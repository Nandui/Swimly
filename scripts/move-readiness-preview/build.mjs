import path from 'node:path';
import { buildPreview, servePreview } from '../instructor-swimmer-preview/build.mjs';

const outputDir = path.resolve('.impeccable/review/move-readiness/site');
await buildPreview({ entryPoint: 'scripts/move-readiness-preview/fixture.jsx', outputDir,
  allowedActions: ['confirmLevelCompletion', 'cancelInstructorMoveReadiness', 'saveInstructorAssessment', 'transferEnrolment'],
  actionTarget: 'window.movePreview.save' });
if (process.argv.includes('--serve-moves')) {
  const { base } = await servePreview(Number(process.env.MOVE_PREVIEW_PORT || 4197), outputDir, ['awaiting-enrolment']);
  console.log(`Synthetic readiness preview: ${base}/instructor/classes/example-class`);
}
