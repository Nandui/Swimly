import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import * as esbuild from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

export const output = path.resolve('.impeccable/review/instructor-swimmers/site');
export async function buildPreview({entryPoint='scripts/instructor-swimmer-preview/fixture.jsx', outputDir=output, serverMocks={}, allowedActions=['saveInstructorAssessment','saveClassAssessment'], actionTarget='window.swimmerPreview.save', pathnameFallback='/instructor/classes/example-class'} = {}) {
  await fs.mkdir(outputDir,{recursive:true});
  await fs.mkdir(path.join(outputDir,'brand'),{recursive:true});
  await fs.copyFile('public/brand/app-logo.png',path.join(outputDir,'brand/app-logo.png'));
  const boundaries={name:'synthetic-instructor-boundaries',setup(build){
    build.onResolve({filter:/^@\//},args=>Object.hasOwn(serverMocks,args.path)?{path:args.path,namespace:'fixture-data'}:undefined);
    build.onLoad({filter:/.*/,namespace:'fixture-data'},({path:id})=>({contents:serverMocks[id],loader:'js',resolveDir:process.cwd()}));
    build.onResolve({filter:/^next\/(navigation|link|image)$|^next-auth\/react$|^@\/lib\/.*\/actions(?:\/|$)/}, args=>({path:args.path,namespace:'synthetic'}));
    build.onResolve({filter:/^@\/(auth|lib\/(prisma|authz|clubs\/current))$|^server-only$/},args=>{throw Error(`Live module forbidden: ${args.path}`)});
    build.onLoad({filter:/.*/,namespace:'synthetic'},async({path:id})=>{
      let contents;
      if(id==='next/navigation') contents=`export const usePathname=()=>location.pathname==='/'?${JSON.stringify(pathnameFallback)}:location.pathname; export const useSearchParams=()=>new URLSearchParams(location.search); export const useRouter=()=>({push(){},replace(){},refresh(){}});`;
      else if(id==='next/link') contents='export default function Link({href,children,prefetch,scroll,replace,...props}){return <a href={href} {...props}>{children}</a>}';
      else if(id==='next/image') contents='export default function Image({unoptimized,priority,preload,...props}){return <img {...props}/>}';
      else if(id==='next-auth/react') contents='export async function signOut(){throw Error("No live sign-out in preview")}';
      else {
        const source=await fs.readFile(path.resolve('src',id.slice(2)+'.ts'),'utf8');
        const names=[...source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(match=>match[1]);
        contents=names.map(name=>allowedActions.includes(name)
          ? `export async function ${name}(...args){return ${actionTarget}('${name}',...args)}`
          : `export async function ${name}(){throw Error('Action disabled in synthetic preview: ${name}')}`).join('\n');
      }
      return {contents,loader:'jsx',resolveDir:process.cwd()};
    });
  }};
  await esbuild.build({entryPoints:[entryPoint],entryNames:'fixture',bundle:true,outdir:outputDir,jsx:'automatic',platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},loader:{'.woff':'file','.woff2':'file'},plugins:[boundaries]});
  const from=path.resolve('src/app/globals.css');
  const css=await postcss([tailwind()]).process(await fs.readFile(from,'utf8'),{from});
  await fs.writeFile(path.join(outputDir,'app.css'),css.css);
  await fs.writeFile(path.join(outputDir,'index.html'),'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Instructor preview</title><link rel="icon" href="data:,"><link rel="stylesheet" href="/app.css"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
}
export async function servePreview(port=0, directory=output, pageRoutes=[]) {
  const server=http.createServer(async(req,res)=>{
    const route=new URL(req.url,'http://localhost').pathname.slice(1);
    const name=!route||route==='instructor'||route.startsWith('instructor/')||pageRoutes.includes(route)?'index.html':route;
    const file=path.resolve(directory,name);
    if(req.method!=='GET'||!file.startsWith(directory+path.sep)){res.writeHead(403).end();return;}
    try {const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.woff2':'font/woff2','.woff':'font/woff'})[path.extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
  return {server,base:`http://127.0.0.1:${server.address().port}`};
}
if(process.argv.includes('--serve')) {
  await buildPreview();
  const {base}=await servePreview(Number(process.env.INSTRUCTOR_PREVIEW_PORT||4190));
  console.log(`Synthetic instructor preview: ${base}`);
}
