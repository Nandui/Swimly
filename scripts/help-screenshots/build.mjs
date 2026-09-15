import fs from 'node:fs/promises';
import path from 'node:path';
import * as esbuild from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

export const output = path.resolve('.impeccable/review/help-screenshots/site');
export async function buildScreenshots({ entryPoint = 'scripts/help-screenshots/fixture.jsx', outputDirectory = output, title = 'Help screenshot examples' } = {}) {
  const destination = outputDirectory;
  const fixture = {name:'help-screenshot-boundaries',setup(build){
    build.onResolve({filter:/^next\/(navigation|link|image)$|^next-auth\/react$|^@\/lib\/.*\/actions(?:\/|$)/},args=>({path:args.path,namespace:'demo'}));
    build.onResolve({filter:/^@\/(auth|lib\/(prisma|authz|clubs\/current))$/},args=>{throw Error(`Live module forbidden in screenshots: ${args.path}`)});
    build.onLoad({filter:/.*/,namespace:'demo'},async({path:id})=>{
      let contents;
      if(id==='next/navigation') contents='export const usePathname=()=>"/schedule";export const useSearchParams=()=>new URLSearchParams();export const useRouter=()=>({push(){},replace(){},refresh(){}});';
      else if(id==='next/link') contents='export default function Link({href,children,prefetch,scroll,replace,...props}){return <a href={href} {...props}>{children}</a>}';
      else if(id==='next/image') contents='export default function Image({unoptimized,priority,preload,...props}){return <img {...props}/>}';
      else if(id==='next-auth/react') contents='export async function signOut(){throw Error("No live actions in screenshot fixtures")}';
      else {
        const source=await fs.readFile(path.resolve('src',id.slice(2)+'.ts'),'utf8');
        const names=[...source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(match=>match[1]);
        contents=names.map(name=>name==='loadSwimmerHistory'?`export async function ${name}(){return {ok:true,...window.helpDemo.history}}`:name==='searchStudents'?`export async function ${name}(){return window.helpDemo.swimmers}`:`export async function ${name}(){throw Error('Action disabled in screenshots: ${name}')}`).join('\n');
      }
      return {contents,loader:'jsx',resolveDir:process.cwd()};
    });
  }};
  await fs.mkdir(path.join(destination,'brand'),{recursive:true});
  await esbuild.build({entryPoints:[entryPoint],bundle:true,outdir:destination,jsx:'automatic',platform:'browser',format:'iife',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},loader:{'.woff':'file','.woff2':'file'},plugins:[fixture],minify:true});
  const from=path.resolve('src/app/globals.css');
  const css=await postcss([tailwind()]).process(await fs.readFile(from,'utf8'),{from});
  await fs.writeFile(path.join(destination,'app.css'),css.css);
  await fs.copyFile('public/brand/app-logo.png',path.join(destination,'brand/app-logo.png'));
  await fs.writeFile(path.join(destination,'index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="icon" href="data:,"><link rel="stylesheet" href="/app.css"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);
}
