import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { Prisma } from "@/generated/prisma/client";
import { serverModule } from "@/test/server-module";
import { sharedIds } from "@/lib/curriculum/shared";

// Isolated PostgreSQL engine: never loads credentials or the shared database.
test("swimmer history unions, filters and pages records without losing audit boundaries", async t => {
  const db = new PGlite({ parsers: { 1114: (value: string) => new Date(value + "Z") } }); t.after(() => db.close());
  await db.exec(`
    CREATE TABLE "Club" (id text PRIMARY KEY, name text);
    CREATE TABLE "Level" (id text PRIMARY KEY, name text, "programmeId" text);
    CREATE TABLE "Course" (id text PRIMARY KEY, name text, "levelId" text, "clubId" text);
    CREATE TABLE "Enrolment" (id text PRIMARY KEY, "studentId" text, "courseId" text, "levelId" text, "programmeId" text, "startedOn" date);
    CREATE TABLE "AssessmentSession" (id text PRIMARY KEY, date date, "programmeId" text, "clubId" text);
    CREATE TABLE "AssessmentBooking" (id text PRIMARY KEY, "studentId" text, "sessionId" text, "outcomeLevelId" text, "assessedOn" date, "assessedByName" text, status text);
    CREATE TABLE "AuditLog" (id text PRIMARY KEY, entity text, "entityId" text, action text, summary text, "actorName" text, "programmeId" text, "clubId" text, "createdAt" timestamp, details jsonb);
    CREATE TABLE "AttendanceRecord" (id text PRIMARY KEY, "studentId" text, "courseId" text, "markedAt" timestamp, "markedByName" text, date date, status text, note text);
    CREATE TABLE "Competency" (id text PRIMARY KEY, name text, "levelId" text);
    CREATE TABLE "CompetencyResult" (id text PRIMARY KEY, "studentId" text, "competencyId" text, "assessedInCourseId" text, "updatedAt" timestamp, "assessedOn" date, "assessedByName" text, status text);
    CREATE TABLE "LevelCompletion" (id text PRIMARY KEY, "studentId" text, "levelId" text, "programmeId" text, "createdAt" timestamp, "completedOn" date, "confirmedByName" text, note text);
    INSERT INTO "Club" VALUES ('a','Site A'),('b','Site B');
    INSERT INTO "Level" VALUES ('level','Turtles','programme'),('level-b','Turtles','programme-b');
    INSERT INTO "Course" VALUES ('class-a','Friday swim','level','a'),('class-b','Monday swim','level-b','b');
    INSERT INTO "Competency" VALUES ('skill','Front float','level'),('skill-b','Front float','level-b'),('second','Back float','level');
    INSERT INTO "Enrolment" VALUES ('place','swimmer','class-b','level-b','programme-b','2026-08-01'),('other-place','other','class-a','level','programme','2026-08-01');
    INSERT INTO "AttendanceRecord" VALUES ('register','swimmer','class-b','2026-09-01 16:00','Original Teacher','2026-08-31','PRESENT',null);
    INSERT INTO "CompetencyResult" VALUES ('old','swimmer','skill','class-a','2026-08-01','2026-08-01','Teacher A','WORKING_ON'),('latest','swimmer','skill-b','class-b','2026-09-01','2026-09-01','Teacher B','ACHIEVED');
    INSERT INTO "LevelCompletion" VALUES ('milestone','swimmer','level-b','programme-b','2026-09-02','2026-09-02','Teacher B','Well done');
    INSERT INTO "AssessmentSession" VALUES ('session','2026-07-01','programme-b','b');
    INSERT INTO "AssessmentBooking" VALUES ('booking','swimmer','session','level-b','2026-07-01','Assessor','ASSESSED');
    INSERT INTO "AuditLog" VALUES ('own','Student','swimmer','update','Changed own details','Desk','programme','a','2026-09-10',null),
      ('other','Student','other','update','SECRET unrelated swimmer','Desk','programme','a','2026-09-10',null),
      ('other-enrolment','Enrolment','other-place','enrol','SECRET unrelated enrolment','Desk','programme','a','2026-09-10',null),
      ('class-audit','Course','class-b','attendance','SECRET whole register summary','Desk','programme-b','b','2026-09-10',null);
  `);
  let allowed = true, audit = true, reads = 0;
  const ids = (root: string) => sharedIds([{ id: root, sharedWithId: null }, { id: `${root}-b`, sharedWithId: root }]);
  const curriculum = { competencyIds: ids('skill'), levelIds: ids('level'), programmeIds: ids('programme'), competencies: [{id:'skill'},{id:'second'}], levels:[{id:'level'}] };
  class AuthorizationError extends Error {}
  const { getSwimmerHistory } = serverModule<typeof import('./history')>('src/lib/students/data/history.ts', {
    '@/generated/prisma/client': { Prisma },
    '@/lib/authz': { AuthorizationError, requireSession: async()=>({}), canSee:()=>allowed, can:()=>audit },
    '@/lib/curriculum/data/shared': { getSharedCurriculum:async()=>curriculum },
    '@/lib/prisma': { prisma: { $queryRaw:async(query: Prisma.Sql)=> { reads++; return (await db.query(query.text, query.values)).rows; } } },
  });
  await t.test('both sites, latest shared competency, imported completion and assessment are retained',async()=>{
    const page=await getSwimmerHistory('swimmer');
    assert.equal(page.events.filter(e=>e.kind==='competencies').length,1);
    const mark=page.events.find(e=>e.kind==='competencies')!;
    assert.equal(mark.actor,'Teacher B'); assert.equal(mark.programmeId,'programme'); assert.equal(mark.evidence?.after,'ACHIEVED');
    assert.ok(page.events.some(e=>e.kind==='completion')); assert.ok(page.events.some(e=>e.kind==='assessment'));
    assert.ok(page.events.some(e=>e.site==='Site B'));
    assert.ok(page.events.every(e=>!e.title.includes('SECRET')));
  });
  await t.test('structured corrections replace snapshots, retain before/after and filter each competency',async()=>{
    const details={version:1,kind:'competencies',levelId:'level',courseId:'class-b',date:'2026-09-01',changes:[{competencyId:'skill',name:'Front float',before:'WORKING_ON',after:'ACHIEVED'},{competencyId:'second',name:'Back float',before:null,after:'WORKING_ON'}]};
    await db.query(`INSERT INTO "AuditLog" VALUES ('mark-audit','Student','swimmer','assess','Two marks changed','Teacher B','programme','b','2026-09-02',$1)`,[JSON.stringify(details)]);
    const page=await getSwimmerHistory('swimmer',{kind:'competencies',competencyId:'skill-b'});
    assert.equal(page.events.length,1); assert.equal(page.events[0].snapshot,false);
    assert.deepEqual(page.events[0].evidence?.changes,[details.changes[0]]);
    await db.query(`INSERT INTO "AuditLog" VALUES ('attendance-audit','Student','swimmer','attendance-corrected','Attendance corrected','Teacher B','programme','b','2026-09-03',$1)`,[JSON.stringify({version:1,kind:'attendance',courseId:'class-b',date:'2026-08-31',before:'ABSENT',after:'PRESENT',previousNote:'Late arrival expected',note:null})]);
    const attendance=await getSwimmerHistory('swimmer',{kind:'attendance',courseId:'class-b',from:'2026-08-31',to:'2026-08-31'});
    assert.equal(attendance.events.length,1); assert.equal(attendance.events[0].evidence?.before,'ABSENT');
    assert.equal((await getSwimmerHistory('swimmer',{from:'2026-09-01',kind:'attendance'})).events.length,0);
    assert.equal((await getSwimmerHistory('swimmer',{programmeId:'programme-b',q:'Two marks'})).events.length,1);
  });
  await t.test('activity permission is enforced and snapshots remain useful without audit access',async()=>{
    audit=false;
    const page=await getSwimmerHistory('swimmer');
    assert.equal(page.canAudit,false); assert.ok(page.events.every(e=>e.snapshot));
    assert.ok(page.events.some(e=>e.kind==='attendance')); assert.ok(page.events.some(e=>e.kind==='competencies'));
    audit=true; allowed=false; const before=reads;
    await assert.rejects(getSwimmerHistory('swimmer'),AuthorizationError); assert.equal(reads,before); allowed=true;
  });
  await t.test('invalid action inputs fail closed before a query; search remains parameterized',async()=>{
    const before=reads;
    for(const query of [null,{q:5},{courseId:{}},{cursor:{at:'bad',id:'x'}}]) assert.equal((await getSwimmerHistory('swimmer',query as never)).events.length,0);
    assert.equal(reads,before);
    assert.equal((await getSwimmerHistory('swimmer',{q:"'; DROP TABLE test; --"})).events.length,0);
  });
  await t.test('stable cursor retains every event when more than 30 have the same timestamp',async()=>{
    await db.exec(`INSERT INTO "AuditLog" SELECT 'paged-'||n, 'Student','swimmer','update','Synthetic event '||n,'Desk','programme','a','2026-09-12',null FROM generate_series(1,45) n;`);
    const ids:string[]=[]; let cursor;
    do { const page=await getSwimmerHistory('swimmer',{cursor}); ids.push(...page.events.map(e=>e.id)); cursor=page.next??undefined; } while(cursor);
    assert.equal(new Set(ids).size,ids.length); assert.equal(ids.filter(id=>id.startsWith('audit:paged-')).length,45);
  });
});
