import { test, expect, type Page, type Locator } from '@playwright/test';

const qa = 'test-results/qa';
async function capture(page: Page, filename: string, fullPage = true) {
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length)).toBe(0);
  await page.screenshot({ path: `${qa}/${filename}`, fullPage });
}
async function shortlist(page: Page) {
  await page.getByRole('button', { name: 'Find dresses' }).click();
  for (const name of ['Sage wrap', 'Midnight blue']) await page.getByRole('button', { name: `Select ${name}`, exact: true }).click();
}
async function display(image: Locator, id: string) {
  await expect(image).toHaveAttribute('src', `/images/display/${id}-640.webp`);
  await expect(image).toHaveAttribute('srcset', new RegExp(`/images/display/${id}-320.webp 320w.*${id}-960.webp 960w`));
  await expect.poll(() => image.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect(await image.evaluate(el => (el as HTMLImageElement).currentSrc)).toMatch(new RegExp(`/images/display/${id}-(320|640|960)\\.webp$`));
  expect(Number(await image.getAttribute('width'))).toBeGreaterThan(0);
  expect(Number(await image.getAttribute('height'))).toBeGreaterThan(0);
}

test('deferred native callback cannot overwrite latest navigation or restored inputs/preference', async ({ page }) => {
  await page.addInitScript(() => {
    const pending: (() => void)[] = [];
    Object.assign(window, { pending });
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: (update: () => void) => {
      let finish!: () => void;
      const finished = new Promise<void>(resolve => { finish = resolve; });
      pending.push(() => { update(); finish(); });
      return { ready: Promise.resolve(), finished, updateCallbackDone: finished, skipTransition() {} };
    }});
  });
  await page.goto('/');
  await page.getByLabel('Total cash available by collection', { exact: true }).fill('1750');
  await shortlist(page);
  await page.getByRole('button', { name: 'Compare these two' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Find your two');
  // Both are real pointer events in one task, before the browser boundary delivers its queued callback.
  await page.evaluate(() => {
    const steps = document.querySelectorAll<HTMLButtonElement>('.stepper button');
    steps[0].dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    steps[1].dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    (window as unknown as { pending: (() => void)[] }).pending.splice(0).forEach(run => run());
  });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Find your two');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page.getByText('2 of 2 selected')).toBeVisible();
  await page.getByRole('button', { name: 'Compare these two' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Compare your looks');
  await page.getByRole('radio', { name: 'B · Midnight blue', exact: true }).check();
  await page.getByRole('button', { name: 'Prepare inquiry' }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByLabel('Your inquiry', { exact: true })).toHaveValue(/₱1,750/);
  await page.getByRole('button', { name: 'Back to compare' }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('radio', { name: 'B · Midnight blue', exact: true })).toBeChecked();
});

for (const boundary of ['unsupported', 'throws', 'reduced'] as const) {
  test(`${boundary} transition boundary preserves immediate keyboard and pointer outcomes`, async ({ page }) => {
    if (boundary === 'reduced') await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript((boundary) => {
      Object.defineProperty(document, 'startViewTransition', { configurable: true, value: boundary === 'unsupported' ? undefined : () => { throw new Error('native boundary unavailable'); } });
    }, boundary);
    await page.goto('/'); await shortlist(page);
    await page.getByRole('button', { name: 'Compare these two' }).click();
    await expect(page.getByRole('heading', { name: 'Compare your looks' })).toBeFocused();
    await expect(page.locator('html')).toHaveAttribute('data-journey-motion', 'fallback');
    await expect(page.locator('.compare-look .dress-photo').first()).toHaveCSS('view-transition-name', 'none');
    if (boundary === 'reduced') await expect(page.locator('.page-content')).toHaveCSS('animation-name', 'none');
  });
}

test('real native transition carries only selected garment identities and settles focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/');
  expect(await page.evaluate(() => typeof document.startViewTransition)).toBe('function');
  await page.evaluate(() => {
    const native = document.startViewTransition.bind(document);
    Object.assign(window, { nativeTransitions: [] });
    document.startViewTransition = ((update: () => void) => {
      const oldNames = [...document.querySelectorAll('.dress-photo')].map(el => getComputedStyle(el).viewTransitionName).filter(name => name !== 'none');
      const transition = native(update);
      const record = { oldNames, newNames: [] as string[], ready: false, finished: false, failure: '' };
      (window as unknown as { nativeTransitions: typeof record[] }).nativeTransitions.push(record);
      void transition.ready.then(() => { record.ready = true; record.newNames = [...document.querySelectorAll('.dress-photo')].map(el => getComputedStyle(el).viewTransitionName).filter(name => name !== 'none'); }).catch(error => { record.failure = String(error); });
      void transition.finished.then(() => { record.finished = true; });
      return transition;
    }) as typeof document.startViewTransition;
  });
  await shortlist(page);
  await page.getByRole('button', { name: 'Compare these two' }).click();
  await expect(page.getByRole('heading', { name: 'Compare your looks' })).toBeFocused();
  const radio = page.getByRole('radio', { name: 'B · Midnight blue', exact: true });
  const point = await radio.evaluate(el => {
    const box = el.getBoundingClientRect(); const x = box.x + box.width / 2, y = box.y + box.height / 2;
    return { x, y, hit: el.closest('label')!.contains(document.elementFromPoint(x, y)) };
  });
  expect(point.hit, 'Native snapshots allow immediate preference interaction').toBe(true);
  await page.mouse.click(point.x, point.y);
  await expect(radio).toBeChecked();
  await expect.poll(() => page.evaluate(() => (window as unknown as { nativeTransitions: { finished: boolean }[] }).nativeTransitions.at(-1)?.finished)).toBe(true);
  const records = await page.evaluate(() => (window as unknown as { nativeTransitions: unknown[] }).nativeTransitions);
  expect(records.at(-1)).toEqual({ oldNames: ['dress-sage', 'dress-midnight'], newNames: ['dress-sage', 'dress-midnight'], ready: true, finished: true, failure: '' });
});

for (const width of [320, 390, 1440]) {
  test(`all image consumers, compact identity and accessible disclosure targets at ${width}px`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 844 }); await page.goto('/');
    const logo = page.getByRole('link', { name: 'Sulyap, restart sample' }).locator('img');
    await expect(logo).toHaveAttribute('src', '/brand/sulyap-horizontal.svg');
    expect(await logo.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    for (const icon of await page.locator('link[rel="icon"], link[rel="apple-touch-icon"]').all()) {
      const response = await request.get((await icon.getAttribute('href'))!); expect(response.ok()).toBe(true);
      expect(response.headers()['content-type']).toMatch(/image/);
    }
    expect((await page.locator('.site-header').boundingBox())!.height).toBeLessThanOrEqual(80);
    await display(page.locator('.occasion-visual img'), 'sage');
    await capture(page, `${width}-occasion.png`);
    await page.getByLabel('Total cash available by collection', { exact: true }).fill('0');
    await page.getByRole('button', { name: 'Find dresses' }).click();
    await expect(page.getByLabel('Total cash available by collection', { exact: true })).toBeFocused();
    await capture(page, `${width}-error.png`);
    await page.getByRole('button', { name: 'Use sample dates' }).click(); await shortlist(page);
    for (const [name, id] of [['Sage wrap', 'sage'], ['Midnight blue', 'midnight'], ['Dusty rose', 'rose'], ['Emerald evening', 'emerald'], ['Champagne glow', 'champagne'], ['Plum satin', 'plum']]) {
      const card = page.getByRole('article', { name, exact: true });
      await card.scrollIntoViewIfNeeded(); await display(card.locator('img'), id);
      await expect(card.locator('img')).toHaveAttribute('loading', 'lazy');
      expect((await card.getByRole('button', { name: 'Costs & sample terms' }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    for (const [name, id] of [['Sage wrap', 'sage'], ['Midnight blue', 'midnight']]) await display(page.getByRole('button', { name: `Remove ${name}`, exact: true }).locator('img'), id);
    await page.evaluate(() => scrollTo(0, 0)); await capture(page, `${width}-shortlist.png`, width >= 760);
    await page.getByRole('button', { name: 'Compare these two' }).click();
    await expect(page.getByRole('heading', { name: 'Compare your looks' })).toBeFocused();
    for (const [index, id] of ['sage', 'midnight'].entries()) {
      const look = page.locator('.compare-look').nth(index); await display(look.locator('img'), id);
      await expect(look.getByRole('link')).toHaveAttribute('href', `/images/${id}.png`);
      expect((await request.get(`/images/${id}.png`)).ok()).toBe(true);
    }
    if (width < 760) {
      await expect(page.getByRole('radio', { name: 'B · Midnight blue', exact: true })).toBeInViewport({ ratio: 1 });
      expect((await page.locator('.compare-look .dress-photo').first().boundingBox())!.y).toBeLessThan(844);
    }
    await page.getByRole('radio', { name: 'B · Midnight blue', exact: true }).check();
    await page.getByRole('button', { name: 'How personal try-on works' }).click();
    await capture(page, `${width}-compare.png`);
    await page.getByRole('button', { name: 'Prepare inquiry' }).click();
    await display(page.locator('.inquiry-recap img'), 'midnight');
    await capture(page, `${width}-inquiry.png`);
  });
}
