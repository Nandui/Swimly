import {buildAnalyticsPreview, outputDir, routes} from './build.mjs';
import {servePreview} from '../instructor-swimmer-preview/build.mjs';
await buildAnalyticsPreview();
const {base} = await servePreview(4194,outputDir,routes);
console.log(`Synthetic weekly analytics preview: ${base}/analytics`);
