import { test, expect, type Page, type Locator } from '@playwright/test';

async function contained(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const control of await page.locator('input, button, textarea, th, td').all()) {
    if (!(await control.isVisible())) continue;
    const box = (await control.boundingBox())!;
    expect(box.x, await control.textContent() ?? '').toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual((await page.viewportSize())!.width + 1);
  }
}

async function disclosure(page: Page) {
  await expect(page.getByText('Demo shop.')).toBeVisible();
  await expect(page.getByText('Example prices, dates and AI-created photos · Try-on not connected')).toBeVisible();
}

for (const [width, fontSize] of [[768, 16], [390, 32]] as const) {
  test(`four steps retain reachable controls and disclosures at ${width}px with ${fontSize}px root text`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    if (fontSize !== 16) await page.addStyleTag({ content: `html { font-size: ${fontSize}px !important; }` });
    await disclosure(page); await contained(page);
    for (const label of ['Collection date', 'Event date', 'Return date', 'Total cash available by collection']) {
      const input = page.getByLabel(label, { exact: true }).and(page.locator('button, input'));
      await input.scrollIntoViewIfNeeded();
      await expect(input).toBeInViewport();
      expect(await input.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x+r.width/2, r.y+r.height/2)); })).toBe(true);
    }
    await page.getByRole('button', { name: 'Find dresses' }).click();
    await disclosure(page); await contained(page);
    for (const name of ['Sage wrap', 'Midnight blue']) await page.getByRole('button', { name: `Select ${name}`, exact: true }).click();
    await page.getByRole('button', { name: 'Compare these two' }).click();
    await disclosure(page); await contained(page);
    const total = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Total cash through collection', exact: true }) });
    await expect(total.getByRole('cell')).toHaveText(['₱2,400', '₱1,500']);
    await page.getByRole('radio', { name: 'B · Midnight blue', exact: true }).check();
    await page.getByRole('button', { name: 'Prepare inquiry' }).click();
    await disclosure(page); await contained(page);
    await expect(page.getByLabel('Your inquiry', { exact: true })).toHaveValue(/Total cash through collection: ₱1,500/);
  });
}

function contrast(a: string, b: string) {
  const luminance = (s: string) => {
    const [r,g,b] = s.match(/[\d.]+/g)!.slice(0,3).map(Number).map(n => n/255).map(n => n <= .04045 ? n/12.92 : ((n+.055)/1.055)**2.4);
    return .2126*r + .7152*g + .0722*b;
  };
  const x=luminance(a), y=luminance(b);
  return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}

test('normal control contrast, focus and reduced-motion feedback remain accessible', async ({ page }) => {
  await page.goto('/');
  const colors = async (locator: Locator) => locator.evaluate(el => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d')!;
    const rgb = (value: string) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1); return `rgb(${[...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).join(',')})`; };
    let parent: Element | null = el, background = 'rgb(255, 255, 255)';
    while (parent) { const value = getComputedStyle(parent).backgroundColor; if (value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') { background = value; break; } parent = parent.parentElement; }
    const style = getComputedStyle(el);
    return { color: rgb(style.color), background: rgb(background), border: rgb(style.borderTopColor), outline: rgb(style.outlineColor) };
  });
  const primary = page.getByRole('button', { name: 'Find dresses' });
  const label = page.locator('label[for="collection"]');
  const input = page.getByLabel('Collection date', { exact: true }).and(page.locator('button, input'));
  const money = page.locator('[data-slot=field][data-appearance=inset]').filter({ has: page.getByLabel('Total cash available by collection', { exact: true }) });
  const dateSurface = input.locator('..');
  const styles = { primary: await colors(primary), label: await colors(label), input: await colors(input), dateSurface: await colors(dateSurface), money: await colors(money) };
  expect(contrast(styles.primary.color, styles.primary.background)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(styles.label.color, styles.label.background)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(styles.input.color, styles.input.background), 'Date input text').toBeGreaterThanOrEqual(4.5);
  expect(contrast(styles.dateSurface.border, styles.dateSurface.background), 'Date visible field boundary').toBeGreaterThanOrEqual(3);
  expect(contrast(styles.money.border, styles.money.background), 'Budget input boundary').toBeGreaterThanOrEqual(3);
  await page.keyboard.press('Tab');
  const focus = await page.locator(':focus').evaluate(el => { const s = getComputedStyle(el); return { color:s.outlineColor, width:s.outlineWidth, style:s.outlineStyle }; });
  expect(focus.style).not.toBe('none'); expect(parseFloat(focus.width)).toBeGreaterThanOrEqual(2);
  expect(contrast((await colors(page.locator(':focus'))).outline, (await colors(page.locator(':focus'))).background)).toBeGreaterThanOrEqual(3);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await primary.evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
  await page.getByRole('button', { name: 'Find dresses' }).click();
  const disabled = page.getByRole('button', { name: 'Compare these two' });
  await expect(disabled).toBeDisabled();
  const before = await disabled.evaluate(el => getComputedStyle(el).transform);
  const box = (await disabled.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  expect(await disabled.evaluate(el => getComputedStyle(el).transform)).toBe(before);
  await page.mouse.up();
});

