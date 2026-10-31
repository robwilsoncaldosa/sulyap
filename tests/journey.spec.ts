import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { setDate } from './date-helpers';

const card = (page: Page, name: string) => page.getByRole('article', { name, exact: true });
const find = (page: Page) => page.getByRole('button', { name: 'Find dresses' }).click();
async function choose(page: Page, first = 'Sage wrap', second = 'Midnight blue') {
  await card(page, first).getByRole('button', { name: `Select ${first}`, exact: true }).click();
  await card(page, second).getByRole('button', { name: `Select ${second}`, exact: true }).click();
  await page.getByRole('button', { name: 'Compare these two' }).click();
}
async function inquiry(page: Page, preferred = 'B · Midnight blue') {
  await page.getByRole('radio', { name: preferred, exact: true }).check();
  await page.getByRole('button', { name: 'Prepare inquiry' }).click();
}
async function verifyDownload(page: Page, expected: string) {
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save text' }).click();
  expect(await readFile((await (await event).path())!, 'utf8')).toBe(expected);
}
async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const button of await page.locator('button, td, th').all()) {
    const box = await button.boundingBox();
    if (box) expect(box.x >= -1 && box.x + box.width <= (await page.viewportSize())!.width + 1).toBe(true);
  }
}
for (const width of [390, 1440]) {
  test(`current payments, keyboard, clipboard and download at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 });
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const external: string[] = [], errors: string[] = [];
    page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:5173') && !request.url().startsWith('blob:')) external.push(request.url()); });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/');
    await expect(page.getByText('Sample dresses. Real decisions.')).toBeVisible();
    await expect(page.locator('input[type=file]')).toHaveCount(0);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Sulyap, restart sample' })).toBeFocused();
    expect(await page.locator(':focus').evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
    await fits(page);
    await page.getByLabel('Total cash available by collection').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    await expect(page.getByRole('article')).toHaveCount(6);
    await expect(page.getByRole('button', { name: 'Compare these two' })).toBeDisabled();
    await expect(card(page, 'Dusty rose').getByRole('button').and(page.locator('[aria-pressed]'))).toBeDisabled();
    await expect(card(page, 'Sage wrap')).toContainText('₱2,400 total cash');
    await expect(card(page, 'Midnight blue')).toContainText('₱1,500 total cash');
    await fits(page);
    await card(page, 'Sage wrap').getByRole('button').and(page.locator('[aria-pressed]')).focus(); await page.keyboard.press('Space');
    await expect(page.getByText('1 of 2 selected')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Compare these two' })).toBeDisabled();
    await card(page, 'Midnight blue').getByRole('button').and(page.locator('[aria-pressed]')).click();
    await expect(card(page, 'Plum satin').getByRole('button').and(page.locator('[aria-pressed]'))).toBeDisabled();
    await page.getByRole('button', { name: 'Compare these two' }).click();
    await expect(page.getByRole('button', { name: 'Prepare inquiry' })).toBeDisabled();
    for (const [row, amounts] of [['Rental charge',['₱800','₱950']], ['Mandatory fee',['₱100','₱50']], ['Security deposit',['₱1,500','₱500']], ['At reservation',['₱400','₱475']], ['Remaining by collection',['₱2,000','₱1,025']], ['Total cash through collection',['₱2,400','₱1,500']]] as const) {
      const tr = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: row, exact: true }) });
      await expect(tr.getByRole('cell')).toHaveText([...amounts]);
    }
    await fits(page);
    await page.getByRole('radio', { name: 'A · Sage wrap', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'B · Midnight blue', exact: true })).toBeChecked();
    await page.getByRole('button', { name: 'Prepare inquiry' }).click();
    const text = await page.getByLabel('Your inquiry', { exact: true }).inputValue();
    for (const value of ['AMI-02','Nov 7, 2026','Nov 8, 2026','Nov 9, 2026','At reservation (50% of rent, credited toward rent): ₱475','Remaining by collection (remaining rent + fees + security): ₱1,025','Total cash through collection: ₱1,500','physical fitting','availability','by 6 PM','refund timing','not a booking']) expect(text).toContain(value);
    await page.getByRole('button', { name: 'Copy inquiry' }).click();
    await expect(page.getByRole('status')).toContainText('Copied.');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(text);
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save text' }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe('sulyap-sample-inquiry.txt');
    expect(text).toMatch(/^Sulyap · Sample inquiry/);
    expect(await readFile((await download.path())!, 'utf8')).toBe(text);
    await fits(page);
    expect(external).toEqual([]); expect(errors).toEqual([]);
  });
}

test('validation rejects unsupported dates and amounts, associates and focuses errors', async ({ page }) => {
  await page.goto('/');
  for (const [label, value, error] of [['Return date','2026-11-10','up to 3 inclusive'], ['Return date','2026-11-06','on or after collection'], ['Event date','2026-11-10','event must fall between'], ['Total cash available by collection','1.001','positive PHP amount']] ) {
    await page.getByRole('button', { name: 'Use sample dates' }).click();
    if (label.endsWith('date')) await setDate(page, label, value);
    else await page.getByLabel(label, { exact: true }).and(page.locator('button, input')).fill(value);
    await find(page);
    const input = page.getByLabel(label, { exact: true }).and(page.locator('button, input'));
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('[aria-invalid="true"]').first()).toBeFocused();
    await expect(page.locator('.field-error').filter({ hasText: error })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Start with your occasion' })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Use sample dates' }).click();
  await setDate(page, 'Collection date', ''); await find(page);
  await expect(page.getByLabel('Collection date', { exact: true }).and(page.locator('button, input'))).toHaveAccessibleDescription('Choose a valid collection date.');
});

test('later edits recompute all consumers and date conflicts remove stale preference', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await setDate(page, 'Collection date', '2026-11-05');
  await setDate(page, 'Event date', '2026-11-06');
  await setDate(page, 'Return date', '2026-11-07');
  await find(page); await choose(page, 'Dusty rose', 'Midnight blue'); await inquiry(page, 'A · Dusty rose');
  await expect(page.getByLabel('Your inquiry', { exact: true })).toHaveValue(/AMI-03/);
  await page.getByRole('button', { name: 'Edit occasion' }).click();
  await page.getByRole('button', { name: 'Use sample dates' }).click();
  await expect(page.getByRole('status')).toContainText('conflicts with your dates and was removed');
  await find(page);
  await expect(page.getByText('1 of 2 selected')).toBeVisible();
  await expect(card(page, 'Midnight blue').getByRole('button').and(page.locator('[aria-pressed]'))).toHaveAttribute('aria-pressed','true');
  await expect(card(page, 'Dusty rose').getByRole('button').and(page.locator('[aria-pressed]'))).toBeDisabled();
  await expect(page.getByRole('button', { name: '4 Inquiry' })).toBeDisabled();
  await card(page, 'Sage wrap').getByRole('button').and(page.locator('[aria-pressed]')).click();
  await page.getByRole('button', { name: 'Compare these two' }).click();
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
  await inquiry(page, 'A · Midnight blue');
  await page.getByRole('button', { name: 'Edit occasion' }).click();
  await page.getByLabel('Total cash available by collection').fill('1000');
  await find(page);
  await expect(card(page, 'Midnight blue')).toContainText('Over your cash limit');
  await page.getByRole('button', { name: 'Compare these two' }).click();
  await expect(page.getByText('Over your cash limit', { exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'Prepare inquiry' }).click();
  await expect(page.getByLabel('Your inquiry', { exact: true })).toHaveValue(/My total-cash limit by collection: ₱1,000/);
  await expect(page.getByLabel('Your inquiry', { exact: true })).toHaveValue(/Budget status: Over your cash limit/);
  const changedText = await page.getByLabel('Your inquiry', { exact: true }).inputValue();
  expect(changedText).toContain('Nov 9, 2026');
  expect(changedText).not.toContain('AMI-03');
  await page.getByRole('button', { name: 'Copy inquiry' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(changedText);
  await verifyDownload(page, changedText);
  await page.getByRole('button', { name: 'Back to compare' }).click();
  await expect(page.getByRole('radio', { name: 'A · Midnight blue', exact: true })).toBeChecked();
});

test('unknowns remain selectable and copied fallback selects exact warning-bearing text', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('denied'); } } }));
  await page.goto('/'); await find(page);
  await expect(card(page, 'Champagne glow')).toContainText('₱1,400 known subtotal');
  await expect(card(page, 'Champagne glow')).toContainText('Total needs confirmation');
  await expect(card(page, 'Emerald evening')).toContainText('Dates need confirmation');
  await choose(page, 'Champagne glow', 'Emerald evening'); await inquiry(page, 'A · Champagne glow');
  const area = page.getByLabel('Your inquiry', { exact: true });
  const text = await area.inputValue();
  expect(text).toContain('Unknown charges: mandatory fee'); expect(text).toContain('known subtotal ₱1,400'); expect(text).toContain('Total needs confirmation');
  expect(text).not.toContain('Within your cash limit');
  await verifyDownload(page, text);
  await page.getByRole('button', { name: 'Copy inquiry' }).click();
  await expect(page.getByRole('status')).toContainText('Clipboard unavailable'); await expect(area).toBeFocused();
  expect(await area.evaluate(el => el instanceof HTMLTextAreaElement && el.selectionStart === 0 && el.selectionEnd === el.value.length)).toBe(true);
  await page.getByRole('button', { name: 'Back to compare' }).click(); await inquiry(page, 'B · Emerald evening');
  await expect(area).toHaveValue(/Date status: Dates need confirmation/);
});


test('missing security and fee preserve centavo math, known subtotal and confirmation', async () => {
  const { evaluateDress, createInquiry, sampleOccasion } = await import('../src/domain/rental');
  const { catalog } = await import('../src/data/catalog');
  for (const missing of [{ security: null }, { fee: null }, { fee: null, security: null }]) {
    const dress = { ...catalog[1], ...missing };
    const quote = evaluateDress(dress, sampleOccasion);
    expect(quote.total).toBeNull(); expect(quote.remaining).toBeNull(); expect(quote.budgetStatus).toBe('unknown');
    expect(quote.knownSubtotal).toBe(dress.rent + (dress.fee ?? 0) + (dress.security ?? 0));
    const text = createInquiry(dress, sampleOccasion);
    expect(text).toContain('needs confirmation; known subtotal');
    expect(text).toContain('Unknown charges:'); expect(text).not.toContain('Within your cash limit');
  }
  const dress = { ...catalog[1], rent: 95101, fee: 5001, security: 50001 };
  const quote = evaluateDress(dress, sampleOccasion);
  expect(quote.total).toBe(150103); expect(quote.reservation + quote.remaining!).toBe(150103);
});


for (const width of [390, 320]) {
  test(`persistent mobile tray supports replacement and clear controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await expect(page.locator('.next-action')).toHaveCount(0);
    await find(page);
    const tray = page.locator('.next-action');
    const assertTray = async () => {
      const box = (await tray.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(845);
      expect(await tray.evaluate(el => getComputedStyle(el).position)).toBe('fixed');
      await expect(tray.getByRole('button', { name: 'Compare these two' })).toBeInViewport();
    };
    await page.evaluate(() => scrollTo(0, 0)); await assertTray();
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight / 2)); await assertTray();
    await card(page, 'Sage wrap').getByRole('button').and(page.locator('[aria-pressed]')).click();
    await card(page, 'Midnight blue').getByRole('button').and(page.locator('[aria-pressed]')).click();
    await expect(tray.getByRole('button', { name: 'Remove Sage wrap', exact: true })).toBeVisible();
    await expect(tray.getByRole('button', { name: 'Remove Midnight blue', exact: true })).toBeVisible();
    await tray.getByRole('button', { name: 'Remove Sage wrap', exact: true }).click();
    await expect(tray.getByRole('button', { name: 'Compare these two' })).toBeDisabled();
    await expect(card(page, 'Midnight blue').getByRole('button').and(page.locator('[aria-pressed]'))).toHaveAttribute('aria-pressed', 'true');
    const replacement = card(page, 'Plum satin').getByRole('button').and(page.locator('[aria-pressed]'));
    await replacement.evaluate(el => el.scrollIntoView({ block: 'center' }));
    expect(await replacement.evaluate(el => { const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!hit && el.contains(hit); })).toBe(true);
    await replacement.click();
    await page.evaluate(() => scrollTo(0, 0)); await assertTray();
    await tray.getByRole('button', { name: 'Compare these two' }).click();
    await expect(page.getByRole('radio')).toHaveCount(2);
    await expect(page.getByRole('radio', { name: 'B · Plum satin', exact: true })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'A · Sage wrap', exact: true })).toHaveCount(0);
    await page.getByRole('radio', { name: 'B · Plum satin', exact: true }).check();
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight / 2));
    await expect(tray.getByText('Preferred: Plum satin')).toBeInViewport();
    await expect(tray.getByRole('button', { name: 'Prepare inquiry' })).toBeInViewport();
    await fits(page);
    await tray.getByRole('button', { name: 'Prepare inquiry' }).click();
    await expect(page.locator('.next-action')).toHaveCount(0);
    await expect(page.getByLabel('Your inquiry', { exact: true })).toHaveValue(/Preferred dress: Plum satin \(AMI-06\)/);
    const text = await page.getByLabel('Your inquiry', { exact: true }).inputValue();
    expect(text).not.toContain('AMI-01');
    await verifyDownload(page, text);
  });
}
