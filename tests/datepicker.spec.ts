import { test, expect } from '@playwright/test';
import { dateLabels, dayName, setDate } from './date-helpers';

for (const [width, fontSize, reducedMotion] of [[320,16,'no-preference'],[390,32,'reduce'],[1440,16,'no-preference']] as const) {
  test(`calendar geometry, selected state and keyboard at ${width}px/${fontSize}px/${reducedMotion}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion });
    await page.goto('/');
    if (fontSize !== 16) await page.addStyleTag({ content: `html { font-size: ${fontSize}px !important; }` });
    await expect(page.locator('input[type=date]')).toHaveCount(0);
    for (const [index, label] of dateLabels.entries()) {
      const trigger = page.getByLabel(label, { exact: true }).and(page.locator('button, input'));
      await expect(trigger).toHaveText(`Nov ${index+7}, 2026`);
      await expect(trigger).toHaveAccessibleDescription(`Nov ${index+7}, 2026`);
      expect((await trigger.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await expect(trigger.locator('svg')).toHaveCount(1);
      await trigger.focus(); await page.keyboard.press('Space');
      const dialog = page.getByRole('dialog', { name: label, exact: true });
      await expect(dialog).toBeVisible();
      await expect.poll(() => dialog.evaluate(el => el.getAnimations().every(a => a.playState === 'finished'))).toBe(true);
      const selected = dialog.locator('button[data-selected-single=true]');
      await expect(selected).toHaveAccessibleName(new RegExp(dayName(`2026-11-0${index+7}`)));
      await expect(selected).toBeFocused();
      const geometry = await dialog.evaluate(el => {
        const box = el.getBoundingClientRect();
        const cells = [...el.querySelectorAll('button[data-day]')].map(b => { const r=b.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}; });
        const firstWeek = cells.slice(0,7);
        const rect = (selector: string) => el.querySelector(selector)!.getBoundingClientRect().toJSON();
        const caption=rect('.rdp-caption_label'),previous=rect('.rdp-button_previous'),next=rect('.rdp-button_next');
        return { left:box.left,right:box.right,bottom:box.bottom,top:box.top, fits:el.scrollWidth<=el.clientWidth+1, cells, firstWeek, caption, previous, next, overflow:document.documentElement.scrollWidth>innerWidth };
      });
      await test.info().attach(`geometry-${index}`, { body: JSON.stringify(geometry), contentType:'application/json' });
      expect(geometry.left).toBeGreaterThanOrEqual(0); expect(geometry.right).toBeLessThanOrEqual(width);
      expect(geometry.top).toBeGreaterThanOrEqual(0); expect(geometry.bottom).toBeLessThanOrEqual(900);
      for (const nav of [geometry.previous, geometry.next]) {
        const separated = geometry.caption.left >= nav.right-1 || geometry.caption.right <= nav.left+1 || geometry.caption.bottom <= nav.top+1 || geometry.caption.top >= nav.bottom-1;
        expect(separated, 'Month caption and navigation targets do not overlap').toBe(true);
      }
      expect(geometry.fits).toBe(true); expect(geometry.overflow).toBe(false);
      for (const cell of geometry.cells) { expect(cell.w).toBeGreaterThanOrEqual(39); expect(cell.h).toBeGreaterThanOrEqual(39); }
      for (let i=1;i<7;i++) { expect(Math.abs(geometry.firstWeek[i].y-geometry.firstWeek[0].y)).toBeLessThanOrEqual(1); expect(geometry.firstWeek[i].x).toBeGreaterThanOrEqual(geometry.firstWeek[i-1].x+geometry.firstWeek[i-1].w-1); }
      if (index === 0) await page.screenshot({ path: `test-results/qa/calendar-${width}-${fontSize}.png` });
      await page.keyboard.press('ArrowRight');
      await expect(dialog.locator('button:focus')).toHaveAccessibleName(new RegExp(dayName(`2026-11-0${index+8}`)));
      await page.keyboard.press('PageUp');
      await expect(dialog.locator('.rdp-caption_label')).toHaveText('October 2026');
      await page.keyboard.press('Escape'); await expect(dialog).toBeHidden(); await expect(trigger).toBeFocused();
      await trigger.click(); await expect(dialog.locator('.rdp-caption_label')).toHaveText('November 2026');
      await expect(dialog.locator('button[data-selected-single=true]')).toBeFocused();
      await page.keyboard.press('Escape');
    }
    await setDate(page, 'Event date', '');
    await page.getByRole('button', { name:'Find dresses' }).click();
    await expect(page.getByLabel('Event date', { exact: true }).and(page.locator('button, input'))).toBeFocused();
    await expect(page.getByLabel('Event date', { exact: true }).and(page.locator('button, input'))).toHaveAccessibleDescription('Choose a valid event date.');
    await page.screenshot({ path: `test-results/qa/error-${width}-${fontSize}.png` });
    await page.getByRole('button', { name:'Use sample dates' }).click();
    await expect(page.getByLabel('Event date', { exact: true }).and(page.locator('button, input'))).toHaveText('Nov 8, 2026');
    await expect(page.getByLabel('Event date', { exact: true }).and(page.locator('button, input'))).toHaveAttribute('aria-invalid','false');
  });
}

for (const timezoneId of ['Asia/Manila','America/Los_Angeles']) {
  test(`calendar month/year edges reach comparison and inquiry unchanged in ${timezoneId}`, async ({ browser }) => {
    const context = await browser.newContext({ timezoneId, baseURL:'http://127.0.0.1:5173' });
    const page = await context.newPage();
    await page.goto('/');
    for (const dates of [['2026-11-30','2026-12-01','2026-12-02'],['2026-12-31','2027-01-01','2027-01-02']]) {
      for (const [i,label] of dateLabels.entries()) await setDate(page,label,dates[i]);
      await page.getByRole('button',{ name:'Find dresses' }).click();
      for (const name of ['Sage wrap','Midnight blue']) await page.getByRole('button',{name:`Select ${name}`,exact:true}).click();
      await page.getByRole('button',{name:'Compare these two'}).click();
      const total = page.getByRole('row').filter({has: page.getByRole('rowheader',{name:'Total cash through collection',exact:true})});
      await expect(total.getByRole('cell')).toHaveText(['₱2,400','₱1,500']);
      const tableGeometry=await page.locator('.table-wrap table').evaluate(el => {
        const rows=[...el.querySelectorAll('tr')].filter(row=>row.querySelectorAll('td').length===2);
        return rows.map(row=>[...row.querySelectorAll('td')].map(td=>({x:td.getBoundingClientRect().x,w:td.getBoundingClientRect().width})));
      });
      expect(tableGeometry.length).toBeGreaterThan(3);
      for(const row of tableGeometry) for(let i=0;i<2;i++) { expect(Math.abs(row[i].x-tableGeometry[0][i].x)).toBeLessThanOrEqual(1); expect(Math.abs(row[i].w-tableGeometry[0][i].w)).toBeLessThanOrEqual(1); }
      await page.getByRole('radio',{name:'B · Midnight blue',exact:true}).check();
      if (timezoneId === 'Asia/Manila') await page.locator('.table-wrap').screenshot({path:'test-results/qa/comparison-table.png'});
      await page.getByRole('button',{name:'Prepare inquiry'}).click();
      const text=await page.getByLabel('Your inquiry',{exact:true}).inputValue();
      for(const iso of dates) { const [y,m,d]=iso.split('-').map(Number); expect(text).toContain(new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,d,12)))); }
      await page.getByRole('button',{name:'Edit occasion'}).click();
      await page.getByRole('button',{name:'Use sample dates'}).click();
      // Clear retained selections through the public shortlist controls before next scenario.
      await page.getByRole('button',{name:'Find dresses'}).click();
      for(const name of ['Sage wrap','Midnight blue']) await page.getByRole('button',{name:`Remove ${name}`,exact:true}).click();
      await page.getByRole('button',{name:'1 Occasion'}).click();
    }
    await context.close();
  });
}

test('all date controls clear, report missing dates, and recover through Calendar selections', async ({ page }) => {
  await page.goto('/');
  for (const [i,label] of dateLabels.entries()) {
    await setDate(page,label,'');
    const trigger=page.locator(['#collection','#event','#returnDate'][i]);
    await expect(trigger).toHaveText('Choose date');
    await page.getByRole('button',{name:'Find dresses'}).click();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-invalid','true');
    await expect(trigger).toHaveAccessibleDescription(new RegExp(`Choose a valid ${i===2?'return':i===1?'event':'collection'} date.`));
    await page.getByRole('button',{name:'Use sample dates'}).click();
  }
  for (const [i,label] of dateLabels.entries()) await setDate(page,label,`2026-11-0${i+6}`);
  await page.getByRole('button',{name:'Find dresses'}).click();
  await expect(page.getByRole('heading',{name:'Find your two'})).toBeVisible();
});
