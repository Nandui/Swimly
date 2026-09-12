import assert from 'node:assert/strict';
import test from 'node:test';
import {nextLesson,chapterOrder} from './history';
import type {StudentEnrolment} from '@/lib/enrolment/data/enrolments';
const place=(id:string,dayOfWeek='FRIDAY',start='2026-01-01')=>({id,status:'ACTIVE',startedOn:new Date(start),scheduledEndOn:null,course:{dayOfWeek,startMinutes:960,archivedAt:null}} as StudentEnrolment);
test('next lesson uses Dublin time, respects future starts and scheduled ends across simultaneous places',()=>{
 const friday=place('a'),monday=place('b','MONDAY');
 assert.equal(nextLesson([friday,monday],new Date('2026-09-11T14:00:00Z'))?.date,'2026-09-11');
 assert.equal(nextLesson([friday,monday],new Date('2026-09-11T15:00:00Z'))?.enrolment.id,'b');
 friday.startedOn=new Date('2026-10-01');
 assert.equal(nextLesson([friday],new Date('2026-09-12T12:00:00Z'))?.date,'2026-10-02');
 friday.scheduledEndOn=new Date('2026-10-02');
 assert.equal(nextLesson([friday],new Date('2026-09-12T12:00:00Z')),null);
 monday.status='WAITLISTED'; assert.equal(nextLesson([monday]),null);
});
test('every enrolment remains a separate chapter with current places first',()=>{
 const old=place('old','FRIDAY','2025-01-01');old.status='COMPLETED';
 const newer=place('new','FRIDAY','2026-01-01');newer.status='WITHDRAWN';
 const current=place('current','MONDAY','2025-06-01');
 const rows=[old,newer,current];assert.deepEqual(chapterOrder(rows).map(r=>r.id),['current','new','old']);assert.equal(rows[0],old);
});
