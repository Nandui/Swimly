import path from 'node:path';
import {buildPreview,servePreview} from '../instructor-swimmer-preview/build.mjs';

const outputDir=path.resolve('.impeccable/review/legend-agreements/site');
await buildPreview({entryPoint:'scripts/legend-agreements-preview/fixture.jsx',outputDir,
  allowedActions:['confirmLegendAgreement','enrolStudent','promoteFromWaitlist','transferEnrolment','searchStudents'],
  actionTarget:'window.agreementsPreview.save',pathnameFallback:'/legend-agreements'});
const {base}=await servePreview(Number(process.env.AGREEMENT_PREVIEW_PORT||4192),outputDir,['legend-agreements','enrol']);
console.log(`Synthetic Legend agreements preview: ${base}/legend-agreements`);
console.log(`Synthetic enrolment forms: ${base}/enrol`);
