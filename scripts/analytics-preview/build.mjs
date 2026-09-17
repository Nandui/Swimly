import path from 'node:path';
import fs from 'node:fs/promises';
import {buildPreview} from '../instructor-swimmer-preview/build.mjs';

export const outputDir = path.resolve('.impeccable/review/analytics/site');
export const routes = ['analytics', 'analytics/reception', 'analytics/instructors'];
export async function buildAnalyticsPreview() {
  await buildPreview({entryPoint:'scripts/analytics-preview/fixture.jsx',outputDir,pathnameFallback:'/analytics',allowedActions:[]});
  const file = path.join(outputDir,'index.html');
  await fs.writeFile(file,(await fs.readFile(file,'utf8')).replace('Instructor preview','Weekly analytics preview'));
}
