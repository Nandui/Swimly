// Exercise the shipped totals overview with fictional swimmers only.
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildPreview,servePreview} from './instructor-swimmer-preview/build.mjs';

const {chromium}=await import(process.env.INSTRUCTOR_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.INSTRUCTOR_PLAYWRIGHT_MODULE).href : 'playwright');
await buildPreview();
const {server,base}=await servePreview();
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:1000},reducedMotion:'reduce'});
await context.route('**/*',route=>route.request().url().startsWith(base)&&route.request().method()==='GET'?route.continue():route.abort());
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const dest=path.resolve('.impeccable/review/instructor-swimmers');
const overview='/instructor/classes/example-class/overview';
const cards=()=>page.getByRole('list',{name:'Competency totals',exact:true}).getByRole('listitem');
const card=name=>cards().filter({has:page.getByRole('heading',{name,exact:true})});
async function open(query='') {await page.goto(base+overview+'?'+query);await page.getByRole('heading',{name:'Class overview',exact:true}).waitFor();}
async function totals(expected) {
  assert.equal(await cards().count(),expected.length);
  for(const [index,count] of expected.entries()) assert.match(await cards().nth(index).innerText(),new RegExp(`${count} out of 5 achieved`));
}

try {
  await page.goto(base+'/');
  await page.getByRole('link',{name:'Class overview',exact:true}).click();
  await page.getByRole('heading',{name:'Class overview',exact:true}).waitFor();
  assert.equal(new URL(page.url()).pathname,overview);
  assert.equal(new URL(page.url()).searchParams.get('group'),'level');
  assert.equal(await page.getByRole('link',{name:'Class overview',exact:true}).getAttribute('aria-current'),'page');
  // Morgan is absent and still contributes to the 5-person denominator and first three skills.
  await totals([5,4,2,1,0,0]);
  assert.equal(await page.getByRole('table').count(),0);
  assert.equal(await cards().getByRole('button').count(),0);
  assert.equal(await page.getByRole('radio').count(),0);
  assert.equal(await page.getByText('Avery Example',{exact:true}).count(),0);
  assert.equal(await page.locator('a[href^="/students"],a[href^="/courses"]').count(),0);
  await page.getByRole('link',{name:'2. Competencies',exact:true}).click();
  await page.getByRole('button',{name:/^Avery Example \d+ of 6 achieved/}).click();
  await page.getByRole('radiogroup',{name:'Float on the front — Avery Example',exact:true}).getByRole('radio',{name:'Achieved',exact:true}).click();
  await page.getByRole('link',{name:'Class overview',exact:true}).click();
  await card('Float on the front').getByText('2 out of 5 achieved',{exact:true}).waitFor();
  await page.getByRole('link',{name:'2. Competencies',exact:true}).click();
  await page.getByRole('button',{name:/^Avery Example \d+ of 6 achieved/}).click();
  assert.equal(await page.getByRole('radiogroup',{name:'Float on the front — Avery Example',exact:true}).getByRole('radio',{name:'Achieved',exact:true}).getAttribute('aria-checked'),'true');
  await page.getByRole('button',{name:'Save marks',exact:true}).click();
  await page.getByRole('status').filter({hasText:/^Saved$/}).waitFor();
  await page.getByRole('link',{name:'Class overview',exact:true}).click();
  await card('Float on the front').getByText('3 out of 5 achieved',{exact:true}).waitFor();
  await page.evaluate(()=>sessionStorage.clear());
  await open('no-attendance');await totals([5,4,2,1,0,0]);
  await open('all-achieved');await totals([5,5,5,5,5,5]);
  await open('empty=roster');assert(await page.getByText('No swimmers are currently enrolled in this class.',{exact:true}).isVisible());assert.equal(await cards().count(),0);
  await open('empty=competencies');assert(await page.getByText('This level has no competencies yet.',{exact:true}).isVisible());assert.equal(await cards().count(),0);
  let layouts=0;
  for(const width of [375,768,1024,1280]) for(const theme of ['light','dark']) {
    await page.setViewportSize({width,height:1100});
    await open(`theme=${theme}${width===375?'&long=1':''}`);
    await totals([5,4,2,1,0,0]);
    assert.equal(await page.getByRole('heading',{level:1}).count(),1);
    assert.equal(await page.getByRole('main').count(),1);
    assert(await page.getByRole('main').evaluate(el=>el.scrollWidth<=el.clientWidth));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.equal(await page.getByRole('table').count(),0);
    const first=await cards().nth(0).boundingBox(),second=await cards().nth(1).boundingBox();
    assert.equal(first.y,second.y,'Cards share a row instead of stacking into an accordion');
    for(const control of await page.locator('button:visible,a[data-slot="button"]:visible').all()) {
      const box=await control.boundingBox();assert(box.width>=44&&box.height>=44,`Touch target ${width}: ${await control.innerText()}`);
    }
    await page.screenshot({path:path.join(dest,`overview-${width}-${theme}.png`)});layouts++;
  }
  await page.setViewportSize({width:375,height:1100});await open('many');
  assert.equal(await cards().count(),18);
  assert.match(await cards().last().innerText(),/0 out of 25 achieved/);
  assert(await page.getByRole('main').evaluate(el=>el.scrollWidth<=el.clientWidth));
  await page.setViewportSize({width:375,height:1100});await open('theme=light');
  await page.mouse.move(0,0);await page.screenshot({path:path.join(dest,'overview-mobile-guide.png')});
  await page.setViewportSize({width:1024,height:1000});await open('theme=light');
  await page.mouse.move(0,0);await page.screenshot({path:path.join(dest,'overview-guide.png')});
  assert.equal(errors.length,0);
  console.log(JSON.stringify({passed:true,totals:true,absentIncluded:true,readOnly:true,navigation:true,savedResults:true,draftPreserved:true,emptyStates:true,largeClass:true,layouts,pageErrors:0}));
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
