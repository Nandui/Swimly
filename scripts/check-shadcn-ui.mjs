import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildPreview,servePreview} from './instructor-swimmer-preview/build.mjs';

const directory=path.resolve('.impeccable/review/shadcn-audit');
const outputDir=path.join(directory,'site');
await buildPreview({entryPoint:'scripts/shadcn-audit-preview/fixture.jsx',outputDir,allowedActions:['loadSwimmerHistory'],actionTarget:'window.shadcnPreview.history'});
const {server,base}=await servePreview(0,outputDir,['help']);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({reducedMotion:'reduce'});
page.setDefaultTimeout(7000);
await page.route('**/*',route=>route.request().url().startsWith(base)&&route.request().method()==='GET'?route.continue():route.abort());
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
let layouts=0;
async function layout(label) {
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('h1').count(),1,label);
  assert.equal(await page.locator('main').count(),1,label);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Page overflow: ${label}`);
  const root=await page.getByRole('dialog').count()?page.getByRole('dialog'):page.getByRole('main');
  for (const control of await root.locator('button,input:not([type=hidden]),textarea').all()) {
    if (!await control.isVisible() || await control.getAttribute('aria-hidden') === 'true') continue;
    const box=await control.boundingBox();
    // Radio/checkbox targets include their labelled row.
    const target=await control.evaluate(el=>el.labels?.[0]?.getBoundingClientRect().height??0);
    assert(Math.max(box.height,target)>=43.5,`Small target: ${label} ${box.height}px ${await control.textContent()} ${await control.getAttribute('aria-label')}`);
    assert(box.x>=-1&&box.x+box.width<=await page.evaluate(()=>innerWidth+1),`Control overflow: ${label}`);
  }
  await page.screenshot({path:path.join(directory,`${label}.png`),fullPage:!label.startsWith('help-')});
  layouts++;
}
async function open(screen,theme='light') {
  await page.goto(`${base}/?screen=${screen}&theme=${theme}`);
  await page.getByRole('heading',{level:1}).waitFor();
}
try {
  for (const width of [375,768,1024,1280]) for (const theme of ['light','dark']) {
    await page.setViewportSize({width,height:1000});
    for (const screen of ['help','profile','duty','billing','error','enrol']) {
      await open(screen,theme);
      if (screen==='help'&&width===375) await page.getByRole('button',{name:/Browse by topic/}).click();
      if (screen==='enrol') {
        await page.getByRole('button',{name:'Choose class'}).click();
        await page.getByRole('radio',{name:/Turtles/}).click();
      }
      await layout(`${screen}-${width}-${theme}`);
    }
  }
  await page.setViewportSize({width:375,height:900});
  await open('help');
  const topics=page.getByRole('button',{name:/Browse by topic/});
  await topics.focus();await page.keyboard.press('Enter');
  assert.equal(await topics.getAttribute('aria-expanded'),'true');
  await page.getByRole('button',{name:/Enrolment & moves/}).click();
  assert(new URL(page.url()).searchParams.get('topic')==='enrolment');
  await page.getByRole('searchbox',{name:'Search help guides'}).fill('zzzz-not-found');
  await page.getByText('No guides match this search').waitFor();
  await page.getByRole('button',{name:'Show all guides'}).click();
  assert.equal(await page.getByRole('searchbox',{name:'Search help guides'}).inputValue(),'');
  assert(await page.getByRole('searchbox',{name:'Search help guides'}).evaluate(el=>el===document.activeElement));

  await open('profile');
  const chapter=page.getByRole('button',{name:'Turtles, LeisureWorld Bishopstown, Active',exact:true});
  await chapter.focus();await page.keyboard.press('Enter');
  assert.equal(await chapter.getAttribute('aria-expanded'),'false');
  await page.keyboard.press('Space');
  assert.equal(await chapter.getAttribute('aria-expanded'),'true');
  assert(await chapter.evaluate(el=>getComputedStyle(el).outlineStyle!=='none'||getComputedStyle(el).boxShadow!=='none'),'Visible keyboard focus');

  for (const screen of ['enrol','move']) {
    await open(screen);
    await page.getByRole('button',{name:'Choose class'}).click();
    await page.getByRole('radio',{name:/Turtles/}).click();
    const trigger=page.getByRole('button',{name:'Placement reason, if needed'});
    assert.equal(await trigger.getAttribute('aria-expanded'),screen==='move'?'false':'true');
    if(screen==='move') await trigger.click();
    const reason=page.getByRole('textbox',{name:'Placement reason',exact:true});
    await reason.fill('Synthetic placement reason');
    await trigger.focus();await page.keyboard.press('Space');
    assert.equal(await trigger.getAttribute('aria-expanded'),'false');
    assert.equal(await page.locator('[name=placementReason]').inputValue(),'Synthetic placement reason');
    if(screen==='enrol') await page.getByRole('radio',{name:/Still to do/}).click();
    const formData=await page.getByRole('dialog').locator('form').evaluate(el=>Object.fromEntries(new FormData(el)));
    assert.equal(formData.placementReason,'Synthetic placement reason');
    assert.equal(formData[screen==='move'?'toCourseId':'courseId'],'demo-class-1');
    await page.getByRole('button',{name:screen==='move'?'Review move':'Review enrolment'}).click();
    await page.getByText('Example save failed. Your choices are still here.').waitFor();
    assert.equal(await page.evaluate(()=>window.shadcnPreview.submitted.placementReason),'Synthetic placement reason');
    await trigger.click();
    assert.equal(await reason.inputValue(),'Synthetic placement reason');
    if(screen==='move') {
      await page.getByRole('combobox',{name:'Level'}).click();
      await page.getByRole('option',{name:'All levels',exact:true}).click();
    }
    await page.getByRole('radio',{name:/Penguins/}).click();
    assert.equal(await trigger.getAttribute('aria-expanded'),'true');
    assert.equal(await reason.inputValue(),'Synthetic placement reason');
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await page.getByRole('button',{name:'Choose class'}).click();
    assert.equal(await page.locator('[name=placementReason]').count(),0,'Fresh form on reopen');
  }
  await open('error');await page.getByRole('button',{name:'Try again'}).click();
  assert.equal(await page.evaluate(()=>window.shadcnPreview.resets),1);
  assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(directory,'verification.json'),JSON.stringify({layouts,errors},null,2));
  console.log(`Passed ${layouts} staff UI layouts plus keyboard disclosures, help filters/search, profile history, enrol/move FormData, failed-save preservation and retry. Synthetic data only.`);
} finally {await browser.close();server.close();}
