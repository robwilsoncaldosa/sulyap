import { expect, type Page } from '@playwright/test';

export const dateLabels = ['Collection date', 'Event date', 'Return date'] as const;
export function dayName(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date).replace(/(\d+),/, (_, n) => `${n}${n % 10 === 1 && n !== '11' ? 'st' : n % 10 === 2 && n !== '12' ? 'nd' : n % 10 === 3 && n !== '13' ? 'rd' : 'th'},`);
}
export async function setDate(page: Page, label: string, iso: string) {
  await page.getByLabel(label, { exact: true }).and(page.locator('button, input')).click();
  const dialog = page.getByRole('dialog', { name: label, exact: true });
  if (!iso) {
    await dialog.getByRole('button', { name: 'Clear date', exact: true }).click();
  } else {
    const [year, month] = iso.split('-').map(Number);
    const target = year * 12 + month - 1;
    for (let count = 0; count < 36; count++) {
      const caption = await dialog.locator('.rdp-caption_label').innerText();
      const current = new Date(`${caption} 1 12:00:00`);
      const position = current.getFullYear() * 12 + current.getMonth();
      if (position === target) break;
      await dialog.getByRole('button', { name: position < target ? 'Go to the Next Month' : 'Go to the Previous Month', exact: true }).click();
    }
    await dialog.getByRole('button', { name: new RegExp(dayName(iso)) }).click();
  }
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel(label, { exact: true }).and(page.locator('button, input'))).toBeFocused();
}
