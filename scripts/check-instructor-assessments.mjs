// Real Instructor page and assessment UI; synthetic data and actions only.
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildAssessmentPreview,output} from './instructor-swimmer-preview/assessment-build.mjs';
import {servePreview} from './instructor-swimmer-preview/build.mjs';
const {chromium}=await import(process.env.INSTRUCTOR_PLAYWRIGHT_MODULE?pathToFileURL(process.env.INSTRUCTOR_PLAYWRIGHT_MODULE).href:'playwright');
await buildAssessmentPreview();
const {server,base}=await servePreview(0,output);
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:1000},reducedMotion:'reduce'});
await context.route('**/*',route=>route.request().url().startsWith(base)&&route.request().method()==='GET'?route.continue():route.abort());
const page=await context.newPage();
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const dest=path.resolve('.impeccable/review/instructor-assessments');
const links=()=>page.getByRole('link',{name:/^Open assessment:/});
const person=name=>page.getByRole('listitem').filter({has:page.getByRole('heading',{name,exact:true})});
const settle=()=>page.evaluate(async()=>{
  await document.fonts.ready;
  await Promise.allSettled(document.getAnimations().filter(animation=>animation.effect?.getTiming().iterations!==Infinity).map(animation=>animation.finished));
});
try {
  for(const query of ['', 'tab=all&group=level', 'no-run']) {
    await page.goto(base+'/?'+query);
    await page.getByRole('heading',{name:'Assessments today',exact:true}).waitFor();
    assert(await page.getByText('New swimmer assessment',{exact:true}).isVisible());
    assert(await page.getByText(/Sam Example · 3 booked/).isVisible());
    assert(await page.getByText(/Assessor not assigned · 0 booked/).isVisible());
    assert.equal(await links().count(),query==='no-run'?0:2);
    assert.equal((await page.evaluate(()=>window.assessmentPreview.listDates)).length,1);
    assert.equal(await page.locator('a[href^="/assessments"],a[href^="/students"]').count(),0);
  }
  await page.goto(base+'/?tab=all&group=level');
  await links().filter({hasText:'Open assessment'}).first().click();
  await page.getByRole('heading',{level:1,name:'New swimmer assessment'}).waitFor();
  assert.equal(new URL(page.url()).pathname,'/instructor/assessments/example-assessment');
  assert.equal(await page.getByRole('link',{name:'Back to Instructor'}).getAttribute('href'),'/instructor?tab=all&group=level');
  assert.equal(await page.locator('a[href^="/students"],a[href^="/assessments"]').count(),0);
  assert.equal(await page.getByRole('button',{name:'Book a swimmer',exact:true}).count(),0);
  await person('Avery Example').getByRole('button',{name:'Place',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await settle();
  for(const control of await dialog.locator('button:visible,[role="combobox"]:visible').all()) {
    const box=await control.boundingBox();assert(box.width>=44&&box.height>=44,`Dialog touch target: ${await control.innerText()}`);
  }
  await dialog.getByRole('combobox',{name:'Level',exact:true}).click();
  await page.getByRole('option',{name:'Turtles',exact:true}).click();
  await dialog.getByRole('textbox',{name:'Note',exact:true}).fill('Confident front and back floats.');
  await page.evaluate(()=>{window.assessmentPreview.fail=true;});
  await dialog.getByRole('button',{name:'Place',exact:true}).click();
  await dialog.getByText('Could not save this assessment. Try again.',{exact:true}).waitFor();
  assert.equal(await dialog.getByRole('textbox',{name:'Note',exact:true}).inputValue(),'Confident front and back floats.');
  await page.evaluate(()=>{window.assessmentPreview.fail=false;});
  await dialog.getByRole('button',{name:'Place',exact:true}).click();
  await dialog.waitFor({state:'hidden'});
  assert(await person('Avery Example').getByText('Turtles',{exact:true}).isVisible());
  await person('Jamie Example').getByRole('button',{name:'Jamie Example did not come',exact:true}).click();
  await settle();
  for(const control of await page.getByRole('alertdialog').getByRole('button').all()) {
    const box=await control.boundingBox();assert(box.width>=44&&box.height>=44);
  }
  await page.getByRole('alertdialog').getByRole('button',{name:'Did not come',exact:true}).click();
  await page.getByRole('alertdialog').waitFor({state:'hidden'});
  assert(await page.getByRole('region',{name:'Not coming'}).getByRole('heading',{name:'Jamie Example',exact:true}).isVisible());
  const calls=await page.evaluate(()=>window.assessmentPreview.calls);
  assert.deepEqual(calls.map(call=>call.action),['recordOutcome','recordOutcome','markNoShow']);
  assert.deepEqual(calls[1].input,{bookingId:'avery',levelId:'turtles',note:'Confident front and back floats.'});
  assert.equal(calls[2].input,'jamie');
  await page.goto(base+'/?empty');
  await page.getByRole('heading',{name:'No classes assigned to you today'}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Assessments today'}).count(),0);
  await page.goto(base+'/instructor/assessments/example-assessment?empty');
  await page.getByText('No swimmers are booked on this assessment.',{exact:true}).waitFor();
  let layouts=0;
  for(const width of [375,768,1024,1280]) for(const theme of ['light','dark']) for(const detail of [false,true]) {
    await page.setViewportSize({width,height:1100});
    await page.goto(base+(detail?'/instructor/assessments/example-assessment':'/')+`?theme=${theme}`);
    await page.getByRole('heading',{level:1}).waitFor();
    await settle();
    assert.equal(await page.getByRole('heading',{level:1}).count(),1);
    assert.equal(await page.getByRole('main').count(),1);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    for(const control of await page.getByRole('main').locator('button:visible,a[href]:visible').all()) {
      const box=await control.boundingBox();assert(box.width>=44&&box.height>=44,`Touch target: ${await control.innerText()}`);
    }
    await page.screenshot({path:path.join(dest,`${detail?'session':'home'}-${width}-${theme}.png`)});layouts++;
  }
  assert.equal(errors.length,0);
  console.log(JSON.stringify({passed:true,visibleToAllInstructors:true,assessmentOnlyDay:true,permissionAware:true,isolatedNavigation:true,placement:true,noShow:true,failedSaveRetry:true,emptyStates:true,layouts,pageErrors:0}));
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
