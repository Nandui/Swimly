// Real teaching components, synthetic data/actions. No database or outbound requests.
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
const button=name=>page.getByRole('button',{name,exact:true});
const swimmer=name=>page.getByRole('button',{name:new RegExp(`^${name} \\d+ of 6 achieved`)});
const skill=(name,person)=>page.getByRole('radiogroup',{name:`${name} — ${person}`,exact:true});
async function open(query='') {await page.goto(base+'/?'+query);await page.getByRole('heading',{name:'Turtles',exact:true}).waitFor();}
async function checked(group,label) {assert.equal(await group.getByRole('radio',{name:label,exact:true}).getAttribute('aria-checked'),'true');}
async function selectSkill(label) {
  const target=Number.parseInt(label,10);
  const counter=await page.getByText(/^Competency \d+ of \d+$/).innerText();
  let current=Number(counter.match(/^Competency (\d+)/)[1]);
  while(current>target) {await button('Previous competency').click();current--;}
  while(current<target) {await button('Next competency').click();current++;}
}

try {
  await open();
  assert.equal(await page.getByRole('group',{name:'Competency view'}).count(),1);
  assert.equal(await button('By swimmer').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#competency-picker').count(),0);
  await swimmer('Jamie Example').click();
  assert.equal(await swimmer('Jamie Example').getAttribute('aria-expanded'),'true');
  assert(await swimmer('Jamie Example').evaluate(el=>el===document.activeElement));
  await skill('Swim five metres on the front','Jamie Example').getByRole('radio',{name:'Achieved',exact:true}).click();
  await swimmer('Avery Example').click();
  assert.equal(await swimmer('Jamie Example').getAttribute('aria-expanded'),'false');
  await skill('Float on the front','Avery Example').getByRole('radio',{name:'Achieved',exact:true}).click();
  await swimmer('Jamie Example').click();
  await checked(skill('Swim five metres on the front','Jamie Example'),'Achieved');
  await button('Mark all achieved for Jamie Example').click();
  assert.match(await swimmer('Jamie Example').innerText(),/6 of 6 achieved/);
  assert.match(await swimmer('Avery Example').innerText(),/3 of 6 achieved/);
  assert.match(await page.getByRole('status').innerText(),/3 marks not saved yet/);
  await swimmer('Jamie Example').click();
  assert.equal(await swimmer('Jamie Example').getAttribute('aria-expanded'),'false');
  await swimmer('Jamie Example').click();
  assert.equal(await swimmer('Jamie Example').getAttribute('aria-expanded'),'true');
  await checked(skill('Exit the water safely','Jamie Example'),'Achieved');
  await page.reload();await swimmer('Jamie Example').click();
  await checked(skill('Exit the water safely','Jamie Example'),'Achieved');
  assert.match(await page.getByRole('status').innerText(),/Restored on this device/);
  await page.evaluate(()=>{window.swimmerPreview.saveMode='error';});
  await button('Save marks').click();await page.getByText('Could not save these marks. Your changes are still here. Try again.',{exact:true}).waitFor();
  assert(await button('Save marks').isEnabled());
  await page.evaluate(()=>{window.swimmerPreview.saveMode='offline';});
  await button('Save marks').click();
  await page.getByRole('alert').filter({hasText:/save|saved/i}).waitFor();
  await button('Save marks').waitFor({state:'visible'});
  assert(await page.evaluate(()=>Boolean(localStorage.getItem('swimly:assess:example-class:2026-09-19'))));
  await page.evaluate(()=>{window.swimmerPreview.saveMode='slow';});
  await button('Save marks').click();
  assert(await skill('Float on the front','Jamie Example').getByRole('radio',{name:'Achieved',exact:true}).isDisabled());
  await page.getByRole('status').filter({hasText:/^Saved$/}).waitFor();
  const calls=await page.evaluate(()=>window.swimmerPreview.calls);
  assert.equal(calls.length,3);assert(calls.every(c=>c.action==='saveInstructorAssessment'));
  const input=calls.at(-1).input;
  assert.deepEqual({courseId:input.courseId,date:input.date,levelId:input.levelId},{courseId:'example-class',date:'2026-09-19',levelId:'example-level'});
  assert.equal(input.marks.length,3);
  assert(input.marks.every(m=>m.status==='ACHIEVED'));
  assert.equal(input.marks.filter(m=>m.studentId==='jamie').length,2);
  assert.equal(input.marks.filter(m=>m.studentId==='avery').length,1);
  assert.equal(await page.evaluate(()=>localStorage.getItem('swimly:assess:example-class:2026-09-19')),null);
  assert.match(await swimmer('Jamie Example').innerText(),/6 of 6 achieved/);
  // An absent swimmer remains in the explicit separate group; no bulk class mark includes them.
  await button('Not in today (1)').click();await swimmer('Morgan Example').click();
  assert(await page.getByText('Not in today. These are their recorded competencies.',{exact:true}).isVisible());
  assert.equal(await swimmer('Morgan Example').getAttribute('aria-expanded'),'true');
  // Both layouts edit one shared draft. Bulk competency marking excludes absent swimmers.
  await open('course=two-views');
  await swimmer('Jamie Example').click();
  await skill('Swim five metres on the front','Jamie Example').getByRole('radio',{name:'Achieved',exact:true}).click();
  await button('By competency').focus();await page.keyboard.press('Enter');
  assert.equal(await button('By competency').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#competency-picker').count(),0);
  await selectSkill('5. Swim five metres on the front');
  await checked(skill('Swim five metres on the front','Jamie Example'),'Achieved');
  await skill('Swim five metres on the front','Avery Example').getByRole('radio',{name:'Achieved',exact:true}).click();
  await button('Next competency').click();
  assert(await button('Next competency').isDisabled());
  await button('Everyone in today achieved').click();
  await button('Not in today (1)').click();
  await checked(skill('Exit the water safely','Morgan Example'),'Not Achieved');
  await checked(skill('Exit the water safely','Casey Example'),'Achieved'); // Late is included.
  await button('By swimmer').click();
  assert.equal(await swimmer('Jamie Example').getAttribute('aria-expanded'),'true');
  await checked(skill('Exit the water safely','Jamie Example'),'Achieved');
  await swimmer('Avery Example').click();
  await checked(skill('Swim five metres on the front','Avery Example'),'Achieved');
  await checked(skill('Exit the water safely','Avery Example'),'Achieved');
  assert.match(await page.getByRole('status').innerText(),/6 marks not saved yet/);
  await button('By competency').click();
  await page.getByRole('heading',{name:'Exit the water safely',exact:true}).waitFor();
  await button('Previous competency').click();
  await checked(skill('Swim five metres on the front','Avery Example'),'Achieved');
  await selectSkill('1. Enter the water safely');assert(await button('Previous competency').isDisabled());
  await page.reload();
  assert.equal(await button('By swimmer').getAttribute('aria-pressed'),'true');
  await button('By competency').click();await selectSkill('6. Exit the water safely');
  await checked(skill('Exit the water safely','Jamie Example'),'Achieved');
  await button('Save marks').click();
  await page.getByRole('status').filter({hasText:/^Saved$/}).waitFor();
  const viewCalls=await page.evaluate(()=>window.swimmerPreview.calls);
  assert.equal(viewCalls.length,1);assert.equal(viewCalls[0].action,'saveInstructorAssessment');
  assert.equal(viewCalls[0].input.marks.length,6);
  assert(!viewCalls[0].input.marks.some(mark=>mark.studentId==='morgan'));
  assert.equal(viewCalls[0].input.marks.filter(mark=>mark.competencyId==='skill-6').length,4);
  assert.equal(await page.locator('a[href^="/students"]').count(),0);
  // Keyboard entry and long content work without nested buttons or clipped controls.
  await open('course=keyboard');
  await swimmer('Jamie Example').focus();await page.keyboard.press('Enter');
  assert.equal(await swimmer('Jamie Example').getAttribute('aria-expanded'),'true');
  assert(await swimmer('Jamie Example').evaluate(el=>el.matches(':focus-visible')));
  assert.notEqual(await swimmer('Jamie Example').evaluate(el=>getComputedStyle(el).outlineStyle),'none');
  await page.screenshot({path:path.join(dest,'keyboard-focus.png')});
  assert.equal(await page.locator('button button').count(),0);
  await open('read-only');await swimmer('Jamie Example').click();
  assert.equal(await button('Mark all achieved for Jamie Example').count(),0);
  for(const control of await page.getByRole('region',{name:'Jamie Example competencies'}).getByRole('radio').all()) assert(await control.isDisabled());
  assert.equal(await button('Save marks').count(),0);
  await button('By competency').click();
  for(const control of await page.getByRole('main').getByRole('radio').all()) assert(await control.isDisabled());
  assert.equal(await button('Everyone in today achieved').count(),0);
  await open('course=no-attendance&no-attendance');
  await button('By competency').click();await selectSkill('6. Exit the water safely');
  await button('Everyone achieved').click();
  await checked(skill('Exit the water safely','Morgan Example'),'Achieved');
  await open('empty=roster');assert(await page.getByText('Nobody in this class yet.',{exact:true}).isVisible());
  await page.goto(base+'/?empty=competencies');await page.getByText('This level has no competencies yet.',{exact:true}).waitFor();assert.equal(await button('By swimmer').count(),0);
  await page.goto(base+'/?desk');await page.getByRole('combobox').last().waitFor();assert.equal(await button('By swimmer').count(),0);assert.equal(await button('View competencies for Jamie Example').count(),0);
  // Shared class/date storage cannot leak into another class.
  await open('course=another-class');await swimmer('Jamie Example').click();assert.match(await swimmer('Jamie Example').innerText(),/4 of 6 achieved/);
  let layouts=0;
  for(const width of [375,768,1024,1280]) for(const theme of ['light','dark']) {
    await page.setViewportSize({width,height:1000});
    await open(`course=layout-${width}-${theme}&theme=${theme}${width===375?'&long=1':''}`);
    const person=width===375?'Jamie Alexandra Example-Montgomery':'Jamie Example';await swimmer(person).click();
    assert.equal(await page.getByRole('heading',{level:1}).count(),1);
    assert.equal(await page.getByRole('main').count(),1);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    for(const control of await page.getByRole('main').locator('button:visible').all()) {
      const box=await control.boundingBox();assert(box.width>=44&&box.height>=44,`Touch target ${width}: ${await control.innerText()}`);
    }
    await page.screenshot({path:path.join(dest,`swimmers-${width}-${theme}.png`),fullPage:true});layouts++;
    await button('By competency').click();
    await selectSkill('5. Swim five metres on the front');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    for(const control of await page.getByRole('main').locator('button:visible').all()) {
      const box=await control.boundingBox();assert(box.width>=44&&box.height>=44,`Competency touch target ${width}: ${await control.innerText()}`);
    }
    await page.screenshot({path:path.join(dest,`competencies-${width}-${theme}.png`),fullPage:true});layouts++;
  }
  // Keep a full-height synthetic illustration for the signed-in instructor guide.
  await page.setViewportSize({width:1024,height:1450});
  await open('course=guide&theme=light');await swimmer('Jamie Example').click();
  await skill('Swim five metres on the front','Jamie Example').getByRole('radio',{name:'Achieved',exact:true}).click();
  await page.mouse.move(0,0);
  await page.screenshot({path:path.join(dest,'guide.png')});
  await button('By competency').click();await selectSkill('5. Swim five metres on the front');
  await page.mouse.move(0,0);
  await page.screenshot({path:path.join(dest,'competency-guide.png')});
  assert.equal(errors.length,0);
  console.log(JSON.stringify({passed:true,viewSwitching:true,sharedDrafts:true,bulkScope:true,draftRecovery:true,saveFailureRetry:true,savePayload:true,absentSwimmers:true,keyboard:true,readOnly:true,emptyStates:true,deskUnchanged:true,layouts,pageErrors:0}));
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
