import { test, expect, type Locator } from '@playwright/test';

const qa = 'test-results/qa';
const terms = 'Reservation is credited toward rent. Cleaning included. Security return is conditional on inspection and deductions; refund timing is unconfirmed.';
const costs = [
  ['Sage wrap', '₱100', '₱1,500', '₱400', '₱2,000'],
  ['Midnight blue', '₱50', '₱500', '₱475', '₱1,025'],
  ['Dusty rose', '₱50', '₱500', '₱425', '₱975'],
  ['Emerald evening', '₱100', '₱700', '₱500', '₱1,300'],
  ['Champagne glow', 'Unconfirmed', '₱500', '₱450', 'Unconfirmed'],
  ['Plum satin', '₱100', '₱600', '₱550', '₱1,250'],
];

async function settled(panel: Locator, open: boolean) {
  if (open) await expect.poll(() => panel.evaluate(async el => {
    const differences: number[] = [];
    for (let frame = 0; frame < 4; frame++) {
      await new Promise(requestAnimationFrame);
      differences.push(Math.abs(el.getBoundingClientRect().height - el.firstElementChild!.getBoundingClientRect().height));
    }
    return Math.max(...differences);
  }), { timeout: 1000 }).toBeLessThan(1);
  if (!open) await expect.poll(() => panel.evaluate(el => el.getBoundingClientRect().height), { timeout: 1000 }).toBe(0);
  else {
    const fit = await panel.evaluate(el => {
      const last = el.querySelector('p:last-child')!;
      return last.getBoundingClientRect().bottom <= el.getBoundingClientRect().bottom + 1;
    });
    expect(fit, 'Last line stays inside the expanded panel').toBe(true);
  }
}

for (const [width, fontSize, reducedMotion, colorScheme] of [
  [320, 16, 'no-preference', 'light'],
  [390, 32, 'reduce', 'dark'],
  [1440, 16, 'no-preference', 'dark'],
] as const) {
  test(`real accordion consumers preserve content and interruption at ${width}px/${fontSize}px/${reducedMotion}/${colorScheme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion, colorScheme });
    await page.goto('/');
    if (fontSize !== 16) await page.addStyleTag({ content: `html { font-size: ${fontSize}px !important; }` });
    await page.getByRole('button', { name: 'Find dresses' }).click();
    await expect(page.locator('details, summary')).toHaveCount(0);
    for (const [name, ...values] of costs) {
      const card = page.getByRole('article', { name, exact: true });
      const trigger = card.getByRole('button', { name: 'Costs & sample terms' });
      const panel = card.locator('[data-slot=accordion-content]');
      expect((await trigger.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await trigger.focus(); await page.keyboard.press('Enter');
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await expect(panel).toHaveAttribute('id', (await trigger.getAttribute('aria-controls'))!);
      await expect(panel).toHaveAttribute('aria-labelledby', (await trigger.getAttribute('id'))!);
      await settled(panel, true);
      await expect(panel.locator('dd')).toHaveText(values);
      await expect(panel).toContainText(terms);
      if (name === 'Dusty rose') await expect(panel).toContainText('Sample conflict: Nov 8–10, 2026 (inclusive).');
      await expect(trigger).toBeFocused();
    }
    await expect(page.locator('[data-slot=accordion-trigger][aria-expanded=true]')).toHaveCount(6);
    const card = page.getByRole('article', { name: 'Sage wrap', exact: true });
    const trigger = card.getByRole('button', { name: 'Costs & sample terms' });
    const panel = card.locator('[data-slot=accordion-content]');
    await trigger.focus(); await page.keyboard.press('Space');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false'); await settled(panel, false);
    await expect(page.locator('[data-slot=accordion-trigger][aria-expanded=true]')).toHaveCount(5);
    await page.keyboard.press('Enter'); await settled(panel, true);
    await trigger.scrollIntoViewIfNeeded();
    // Immediate pointer reversal avoids the locator animation stability wait.
    const box = (await trigger.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true'); await settled(panel, true);
    await page.screenshot({ path: `${qa}/${width}-terms.png` });
    for (const name of ['Sage wrap', 'Midnight blue']) await page.getByRole('button', { name: `Select ${name}`, exact: true }).click();
    await page.getByRole('button', { name: 'Compare these two' }).click();
    const explanation = page.getByRole('region', { name: 'Your photo. Two possible looks.' });
    const how = explanation.getByRole('button', { name: 'How personal try-on works' });
    const content = explanation.locator('[data-slot=accordion-content]');
    await how.click(); await settled(content, true);
    await expect(explanation.getByRole('listitem')).toHaveCount(3);
    await how.click(); await expect(content).toHaveAttribute('inert', '');
    await expect(content).toHaveAttribute('aria-hidden', 'true');
    await expect(content.getByRole('listitem')).toHaveCount(0);
    await settled(content, false);
    if (reducedMotion === 'reduce') await expect(explanation.locator('[data-slot=accordion]')).toHaveAttribute('data-instant', 'true');
    await how.click(); await settled(content, true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${qa}/${width}-compare.png` });
  });
}

