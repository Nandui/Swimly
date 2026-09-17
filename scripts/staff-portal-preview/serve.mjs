import {servePreview} from '../instructor-swimmer-preview/build.mjs';
import {buildPortalPreview, outputDir} from './build.mjs';

await buildPortalPreview();
const {base} = await servePreview(4193, outputDir, ['modules', 'start', 'sign-in']);
console.log(`Synthetic staff portal preview: ${base}/modules`);
