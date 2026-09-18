import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { buildPreview } from '../instructor-swimmer-preview/build.mjs';
import { createDocsTestDatabase } from '../../src/test/docs-database.ts';
import { DocumentService, actor, library, requirements, documentView } from '../../src/lib/docs/domain.ts';
import { rows, one } from '../../src/lib/docs/database.ts';
import { canRead, canWrite } from '../../src/lib/docs/types.ts';

export const output = path.resolve('.impeccable/review/docs/site');
export async function docsPreview(port = 0) {
  const actionSource = await fs.readFile('src/app/docs/actions.ts','utf8');
  const names = [...actionSource.matchAll(/export async function (\w+)/g)].map(m=>m[1]);
  await buildPreview({entryPoint:'scripts/docs-preview/fixture.jsx',outputDir:output,pathnameFallback:'/docs',serverMocks:{
    '@/app/docs/actions': names.map(n=>`export async function ${n}(...args){return window.docsAction('${n}',...args)}`).join('\n'),
    'next/navigation': 'export const usePathname=()=>location.pathname; export const useSearchParams=()=>new URLSearchParams(location.search); export const useRouter=()=>({push(href){window.docsNavigating=true;location.assign(href)},replace(href){window.docsNavigating=true;location.replace(href)},refresh(){if(!window.docsNavigating)location.reload()}});',
  }});
  const html = path.join(output, 'index.html');
  await fs.writeFile(html, (await fs.readFile(html, 'utf8')).replace('Instructor preview', 'Turnfin Docs · synthetic preview'));
  await fs.copyFile('public/brand/turnfin.png',path.join(output,'brand/turnfin.png'));
  const db = await createDocsTestDatabase();
  const service = new DocumentService(db);
  const content = (title,type='SOP') => ({schemaVersion:1,title,reference:randomUUID().slice(0,8),type,summary:'Fictional guidance for checking the Docs module.',ownerId:'jamie',facilityIds:['harbour'],teamIds:['aquatics'],reviewDate:'2027-09-18',body:{type:'doc',content:[{type:'heading',attrs:{level:2},content:[{type:'text',text:'Before you begin'}]},{type:'paragraph',content:[{type:'text',text:'Read the handover notes and check the outstanding actions with your team.'}]}]},riskRows:[],riskMatrix:null,relatedIds:[],attachments:[]});
  const published=await service.create('jamie',content('Pool opening procedure'));
  const token=randomUUID();
  const draft=await service.lock('jamie',published,token);
  await service.assign('jamie',published,['riley','alex'],[],'2026-09-25');
  const submission=await service.submit('jamie',published,token,draft.revision,'sam','Initial example');
  await service.review('sam',published,submission,'approved','');
  const editing=await service.create('jamie',content('Closing handover checklist'));
  const reviewing=await service.create('jamie',content('Staff safety policy','Policy'));
  const rd=await service.lock('jamie',reviewing,token);
  const reviewVersion=await service.submit('jamie',reviewing,token,rd.revision,'sam','For review');
  const ids={published,editing,reviewing,reviewVersion};
  const methods={createDocumentAction:'create',startDraftAction:'startDraft',lockAction:'lock',saveDraftAction:'save',submitAction:'submit',reviewAction:'review',acknowledgeAction:'acknowledge',assignAction:'assign',archiveAction:'archive',saveMemberAction:'saveMember',saveGroupAction:'saveGroup',saveMatrixAction:'saveMatrix',saveTemplateAction:'saveTemplate'};
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');
    try {
      if(url.pathname==='/__docs-action'&&req.method==='POST'){
        const chunks=[];for await(const part of req)chunks.push(part);
        const {who,name,args}=JSON.parse(Buffer.concat(chunks).toString());
        if(!methods[name])throw Error('Unknown fixture action');
        try {const data=await service[methods[name]](who,...args);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,data}));}
        catch(e){res.end(JSON.stringify({ok:false,error:e.message,code:e.code||500}));}
        return;
      }
      if(url.pathname==='/__docs-data'){
        const who=url.searchParams.get('who')||'alex',p=url.searchParams.get('path')||'/docs';
        const member=await actor(db,who),groups=await rows(db,'SELECT * FROM groups'),members=await rows(db,'SELECT * FROM members');
        const workspace={now:new Date().toISOString(),member,members:members.filter(canRead),facilities:groups.filter(g=>g.kind==='facility'),teams:groups.filter(g=>g.kind==='team'),templates:await rows(db,'SELECT * FROM templates ORDER BY name'),matrix:(await one(db,"SELECT value FROM settings WHERE id='matrix'")).value,documents:await library(db,who),requirements:await requirements(db,who),localMode:false};
        const id=p.split('/')[3];
        const view=id&&id!=='new'?await documentView(db,who,id,new URLSearchParams(url.searchParams.get('query')).get('version')||undefined):null;
        const data={workspace,view,ids,items:canWrite(member)?await requirements(db,who,true):[],drafts:canWrite(member)?await rows(db,'SELECT * FROM drafts'):[],events:await rows(db,'SELECT * FROM audit_events ORDER BY created_at DESC')};
        res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return;
      }
      const name=url.pathname.startsWith('/docs')||url.pathname==='/modules'?'index.html':url.pathname.slice(1)||'index.html';
      const target=path.resolve(output,name);
      if(req.method!=='GET'||!target.startsWith(output+path.sep)){res.writeHead(403).end();return;}
      const bytes=await fs.readFile(target);
      res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.woff2':'font/woff2','.woff':'font/woff'})[path.extname(target)]||'application/octet-stream');res.end(bytes);
    } catch(error) {res.writeHead(500,{'Content-Type':'application/json'}).end(JSON.stringify({error:error.message}));}
  });
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
  return {server,db,ids,base:`http://127.0.0.1:${server.address().port}`};
}
if(process.argv.includes('--serve-docs')){
  const {base,ids}=await docsPreview(4195);
  console.log(JSON.stringify({base,ids}));
}
