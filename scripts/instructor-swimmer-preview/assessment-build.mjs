import path from 'node:path';
import {buildPreview,servePreview} from './build.mjs';

export const output=path.resolve('.impeccable/review/instructor-assessments/site');
export async function buildAssessmentPreview() {
  await buildPreview({entryPoint:'scripts/instructor-swimmer-preview/assessment-fixture.jsx',outputDir:output,
    pathnameFallback:'/instructor',
    allowedActions:['recordOutcome','markNoShow'],actionTarget:'window.assessmentPreview.save',serverMocks:{
      '@/lib/page-guards':'export async function screenPage(){return {user:{id:"example-teacher",name:"Alex Example"}}}',
      '@/lib/authz':'export const can=(_session,permission)=>permission==="assessments.run"&&!new URLSearchParams(location.search).has("no-run");',
      '@/modules/activities/shared/courses/data/courses':'export async function getCoursesOnDay(){return window.assessmentPreview.courses||[]}',
      '@/modules/activities/shared/attendance/data/register':'export async function getRegisterStateForDay(){return new Set()}',
      '@/modules/activities/shared/attendance/data/cover':'export async function getCoversForDay(){return new Map(window.assessmentPreview.covers||[])}',
      '@/modules/activities/shared/cancellations/data':'export async function getCancellationsForDay(){return new Map()}',
      '@/modules/activities/shared/today/assessments':'export async function getTodayAssessments(date){window.assessmentPreview.listDates.push(date); return window.assessmentPreview.sessions}',
    }});
}
if(process.argv.includes('--serve-assessments')) {
  await buildAssessmentPreview();
  const {base}=await servePreview(4191,output);
  console.log(`Synthetic instructor assessments: ${base}`);
}
