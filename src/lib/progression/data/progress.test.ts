import assert from 'node:assert/strict';
import test from 'node:test';
import {serverModule} from '@/test/server-module';
import {sharedCurriculumRows} from '@/test/curriculum';
test('historical and marks-only programmes stay visible after the last enrolment ends',async()=>{
 const rows=sharedCurriculumRows();let enrolments=[{status:'COMPLETED',levelId:'entry-b',programmeId:'programme-b',level:{sortOrder:0}}];
 const {getStudentProgress}=serverModule<typeof import('./progress')>('src/lib/progression/data/progress.ts',{
  '@/lib/authz':{requireSession:async()=>({})},
  '@/lib/prisma':{prisma:{programme:{findMany:async()=>rows},enrolment:{findMany:async()=>enrolments},levelCompletion:{findMany:async()=>[]},competencyResult:{findMany:async()=>[{competencyId:'entry-b-skill',status:'ACHIEVED',assessedOn:new Date('2026-09-01'),updatedAt:new Date('2026-09-01'),assessedByName:'Synthetic Assessor',note:null}]}}},
 });
 const result=await getStudentProgress('swimmer');assert.equal(result.length,1);assert.equal(result[0].currentLevelId,null);assert.equal(result[0].levels.find(l=>l.id==='entry')?.achieved,1);
 enrolments=[];assert.equal((await getStudentProgress('swimmer')).length,1);
});
