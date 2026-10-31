import { test, expect, type Locator } from '@playwright/test';

test('selected thumbnails retain dress identity and accessible removal through replacement and inquiry', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Find dresses' }).click();
  for (const name of ['Sage wrap', 'Midnight blue']) await page.getByRole('button', { name: `Select ${name}`, exact: true }).click();
  const tray = page.locator('.selection-controls');
  for (const [name, image] of [['Sage wrap', '/images/display/sage-640.webp'], ['Midnight blue', '/images/display/midnight-640.webp']]) {
    const remove = tray.getByRole('button', { name: `Remove ${name}`, exact: true });
    await expect(remove).toHaveAccessibleName(`Remove ${name}`);
    await expect(remove.locator('img')).toHaveAttribute('src', image);
    await expect(remove.locator('img')).toHaveAttribute('alt', '');
    expect(await remove.locator('img').evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  await tray.getByRole('button', { name: 'Remove Sage wrap', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(tray.locator('img')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Compare these two' })).toBeDisabled();
  await page.getByRole('button', { name: 'Select Plum satin', exact: true }).click();
  await expect(tray.getByRole('button', { name: 'Remove Plum satin', exact: true }).locator('img')).toHaveAttribute('src', '/images/display/plum-640.webp');
  await expect(tray.locator('img')).toHaveCount(2);
  await page.getByRole('button', { name: 'Compare these two' }).click();
  await page.getByRole('radio', { name: 'B · Plum satin', exact: true }).check();
  await page.getByRole('button', { name: 'Prepare inquiry' }).click();
  await expect(page.getByLabel('Your inquiry', { exact: true })).toHaveValue(/Preferred dress: Plum satin \(AMI-06\)/);
  await expect(page.getByLabel('Your inquiry', { exact: true })).not.toHaveValue(/AMI-01/);
});

for (const reducedMotion of ['reduce', 'no-preference'] as const) {
  test(`selection and primary arrow feedback respect ${reducedMotion} motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto('/');
    const primary = page.getByRole('button', { name: 'Find dresses' });
    const arrow = primary.locator('[data-icon="inline-end"]');
    await primary.focus();
    if (reducedMotion === 'reduce') {
      await expect(arrow).toHaveCSS('transform', 'none');
      await expect(arrow).toHaveCSS('transition-duration', '0s');
    } else {
      await expect(arrow).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 2, 0)');
    }
    await page.keyboard.press('Enter');
    const selected = page.getByRole('article', { name: 'Sage wrap', exact: true });
    await selected.getByRole('button', { name: 'Select Sage wrap', exact: true }).click();
    await expect(selected.getByRole('button').and(page.locator('[aria-pressed]'))).toHaveAttribute('aria-pressed', 'true');
    await expect(selected.locator('.photo-selection')).toHaveText('Selected');
    const check = selected.locator('.photo-selection svg path');
    if (reducedMotion === 'reduce') {
      await expect(check).toHaveCSS('animation-name', 'none');
      await expect(check).toHaveCSS('stroke-dashoffset', '0px');
    } else {
      await expect(check).toHaveCSS('animation-name', 'selection-check');
      await expect(check).toHaveCSS('animation-duration', '0.22s');
      await expect(check).toHaveCSS('animation-iteration-count', '1');
      await expect.poll(() => check.evaluate(el => el.getAnimations().filter(a => a.playState === 'running').length)).toBe(0);
      await expect(check).toHaveCSS('stroke-dashoffset', '0px');
    }
  });
}

async function contrast(locator: Locator) {
  return locator.evaluate(el => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    const rgb = (value: string) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
    const foreground = rgb(getComputedStyle(el).color);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 1, 1);
    const chain: Element[] = []; for (let e: Element | null = el; e; e = e.parentElement) chain.unshift(e);
    for (const e of chain) { ctx.fillStyle = getComputedStyle(e).backgroundColor; ctx.fillRect(0, 0, 1, 1); }
    const background = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
    const luminance = (channels: number[]) => channels.map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
    const a = luminance(foreground), b = luminance(background);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  });
}

test('new editorial accent remains readable under both OS themes', async ({ page }) => {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    expect(await contrast(page.locator('.form-heading h1 em'))).toBeGreaterThanOrEqual(3);
    expect(await contrast(page.locator('.occasion-visual figcaption em'))).toBeGreaterThanOrEqual(4.5);
    expect(await contrast(page.locator('.form-heading p'))).toBeGreaterThanOrEqual(4.5);
    const primary = page.getByRole('button', { name: 'Find dresses' });
    const original = await primary.evaluate(el => getComputedStyle(el).backgroundColor);
    await primary.hover();
    await expect.poll(() => primary.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(original);
    expect(await contrast(primary)).toBeGreaterThanOrEqual(4.5);
  }
});