for (const [width, height] of [[1280, 720], [1440, 900]] as const) {
  test(`Find dresses is visible without scroll at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await page.goto('/');
    await expect(page.getByRole('button', { name: 'Find dresses' })).toBeInViewport({ ratio: 1 });
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  });
}

test('print uses the current selected inquiry', async ({ page }) => {
  await page.addInitScript(() => { window.print = () => { document.documentElement.dataset.printed = 'true'; }; });
  await page.goto('/'); await page.getByRole('button', { name: 'Find dresses' }).click();
  for (const name of ['Sage wrap', 'Midnight blue']) await page.getByRole('button', { name: `Select ${name}`, exact: true }).click();
  await page.getByRole('button', { name: 'Compare these two' }).click();
  await page.getByRole('radio', { name: 'B · Midnight blue', exact: true }).check();
  await page.getByRole('button', { name: 'Prepare inquiry' }).click();
  const current = await page.getByLabel('Your inquiry', { exact: true }).inputValue();
  await page.getByRole('button', { name: 'Print summary' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-printed', 'true');
  await page.emulateMedia({ media: 'print' });
  const summary = page.locator('.print-summary');
  await expect(summary).toBeVisible(); await expect(summary).toHaveText(current);
  await expect(page.getByRole('link', { name: 'Sulyap, start over' })).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Rental journey' })).toBeHidden();
  for (const name of ['Copy inquiry', 'Save text', 'Print summary']) await expect(page.getByRole('button', { name })).toBeHidden();
  await expect(page.getByLabel('Your inquiry', { exact: true })).toBeHidden();
  await expect(page.getByText('Review the current dates, costs and questions below.', { exact: false })).toBeHidden();
});

for (const width of [320, 390]) {
  test(`mobile first view exposes shortlist photography and preferred controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Find dresses' }).click();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    const image = page.getByRole('article', { name: 'Sage wrap', exact: true }).getByRole('img');
    const visibleImage = await image.evaluate(el => {
      const image = el.getBoundingClientRect();
      const tray = document.querySelector('.next-action')!.getBoundingClientRect();
      return Math.max(0, Math.min(image.bottom, tray.top, innerHeight) - Math.max(image.top, 0));
    });
    expect(visibleImage, 'First garment photo visible above the comparison tray').toBeGreaterThanOrEqual(160);
    for (const name of ['Sage wrap', 'Midnight blue']) await page.getByRole('button', { name: `Select ${name}`, exact: true }).click();
    await page.evaluate(() => scrollTo(0, 0));
    for (const name of ['Sage wrap', 'Midnight blue']) {
      const remove = page.getByRole('button', { name: `Remove ${name}`, exact: true });
      const target = (await remove.boundingBox())!;
      expect(target.height, `${name} removal target height`).toBeGreaterThanOrEqual(44);
      expect(target.width, `${name} removal target width`).toBeGreaterThanOrEqual(44);
      await expect(remove).toBeInViewport({ ratio: 1 });
    }
    const selectedExposure = await image.evaluate(el => {
      const image = el.getBoundingClientRect();
      const tray = document.querySelector('.next-action')!.getBoundingClientRect();
      return Math.max(0, Math.min(image.bottom, tray.top, innerHeight) - Math.max(image.top, 0));
    });
    expect(selectedExposure, 'Selected garment photo visible above the comparison tray').toBeGreaterThanOrEqual(160);
    await page.getByRole('button', { name: 'Compare these two' }).click();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    for (const name of ['A · Sage wrap', 'B · Midnight blue']) {
      const radio = page.getByRole('radio', { name, exact: true });
      await expect.poll(() => radio.evaluate(el => {
        const box = el.getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return !!hit && el.closest('label')!.contains(hit);
      }), { message: `${name} becomes unobscured after navigation settles` }).toBe(true);
      const geometry = await radio.evaluate(el => {
        const label = el.closest('label')!;
        const box = label.getBoundingClientRect();
        const radio = el.getBoundingClientRect();
        const x = radio.x + radio.width / 2, y = radio.y + radio.height / 2;
        const center = document.elementFromPoint(x, y);
        const labelCenter = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return { x, y, top: box.top, bottom: box.bottom, left: box.left, right: box.right, hit: !!center && label.contains(center), labelHit: !!labelCenter && label.contains(labelCenter) };
      });
      expect(geometry.top).toBeGreaterThanOrEqual(0);
      expect(geometry.bottom).toBeLessThanOrEqual(900);
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(width);
      expect(geometry.hit, `${name} radio is unobscured`).toBe(true);
      expect(geometry.labelHit, `${name} name label is unobscured`).toBe(true);
      await page.mouse.click(geometry.x, geometry.y);
      await expect(radio).toBeChecked();
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    }
  });
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`approved light controls retain semantic surfaces under ${colorScheme} OS preference`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.setViewportSize({ width: 1392, height: 951 });
    await page.goto('/');
    const verifyControl = async (control: Locator, boundary = control) => {
      const boundaryColor = await boundary.evaluate(el => getComputedStyle(el).borderTopColor);
      const colors = await control.evaluate((el, boundaryColor) => {
        const ctx = document.createElement('canvas').getContext('2d')!;
        const rgb = (value: string) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
        const style = getComputedStyle(el);
        const card = rgb(getComputedStyle(document.documentElement).getPropertyValue('--field'));
        const chain: Element[] = []; for (let e: Element | null = el; e; e = e.parentElement) chain.unshift(e);
        ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 1, 1);
        for (const e of chain) { ctx.fillStyle = getComputedStyle(e).backgroundColor; ctx.fillRect(0, 0, 1, 1); }
        const background = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
        return { background, card, color: rgb(style.color), border: rgb(boundaryColor), colorScheme: style.colorScheme };
      }, boundaryColor);
      expect(colors.background, 'Control uses the opaque semantic warm field surface').toEqual(colors.card);
      const css = (channels: number[]) => `rgb(${channels.join(',')})`;
      expect(contrast(css(colors.border), css(colors.background)), 'Control boundary').toBeGreaterThanOrEqual(3);
      expect(contrast(css(colors.color), css(colors.background)), 'Control text').toBeGreaterThanOrEqual(4.5);
      expect(colors.colorScheme, 'Native controls explicitly use the approved light scheme').toBe('light');
    };
    const date = page.getByLabel('Collection date', { exact: true }).and(page.locator('button, input'));
    const budget = page.getByLabel('Total cash available by collection', { exact: true });
    await verifyControl(date, date.locator('..'));
    await verifyControl(budget, budget.locator('..').locator('..'));
    await expect(page.getByRole('button', { name: 'Find dresses' })).toBeInViewport({ ratio: 1 });
    if (colorScheme === 'dark') await page.screenshot({ path: 'test-results/qa/occasion-dark-after.png' });
    await page.getByRole('button', { name: 'Find dresses' }).click();
    for (const name of ['Sage wrap', 'Midnight blue']) await page.getByRole('button', { name: `Select ${name}`, exact: true }).click();
    await page.getByRole('button', { name: 'Compare these two' }).click();
    await page.getByRole('radio', { name: 'B · Midnight blue', exact: true }).check();
    await page.getByRole('button', { name: 'Prepare inquiry' }).click();
    await verifyControl(page.getByLabel('Your inquiry', { exact: true }));
    if (colorScheme === 'dark') await page.screenshot({ path: 'test-results/qa/inquiry-dark-after.png' });
  });
}
