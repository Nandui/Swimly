import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base='http://127.0.0.1:4200', output=path.resolve('.impeccable/review/reception-portal');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:1000},reducedMotion:'reduce'}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try {
  for(const width of [375,768,1024,1280]) for(const theme of ['light','dark']) {
    await page.setViewportSize({width,height:1000});
    await page.goto(`${base}/reception-portal?access=admin&theme=${theme}&long-name`);
    await page.getByRole('heading',{level:1,name:'Reception Portal'}).waitFor();
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('h1').count(),1);
    assert.equal(await page.getByRole('main').count(),1);
    assert(await page.evaluate(()=>getComputedStyle(document.body).fontFamily.includes('Inter')));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Overflow at ${width} ${theme}`);
    for(const control of await page.locator('button:visible,main a:visible').all()) {
      const box=await control.boundingBox();assert(box.height>=43&&box.width>=43,`Small control: ${await control.textContent()}`);
    }
    assert.equal(await page.getByRole('link',{name:'Open Aquatics',exact:true}).getAttribute('href'),'/start?workspace=desk');
    assert.equal(await page.getByRole('link',{name:/Open Bookings/}).count(),0);
    await page.screenshot({path:path.join(output,`bento-${width}-${theme}.png`),fullPage:true});
  }
  await page.goto(base+'/reception-portal?access=admin');
  await page.getByRole('button',{name:/Working area:/}).click();
  await page.getByRole('menuitemradio',{name:'LeisureWorld Churchfield'}).click();
  await page.getByRole('button',{name:/Working area: LeisureWorld Churchfield/}).waitFor();
  const add=page.getByRole('button',{name:/Add a swimmer/});
  await add.click();
  const dialog=page.getByRole('dialog');
  await dialog.waitFor();
  assert(await dialog.evaluate(el=>getComputedStyle(el).fontFamily.includes('Inter')));
  assert.equal(await dialog.evaluate(el=>getComputedStyle(el).getPropertyValue('--brand-ocean').trim()),'#0077df');
  await dialog.getByRole('textbox',{name:/^First name/}).fill('Test');
  await dialog.getByRole('textbox',{name:/^Last name/}).fill('Example');
  await dialog.getByRole('button',{name:'Add and open profile',exact:true}).click();
  await dialog.getByText('Preview only. No swimmer has been added; your entries are still here.').waitFor();
  assert.equal(await dialog.getByRole('textbox',{name:/^First name/}).inputValue(),'Test');
  await page.keyboard.press('Escape');
  await dialog.waitFor({state:'hidden'});
  assert(await add.evaluate(el=>el===document.activeElement));
  for(const access of ['read','docs']) {
    await page.goto(`${base}/reception-portal?access=${access}`);
    await page.getByRole('heading',{level:1}).waitFor();
    assert.equal(await page.getByRole('button',{name:/Add a swimmer/}).count(),0);
    assert.equal(await page.getByRole('link',{name:'Open Refunds',exact:true}).count(),0);
    assert.equal(await page.getByRole('link',{name:'Open Docs',exact:true}).count(),access==='docs'?1:0);
    assert.equal(await page.getByRole('link',{name:'Open Aquatics',exact:true}).count(),access==='read'?1:0);
  }
  await page.goto(base+'/reception-portal?access=admin');
  await page.keyboard.press('Tab');
  assert(await page.getByRole('link',{name:'Skip to content'}).evaluate(el=>el===document.activeElement));
  await page.keyboard.press('Enter');
  assert(await page.getByRole('main').evaluate(el=>el===document.activeElement));
  await page.getByRole('link',{name:'All modules',exact:true}).click();
  await page.getByRole('heading',{name:'Choose your workspace'}).waitFor();
  assert.equal(await page.locator('.reception-portal').count(),0);
  assert(!(await page.evaluate(()=>getComputedStyle(document.body).fontFamily.includes('Inter'))),'Reception font must not leak into All modules');
  await page.setViewportSize({width:375,height:900});
  await page.goto(base+'/reception-portal?signout-error');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.getByText('Could not sign out. Please try again.',{exact:true}).waitFor();
  assert(await page.getByRole('button',{name:'Sign out',exact:true}).isEnabled());
  assert.deepEqual(errors,[]);
  console.log('Reception portal passed: 8 responsive/theme layouts, Docs font/theme including dialog, restricted access, site switch, form error/draft/focus, skip link and theme isolation.');
} finally {await browser.close();}
