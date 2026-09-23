import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { buildPreview } from '../instructor-swimmer-preview/build.mjs';
import { isolatedPrisma } from '../../src/test/pglite-prisma.ts';
import { serverModule } from '../../src/test/server-module.ts';

const outputDir = path.resolve('.impeccable/review/refunds/site');
await buildPreview({ entryPoint:'scripts/refunds-preview/fixture.jsx', outputDir, pathnameFallback:'/refunds', allowedActions:['saveRefund','retryRefundEmails'], actionTarget:'window.refundPreview.action', serverMocks:{
  'next/navigation': `export const usePathname=()=>location.pathname; export const useSearchParams=()=>new URLSearchParams(location.search); export const useRouter=()=>({push(href){window.refundNavigating=true;location.assign(href)},refresh(){if(!window.refundNavigating)location.reload()}});`,
  'next-auth/react': `export async function signOut(){sessionStorage.removeItem('refund-preview-role');location.assign('/refunds')}`,
}});
await fs.copyFile('public/brand/turnfin.png',path.join(outputDir,'brand/turnfin.png'));
const htmlFile=path.join(outputDir,'index.html');
await fs.writeFile(htmlFile,(await fs.readFile(htmlFile,'utf8')).replace('Instructor preview','Turnfin Refunds · isolated preview').replace('href="data:,"','href="/brand/turnfin.png"'));
if(process.argv.includes('--build-only')) process.exit(0);

// This helper creates an in-memory PostgreSQL engine; it never reads a live URL.
const sandbox = await isolatedPrisma(), context = new AsyncLocalStorage();
const profiles = {
  reception:{id:'preview-reception',name:'Alex Example',permissions:['refunds.request']},
  finance:{id:'preview-finance',name:'Riley Example',permissions:['refunds.review','refunds.process']},
  reader:{id:'preview-reader',name:'Jamie Example',permissions:['refunds.read']},
};
for(const [key,user] of Object.entries(profiles)) {
  await sandbox.prisma.staffRole.create({data:{id:`refund-${key}`,name:`Example ${key}`,permissions:user.permissions,screens:['refunds']}});
  await sandbox.prisma.user.create({data:{id:user.id,name:user.name,email:`${key}@example.test`,staffRoleId:`refund-${key}`}});
}
const sites=await sandbox.prisma.club.findMany({orderBy:{sortOrder:'asc'},select:{id:true,name:true}});
const doubles={
  '@/lib/prisma':{prisma:sandbox.prisma},
  '@/auth':{auth:async()=>({user:{...profiles[context.getStore()||'reception'],screens:['refunds']}})},
  '@/lib/clubs/current':{currentClubIdIfAny:async()=>null},
  '@/lib/parent/email':{parentEmailConfig:()=>({sender:'preview@example.test',fromHeader:'Preview <preview@example.test>'})},
  '@/lib/email/google':{sendGoogleTextEmail:async()=>{}},
  'next/cache':{revalidatePath(){}},
};
const service=serverModule('src/lib/refunds/service.ts',doubles), actions=serverModule('src/lib/refunds/actions.ts',doubles), data=serverModule('src/lib/refunds/data.ts',doubles), files=serverModule('src/lib/refunds/files.ts',doubles), auth=serverModule('src/lib/refunds/auth.ts',doubles);
process.env.REFUNDS_APP_URL='https://preview.example.test';
const reception={id:profiles.reception.id,name:profiles.reception.name,request:true,review:false,process:false}, finance={id:profiles.finance.id,name:profiles.finance.name,request:false,review:true,process:true};
for(const [index,name,site,serviceKind,amount] of [[1,'Casey Example',sites[0],'MEMBERSHIP','80'],[2,'Morgan Example',sites[1],'BOOKING','45'],[3,'Avery Example',sites[0],'AQUATICS','125'],[4,'Taylor Example',sites[1],'OTHER','20']]) {
  let row=await service.mutateRefund(reception,{id:randomUUID(),version:0,operationId:randomUUID(),action:'submit',fields:{clubId:site.id,customerName:name,contactEmail:'customer@example.test',contactPhone:'',memberNumber:`EXAMPLE-${index}`,service:serviceKind,description:'Example customer purchase',amount,paymentDate:'2026-09-01',paymentReference:`EXAMPLE-PAY-${index}`,reason:'Duplicate payment — example request'}});
  if(index===2) row=await service.mutateRefund(finance,{id:row.id,version:row.version,operationId:randomUUID(),action:'approve',amount:'35',note:'Example reduction for the portion already used.'});
  if(index===3) await service.mutateRefund(finance,{id:row.id,version:row.version,operationId:randomUUID(),action:'information',note:'Please confirm the date of the original payment and attach the receipt if available.'});
}
async function body(req) {const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>4*1024*1024+128*1024)throw Error('Upload too large.');chunks.push(chunk)}return Buffer.concat(chunks)}
const server=http.createServer((req,res)=>context.run(Object.hasOwn(profiles,req.headers['x-preview-role'])?req.headers['x-preview-role']:'reception',async()=>{
  const url=new URL(req.url,'http://127.0.0.1');
  const json=(payload,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(payload))};
  try {
    if(url.pathname==='/preview/data') {
      const target=new URL(url.searchParams.get('href')||'/refunds','http://127.0.0.1'), who=await auth.requireRefundActor();
      if(target.pathname==='/refunds/new') {if(!who.request)throw Error('Request permission required.');return json({kind:'new',who,id:randomUUID(),sites})}
      if(target.pathname.startsWith('/refunds/')) return json({kind:'detail',who,detail:await data.getRefund(target.pathname.split('/')[2]),sites});
      return json({kind:'queue',who,queue:await data.listRefunds(Object.fromEntries(target.searchParams))});
    }
    if(url.pathname==='/preview/action'&&req.method==='POST') {const input=JSON.parse((await body(req)).toString());if(!['saveRefund','retryRefundEmails'].includes(input.name))throw Error('Unknown action');return json(await actions[input.name](...input.args))}
    if(url.pathname==='/api/refunds/files'&&req.method==='POST') {
      const form=await new Response(await body(req),{headers:{'Content-Type':req.headers['content-type']}}).formData();
      const row=await files.changeReceipt(await auth.requireRefundActor(),{id:String(form.get('id')),version:Number(form.get('version')),operationId:String(form.get('operationId')),attachmentId:String(form.get('attachmentId'))},form.get('file')||undefined);
      return json({ok:true,id:row.id,version:row.version});
    }
    if(url.pathname.startsWith('/api/refunds/files/')) {const file=await files.readReceipt(await auth.requireRefundActor(),url.pathname.split('/').pop());res.writeHead(200,{'Content-Type':file.mime,'Content-Disposition':'attachment'});return res.end(Buffer.from(file.bytes))}
    const name=url.pathname==='/'||url.pathname==='/refunds'||url.pathname.startsWith('/refunds/')?'index.html':url.pathname.slice(1), target=path.resolve(outputDir,name);
    if(req.method!=='GET'||!target.startsWith(outputDir+path.sep)) {res.writeHead(403).end();return}
    const content=await fs.readFile(target);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff':'font/woff','.woff2':'font/woff2'})[path.extname(target)]||'application/octet-stream'});res.end(content);
  } catch(error) {json({ok:false,error:error.message||'Preview unavailable'},400)}
}));
server.listen(Number(process.env.REFUNDS_PREVIEW_PORT||4201),'127.0.0.1',()=>console.log('Isolated Refunds preview: http://127.0.0.1:4201/refunds'));
