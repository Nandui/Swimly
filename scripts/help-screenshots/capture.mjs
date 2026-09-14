import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { buildScreenshots, output } from './build.mjs';

await buildScreenshots();
const { chromium } = await import(process.env.HELP_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.HELP_PLAYWRIGHT_MODULE).href : 'playwright');
const server=http.createServer(async(req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
  const file=path.resolve(output,name);
  if(!['GET','HEAD'].includes(req.method)||!file.startsWith(output+path.sep)){res.writeHead(403).end();return}
  try{const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream'});res.end(data)}catch{res.writeHead(404).end()}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});
const dest=path.resolve('assets/help');await fs.mkdir(dest,{recursive:true});
const manifest=process.env.HELP_CAPTURE_ONLY?JSON.parse(await fs.readFile(path.join(dest,'manifest.json'),'utf8')):{};
const failures=[];
const plans=[
  {id:'workspace',full:true}, {id:'site-menu',full:true,click:'Working area: LeisureWorld Bishopstown. Switch site'},
  {id:'instructor-home',full:true}, {id:'instructor-menu',full:true,click:'Instructor menu: Alex Example'}, {id:'instructor-site',full:true,click:'Working area: LeisureWorld Bishopstown. Switch site'},
  {id:'appearance'}, {id:'password'}, {id:'directory',width:1280}, {id:'profile'},
  {id:'add-swimmer',click:'Add swimmer',dialog:true,fill:{'First name':'Avery','Last name':'Example','Member number':'DEMO-5'}},
  {id:'edit-swimmer',click:'Edit details',dialog:true},
  {id:'enrol',click:'Manage enrolment',then:'Enrol in a class',dialog:true},
  {id:'move',click:'Manage enrolment',then:'Move class',dialog:true},
  {id:'waitlist',click:'Manage enrolment',dialog:true},
  {id:'end-enrolment',click:'Manage enrolment',then:'Unenrol',dialog:true},
  {id:'classes'}, {id:'class-detail'}, {id:'add-class',click:'Add class',dialog:true},
  {id:'schedule'}, {id:'together'}, {id:'start-class',click:'Start class: Turtles, 16:00–16:30',dialog:true},
  {id:'attendance'}, {id:'save-conflict'}, {id:'competencies'},
  {id:'complete-class',click:'Complete Turtles for Avery Example',dialog:true},
  {id:'profile-competencies'}, {id:'complete-level',click:'Confirm level completion',dialog:true},
  {id:'assessment-session',click:'Add a session',dialog:true}, {id:'assessment-booking',click:'Book a swimmer',dialog:true},
  {id:'assessment-outcome',click:'Place',dialog:true},
  {id:'cancel-session',click:'Cancel session: Turtles, 16:00',dialog:true,fill:{'Reason for cancellation':'Pool unavailable for this session.'}},
  {id:'billing',click:/^Review cancellation:/,dialog:true},
  {id:'analytics'}, {id:'programme',click:'Add programme',dialog:true,fill:{Name:'Water Safety & Fun'}},
  {id:'curriculum',click:'Add competency',dialog:true,fill:{'What the swimmer has to do':'Float on the back for five seconds'}},
  {id:'staff',click:'Add person',dialog:true,fill:{Name:'Alex Example',Email:'staff@example.invalid'}},
  {id:'roles',click:'Edit Teaching team',dialog:true}, {id:'clubs',click:'Add a club',dialog:true,fill:{Name:'Example site'}}, {id:'activity'},
];
try {
  for(const plan of plans.filter(p=>!process.env.HELP_CAPTURE_ONLY||process.env.HELP_CAPTURE_ONLY.split(',').includes(p.id))){
    const width=plan.width??(plan.id.startsWith('instructor-')?768:1200);
    const page=await browser.newPage({viewport:{width,height:980},deviceScaleFactor:1,colorScheme:'light',reducedMotion:'reduce'});
    page.setDefaultTimeout(5000);
    try {
    const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Browser: '+e.message)});
    // Reject every remote request, including accidental real action calls.
    await page.route('**/*',route=>route.request().url().startsWith(base)&&route.request().method()==='GET'?route.continue():route.abort());
    await page.goto(`${base}/?screen=${plan.id}`);await page.locator('#root').waitFor();
    if(plan.click)await page.getByRole('button',{name:plan.click,exact:true}).first().click({timeout:5000});
    if(plan.then)await page.getByRole('button',{name:plan.then,exact:true}).first().click();
    if(plan.fill)for(const [name,value]of Object.entries(plan.fill))await page.getByRole('textbox',{name:new RegExp('^'+name)}).fill(value);
    if(['enrol','move'].includes(plan.id))await page.getByRole('radio').nth(plan.id==='move'?1:2).click();
    await page.evaluate(()=>document.fonts.ready);
    const target=plan.dialog?page.getByRole('dialog').last():plan.full?page.locator('body'):page.locator('[data-capture]');
    await target.waitFor();
    if(errors.length)throw Error(`${plan.id}: ${errors.join('; ')}`);
    let box=await target.boundingBox();
    if(plan.id.startsWith('instructor-')) {
      const header=await page.locator('header').boundingBox();
      const menu=await page.getByRole('menu').boundingBox().catch(()=>null);
      box={x:0,y:0,width,height:Math.ceil(Math.max(header.y+header.height,menu?menu.y+menu.height:0)+16)};
      await page.screenshot({path:path.join(dest,`${plan.id}.png`),clip:box,animations:'disabled'});
    } else await target.screenshot({path:path.join(dest,`${plan.id}.png`),animations:'disabled'});
    const png=await fs.readFile(path.join(dest,`${plan.id}.png`));
    manifest[plan.id]={width:png.readUInt32BE(16),height:png.readUInt32BE(20)};
    console.log(`${plan.id}: ${manifest[plan.id].width} × ${manifest[plan.id].height}`);
    } catch(error) { failures.push(plan.id); console.error(`${plan.id}: ${error.message}`); await page.screenshot({path:path.join(output,`${plan.id}-error.png`)}); }
    finally {await page.close();}
  }
  await fs.writeFile(path.join(dest,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  if(failures.length)throw Error(`Screenshots need attention: ${failures.join(', ')}`);
} finally {await browser.close();await new Promise(resolve=>server.close(resolve))}
