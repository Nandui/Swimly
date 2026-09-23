import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
import {buildPreview} from '../instructor-swimmer-preview/build.mjs';
import {isolatedPrisma} from '../../src/test/pglite-prisma.ts';
import {serverModule} from '../../src/test/server-module.ts';
const outputDir=path.resolve('.impeccable/review/enrolment-follow-up/site');
await buildPreview({entryPoint:'scripts/follow-up-preview/fixture.jsx',outputDir,pathnameFallback:'/awaiting-enrolment',allowedActions:['addFollowUp','getFollowUpHistory'],actionTarget:'window.followUpPreview.action',serverMocks:{'next/navigation':`export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push(href){location.assign(href)},refresh(){window.followUpPreview.refresh()}});`}});
const htmlFile=path.join(outputDir,'index.html');
await fs.writeFile(htmlFile,(await fs.readFile(htmlFile,'utf8')).replace('Instructor preview','Awaiting enrolment · follow-up preview'));
if(process.argv.includes('--build-only'))process.exit(0);
const fixture=await isolatedPrisma(), db=fixture.prisma, context=new AsyncLocalStorage();
await db.user.create({data:{id:'example-reception',name:'Alex Example',email:'reception@example.test'}});
await db.programme.create({data:{id:'example-programme',clubId:'club_bishopstown',name:'Water Safety & Fun'}});
await db.level.create({data:{id:'example-level',programmeId:'example-programme',name:'Turtles'}});
await db.level.create({data:{id:'example-next-level',programmeId:'example-programme',name:'Dolphins',sortOrder:2}});
await db.competency.create({data:{id:'example-skill',levelId:'example-level',name:'Float safely'}});
await db.course.create({data:{id:'example-class',clubId:'club_bishopstown',levelId:'example-level',dayOfWeek:'SATURDAY',startMinutes:600,durationMinutes:30,location:'Learner pool'}});
await db.assessmentSession.create({data:{id:'example-assessment',clubId:'club_bishopstown',programmeId:'example-programme',date:new Date('2026-09-01'),startMinutes:900}});
for(const firstName of ['Avery','Jamie','Morgan']){
 const id='example-'+firstName.toLowerCase();
 await db.student.create({data:{id,clubId:'club_bishopstown',firstName,lastName:'Example',contactName:'Example parent',contactEmail:'parent@example.test',memberNumber:'EXAMPLE-'+firstName.toUpperCase()}});
 await db.assessmentBooking.create({data:{sessionId:'example-assessment',studentId:id,status:'ATTENDED',outcomeLevelId:'example-level',assessedOn:new Date('2026-09-01'),bookedByName:'Example staff'}});
}
await db.enrolment.create({data:{studentId:'example-morgan',courseId:'example-class',programmeId:'example-programme',levelId:'example-level',startedOn:new Date('2026-09-01'),readyToMoveAt:new Date('2026-09-02'),readyToMoveLevelId:'example-level',readyToMoveByName:'Casey Example',readyToMoveNote:'Confident and ready for the next level.'}});
await db.competencyResult.create({data:{studentId:'example-morgan',competencyId:'example-skill',status:'ACHIEVED',assessedOn:new Date('2026-09-02'),assessedByName:'Casey Example'}});
await db.levelCompletion.create({data:{studentId:'example-morgan',levelId:'example-level',programmeId:'example-programme',competenciesAchieved:1,competencyCount:1,completedOn:new Date('2026-09-02'),confirmedByName:'Casey Example'}});
const doubles={
 '@/lib/prisma':{prisma:db},
 '@/lib/authz':{AuthorizationError:Error,requireSession:async()=>({user:{id:'example-reception',name:'Alex Example',permissions:context.getStore()==='reader'?[]:['enrolment.manage'],screens:['awaiting-enrolment','students']}}),can:(actor,key)=>actor.user.permissions.includes(key),canSee:(actor,key)=>actor.user.screens.includes(key)},
 '@/lib/clubs/current':{currentClubId:async()=>'club_bishopstown',currentClubIdIfAny:async()=>'club_bishopstown'},
 'next/cache':{revalidatePath(){}},react:{cache:fn=>fn},
};
const actions=serverModule('src/lib/enrolment/actions/follow-up.ts',doubles), reads=serverModule('src/lib/enrolment/data/awaiting-enrolment.ts',doubles), moves=serverModule('src/lib/enrolment/data/awaiting-moves.ts',doubles);
for(const [studentId,outcome,note,date,next] of [['example-avery','NO_REPLY','Called the parent; no answer. Try again in the afternoon.','2026-09-02','2026-09-03'],['example-avery','PARENT_NOT_READY','Parent would like to wait until the school routine settles. Call again next week.','2026-09-03','2026-10-01'],['example-morgan','NO_SUITABLE_CLASS','Checked both sites. Family needs a Saturday morning place; none suitable currently.','2026-09-02','2026-09-03']]){
 const history=await actions.getFollowUpHistory(studentId);
 await actions.addFollowUp({studentId,operationId:randomUUID(),expectedLatest:history.summary.latest?.sequence??null,channel:outcome==='NO_SUITABLE_CLASS'?'INTERNAL':'PHONE',outcome,note,occurredOn:date,nextContactOn:next});
}
const server=http.createServer((req,res)=>context.run(req.headers['x-preview-role']==='reader'?'reader':'reception',async()=>{
 const url=new URL(req.url,'http://127.0.0.1');const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
 try{
  if(url.pathname==='/preview/queue')return json(await (url.searchParams.get('view')==='moves'?moves.getAwaitingMoves:reads.getAwaitingEnrolment)({q:url.searchParams.get('q')||'',page:Number(url.searchParams.get('page')||1)}));
  if(url.pathname==='/preview/action'&&req.method==='POST'){let body='';for await(const chunk of req){body+=chunk;if(body.length>32000)throw Error('Request too large');}const {name,args}=JSON.parse(body);if(!['getFollowUpHistory','addFollowUp'].includes(name))throw Error('Action unavailable');return json(await actions[name](...args));}
  const route=url.pathname==='/'||url.pathname==='/awaiting-enrolment'||url.pathname.startsWith('/students/')?'index.html':url.pathname.slice(1), target=path.resolve(outputDir,route);
  if(req.method!=='GET'||!target.startsWith(outputDir+path.sep)){res.writeHead(403).end();return;}
  const bytes=await fs.readFile(target);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff':'font/woff','.woff2':'font/woff2'})[path.extname(target)]||'application/octet-stream'});res.end(bytes);
 }catch(error){json({error:error.message},400);}
}));
server.listen(4202,'127.0.0.1',()=>console.log('Follow-up preview: http://127.0.0.1:4202/awaiting-enrolment'));
