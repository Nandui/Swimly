// Actual shadcn screens with fictional data and blocked server actions.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildPreview,servePreview} from './instructor-swimmer-preview/build.mjs';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const output=path.resolve('.impeccable/review/assessment-workspace/site');
await buildPreview({entryPoint:'scripts/assessment-workspace-preview/fixture.jsx',outputDir:output,allowedActions:['enrolStudent','createSession','promoteFromWaitlist'],actionTarget:'window.assessmentWorkspace.save',pathnameFallback:'/assessments'});
const {server,base}=await servePreview(0,output);
const html=await fs.readFile(path.join(output,'index.html'),'utf8');
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:1000},reducedMotion:'reduce'});
await context.route('**/*',route=>{
  const request=route.request();
  if(!request.url().startsWith(base)||request.method()!=='GET') return route.abort();
  if(request.isNavigationRequest()) return route.fulfill({status:200,contentType:'text/html',body:html});
  return route.continue();
});
const page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const settle=()=>page.evaluate(async()=>{await document.fonts.ready;await Promise.allSettled(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished));});
const mainNav=()=>page.getByRole('navigation',{name:'Assessment pages',exact:true});
try {
  await page.goto(base+'/assessments');
  await page.getByRole('heading',{level:1,name:'Upcoming assessments',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Add a session',exact:true}).count(),0);
  assert.equal(await page.getByRole('link',{name:/^View swimmers,/}).count(),2);
  await mainNav().getByRole('link',{name:'Assessment setup',exact:true}).click();
  await page.getByRole('heading',{level:1,name:'Assessment setup',exact:true}).waitFor();
  await page.getByRole('button',{name:'Add a session',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.waitFor();
  assert(await dialog.getByRole('heading',{name:'Add an assessment session',exact:true}).isVisible());
  await page.keyboard.press('Escape');
  await dialog.waitFor({state:'hidden'});
  assert.equal(await mainNav().getByRole('link',{name:'Awaiting enrolment',exact:true}).count(),0);
  await page.getByRole('link',{name:'Awaiting enrolment',exact:true}).click();
  await page.getByRole('heading',{level:1,name:'Awaiting enrolment',exact:true}).waitFor();
  assert.equal(await mainNav().count(),0);
  assert.equal(await page.getByText('Waitlisted',{exact:true}).count(),2);
  const unassessed=page.getByRole('listitem',{name:'Morgan Example',exact:true});
  await unassessed.locator('[data-slot=collapsible-trigger]').click();
  assert.equal(await unassessed.getByText(/Assessed level/).count(),0);
  assert.equal(await unassessed.getByRole('listitem').count(),2);
  assert.equal(await unassessed.getByRole('button',{name:/^Enrol .* from the waitlist/}).count(),1);
  const promote=unassessed.getByRole('button',{name:/^Enrol .* from the waitlist/});
  await promote.click();
  const confirmation=page.getByRole('dialog');
  await confirmation.waitFor();
  assert(await confirmation.getByRole('heading',{name:'Enrol Morgan Example from the waitlist',exact:true}).isVisible());
  assert(await confirmation.getByRole('radiogroup',{name:'Legend billing agreement'}).isVisible());
  await page.keyboard.press('Escape');
  await confirmation.waitFor({state:'hidden'});
  assert(await promote.evaluate(el=>el===document.activeElement));
  await page.getByRole('listitem',{name:'Avery Example',exact:true}).locator('[data-slot=collapsible-trigger]').click();
  await page.getByRole('button',{name:'Find a class',exact:true}).first().click();
  await dialog.waitFor();
  assert(await dialog.getByRole('heading',{name:'Enrol Avery Example',exact:true}).isVisible());
  await page.keyboard.press('Escape');
  await dialog.waitFor({state:'hidden'});
  await page.getByRole('searchbox',{name:'Find a swimmer',exact:true}).fill('Avery');
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await page.waitForURL('**/awaiting-enrolment?q=Avery');
  await page.getByRole('link',{name:'Next',exact:true}).click();
  await page.waitForURL('**/awaiting-enrolment?q=Avery&page=2');
  for(const url of ['/assessments','/assessments/setup','/awaiting-enrolment']) {
    await page.goto(base+url+'?empty');
    await page.getByText(url.includes('awaiting')?'No swimmers awaiting enrolment':'No upcoming assessments',{exact:true}).waitFor();
  }
  await page.goto(base+'/awaiting-enrolment?restricted');
  await page.getByRole('heading',{level:1,name:'Awaiting enrolment',exact:true}).waitFor();
  assert.equal(await mainNav().getByRole('link',{name:'Assessment setup',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Find a class',exact:true}).count(),0);
  assert.equal(await page.locator('a[href^="/students/"]').count(),0);
  assert.equal(await page.locator('main a[href^="/assessments/"]').count(),0);
  assert.equal(await page.getByRole('button',{name:/^Enrol .* from the waitlist/}).count(),0);
  let layouts=0;
  for(const width of [375,768,1024,1280]) for(const theme of ['light','dark']) for(const section of ['', '/setup','/awaiting-enrolment']) {
    await page.setViewportSize({width,height:1100});
    await page.goto(`${base}${section==='/awaiting-enrolment'?section:`/assessments${section}`}?theme=${theme}`);
    await page.getByRole('heading',{level:1}).waitFor();await settle();
    assert.equal(await page.locator('h1').count(),1);
    const overflow=await page.evaluate(()=>[document.documentElement,...document.querySelectorAll('main')].some(el=>el.scrollWidth>el.clientWidth+1));
    assert.equal(overflow,false,`Overflow: ${width} ${theme} ${section}`);
    for(const control of await page.locator('main a:visible,main button:visible,main input:visible').all()) {
      const box=await control.boundingBox();
      assert(box.height>=43&&box.width>=43,`Touch target at ${width}: ${await control.textContent()}`);
    }
    const capture=path.resolve('.impeccable/review/assessment-workspace',`${section.replaceAll('/','')||'upcoming'}-${width}-${theme}.png`);
    await page.screenshot({path:capture}); layouts++;
  }
  await page.goto(base+'/assessments');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'Skip to content');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'workspace-main');
  assert.deepEqual(errors,[]);
  if(process.argv.includes('--write-help-images')) {
    await fs.copyFile(path.resolve('.impeccable/review/assessment-workspace/awaiting-enrolment-1280-light.png'),path.resolve('assets/help/assessment-awaiting-enrolment.png'));
    const manifest=JSON.parse(await fs.readFile('assets/help/manifest.json','utf8'));
    manifest['assessment-awaiting-enrolment']={width:1280,height:1100};
    await fs.writeFile('assets/help/manifest.json',JSON.stringify(manifest,null,2)+'\n');
  }
  console.log(`Assessment workspace passed: navigation, dialogs, search/pagination, empty/restricted views, keyboard skip link, 44px controls and ${layouts} responsive/theme layouts. Synthetic data only.`);
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
