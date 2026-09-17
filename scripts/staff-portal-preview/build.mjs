import fs from 'node:fs/promises';
import path from 'node:path';
import {buildPreview} from '../instructor-swimmer-preview/build.mjs';

export const outputDir = path.resolve('.impeccable/review/staff-portal/site');
export async function buildPortalPreview() {
  await buildPreview({
    entryPoint: 'scripts/staff-portal-preview/fixture.jsx', outputDir,
    pathnameFallback: '/modules', allowedActions: [],
    serverMocks: {
      'next-auth/react': `export async function signOut(options) {
        window.portalPreview.calls.push(options);
        await new Promise(resolve => setTimeout(resolve, 200));
        if (window.portalPreview.fail) throw Error('Synthetic sign-out failure');
        location.assign(options.redirectTo);
      }`,
    },
  });
  await fs.copyFile('public/brand/turnfin.png', path.join(outputDir, 'brand/turnfin.png'));
  const file = path.join(outputDir, 'index.html');
  await fs.writeFile(file, (await fs.readFile(file, 'utf8'))
    .replace('Instructor preview', 'Turnfin staff portal preview')
    .replace('href="data:,"', 'href="/brand/turnfin.png"'));
}
