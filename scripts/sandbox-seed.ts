import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";
import type { PrismaClient } from "../src/generated/prisma/client";

/** Extra fictional data for `npm run sandbox`, loaded by scripts/sandbox.mts.
 *  Everything here is synthetic and only ever written to the throwaway PGlite
 *  databases the sandbox starts. Never import this from app code. */

const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;

type Ctx = { prisma: PrismaClient; docsUrl: string; hrUrl: string | null; roles: Record<string, string> };

export async function seed(ctx: Ctx) {
  await seedAquatics(ctx.prisma);
  await seedTraining(ctx.prisma);
  if (ctx.hrUrl) await seedHr(ctx.prisma, ctx.hrUrl);
  await seedRota(ctx.prisma);
}

/** Two sites' worth of classes so the deck and desk surfaces can be checked:
 *  Ava teaches Otters at Churchfield today, Riley teaches Seals there too, and
 *  one Bishopstown class shows that the site lookup stays on its own site. A
 *  parent has a pending change request waiting for reception. */
async function seedAquatics(db: PrismaClient) {
  const today = DAYS[new Date().getDay()];
  const programme = await db.programme.create({ data: { clubId: "club_churchfield", name: "Learn to swim" } });
  const otters = await db.level.create({ data: { programmeId: programme.id, name: "Otters", sortOrder: 0 } });
  const seals = await db.level.create({ data: { programmeId: programme.id, name: "Seals", sortOrder: 1 } });
  const farProgramme = await db.programme.create({ data: { clubId: "club_bishopstown", name: "Learn to swim" } });
  const farLevel = await db.level.create({ data: { programmeId: farProgramme.id, name: "Otters" } });

  const courses = {
    ava: await db.course.create({ data: { clubId: "club_churchfield", levelId: otters.id, dayOfWeek: today, startMinutes: 16 * 60, durationMinutes: 30, location: "Learner pool", instructorId: "sbx_ava" } }),
    riley: await db.course.create({ data: { clubId: "club_churchfield", levelId: seals.id, dayOfWeek: today, startMinutes: 17 * 60, durationMinutes: 30, location: "Main pool", instructorId: "sbx_riley" } }),
    far: await db.course.create({ data: { clubId: "club_bishopstown", levelId: farLevel.id, dayOfWeek: today, startMinutes: 16 * 60, durationMinutes: 30, location: "Learner pool", instructorId: "sbx_riley" } }),
  };

  const swimmers = [
    { first: "Robin", last: "Sample", course: courses.ava, level: otters, programme, medical: "Synthetic: mild asthma, inhaler in kit bag" },
    { first: "Jamie", last: "Sample", course: courses.ava, level: otters, programme, medical: null },
    { first: "Casey", last: "Placeholder", course: courses.riley, level: seals, programme, medical: "Synthetic: grommets, no deep-water jumps" },
    { first: "Morgan", last: "Placeholder", course: courses.riley, level: seals, programme, medical: null },
    { first: "Quinn", last: "Fictional", course: courses.far, level: farLevel, programme: farProgramme, medical: "Synthetic: nut allergy" },
  ];
  const ids: Record<string, string> = {};
  for (const s of swimmers) {
    const student = await db.student.create({ data: {
      clubId: s.course.clubId, firstName: s.first, lastName: s.last, dateOfBirth: new Date("2018-05-01T00:00:00Z"),
      medicalNotes: s.medical, contactName: `${s.last} family`, contactEmail: `${s.first.toLowerCase()}.family@example.test`, contactPhone: "000 000 0000",
      emergencyName: "Synthetic Neighbour", emergencyPhone: "000 111 1111", emergencyRelationship: "Neighbour",
    } });
    await db.enrolment.create({ data: { studentId: student.id, courseId: s.course.id, levelId: s.level.id, programmeId: s.programme.id, startedOn: new Date("2026-01-05T00:00:00Z") } });
    ids[s.first] = student.id;
  }

  const parent = await db.parentAccount.create({ data: { email: "sample.parent@example.test", name: "Sample Parent" } });
  await db.parentChildAccess.create({ data: { studentId: ids.Robin, parentEmail: parent.email, source: "STAFF_APPROVAL" } });
  const proposed = { contactPhone: "000 222 3333", medicalNotes: "Synthetic: mild asthma, inhaler in kit bag. Now also uses a spacer." };
  await db.parentChangeRequest.create({ data: {
    parentId: parent.id, studentId: ids.Robin, key: "sandbox-change-0001", proposed, message: "New number and an update from the GP",
    requestHash: createHash("sha256").update(JSON.stringify([ids.Robin, proposed, "sandbox"])).digest("hex"),
  } });
}

