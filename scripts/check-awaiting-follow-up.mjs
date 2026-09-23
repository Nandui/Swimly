// Uses the isolated follow-up preview on port 4202; never the live database.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base='http://127.0.0.1:4202', output=path.resolve('.impeccable/review/enrolment-follow-up');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:1000},reducedMotion:'reduce'});
const page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try {
  await page.goto(base+'/awaiting-enrolment?q=Jamie');
  const row=page.getByRole('listitem',{name:'Jamie Example',exact:true});
  await row.locator('[data-slot=collapsible-trigger]').focus();
  await page.keyboard.press('Enter');
  const history=row.getByRole('region',{name:'Contact history for Jamie Example'});
  const add=history.getByRole('button',{name:'Add contact or note',exact:true});
  await add.click();
  assert.equal(await page.getByRole('dialog').count(),0,'Queue contact history is inline');
  const note=history.getByLabel('What happened?');
  const text='Family can attend a Saturday morning class. Check the next available place.';
  await note.fill(text);
  await history.getByRole('button',{name:'Hide form',exact:true}).click();
  await add.click();
  assert.equal(await note.inputValue(),text);
  await row.locator('[data-slot=collapsible-trigger]').click();
  await row.locator('[data-slot=collapsible-trigger]').click();
  assert.equal(await note.inputValue(),text,'Draft survives closing the swimmer');
  await history.getByRole('button',{name:'Save update',exact:true}).click();
  await history.getByText('Update saved to the swimmer’s history.',{exact:true}).waitFor();
  await history.getByRole('list').getByText(text,{exact:true}).first().waitFor();
  await row.locator('[data-slot=collapsible-trigger]').getByText(text,{exact:true}).waitFor();
  await page.goto(base+'/awaiting-enrolment?reader');
  const reader=page.getByRole('listitem',{name:'Avery Example',exact:true});
  await reader.locator('[data-slot=collapsible-trigger]').click();
  const readHistory=reader.getByRole('region',{name:'Contact history for Avery Example'});
  await readHistory.getByText('Called the parent; no answer. Try again in the afternoon.',{exact:true}).waitFor();
  assert.equal(await readHistory.getByRole('button',{name:'Add contact or note',exact:true}).count(),0);
  // Failed reads are retryable without replacing the queue.
  await page.route('**/preview/action',route=>route.fulfill({status:500,contentType:'application/json',body:'{"error":"Preview failure"}'}));
  await readHistory.getByRole('button',{name:'Reload history'}).click();
  await readHistory.getByText(/Could not load the follow-up history/).waitFor();
  await page.unroute('**/preview/action');
  await readHistory.getByRole('button',{name:'Reload history'}).click();
  await readHistory.getByText(/Could not load the follow-up history/).waitFor({state:'hidden'});
  // The profile still opens the original Sheet.
  await page.goto(base+'/students/example-avery');
  const profileHistory=page.getByRole('button',{name:'Follow-up history for Avery Example'});
  await profileHistory.click();
  const sheet=page.getByRole('dialog');
  await sheet.getByText('Called the parent; no answer. Try again in the afternoon.',{exact:true}).waitFor();
  await page.keyboard.press('Escape');
  await sheet.waitFor({state:'hidden'});
  assert(await profileHistory.evaluate(el=>el===document.activeElement));
  for(const width of [375,768,1024,1280]) for(const theme of ['light','dark']) for(const view of ['enrolment','moves']) {
    await page.setViewportSize({width,height:1000});
    await page.goto(`${base}/awaiting-enrolment?theme=${theme}${view==='moves'?'&view=moves':''}`);
    await page.getByRole('listitem',{name:view==='moves'?'Morgan Example':'Avery Example',exact:true}).waitFor();
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.allSettled(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished));});
    assert.equal(await page.locator('h1').count(),1);
    assert.equal(await page.evaluate(()=>[document.documentElement,...document.querySelectorAll('main')].some(el=>el.scrollWidth>el.clientWidth+1)),false,`Overflow at ${width} ${theme} ${view}`);
    for(const control of await page.locator('main a:visible,main button:visible,main input:visible').all()) {
      const box=await control.boundingBox(); assert(box.height>=43&&box.width>=43,`Small control: ${await control.textContent()}`);
    }
    await page.screenshot({path:path.join(output,`${view}-${width}-${theme}.png`),fullPage:true});
    const expanded=page.getByRole('listitem',{name:view==='moves'?'Morgan Example':'Avery Example',exact:true});
    await expanded.locator('[data-slot=collapsible-trigger]').click();
    await expanded.getByRole('region',{name:/Contact history for/}).getByRole('list').waitFor();
    assert(await expanded.getByRole('button',{name:'Add contact or note',exact:true}).isVisible());
    assert.equal(await page.evaluate(()=>document.querySelector('main').scrollWidth>document.querySelector('main').clientWidth+1),false);
    await page.screenshot({path:path.join(output,`${view}-${width}-${theme}-expanded.png`),fullPage:true});
    await expanded.getByRole('button',{name:'Add contact or note',exact:true}).click();
    await expanded.getByLabel('What happened?').fill('Internal note: check Saturday availability at both sites.');
    assert.equal(await page.evaluate(()=>document.querySelector('main').scrollWidth>document.querySelector('main').clientWidth+1),false,`Inline form overflow at ${width}`);
    for(const control of await expanded.locator('button:visible,input:visible,textarea:visible,a:visible').all()) {
      const box=await control.boundingBox();assert(box.height>=43&&box.width>=43,`Small expanded control: ${await control.textContent()}`);
    }
    if(width===375 || width===1280) {
      await expanded.getByLabel('What happened?').scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(output,`${view}-${width}-${theme}-form.png`)});
    }
  }
  assert.deepEqual(errors,[]);
  console.log('Follow-up queue passed: inline history and note saving, row refresh, preserved drafts, profile Sheet focus, read-only history, retryable failures, and 16 viewport/theme/view combinations.');
} finally {await browser.close();}