test('budget typing keeps value, focus, labels and geometry stable', async ({ page }) => {
  await page.goto('/');
  const input = page.getByLabel('Total cash available by collection', { exact: true });
  const label = page.locator('label[for=budget]');
  const before = await label.boundingBox();
  await input.fill(''); await input.pressSequentially('2345.67', { delay: 10 });
  await expect(input).toHaveValue('2345.67'); await expect(input).toBeFocused();
  expect(await label.boundingBox()).toEqual(before);
  await page.getByRole('button', { name: 'Find dresses' }).click();
  await page.getByRole('button', { name: '1 Occasion' }).click();
  await expect(input).toHaveValue('2345.67');
});

test('semantic badges retain readable contrast and pointer motion settles without bounce', async ({ page }) => {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: 'no-preference' });
    await page.goto('/'); await page.getByRole('button', { name: 'Find dresses' }).click();
    const badges = page.locator('[data-slot=badge]');
    await expect(badges.filter({ hasText: 'Over your cash limit' })).toHaveCount(1);
    await expect(badges.filter({ hasText: 'Within your cash limit' })).toHaveCount(4);
    await expect(badges.filter({ hasText: 'Total needs confirmation' })).toHaveCount(1);
    for (const badge of await badges.all()) {
      const contrast = await badge.evaluate(el => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = getComputedStyle(el).color; ctx.fillRect(0, 0, 1, 1);
        const fg = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
        ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 1, 1);
        const chain: Element[] = []; for (let node: Element | null = el; node; node = node.parentElement) chain.unshift(node);
        for (const node of chain) { ctx.fillStyle = getComputedStyle(node).backgroundColor; ctx.fillRect(0, 0, 1, 1); }
        const bg = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
        const lum = (channels: number[]) => channels.map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
        return (Math.max(lum(fg), lum(bg)) + .05) / (Math.min(lum(fg), lum(bg)) + .05);
      });
      expect(contrast, (await badge.textContent())!).toBeGreaterThanOrEqual(4.5);
    }
    const trigger = page.getByRole('article', { name: 'Sage wrap', exact: true }).getByRole('button', { name: 'Costs & sample terms' });
    await trigger.scrollIntoViewIfNeeded();
    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
      await page.emulateMedia({ reducedMotion });
      await expect(trigger.locator('xpath=../../..')).toHaveAttribute('data-instant', String(reducedMotion === 'reduce'));
      await page.mouse.move(0, 0);
      await trigger.evaluate(el => {
        el.removeAttribute('data-qa-samples');
        el.addEventListener('click', async () => {
          const panel = el.closest('[data-slot=accordion-item]')!.querySelector('[data-slot=accordion-content]')!;
          const values: number[] = [];
          const start = performance.now();
          while (performance.now() - start < 400) { await new Promise(requestAnimationFrame); values.push(panel.getBoundingClientRect().height); }
          el.setAttribute('data-qa-samples', JSON.stringify({ values, full: panel.firstElementChild!.getBoundingClientRect().height, instant: el.closest('[data-slot=accordion]')!.getAttribute('data-instant'), duration: getComputedStyle(panel).getPropertyValue('--motion-journey') }));
        }, { once: true });
      });
      await trigger.click();
      await expect(trigger).toHaveAttribute('data-qa-samples', /values/);
      const samples = JSON.parse((await trigger.getAttribute('data-qa-samples'))!) as { values: number[]; full: number; instant: string; duration: string };
      console.log(JSON.stringify({ colorScheme, reducedMotion, samples }));
      for (let i = 1; i < samples.values.length; i++) expect(samples.values[i]).toBeGreaterThanOrEqual(samples.values[i - 1] - .5);
      expect(Math.abs(samples.values.at(-1)! - samples.full)).toBeLessThan(1);
      if (reducedMotion === 'reduce') expect(samples.values.every(height => height < 1 || Math.abs(height - samples.full) < 1), 'Reduced motion never interpolates spatial height').toBe(true);
      else expect(samples.values.some(height => height > 0 && height < samples.full - 1), 'Ordinary opening has spatial transition').toBe(true);
      await trigger.click();
      await settled(trigger.locator('xpath=../..').locator('[data-slot=accordion-content]'), false);
    }
  }
});