/** Training: Liam leads training for Aquatics (a department-scoped role), so
 *  he assigns and signs off for Ava and Riley but not for reception. Riley is
 *  waiting for sign-off on the rescue refresher that renews his expired NPLQ;
 *  Ava has one course to do and one overdue. */
async function seedTraining(db: PrismaClient) {
  const ORG = "org_leisureworld";
  const lead = await db.staffRole.create({ data: {
    name: "Training lead", permissions: ["training.assign", "training.signoff"], screens: ["training"], sortOrder: 30,
    description: "Assigns and signs off training for the people in their scope.",
  } });
  await db.roleAssignment.create({ data: { orgId: ORG, userId: "sbx_liam", roleId: lead.id, scopeKind: "department", scopeId: "dept_aquatics", grantedById: "sbx_alex" } });
  const course = (title: string, summary: string, content: string, requiresSignoff: boolean, grantsTypeId: string | null) =>
    db.trainingCourse.create({ data: { orgId: ORG, title, summary, content, requiresSignoff, grantsTypeId, createdById: "sbx_alex" } });
  const rescue = await course("Pool rescue refresher", "Spinal and deep-water rescue, renewed every two years.",
    "1. Read the rescue procedure in Docs.\n2. Practise the spinal roll and a deep-water tow with a colleague.\n3. Ask for sign-off when you are ready; a trainer watches you do both.", true, "qt_nplq");
  const safeguarding = await course("Safeguarding e-learning", "Recognising and reporting concerns about a child.",
    "Read the safeguarding policy and the reporting flowchart, then mark this done.", false, "qt_safeguarding");
  await course("Chemical handling", "Safe storage and dosing in the plant room.", "Walk through the plant room checklist with the duty manager.", true, null);
  const day = (offset: number) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + offset); return d; };
  await db.trainingAssignment.createMany({ data: [
    { orgId: ORG, courseId: rescue.id, userId: "sbx_ava", dueOn: day(14), assignedById: "sbx_liam", assignedByName: "Liam Example" },
    { orgId: ORG, courseId: safeguarding.id, userId: "sbx_ava", dueOn: day(-3), assignedById: "sbx_liam", assignedByName: "Liam Example" },
    { orgId: ORG, courseId: rescue.id, userId: "sbx_riley", dueOn: day(7), assignedById: "sbx_liam", assignedByName: "Liam Example", status: "SUBMITTED", submittedAt: new Date(), learnerNote: "On the Saturday morning shift if that suits." },
    { orgId: ORG, courseId: safeguarding.id, userId: "sbx_noah", assignedById: "sbx_alex", assignedByName: "Alex Example" },
  ] });
}

/** HR: Maya is the HR lead for Churchfield (a restricted role only a
 *  superadmin could give), so she reads and writes for Liam and Ava but not
 *  Bishopstown staff. Ava has a shared review to acknowledge and a note shared
 *  with her; the private and on-record notes never reach her. */
