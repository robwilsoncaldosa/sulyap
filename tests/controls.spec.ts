import { test, expect, type Page } from '@playwright/test';
import { setDate } from './date-helpers';

async function aligned(page: Page) {
  const segments = await page.locator('.stepper button').evaluateAll(buttons => buttons.map(button => {
    const line = button.querySelector('.step-line')!.getBoundingClientRect();
    const number = button.querySelector('.step-number')!.getBoundingClientRect();
    const content = button.querySelector('.step-content')!.getBoundingClientRect();
    const box = button.getBoundingClientRect();
    return { line: { x: line.x, y: line.y, width: line.width }, number: { x: number.x, y: number.y }, contentY: content.y, width: box.width - parseFloat(getComputedStyle(button).borderLeftWidth) - parseFloat(getComputedStyle(button).borderRightWidth), height: box.height };
  }));
  expect(segments).toHaveLength(4);
  for (const segment of segments) {
    expect(Math.abs(segment.line.y - segments[0].line.y), 'Rules share one baseline').toBeLessThanOrEqual(1);
    expect(Math.abs(segment.line.width - segments[0].line.width), 'Rules have equal width').toBeLessThanOrEqual(1);
    expect(Math.abs(segment.width - segment.line.width), 'Rule spans its step segment').toBeLessThanOrEqual(1);
    expect(Math.abs(segment.number.x - segment.line.x), 'Number begins at the rule edge').toBeLessThanOrEqual(1);
    expect(Math.abs(segment.number.y - segments[0].number.y), 'Numbers align across steps').toBeLessThanOrEqual(1);
    expect(segment.height, 'Step clickable height').toBeGreaterThanOrEqual(44);
  }
}

for (const width of [320, 390, 1280, 1440]) {
  test(`step geometry and gating survive progress and back at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await page.goto('/');
    await aligned(page);
    await expect(page.getByRole('button', { name: '1 Occasion' })).toHaveAttribute('aria-current', 'step');
    await expect(page.getByRole('button', { name: '2 Shortlist' })).toBeDisabled();
    await page.getByRole('button', { name: 'Find dresses' }).click(); await aligned(page);
    await expect(page.getByRole('button', { name: '2 Shortlist' })).toHaveAttribute('aria-current', 'step');
    for (const name of ['Sage wrap', 'Midnight blue']) await page.getByRole('button', { name: `Select ${name}`, exact: true }).click();
    await page.getByRole('button', { name: 'Compare these two' }).click(); await aligned(page);
    await page.getByRole('radio', { name: 'B · Midnight blue', exact: true }).check();
    await page.getByRole('button', { name: 'Prepare inquiry' }).click(); await aligned(page);
    await page.getByRole('button', { name: '1 Occasion' }).click(); await aligned(page);
    await expect(page.getByRole('button', { name: '1 Occasion' })).toHaveAttribute('aria-current', 'step');
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    await expect(page.getByLabel('Total cash available by collection', { exact: true })).toHaveValue('2000');
    await page.getByRole('button', { name: '4 Inquiry' }).click();
    await expect(page.getByLabel('Your inquiry', { exact: true })).toHaveValue(/Preferred dress: Midnight blue/);
  });
}

for (const [width, fontSize] of [[320, 16], [390, 32], [1440, 16]]) {
  test(`inset fields preserve calendar editing, label and error focus at ${width}px/${fontSize}px text`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await page.goto('/');
    if (fontSize !== 16) await page.addStyleTag({ content: `html { font-size: ${fontSize}px !important; }` });
    for (const [id, label] of [['collection', 'Collection date'], ['event', 'Event date'], ['returnDate', 'Return date'], ['budget', 'Total cash available by collection']]) {
      const input = page.getByLabel(label, { exact: true }).and(page.locator('button, input'));
      const surface = page.locator('[data-slot=field][data-appearance=inset]').filter({ has: input });
      await input.focus(); await expect(input).toBeFocused();
      await expect(input).toHaveAttribute('id', id);
      expect(await surface.evaluate(el => el.matches(':focus-within'))).toBe(true);
      const geometry = await surface.evaluate(el => {
        const input = el.querySelector('input, button')!;
        const r = el.getBoundingClientRect(), i = input.getBoundingClientRect();
        return { height:r.height, inputHeight:i.height, width:r.width, inputInside: i.left >= r.left && i.right <= r.right, fits: input.scrollWidth <= input.clientWidth + 1, border: parseFloat(getComputedStyle(el).borderTopWidth), ring: getComputedStyle(el).boxShadow };
      });
      expect(geometry.height).toBeGreaterThanOrEqual(44);
      expect(geometry.inputHeight, "Actual control target height").toBeGreaterThanOrEqual(44);
      expect(geometry.inputInside).toBe(true); expect(geometry.fits).toBe(true);
      expect(geometry.border).toBeGreaterThanOrEqual(1); expect(geometry.ring).not.toBe('none');
      await page.locator(`label[for=${id}]`).click();
      if (id === 'budget') await expect(input).toBeFocused();
      else {
        const calendar = page.getByRole('dialog', { name: label, exact: true });
        await expect(calendar).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(calendar).toBeHidden();
        await expect(input).toBeFocused();
      }
    }
    const collection = page.getByLabel('Collection date', { exact: true }).and(page.locator('button, input'));
    await expect(collection).toHaveJSProperty('tagName', 'BUTTON');
    await expect(page.locator('input[type=date]')).toHaveCount(0);
    await collection.focus(); await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Collection date', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('button:focus')).toHaveAccessibleName(/November 7th, 2026/);
    await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Enter');
    await expect(collection).toHaveText('Nov 6, 2026'); await expect(collection).toBeFocused();
    await setDate(page, 'Collection date', '');
    await page.getByLabel('Total cash available by collection', { exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(collection).toBeFocused(); await expect(collection).toHaveAttribute('aria-invalid', 'true');
    await expect(collection).toHaveAccessibleDescription('Choose a valid collection date.');
    await expect(collection.locator('..')).toHaveAttribute('data-invalid', 'true');
    const destructive = await page.locator('#collection-error').evaluate(el => getComputedStyle(el).color);
    await expect(collection.locator('..')).toHaveCSS('border-top-color', destructive);
    await page.getByRole('button', { name: 'Use sample dates' }).click();
    await expect(collection).toHaveText('Nov 7, 2026'); await expect(collection).toHaveAttribute('aria-invalid', 'false');
  });
}
