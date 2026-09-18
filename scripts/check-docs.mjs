import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { docsPreview } from './docs-preview/server.mjs';
import { one } from '../src/lib/docs/database.ts';
import { DocumentService } from '../src/lib/docs/domain.ts';

const { server, db, ids, base } = await docsPreview();
const directory=path.resolve('.impeccable/review/docs');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({reducedMotion:'reduce'});
page.setDefaultTimeout(8000);
const errors=[],issues=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
let layouts=0,workflow;
async function open(route,theme='light',who='alex') {
  const url=new URL(route,base);url.searchParams.set('theme',theme);url.searchParams.set('as',who);
  await page.goto(url.href);
  await page.locator('h1').waitFor();
  await page.evaluate(()=>document.fonts.ready);
}
async function layout(label) {
  assert.equal(await page.locator('h1').count(),1,label);
  assert.equal(await page.locator('main').count(),1,label);
  const found=await page.evaluate(()=>{
    const result=[];
    if(document.documentElement.scrollWidth>innerWidth+1)result.push('page overflow');
    const root=document.querySelector('[role=dialog]')||document.querySelector('main');
    for(const el of root.querySelectorAll('button,input:not([type=hidden]),textarea,select,a[data-slot=button]')){
      if(!el.checkVisibility()||el.getAttribute('aria-hidden')==='true')continue;
      const box=el.getBoundingClientRect();
      const label=el.labels?.[0]||el.closest('label');
      const target=label?.getBoundingClientRect().height||0;
      if(Math.max(box.height,target)<43.5)result.push('small control '+(el.getAttribute('aria-label')||el.textContent||el.getAttribute('name')).slice(0,70));
      if(box.x< -1||box.right>innerWidth+1)result.push('control overflow '+(el.getAttribute('aria-label')||el.textContent||'input').slice(0,70));
    }
    return result;
  });
  issues.push(...found.map(x=>label+': '+x));
  if(label.endsWith('375-light')||label.endsWith('1280-dark')||found.length)await page.screenshot({path:path.join(directory,label+'.png'),fullPage:true});
  layouts++;
}
try {
  const routes=[['portal','/modules'],['home','/docs'],['library','/docs/library'],['work','/docs/work'],['reports','/docs/reports'],['admin','/docs/admin'],['new','/docs/documents/new'],['reader',`/docs/documents/${ids.published}`],['history',`/docs/documents/${ids.published}/history`],['editor',`/docs/documents/${ids.editing}/edit`]];
  for(const width of [375,768,1024,1280])for(const theme of ['light','dark']){
    await page.setViewportSize({width,height:1000});
    for(const [label,route]of routes){
      await open(route,theme);await layout(`${label}-${width}-${theme}`);
      if(label==='editor') {
        const draft=await one(db,'SELECT * FROM drafts WHERE document_id=$1',[ids.editing]);
        if(draft.leaseOwner)await new DocumentService(db).lock(draft.leaseOwner,ids.editing,draft.leaseSession,true);
      }
    }
  }
  await page.setViewportSize({width:375,height:900});
  await open('/docs');
  await page.getByRole('button',{name:'Open navigation'}).click();
  await page.getByRole('dialog').waitFor();
  await layout('mobile-navigation-375-light');
  await page.getByRole('link',{name:'All modules',exact:true}).last().click();
  await page.getByRole('link',{name:'Open Docs'}).waitFor();
  await page.getByRole('link',{name:'Open Docs'}).click();
  await page.getByRole('heading',{name:'Your workspace'}).waitFor();

  await open(`/docs/documents/${ids.published}`,'light','riley');
  assert.equal(await page.getByRole('button',{name:'Assign required reading'}).count(),0);
  await page.getByRole('button',{name:'I have read this version'}).click();
  await page.getByRole('heading',{name:'You’ve read this version'}).waitFor();

  await page.setViewportSize({width:1280,height:1000});
  await open(`/docs/documents/${ids.editing}/edit`,'dark','jamie');
  await page.getByRole('button',{name:'Submit for review',exact:true}).waitFor();
  await page.getByRole('button',{name:'Submit for review',exact:true}).click();
  await page.getByRole('dialog').waitFor();
  await layout('submit-dialog-1280-dark');
  await page.getByLabel('What changed?',{exact:true}).fill('Verified through the integrated Docs interface.');
  await page.getByLabel('Approver',{exact:true}).selectOption('sam');
  await page.getByRole('button',{name:'Send for review',exact:true}).click();
  await page.waitForURL(/version=/);
  const submittedUrl=new URL(page.url());
  await open(submittedUrl.pathname+submittedUrl.search,'light','sam');
  await page.getByRole('button',{name:/Approve and publish/}).click();
  await page.getByText('Version 1',{exact:true}).first().waitFor();
  workflow='portal, mobile navigation, acknowledgement, submit and independent approval';
  assert.deepEqual(errors,[],'browser console errors');
  assert.deepEqual(issues,[],'responsive checks');
  console.log(`Docs: ${layouts} layouts and portal → reading → authoring → independent approval passed.`);
} finally {await fs.writeFile(path.join(directory,'verification.json'),JSON.stringify({layouts,issues,errors,workflow},null,2));await page.screenshot({path:path.join(directory,'last-state.png'),fullPage:true});await browser.close();await new Promise(resolve=>server.close(resolve));await db.close();}
