import { test, expect } from '@playwright/test';

for (const [width, fontSize] of [[390, 16], [1440, 16], [390, 32]] as const) {
  test(`brand and planned try-on disclosure remain honest and operable at ${width}px/${fontSize}px text`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const external: string[] = [];
    page.on('request', request => {
      if (!request.url().startsWith('http://127.0.0.1:5173')) external.push(request.url());
    });
    await page.goto('/');
    if (fontSize === 32) await page.addStyleTag({ content: 'html { font-size: 32px !important; }' });
    await expect(page).toHaveTitle(/Sulyap/);
    await expect(page.getByRole('link', { name: 'Sulyap, restart sample' })).toBeVisible();
    await expect(page.locator('footer')).toContainText('Sulyap');
    await page.getByRole('button', { name: 'Find dresses' }).click();
    for (const name of ['Sage wrap', 'Midnight blue']) await page.getByRole('button', { name: `Select ${name}`, exact: true }).click();
    await page.getByRole('button', { name: 'Compare these two' }).click();
    const explanation = page.getByRole('region', { name: 'Your photo. Two possible looks.' });
    const summary = explanation.getByRole('button', { name: 'How personal try-on works' });
    await expect(explanation).toContainText('YouCam · not connected');
    await expect(explanation).toContainText('images above show sample models');
    await expect(explanation).toContainText('isn’t configured on this server');
    await expect(summary).toHaveAttribute('aria-expanded', 'false');
    await summary.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(summary).toBeFocused();
    expect(await summary.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
    await page.keyboard.press('Enter');
    await expect(summary).toHaveAttribute('aria-expanded', 'true');
    await expect(explanation.getByRole('listitem')).toHaveCount(3);
    for (const text of ['agree to share it', 'same photo is paired with each dress', 'doesn’t save your photo', 'deleted automatically after 30 days', 'never includes your photo', 'will not confirm size, physical fit or availability']) await expect(explanation).toContainText(text);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const target of [summary, explanation, page.getByRole('table')]) {
      const box = (await target.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    }
    await page.getByRole('radio', { name: 'B · Midnight blue', exact: true }).check();
    await expect(page.getByRole('button', { name: 'Prepare inquiry' })).toBeEnabled();
    await summary.focus(); await page.keyboard.press('Space');
    await expect(summary).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Enter');
    await expect(summary).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('radio', { name: 'B · Midnight blue', exact: true })).toBeChecked();
    await expect(page.locator('input[type=file]')).toHaveCount(0);
    expect(external).toEqual([]);
  });
}
