import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {buildAnalyticsPreview, outputDir, routes} from './analytics-preview/build.mjs';
import {servePreview} from './instructor-swimmer-preview/build.mjs';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
await buildAnalyticsPreview();
const {server,base} = await servePreview(0,outputDir,routes);
const browser = await chromium.launch({channel:'chrome',headless:true});
const context = await browser.newContext({reducedMotion:'reduce'});
await context.route('**/*',route => route.request().url().startsWith(base) && route.request().method() === 'GET' ? route.continue() : route.abort());
const page = await context.newPage(), errors = [];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
try {
  for (const route of routes) for (const width of [375,768,1024,1280]) for (const theme of ['light','dark']) {
    await page.setViewportSize({width,height:900});
    await page.goto(`${base}/${route}?theme=${theme}`);
    await page.getByRole('heading',{level:1}).waitFor();
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('h1').count(),1);
    assert.equal(await page.getByRole('main').count(),1);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow ${route} ${width}/${theme}`);
    for (const control of await page.locator('main button, main a, main input, main summary').all()) {
      if (!await control.isVisible()) continue;
      const box=await control.boundingBox();
      assert(box.height>=44,`Touch height ${await control.textContent()} ${width}/${theme}`);
    }
    await page.screenshot({path:path.resolve(`.impeccable/review/analytics/${route.split('/').at(-1)}-${width}-${theme}.png`),fullPage:true});
    if (route.endsWith('/instructors')) {
      await page.getByRole('heading',{name:'Class details',exact:true}).evaluate(el => el.scrollIntoView({block:'start'}));
      await page.screenshot({path:path.resolve(`.impeccable/review/analytics/class-details-${width}-${theme}.png`),fullPage:true});
    }
  }
  await page.goto(`${base}/analytics`);
  assert.equal(await page.getByText(/Last 7 days/).count(),0);
  await page.getByRole('navigation',{name:'Analytics pages'}).getByRole('link',{name:'Reception activity'}).click();
  await page.getByRole('heading',{name:'Reception activity',exact:true}).waitFor();
  await page.getByRole('textbox',{name:'Find a staff member'}).fill('Alex');
  assert.equal(await page.getByRole('row').count(),2);
  const summary=page.locator('summary').filter({hasText:'Alex Example'});
  await summary.focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('details[open]').count(),1);
  await page.getByRole('textbox',{name:'Find a staff member'}).fill('nobody');
  await page.getByText('No staff match your search.').waitFor();
  await page.getByRole('navigation',{name:'Analytics pages'}).getByRole('link',{name:'Instructor attendance'}).click();
  await page.getByRole('heading',{name:'Instructor attendance',exact:true}).waitFor();
  await page.getByRole('button',{name:'Needs attendance',exact:true}).click();
  assert.equal(await page.getByRole('link',{name:'Penguins',exact:true}).count(),1);
  assert.equal(await page.getByRole('link',{name:'Turtles',exact:true}).count(),1);
  assert.equal(await page.getByRole('link',{name:'Dolphins',exact:true}).count(),0);
  await page.getByRole('button',{name:'Jamie Example',exact:true}).click();
  await page.getByRole('heading',{name:'Jamie Example’s classes'}).waitFor();
  assert.equal(await page.getByRole('link',{name:'Turtles',exact:true}).count(),0);
  await page.getByRole('button',{name:'Show all instructors'}).click();
  await page.getByRole('button',{name:'Upcoming',exact:true}).click();
  assert.equal(await page.getByRole('link',{name:'Starfish (Saturday)',exact:true}).count(),1);
  await page.getByRole('button',{name:'Saved',exact:true}).click();
  assert.equal(await page.getByRole('link',{name:'Starfish',exact:true}).count(),1);
  await page.getByRole('textbox',{name:'Find an instructor'}).fill('missing name');
  await page.getByText('No instructors match your search.').waitFor();
  await page.goto(`${base}/analytics/instructors?restricted`);
  assert.equal(await page.locator('a[href^="/courses/"]').count(),0);
  await page.goto(`${base}/analytics/instructors?empty`);
  await page.getByText('No weekly classes are scheduled at this site this week.').waitFor();
  await page.goto(`${base}/analytics/reception?empty`);
  await page.getByText('No enrolments or unenrolments have been recorded at this site this week.').waitFor();
  if (process.env.UPDATE_HELP_IMAGES === '1') {
    const manifest = JSON.parse(await fs.readFile('assets/help/manifest.json','utf8'));
    for (const [route,id,height] of [['analytics','analytics',1800],['analytics/reception','analytics-reception',1300],['analytics/instructors','analytics-instructors',2400]]) {
      await page.setViewportSize({width:1440,height});
      await page.goto(`${base}/${route}?theme=light`);
      await page.getByRole('heading',{level:1}).waitFor();
      await page.evaluate(()=>document.fonts.ready);
      const png = await page.getByRole('main').screenshot({path:`assets/help/${id}.png`});
      manifest[id]={width:png.readUInt32BE(16),height:png.readUInt32BE(20)};
    }
    await fs.writeFile('assets/help/manifest.json',JSON.stringify(manifest,null,2)+'\n');
  }
  assert.deepEqual(errors,[]);
  console.log('Analytics UI passed: 24 layouts, navigation, staff search, keyboard daily breakdown, instructor selection, status filters, empty states and permission-gated class links. Synthetic data only.');
} finally {await browser.close();server.close();}
