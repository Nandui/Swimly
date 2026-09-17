// Actual Instructor list and start dialog; fictional staff/classes and no database.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildAssessmentPreview,output} from './instructor-swimmer-preview/assessment-build.mjs';
import {servePreview} from './instructor-swimmer-preview/build.mjs';
const {chromium}=await import(process.env.INSTRUCTOR_PLAYWRIGHT_MODULE?pathToFileURL(process.env.INSTRUCTOR_PLAYWRIGHT_MODULE).href:'playwright');
await buildAssessmentPreview();
const {server,base}=await servePreview(0,output);
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({reducedMotion:'reduce'});
await context.route('**/*',route=>route.request().url().startsWith(base)&&route.request().method()==='GET'?route.continue():route.abort());
const page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const dest=path.resolve('.impeccable/review/instructor-shared');
await fs.mkdir(dest,{recursive:true});
try {
  for(const width of [375,768,1024,1280]) for(const theme of ['light','dark']) {
    await page.setViewportSize({width,height:1000});
    await page.goto(`${base}/instructor?shared&tab=all&group=level&theme=${theme}`);
    await page.getByRole('heading',{name:'Instructor',exact:true}).waitFor();
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.getByRole('link',{name:/^Open class:/}).count(),2);
    assert.equal(await page.getByRole('button',{name:/^Start class:/}).count(),1);
    assert.equal(await page.getByText('In progress',{exact:true}).count(),0);
    assert.match(await page.getByRole('link',{name:/^Open class:.*10:00/}).getAttribute('href'),/\/instructor\/classes\/shared/);
    assert.match(await page.getByRole('link',{name:/^Open class:.*10:30/}).getAttribute('href'),/\/instructor\/classes\/deleted/);
    assert.equal(await page.locator('h1').count(),1);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    for(const link of await page.getByRole('link',{name:/^Open class:/}).all()) assert((await link.boundingBox()).height>=44);
    await page.screenshot({path:path.join(dest,`${width}-${theme}.png`),fullPage:true});
  }
  await page.goto(`${base}/instructor?shared&tab=all&group=level&theme=light`);
  await page.getByRole('button',{name:/^Start class:/}).click();
  const dialog=page.getByRole('dialog');
  await dialog.waitFor();
  assert.match(await dialog.innerText(),/Other instructors can also open/);
  await page.evaluate(()=>Promise.allSettled(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished)));
  if(process.argv.includes('--write-help-image')) {
    const file='assets/help/start-class.png';
    await dialog.screenshot({path:file});
    const sharp=(await import('sharp')).default;
    const {width,height}=await sharp(file).metadata();
    const manifest=JSON.parse(await fs.readFile('assets/help/manifest.json','utf8'));
    manifest['start-class']={width,height};
    await fs.writeFile('assets/help/manifest.json',JSON.stringify(manifest,null,2)+'\n');
  }
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  assert.deepEqual(errors,[]);
  console.log('Shared Instructor checks passed: existing and deleted-teacher starts offer Open class; eight layouts and updated start dialog.');
} finally {await browser.close();server.close();}
