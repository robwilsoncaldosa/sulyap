import { test, expect, type Page, type Route } from '@playwright/test';

// The provider is mocked at Sulyap's own API boundary, so these checks never spend YouCam units.
// The stand-in "results" are local sample images; real output is verified separately with a key.
type Mock = { uploads: number; creates: string[]; polls: number; fail?: Record<string, string> };

async function mockTryOn(page: Page, mock: Mock) {
  await page.route('**/api/try-on/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const reply = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/try-on/config') return reply({ configured: true, provider: 'YouCam AI Clothes V4' });
    if (url.pathname === '/api/try-on/photo') {
      expect(request.headers()['content-type']).toBe('image/jpeg');
      mock.uploads += 1;
      return reply({ photoId: `file_test_${mock.uploads}` });
    }
    if (url.pathname === '/api/try-on/looks' && request.method() === 'POST') {
      const { photoId, garmentId } = request.postDataJSON();
      expect(photoId).toMatch(/^file_test_/);
      mock.creates.push(garmentId);
      return reply({ taskId: `task_${garmentId}_${mock.creates.length}` });
    }
    if (url.pathname === '/api/try-on/looks') {
      mock.polls += 1;
      const task = url.searchParams.get('task')!;
      const garment = task.split('_')[1];
      if (mock.fail?.[garment]) return reply({ status: 'error', error: { code: 'error_pose', message: mock.fail[garment] } });
      return reply({ status: 'success', imageUrl: `/images/display/${garment === 'sage' ? 'emerald' : 'plum'}-640.webp?task=${task}` });
    }
    return reply({ error: { code: 'not_found', message: 'Not found.' } }, 404);
  });
}

async function openCompare(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Find dresses' }).click();
  for (const name of ['Sage wrap', 'Midnight blue']) await page.getByRole('button', { name: `Select ${name}`, exact: true }).click();
  await page.getByRole('button', { name: 'Compare these two' }).click();
  return page.getByRole('region', { name: 'Your photo. Two possible looks.' });
}

const photo = 'public/images/rose.png';

for (const width of [390, 1280]) {
  test(`consent, one upload and two YouCam looks beside originals at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const mock: Mock = { uploads: 0, creates: [], polls: 0 };
    await mockTryOn(page, mock);
    const panel = await openCompare(page);
    await expect(page.getByText('Fictional collection · Personal try-on by YouCam AI.')).toBeVisible();
    await expect(panel).toContainText('YouCam AI Clothes');
    const table = await page.getByRole('table').innerText();
    const file = panel.getByLabel('Your photo');
    const create = panel.getByRole('button', { name: 'Create my two looks' });
    await expect(file).toBeDisabled();
    await expect(create).toBeDisabled();
    await panel.getByRole('checkbox').check();
    await file.setInputFiles(photo);
    await expect(panel.getByRole('img', { name: 'Your photo for the try-on' })).toBeVisible();
    expect(mock.uploads).toBe(0); // nothing leaves the browser before an explicit request
    await create.click();
    await expect(panel.getByRole('button', { name: 'Both looks are ready' })).toBeDisabled({ timeout: 10000 });
    expect(mock.uploads).toBe(1);
    expect(mock.creates.sort()).toEqual(['midnight', 'sage']);
    for (const name of ['sage wrap', 'midnight blue']) {
      await expect(page.getByRole('img', { name: `YouCam AI preview of you wearing the ${name} dress` })).toBeVisible();
      await expect(page.getByRole('img', { name: `Original ${name} reference` })).toBeVisible();
    }
    await expect(page.locator('.compare-look .image-label')).toHaveText(['YouCam AI preview', 'YouCam AI preview']);
    await expect(page.getByRole('link', { name: /Open full-size preview/ })).toHaveCount(2);
    expect(await page.getByRole('table').innerText()).toBe(table);
    await expect(page.locator('.policy-note')).toContainText('AI-generated from your photo');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/try-on-${width}.png`, fullPage: true });

    // Back and forth keeps results; no new uploads or billable tasks.
    await page.getByRole('button', { name: 'Back to shortlist' }).click();
    await page.getByRole('button', { name: 'Compare these two' }).click();
    await expect(page.getByRole('img', { name: 'YouCam AI preview of you wearing the sage wrap dress' })).toBeVisible();
    expect(mock.uploads).toBe(1);
    expect(mock.creates).toHaveLength(2);

    // The inquiry never carries the photo or preview link.
    await page.getByRole('radio', { name: 'B · Midnight blue', exact: true }).check();
    await page.getByRole('button', { name: 'Prepare inquiry' }).click();
    const inquiry = await page.getByRole('textbox').inputValue();
    expect(inquiry).not.toMatch(/blob:|task_|file_test_|https?:\/\/|\.webp|\.jpe?g/i);
    expect(inquiry).toContain('Any AI try-on preview is not a size or fit check.');
  });
}

test('a failed look explains itself and retries only that dress; removing the photo clears previews', async ({ page }) => {
  const mock: Mock = { uploads: 0, creates: [], polls: 0, fail: { midnight: 'YouCam couldn’t find a standing pose. Use a full-length photo.' } };
  await mockTryOn(page, mock);
  const panel = await openCompare(page);
  await panel.getByRole('checkbox').check();
  await panel.getByLabel('Your photo').setInputFiles(photo);
  await panel.getByRole('button', { name: 'Create my two looks' }).click();
  const status = panel.locator('.look-status');
  await expect(status).toContainText('couldn’t find a standing pose', { timeout: 10000 });
  await expect(status.locator('li[data-status=success]')).toContainText('Sage wrap');
  await expect(page.getByRole('img', { name: 'YouCam AI preview of you wearing the sage wrap dress' })).toBeVisible();
  await expect(page.locator('.compare-look').nth(1).locator('.image-label')).toHaveText('Illustrative image');
  await expect(panel.getByRole('button', { name: 'Finish my looks' })).toBeEnabled();
  delete mock.fail!.midnight;
  await panel.getByRole('button', { name: 'Try again for Midnight blue' }).click();
  await expect(page.getByRole('img', { name: 'YouCam AI preview of you wearing the midnight blue dress' })).toBeVisible({ timeout: 10000 });
  expect(mock.creates).toEqual(expect.arrayContaining(['sage', 'midnight', 'midnight']));
  expect(mock.creates).toHaveLength(3);
  expect(mock.uploads).toBe(1);
  await panel.getByRole('button', { name: 'Remove my photo' }).click();
  await expect(page.locator('.compare-look .image-label')).toHaveText(['Illustrative image', 'Illustrative image']);
  await expect(panel.getByRole('img', { name: 'Your photo for the try-on' })).toHaveCount(0);
  await panel.getByRole('checkbox').uncheck();
  await expect(panel.getByLabel('Your photo')).toBeDisabled();
});

test('server errors on photo upload are shown in text without creating looks', async ({ page }) => {
  await page.route('**/api/try-on/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/try-on/config') return route.fulfill({ json: { configured: true, provider: 'YouCam AI Clothes V4' } });
    if (path === '/api/try-on/photo') return route.fulfill({ status: 503, json: { error: { code: 'provider_credits', message: 'This demo has used its YouCam preview credits for now.' } } });
    throw new Error(`unexpected ${path}`);
  });
  const panel = await openCompare(page);
  await panel.getByRole('checkbox').check();
  await panel.getByLabel('Your photo').setInputFiles(photo);
  await panel.getByRole('button', { name: 'Create my two looks' }).click();
  await expect(panel.locator('.look-status li[data-status=error]')).toHaveCount(2);
  await expect(panel.locator('.look-status')).toContainText('used its YouCam preview credits');
});