async function seedHr(db: PrismaClient, hrUrl: string) {
  const ORG = "org_leisureworld";
  const lead = await db.staffRole.create({ data: {
    name: "HR lead", permissions: ["hr.notes.write", "hr.reviews.write"], screens: ["hr"], restricted: true, sortOrder: 40,
    description: "HR notes and performance reviews for the people in their scope.",
  } });
  await db.roleAssignment.create({ data: { orgId: ORG, userId: "sbx_maya", roleId: lead.id, scopeKind: "site", scopeId: "club_churchfield", grantedById: "sbx_alex" } });
  const hr = new Client({ connectionString: hrUrl });
  await hr.connect();
  try {
    await hr.query("SET search_path = turnfin_hr");
    const note = (subject: string, visibility: string, body: string) => hr.query(
      "INSERT INTO notes (id, org_id, subject_user_id, author_id, author_name, visibility, body) VALUES ($1,$2,$3,'sbx_maya','Maya Example',$4,$5)",
      [randomUUID(), ORG, subject, visibility, body]);
    await note("sbx_ava", "private", "Synthetic: check in about shift preferences before the rota changes.");
    await note("sbx_ava", "record", "Synthetic: agreed to cover Tuesday learners until December.");
    await note("sbx_ava", "subject", "Synthetic: thank you for the calm handling of the pool evacuation drill.");
    await hr.query(
      `INSERT INTO reviews (id, org_id, subject_user_id, reviewer_id, reviewer_name, period, status, summary, strengths, goals, overall, shared_at)
       VALUES ($1,$2,'sbx_ava','sbx_maya','Maya Example','2026 probation review','shared',$3,$4,$5,'meets',now())`,
      [randomUUID(), ORG, "Synthetic: a strong first six months on poolside.", "Synthetic: clear instructions, punctual.", "Synthetic: complete the rescue refresher and shadow a senior teacher."]);
    await hr.query(
      "INSERT INTO reviews (id, org_id, subject_user_id, reviewer_id, reviewer_name, period, summary) VALUES ($1,$2,'sbx_liam','sbx_maya','Maya Example','2026 annual review','')",
      [randomUUID(), ORG]);
  } finally { await hr.end(); }
}

/** Rota: Maya plans Churchfield (a site-scoped role). Today and tomorrow show
 *  every warning: Riley's lifeguard shift while his NPLQ is expired (until his
 *  refresher is signed off), an open swim teacher shift, and Riley double-booked
 *  at Bishopstown. */
async function seedRota(db: PrismaClient) {
  const ORG = "org_leisureworld";
  const planner = await db.staffRole.create({ data: {
    name: "Rota planner", permissions: ["rota.manage"], screens: ["rota"], sortOrder: 50,
    description: "Plans shifts at the sites in their scope.",
  } });
  await db.roleAssignment.create({ data: { orgId: ORG, userId: "sbx_maya", roleId: planner.id, scopeKind: "site", scopeId: "club_churchfield", grantedById: "sbx_alex" } });
  const day = (offset: number) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + offset); return d; };
  const shift = (siteId: string, offset: number, start: number, end: number, role: string, userId: string | null, requiredTypeId: string | null = null) =>
    ({ orgId: ORG, siteId, date: day(offset), startMinutes: start * 60, endMinutes: end * 60, role, userId, requiredTypeId, createdById: "sbx_maya", createdByName: "Maya Example" });
  await db.rotaShift.createMany({ data: [
    shift("club_churchfield", 0, 7, 15, "Lifeguard", "sbx_ava", "qt_nplq"),
    shift("club_churchfield", 0, 15, 22, "Lifeguard", "sbx_riley", "qt_nplq"),
    shift("club_churchfield", 0, 16, 19, "Swim teacher", null, "qt_swim_teacher"),
    shift("club_churchfield", 0, 9, 17, "Duty manager", "sbx_liam"),
    shift("club_bishopstown", 0, 18, 21, "Lifeguard", "sbx_riley", "qt_nplq"),
    shift("club_churchfield", 1, 7, 15, "Lifeguard", "sbx_riley", "qt_nplq"),
    shift("club_churchfield", 1, 15, 22, "Lifeguard", "sbx_ava", "qt_nplq"),
  ] });
}
