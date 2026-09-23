import fs from 'node:fs/promises';
import path from 'node:path';
import { buildPreview, servePreview } from '../instructor-swimmer-preview/build.mjs';

const implementation = process.argv.includes('--implementation');
const outputDir = path.resolve(`.impeccable/review/reception-portal/${implementation ? 'implementation' : 'site'}`);
await buildPreview({
  entryPoint: `scripts/reception-portal-preview/${implementation ? 'implementation' : 'fixture'}.jsx`, outputDir, pathnameFallback: '/reception-portal',
  allowedActions: implementation ? ['switchClub', 'createStudent'] : [],
  actionTarget: 'window.receptionFixture.action',
  serverMocks: implementation ? {
    'next-auth/react': `export async function signOut(options) {
      window.receptionFixture.calls.push({name:'signOut'});
      if(new URLSearchParams(location.search).has('signout-error')) throw Error('Synthetic sign-out failure');
      location.assign(options.redirectTo);
    }`,
  } : {},
});
await fs.copyFile('public/brand/turnfin.png', path.join(outputDir, 'brand/turnfin.png'));
const html = path.join(outputDir, 'index.html');
await fs.writeFile(html, (await fs.readFile(html, 'utf8')).replace('Instructor preview', 'Turnfin Reception Portal · design preview').replace('href="data:,"', 'href="/brand/turnfin.png"'));
if (!process.argv.includes('--build-only')) {
  const { base } = await servePreview(Number(process.env.RECEPTION_PREVIEW_PORT || (implementation ? 4200 : 4198)), outputDir, ['reception-portal', 'modules', 'students', 'students/parents', 'start', 'courses', 'assessments', 'together', 'awaiting-enrolment', 'legend-agreements', 'docs', 'docs/work', 'account', 'help', 'sign-in']);
  console.log(`Turnfin Reception Portal preview: ${base}/reception-portal`);
}
