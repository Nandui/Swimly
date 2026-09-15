import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { startParentAdminPreview } from './parent-admin-preview.ts';

process.env.PARENT_ADMIN_PREVIEW = '1';
const preview = await startParentAdminPreview();
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const evidence = path.resolve('.impeccable/review/parent-admin');
const failures = [], screenshots = {};
let checks = 0;

async function checkLayout(page, label, dialog = false) {
  await page.evaluate(() => document.fonts.ready);
  if (dialog) await page.getByRole('dialog').evaluate(el => Promise.all(el.getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>{}))));
  const issues = await page.evaluate(dialog => {
    const root = dialog ? document.querySelector('[role="dialog"]') : document.querySelector('main');
    const visible = el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
    const problems = [];
    if (document.documentElement.scrollWidth > innerWidth + 1) problems.push('page overflow');
    if (!dialog && document.querySelectorAll('h1').length !== 1) problems.push('H1 count');
    if (document.querySelectorAll('main').length !== 1) problems.push('main count');
    for (const el of root.querySelectorAll('button,input:not([type=hidden]),textarea,[role=tab],a')) {
      if (!visible(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.height < 43.5) problems.push(`small control: ${el.textContent?.trim() || el.getAttribute('aria-label') || el.name}`);
      if (rect.width > innerWidth || rect.x < -1 || rect.right > innerWidth + 1) problems.push('control overflow');
      if (el.matches('input,textarea') && !el.labels?.length && !el.getAttribute('aria-label')) problems.push('unlabelled field');
    }
    return problems;
  }, dialog);
  if (issues.length) failures.push(`${label}: ${issues.join(', ')}`);
  checks++;
}
async function capture(page, id, dialog = false) {
  const target = dialog ? page.getByRole('dialog') : page.locator('main');
  const file = path.join(evidence, `${id}.png`);
  await target.screenshot({ path: file, animations: 'disabled' });
  screenshots[id] = file;
}
async function open(screen, width = 1280, theme = 'light') {
  const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', colorScheme: theme, timezoneId: 'America/Los_Angeles' });
  page.setDefaultTimeout(7000);
  page.on('pageerror', error => failures.push(error.message));
  page.on('console', message => { if (message.type()==='error' && !message.text().includes('Failed to load resource')) failures.push(message.text()); });
  await page.route('**/*', route => route.request().url().startsWith(preview.url) ? route.continue() : route.abort());
  await page.goto(`${preview.url}/?screen=${screen}&theme=${theme}`);
  await page.getByRole('heading', {level:1}).waitFor();
  if (screen === 'profile') await page.getByRole('button', {name:'Approve parent email',exact:true}).waitFor();
  if (screen === 'publication') await page.getByRole('button', {name:'Publish to LeisureWorld Aquatics',exact:true}).waitFor();
  return page;
}
async function fillReason(page, value = 'Verified with the guardian at the desk') {
  await page.getByRole('dialog').getByLabel('Reason', {exact:false}).fill(value);
}
try {
  for (const theme of ['light','dark']) for (const width of [375,768,1024,1280]) {
    for (const screen of ['directory','profile','accounts','publication']) {
      const page = await open(screen,width,theme);
      try {
        if (screen === 'accounts') {
          await page.getByLabel('Parent email',{exact:false}).fill('parent@example.test');
          await page.getByRole('button',{name:'Find account',exact:true}).click();
          await page.getByRole('button',{name:'Suspend account',exact:true}).waitFor();
        }
        await checkLayout(page,`${screen}-${width}-${theme}`);
        if ((width===375||width===1280)&&screen!=='directory') await capture(page,`${screen}-${width}-${theme}`);
        const trigger = {profile:'Approve parent email',accounts:'Suspend account',publication:'Publish to LeisureWorld Aquatics'}[screen];
        if (trigger) {
          await page.getByRole('button',{name:trigger,exact:true}).click();
          await page.getByRole('dialog').waitFor();
          if (screen==='profile') await page.getByRole('dialog').getByLabel('Guardian email',{exact:false}).fill('parent@example.test');
          await fillReason(page,screen==='publication'?'Open assessment booking for families':screen==='accounts'?'Access paused following a guardian request':'Verified with the guardian at the desk');
          await checkLayout(page,`${screen}-dialog-${width}-${theme}`,true);
          if (width===1280&&theme==='light') await capture(page,`parent-${screen}`,true);
          if (width===375&&theme==='dark') await capture(page,`${screen}-dialog-mobile-dark`,true);
          await page.keyboard.press('Tab');
          assert.equal(await page.getByRole('dialog').evaluate(el=>el.contains(document.activeElement)),true);
          await page.getByRole('button',{name:'Cancel',exact:true}).click();
          await page.getByRole('dialog').waitFor({state:'hidden'});
          await page.waitForFunction(label=>document.activeElement?.textContent?.trim()===label,trigger,{timeout:1500})
            .catch(()=>failures.push(`${screen}-${width}-${theme}: focus did not return to ${trigger}`));
        }
      } finally { await page.close(); }
    }
    console.log(`Layout and dialog checks completed: ${width}px ${theme}`);
  }

  const page = await open('profile');
  await page.getByRole('button',{name:'Approve parent email',exact:true}).click();
  await page.getByRole('dialog').getByLabel('Guardian email',{exact:false}).fill('parent@example.test');
  await fillReason(page,'   ');
  await page.getByRole('dialog').getByRole('button',{name:'Approve parent email',exact:true}).click();
  await page.getByText('Enter a reason between 3 and 500 characters.').first().waitFor();
  assert.equal(await page.getByRole('dialog').getByLabel('Guardian email',{exact:false}).inputValue(),'parent@example.test');
  await fillReason(page);
  let writes=0;
  await page.route('**/children/*/access',async route=>{
    if(route.request().method()==='PUT'){writes++;await new Promise(resolve=>setTimeout(resolve,200));}
    await route.continue();
  });
  await page.getByRole('dialog').locator('form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByText('Approved',{exact:true}).waitFor();
  assert.equal(writes,1);
  assert.equal(await preview.prisma.parentChildAccess.count(),1);
  await page.getByRole('button',{name:'Revoke access',exact:true}).click();await fillReason(page);
  await page.getByRole('dialog').getByRole('button',{name:'Revoke access',exact:true}).click();
  await page.getByText('Revoked',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Restore access',exact:true}).click();await fillReason(page);
  await page.getByRole('dialog').getByRole('button',{name:'Restore access',exact:true}).click();
  await page.getByText('Approved',{exact:true}).waitFor();
  await page.close();

  const accounts = await open('accounts');
  await accounts.getByLabel('Parent email',{exact:false}).fill('missing@example.test');
  await accounts.getByRole('button',{name:'Find account',exact:true}).click();
  await accounts.getByRole('heading',{name:'No account found'}).waitFor();
  await accounts.getByLabel('Parent email',{exact:false}).fill('parent@example.test');
  await accounts.getByRole('button',{name:'Find account',exact:true}).click();
  await accounts.getByRole('button',{name:'Suspend account',exact:true}).click();await fillReason(accounts);
  preview.state.failAudit=true;
  await accounts.getByRole('dialog').getByRole('button',{name:'Suspend account',exact:true}).click();
  await accounts.getByText('Something went wrong. Please try again.').waitFor();
  assert.equal(await accounts.getByRole('dialog').getByLabel('Reason',{exact:false}).inputValue(),'Verified with the guardian at the desk');
  preview.state.failAudit=false;
  await accounts.getByRole('dialog').getByRole('button',{name:'Suspend account',exact:true}).click();
  await accounts.getByText('Suspended',{exact:true}).waitFor();
  assert.ok((await preview.prisma.parentSession.findFirstOrThrow()).revokedAt);
  await accounts.getByRole('button',{name:'Reactivate account',exact:true}).click();await fillReason(accounts);
  await accounts.getByRole('dialog').getByRole('button',{name:'Reactivate account',exact:true}).click();
  await accounts.getByText('Active',{exact:true}).waitFor();
  await accounts.close();

  const publication = await open('publication');
  await publication.getByRole('button',{name:'Publish to LeisureWorld Aquatics',exact:true}).click();
  const deadline=`${preview.session.date.toISOString().slice(0,10)}T15:00`;
  await publication.getByLabel('Booking deadline (Ireland time)').fill(deadline);await fillReason(publication);
  await publication.getByRole('dialog').getByRole('button',{name:'Publish session',exact:true}).click();
  await publication.getByText('Published',{exact:true}).waitFor();
  const stored=await preview.prisma.parentAssessmentPublication.findUniqueOrThrow({where:{sessionId:preview.session.id}});
  assert.equal(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Dublin',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(stored.bookingClosesAt),'15:00');
  await publication.getByRole('button',{name:'Edit booking deadline',exact:true}).click();
  assert.equal(await publication.getByLabel('Booking deadline (Ireland time)').inputValue(),deadline);
  await publication.getByLabel('Booking deadline (Ireland time)').fill('');await fillReason(publication);
  await publication.getByRole('dialog').getByRole('button',{name:'Save deadline',exact:true}).click();
  await publication.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal((await preview.prisma.parentAssessmentPublication.findUniqueOrThrow({where:{sessionId:preview.session.id}})).bookingClosesAt,null);
  await publication.getByRole('button',{name:'Unpublish',exact:true}).click();await fillReason(publication);
  await publication.getByRole('dialog').getByRole('button',{name:'Unpublish session',exact:true}).click();
  await publication.getByText('Not published',{exact:true}).waitFor();
  await publication.close();

  const restricted=await open('restricted');
  assert.equal(await restricted.getByRole('tab',{name:'Parent access'}).count(),0);
  await restricted.close();
  preview.state.permissions.delete('parents.manage');
  const denied=await browser.newPage();
  await denied.goto(`${preview.url}/?screen=profile`);
  await denied.getByText('Staff permission is required.').waitFor();
  assert.equal(await denied.getByRole('button',{name:'Approve parent email',exact:true}).count(),0);
  preview.state.permissions.add('parents.manage');
  await denied.getByRole('button',{name:'Try again',exact:true}).click();
  await denied.getByRole('button',{name:'Approve parent email',exact:true}).waitFor();await denied.close();

  assert.deepEqual(failures,[]);
  console.log(`PASS: ${checks} responsive layout checks; approval/revoke/restore, exact lookup, suspend/reactivate, publish/deadline/unpublish, permissions, retry, duplicate submit, focus and preserved input.`);
  await fs.writeFile(path.join(evidence,'verification.json'),JSON.stringify({checks,failures,screenshots},null,2));
  if (process.argv.includes('--write-help-images')) {
    const manifest = JSON.parse(await fs.readFile('assets/help/manifest.json','utf8'));
    for (const id of ['parent-profile','parent-accounts','parent-publication']) {
      const png = await fs.readFile(screenshots[id]);
      await fs.writeFile(`assets/help/${id}.png`,png);
      manifest[id] = {width:png.readUInt32BE(16),height:png.readUInt32BE(20)};
    }
    await fs.writeFile('assets/help/manifest.json',JSON.stringify(manifest,null,2)+'\n');
  }
} finally {await browser.close();await preview.close();}
