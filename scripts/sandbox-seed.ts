import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";
import type { PrismaClient } from "../src/generated/prisma/client";
import { seedDeskHistory } from "./sandbox-desk-history";
import { seedSwimHistory } from "./sandbox-swim-history";

/** Extra fictional data for `npm run sandbox`, loaded by scripts/sandbox.mts.
 *  Everything here is synthetic and only ever written to the throwaway PGlite
 *  databases the sandbox starts. Never import this from app code. */

const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;

type Ctx = { prisma: PrismaClient; docsUrl: string; hrUrl: string | null; roles: Record<string, string> };

export async function seed(ctx: Ctx) {
  await seedAquatics(ctx.prisma);
  await seedHelpExamples(ctx.prisma);
  await seedTraining(ctx.prisma);
  if (ctx.hrUrl) await seedHr(ctx.prisma, ctx.hrUrl);
  await seedRota(ctx.prisma);
  await seedAcademy(ctx.prisma);
  await seedShortCourses(ctx.prisma);
  await seedStock(ctx.prisma);
  await seedCctv(ctx.prisma);
  await seedSwimHistory(ctx.prisma, ctx.roles.Instructor);
  await seedDeskHistory(ctx.prisma, ctx.roles.Receptionist);
}

/** Two sites' worth of classes so the deck and desk surfaces can be checked:
 *  Ava teaches Otters at Hillview (club_churchfield) today, Riley teaches Seals there too, and
 *  one Riverside (club_bishopstown) class shows that the site lookup stays on its own site. A
 *  parent has a pending change request waiting for reception. */
async function seedAquatics(db: PrismaClient) {
  const today = DAYS[new Date().getDay()];
  const programme = await db.programme.create({ data: { clubId: "club_churchfield", name: "Learn to swim" } });
  const otters = await db.level.create({ data: { programmeId: programme.id, name: "Otters", sortOrder: 0 } });
  const seals = await db.level.create({ data: { programmeId: programme.id, name: "Seals", sortOrder: 1 } });
  const farProgramme = await db.programme.create({ data: { clubId: "club_bishopstown", name: "Swimming Skills" } });
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

  // Analytics › Multiple places: Casey holds a second Hillview class at another level of the
  // same programme; Morgan a second class in another programme. Not on today's deck.
  const otherDay = DAYS[(new Date().getDay() + 3) % 7];
  const strokes = await db.programme.create({ data: { clubId: "club_churchfield", name: "Stroke club", sortOrder: 1 } });
  const strokeLevel = await db.level.create({ data: { programmeId: strokes.id, name: "Stroke development" } });
  const extra = {
    otters: await db.course.create({ data: { clubId: "club_churchfield", levelId: otters.id, dayOfWeek: otherDay, startMinutes: 9 * 60, durationMinutes: 30, location: "Learner pool" } }),
    strokes: await db.course.create({ data: { clubId: "club_churchfield", levelId: strokeLevel.id, dayOfWeek: otherDay, startMinutes: 10 * 60, durationMinutes: 45, location: "Main pool" } }),
  };
  await db.student.update({ where: { id: ids.Casey }, data: { memberNumber: "SBX-1001" } });
  await db.student.update({ where: { id: ids.Morgan }, data: { memberNumber: "SBX-1002" } });
  await db.enrolment.createMany({ data: [
    { studentId: ids.Casey, courseId: extra.otters.id, levelId: otters.id, programmeId: programme.id, startedOn: new Date("2026-01-05T00:00:00Z") },
    { studentId: ids.Morgan, courseId: extra.strokes.id, levelId: strokeLevel.id, programmeId: strokes.id, startedOn: new Date("2026-01-05T00:00:00Z") },
  ] });

  const parent = await db.parentAccount.create({ data: { email: "sample.parent@example.test", name: "Sample Parent" } });
  await db.parentChildAccess.create({ data: { studentId: ids.Robin, parentEmail: parent.email, source: "STAFF_APPROVAL" } });
  const proposed = { contactPhone: "000 222 3333", medicalNotes: "Synthetic: mild asthma, inhaler in kit bag. Now also uses a spacer." };
  await db.parentChangeRequest.create({ data: {
    parentId: parent.id, studentId: ids.Robin, key: "sandbox-change-0001", proposed, message: "New number and an update from the GP",
    requestHash: createHash("sha256").update(JSON.stringify([ids.Robin, proposed, "sandbox"])).digest("hex"),
  } });
}

/** The records Help's screenshots show (scripts/help-screenshots/capture.mjs): competencies with
 *  some achieved, a waitlist place, an assessment today with a booking and one next week, a
 *  cancelled class awaiting billing, a parent's link request and a refund waiting for finance.
 *  All at Hillview (club_churchfield) except the refund, logged at Riverside. */
async function seedHelpExamples(db: PrismaClient) {
  const day = (offset: number) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + offset); return d; };
  const programme = await db.programme.findFirstOrThrow({ where: { clubId: "club_churchfield" } });
  const otters = await db.level.findFirstOrThrow({ where: { programmeId: programme.id, name: "Otters" } });
  const seals = await db.level.findFirstOrThrow({ where: { programmeId: programme.id, name: "Seals" } });
  const skills = async (levelId: string, names: string[]) => Promise.all(names.map((name, sortOrder) => db.competency.create({ data: { levelId, name, sortOrder } })));
  const otterSkills = await skills(otters.id, ["Submerge and blow bubbles", "Float on the back for five seconds", "Push and glide on the front", "Kick on the front with a float"]);
  await skills(seals.id, ["Swim 10 metres front crawl", "Swim 10 metres back crawl", "Tread water for 30 seconds"]);
  const swimmer = (firstName: string) => db.student.findFirstOrThrow({ where: { firstName } });
  const robin = await swimmer("Robin"), jamie = await swimmer("Jamie");
  const ottersClass = await db.course.findFirstOrThrow({ where: { levelId: otters.id } });
  const sealsClass = await db.course.findFirstOrThrow({ where: { levelId: seals.id } });
  // Robin has every Otters skill (ready to complete the level); Jamie has two.
  await db.competencyResult.createMany({ data: [
    ...otterSkills.map((skill) => ({ studentId: robin.id, competencyId: skill.id })),
    ...otterSkills.slice(0, 2).map((skill) => ({ studentId: jamie.id, competencyId: skill.id })),
  ].map((row) => ({ ...row, status: "ACHIEVED" as const, assessedInCourseId: ottersClass.id, assessedById: "sbx_ava", assessedByName: "Ava Example", assessedOn: day(-7) })) });
  // Jamie also waits for a place in Seals.
  await db.enrolment.create({ data: { studentId: jamie.id, courseId: sealsClass.id, levelId: seals.id, programmeId: programme.id, status: "WAITLISTED", startedOn: day(0), placementReason: "Synthetic: family asked to move up next term." } });
  // A new swimmer booked onto today's assessment, and a session next week to publish.
  const avery = await db.student.create({ data: {
    clubId: "club_churchfield", firstName: "Avery", lastName: "Example", dateOfBirth: new Date("2019-03-01T00:00:00Z"),
    contactName: "Example family", contactEmail: "avery.family@example.test", contactPhone: "000 000 0000",
  } });
  const kind = await db.assessmentType.create({ data: { programmeId: programme.id, name: "New swimmers", description: "Children new to the swim school." } });
  const today = await db.assessmentSession.create({ data: { clubId: "club_churchfield", date: day(0), startMinutes: 18 * 60, durationMinutes: 30, location: "Learner pool", capacity: 6, instructorId: "sbx_ava", programmeId: programme.id, typeId: kind.id } });
  await db.assessmentSession.create({ data: { clubId: "club_churchfield", date: day(7), startMinutes: 10 * 60, durationMinutes: 45, location: "Learner pool", capacity: 8, instructorId: "sbx_ava", programmeId: programme.id, typeId: kind.id } });
  await db.assessmentBooking.create({ data: { sessionId: today.id, studentId: avery.id, bookedById: "sbx_maya", bookedByName: "Maya Example" } });
  // Otters was cancelled a week ago; billing has not been told yet.
  await db.classCancellation.create({ data: {
    courseId: ottersClass.id, clubId: "club_churchfield", date: day(-7), className: "Otters", levelName: "Otters", programmeName: programme.name,
    startMinutes: ottersClass.startMinutes, durationMinutes: ottersClass.durationMinutes, location: ottersClass.location, instructorName: "Ava Example",
    reason: "Synthetic: learner pool closed for maintenance.", cancelledById: "sbx_maya", cancelledByName: "Maya Example", cancelledAt: day(-7),
    swimmers: { create: [robin, jamie].map((s) => ({ studentId: s.id, swimmerName: `${s.firstName} ${s.lastName}` })) },
  } });
  // A parent asks to link their child from the parent app.
  const pat = await db.parentAccount.create({ data: { email: "pat.example@example.test", name: "Pat Example", phone: "000 333 4444" } });
  await db.parentAccessRequest.create({ data: {
    parentId: pat.id, key: "sandbox-link-0001", requestHash: createHash("sha256").update("sandbox-link-0001").digest("hex"),
    childFingerprint: createHash("sha256").update("jamie|sample|2018-05-01").digest("hex"), firstName: "Jamie", lastName: "Sample",
    dateOfBirth: new Date("2018-05-01T00:00:00Z"), context: "Synthetic: Jamie swims in Otters on weekday afternoons.",
  } });
  // A refund Noah logged at reception, waiting for finance.
  const refundId = randomUUID();
  await db.refundRequest.create({ data: {
    id: refundId, status: "SUBMITTED", creatorId: "sbx_noah", creatorName: "Noah Example", clubId: "club_bishopstown", clubName: "Riverside",
    customerName: "Sam Example", contactEmail: "sam.example@example.test", memberNumber: "EX-1042", service: "AQUATICS",
    description: "Ten-week swim course, autumn term", requestedCents: 4500, paymentDate: day(-20).toISOString().slice(0, 10),
    paymentReference: "EXAMPLE-0042", reason: "Synthetic: the family moved away before the course started.", submittedAt: day(-1),
    events: { create: [{ operationId: randomUUID(), actorId: "sbx_noah", actorName: "Noah Example", action: "submit", snapshot: {} }] },
  } });
}

/** Training: Liam, the swim school manager, runs training (Training: Manage). Riley is
 *  waiting for sign-off on the rescue refresher that renews his expired NPLQ;
 *  Ava has one course to do and one overdue. */
async function seedTraining(db: PrismaClient) {
  const ORG = "org_leisureworld";
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

/** HR: Maya wrote these as Ava's and Liam's manager at the time; Liam now
 *  holds HR "Their team" for Ava and Riley. Ava has a shared review to acknowledge and a note shared
 *  with her; the private and on-record notes never reach her. */
async function seedHr(db: PrismaClient, hrUrl: string) {
  const ORG = "org_leisureworld";
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

/** The rota at Hillview (docs/rota.md): Lifeguarding, Teaching (the swim classes) and Reception on
 *  the activity list; this week planned with gaps to fill; Riley off sick today, so his place on the
 *  main pool needs cover and his class needs a teacher; a repeating school booking; the pool's week
 *  shared and reception's still a draft; one change waiting for Timepoint. Sam plans the pool
 *  (Plan); Maya runs the day (Run). */
async function seedRota(db: PrismaClient) {
  const ORG = "org_leisureworld", HILLVIEW = "club_churchfield";
  const day = (offset: number) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + offset); return d; };
  const by = { createdById: "sbx_sam", createdByName: "Sam Example" };
  // Each site's areas (Admin, Areas): what activities, bookings and classes pick their "where" from.
  for (const siteId of ["club_bishopstown", HILLVIEW]) {
    await db.siteArea.createMany({ data: ["Main pool", "Learner pool", "Front desk", "Gym"].map((name, sortOrder) => ({ orgId: ORG, siteId, name, sortOrder })), skipDuplicates: true });
  }
  // Hillview's own needs while open (Admin, Areas): two holding NPLQ on the main pool, one anyone
  // on the front desk. Neither names its role, as lines from before roles did.
  for (const [name, from, until, typeId] of [["Main pool", "07:00", "21:30", "qt_nplq"], ["Front desk", "07:00", "21:00", null]] as const) {
    const t = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
    await db.siteArea.update({ where: { siteId_name: { siteId: HILLVIEW, name } }, data: { openFrom: t(from), openUntil: t(until),
      staffing: { create: [{ count: typeId ? 2 : 1, qualificationTypeId: typeId }] } } });
  }
  // The organisation's activity list: Teaching takes the swim classes.
  await db.activityType.createMany({ data: [
    { id: "rat_guard", orgId: ORG, departmentId: "dept_aquatics", name: "Lifeguarding", icon: "lifeguard", requiredTypeId: "qt_nplq", sortOrder: 0 },
    { id: "rat_teach", orgId: ORG, departmentId: "dept_aquatics", name: "Teaching", icon: "teaching", fromClasses: true, sortOrder: 1 },
    { id: "rat_desk", orgId: ORG, departmentId: "dept_reception", name: "Reception", icon: "reception", sortOrder: 2 },
  ] });
  const h = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const need = async (offset: number, typeId: string, place: string, start: string, end: string, places: number, people: [number, string, string, string][]) =>
    db.rotaNeed.create({ data: { orgId: ORG, siteId: HILLVIEW, date: day(offset), typeId, place, startMinutes: h(start), endMinutes: h(end), places, ...by,
      assignments: { create: people.map(([placeNo, userId, a, b]) => ({ place: placeNo, userId, startMinutes: h(a), endMinutes: h(b), ...by })) } } });
  // This week at Hillview: two on the main pool all day with a lunchtime gap, the learner pool
  // with an evening gap, and reception partly covered. Riley is on today but rang in sick.
  for (let offset = 0; offset < 7; offset++) {
    await need(offset, "rat_guard", "Main pool", "07:00", "21:30", 2, [
      [1, "sbx_ciara", "07:00", "14:00"], [1, "sbx_conor", "14:00", "21:30"],
      [2, offset % 2 ? "sbx_dylan" : "sbx_riley", "07:00", "12:00"], [2, offset % 2 ? "sbx_riley" : "sbx_dylan", "15:00", "21:30"],
    ]);
    await need(offset, "rat_guard", "Learner pool", "09:00", "20:00", 1, [[1, "sbx_sam", "09:00", "15:00"]]);
    await need(offset, "rat_desk", "Front desk", "07:00", "21:00", 1, [[1, "sbx_noah", "12:00", "18:00"]]);
  }
  // School lessons every weekday morning for two weeks, in the learner pool: one lifeguard each.
  const dates = Array.from({ length: 14 }, (_, i) => i).filter((i) => { const d = day(i).getUTCDay(); return d >= 1 && d <= 5; });
  const lessons = await db.rotaRepeat.create({ data: { orgId: ORG, siteId: HILLVIEW, kind: "school", title: "Example National School", typeId: "rat_guard", place: "Learner pool",
    startMinutes: 570, endMinutes: 690, places: 1, weekdays: [0, 1, 2, 3, 4], firstDay: day(0), lastDay: day(13), ...by } });
  for (const offset of dates) await db.rotaNeed.create({ data: { orgId: ORG, siteId: HILLVIEW, date: day(offset), typeId: "rat_guard", place: "Learner pool", startMinutes: 570, endMinutes: 690, places: 1, repeatId: lessons.id, ...by } });
  // The pool's week is shared with its staff; reception's is still a draft.
  const monday = day(0); monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  await db.rotaWeekShare.create({ data: { siteId: HILLVIEW, departmentId: "dept_aquatics", monday, sharedById: "sbx_sam", sharedByName: "Sam Example" } });
  // A change made this morning, still to put into Timepoint.
  await db.rotaLog.create({ data: { orgId: ORG, siteId: HILLVIEW, date: day(0), kind: "added", summary: "Noah Example put on Reception, Front desk, 12:00 to 18:00", userId: "sbx_noah",
    reason: "extra", byId: "sbx_maya", byName: "Maya Example" } });
  await db.rotaAbsence.create({ data: { orgId: ORG, userId: "sbx_riley", reason: "sickness", firstDay: day(0), lastDay: day(0), note: "Synthetic: rang in at 08:00.", reportedById: "sbx_maya", reportedByName: "Maya Example" } });
  // Ava was off sick for nine days until yesterday; today is her first day back, so her
  // return to work is due (and asks about the fit note).
  await db.rotaAbsence.create({ data: { orgId: ORG, userId: "sbx_ava", reason: "sickness", firstDay: day(-9), lastDay: day(-1), note: "Synthetic: called in before her shift.", reportedById: "sbx_maya", reportedByName: "Maya Example" } });
}

/** The Academy at Hillview (docs/academy.md): NPLQ and a swim teacher course on the list; an
 *  NPLQ course that started yesterday, Sam tutoring and Liam assessing, with Ciara (staff) and
 *  two invented members of the public on it, one with a deposit and checks still to do. And an
 *  NPLQ course next month open for online booking, with three invented people who held a place
 *  online: one overdue after two unanswered calls, one due within a day, one held today. */
async function seedAcademy(db: PrismaClient) {
  const ORG = "org_leisureworld", HILLVIEW = "club_churchfield";
  const day = (offset: number) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + offset); return d; };
  const nplq = await db.academyCourseType.create({ data: { orgId: ORG, name: "National Pool Lifeguard Qualification", kind: "lifeguard", awardingBody: "Example awarding body",
    minAge: 16, minHours: 30, checks: ["age", "swim", "medical", "id"], qualificationTypeId: "qt_nplq", sortOrder: 0 } });
  const teacher = await db.academyCourseType.create({ data: { orgId: ORG, name: "Swim Teacher Level 1", kind: "swim-teacher", awardingBody: "Example awarding body", minAge: 16, minHours: 20, checks: ["age", "id"], sortOrder: 1 } });
  const course = await db.academyCourse.create({ data: { orgId: ORG, siteId: HILLVIEW, typeId: nplq.id, capacity: 8, priceCents: 35000, tutorId: "sbx_sam", assessorId: "sbx_liam",
    createdById: "sbx_liam", createdByName: "Liam Example", note: "Synthetic course for the sandbox." } });
  const sessions = [];
  for (const [offset, start, end] of [[-1, 540, 1020], [0, 540, 1020], [1, 540, 1020], [6, 540, 1020], [7, 540, 780]] as const) {
    sessions.push(await db.academySession.create({ data: { courseId: course.id, date: day(offset), startMinutes: start, endMinutes: end, place: offset === 0 ? "Main pool" : "Learner pool" } }));
  }
  const by = { createdById: "sbx_liam", createdByName: "Liam Example" };
  const ciara = await db.academyCandidate.create({ data: { courseId: course.id, userId: "sbx_ciara", name: "Ciara Example", email: "ciara@sandbox.invalid", payment: "waived",
    dateOfBirth: new Date("2004-06-01T00:00:00Z"), swimTestOn: day(-10), medicalOn: day(-10), idCheckedOn: day(-1), checkedByName: "Sam Example", ...by } });
  const jordan = await db.academyCandidate.create({ data: { courseId: course.id, name: "Jordan Sample", email: "jordan@example.invalid", phone: "000 000 0000", payment: "paid", paidCents: 35000,
    dateOfBirth: new Date("2008-02-14T00:00:00Z"), swimTestOn: day(-7), medicalOn: day(-7), idCheckedOn: day(-1), checkedByName: "Sam Example", ...by } });
  await db.academyCandidate.create({ data: { courseId: course.id, name: "Robin Sample", email: "robin@example.invalid", payment: "deposit", paidCents: 10000, dateOfBirth: new Date("2010-12-20T00:00:00Z"), ...by } });
  // Yesterday's register was taken; Jordan left an hour early.
  await db.academyAttendance.createMany({ data: [{ sessionId: sessions[0].id, candidateId: ciara.id, minutes: 480 }, { sessionId: sessions[0].id, candidateId: jordan.id, minutes: 420 }] });
  await db.academySession.update({ where: { id: sessions[0].id }, data: { registerAt: new Date(), registerById: "sbx_sam", registerBy: "Sam Example" } });

  // Online booking: open courses, and places held online waiting for a call.
  const online = await db.academyCourse.create({ data: { orgId: ORG, siteId: HILLVIEW, typeId: nplq.id, capacity: 8, priceCents: 39500, tutorId: "sbx_sam", assessorId: "sbx_liam",
    bookOnline: true, createdById: "sbx_liam", createdByName: "Liam Example", note: "Synthetic online course for the sandbox." } });
  for (const [offset, place] of [[30, "Main pool"], [31, "Main pool"], [37, "Learner pool"], [38, "Learner pool"]] as const) {
    await db.academySession.create({ data: { courseId: online.id, date: day(offset), startMinutes: 540, endMinutes: 1020, place } });
  }
  const evenings = await db.academyCourse.create({ data: { orgId: ORG, siteId: "club_bishopstown", typeId: teacher.id, capacity: 6, priceCents: 29500, tutorId: "sbx_sam",
    bookOnline: true, createdById: "sbx_liam", createdByName: "Liam Example" } });
  for (const offset of [46, 47, 48, 49]) await db.academySession.create({ data: { courseId: evenings.id, date: day(offset), startMinutes: 1080, endMinutes: 1260, place: "Learner pool" } });
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
  const heldOnline = (name: string, ref: string, hours: number, callTimes: string[]) => db.academyCandidate.create({ data: {
    courseId: online.id, name, email: `${name.split(" ")[1].toLowerCase()}@example.invalid`, phone: "000 000 0000", dateOfBirth: new Date("2005-05-05T00:00:00Z"),
    payment: "owed", source: "online", reference: ref, callTimes, createdAt: hoursAgo(hours), callBy: new Date(hoursAgo(hours).getTime() + 72 * 3_600_000), createdByName: "Online booking" } });
  const overdue = await heldOnline("Candidate Dee", "AC-SBX4D", 78, ["evening"]);
  await heldOnline("Candidate Cee", "AC-SBX3C", 60, ["morning"]);
  await heldOnline("Candidate Bee", "AC-SBX2B", 2, []);
  await db.academyCall.createMany({ data: [
    { candidateId: overdue.id, outcome: "no-answer", byId: "sbx_maya", byName: "Maya Example", createdAt: hoursAgo(50) },
    { candidateId: overdue.id, outcome: "no-answer", byId: "sbx_maya", byName: "Maya Example", createdAt: hoursAgo(26) },
  ] });
}

/** Short courses (docs/short-courses.md): Couch to 5k at Hillview, two weeks in with its
 *  registers taken, five booked (one still owing, one without a health form) and two invented
 *  people waiting for the free place; and Adult swim lessons at Riverside starting in ten days,
 *  open for online booking, with one place held online and overdue for a call. */
async function seedShortCourses(db: PrismaClient) {
  const ORG = "org_leisureworld";
  const day = (offset: number) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + offset); return d; };
  const by = { createdById: "sbx_maya", createdByName: "Maya Example" };
  const c25k = await db.shortCourseType.create({ data: { orgId: ORG, name: "Couch to 5k", area: "gym", description: "From the sofa to running 5 km in eight weeks, with a coach.", weeks: 8, sessionMinutes: 60, minAge: 16, healthForm: true } });
  const swim = await db.shortCourseType.create({ data: { orgId: ORG, name: "Adult swim lessons", area: "pool", description: "Confidence in the water and the basics of front crawl.", weeks: 6, sessionMinutes: 45, sortOrder: 1 } });
  const running = await db.shortCourse.create({ data: { orgId: ORG, siteId: "club_churchfield", typeId: c25k.id, capacity: 6, priceCents: 9000, instructorId: "sbx_liam", ...by } });
  const sessions = [];
  for (let week = 0; week < 8; week++) sessions.push(await db.shortCourseSession.create({ data: { courseId: running.id, date: day(-14 + week * 7), startMinutes: 1110, endMinutes: 1170, place: "Gym" } }));
  // Booked from the swimmer records (owner request, 21 October 2026): invented adults with member
  // numbers, one with medical notes; Eli was booked before the records and is not linked yet.
  const adult = async (name: string, n: number, medicalNotes: string | null = null) => {
    const [firstName, lastName] = name.split(" ");
    const s = await db.student.create({ data: { clubId: "club_churchfield", memberNumber: `SBX-90${String(n).padStart(2, "0")}`, firstName, lastName, dateOfBirth: new Date(`19${80 + n}-0${(n % 9) + 1}-1${n % 9}T00:00:00Z`),
      contactName: name, contactPhone: "000 000 0000", contactEmail: `${firstName.toLowerCase()}@example.invalid`, emergencyName: "Pat Sample", emergencyPhone: "000 111 1111", emergencyRelationship: "Partner", medicalNotes } });
    return { swimmerId: s.id, email: s.contactEmail ?? "", dateOfBirth: s.dateOfBirth };
  };
  const people = [];
  for (const [i, [name, payment, paidCents, form]] of ([["Alex Sample", "paid", 9000, true], ["Bea Sample", "paid", 9000, true], ["Cal Sample", "deposit", 3000, true], ["Dee Sample", "paid", 9000, false], ["Eli Sample", "waived", 0, true]] as const).entries()) {
    const record = name === "Eli Sample" ? {} : await adult(name, i + 1, name === "Bea Sample" ? "Invented: mild asthma, inhaler in her bag." : null);
    people.push(await db.shortCourseParticipant.create({ data: { courseId: running.id, name, phone: "000 000 0000", payment, paidCents, healthFormOn: form ? day(-15) : null, ...record, ...by } }));
  }
  for (const [i, name] of ["Fin Sample", "Gus Sample"].entries()) {
    await db.shortCourseParticipant.create({ data: { courseId: running.id, name, phone: "000 000 0000", status: "waiting", createdAt: new Date(Date.now() - (3 - i) * 86_400_000), ...await adult(name, i + 6), ...by } });
  }
  for (const session of sessions.slice(0, 2)) {
    await db.shortCourseAttendance.createMany({ data: people.map((p, i) => ({ sessionId: session.id, participantId: p.id, present: i !== 3 })) });
    await db.shortCourseSession.update({ where: { id: session.id }, data: { registerAt: new Date(), registerById: "sbx_liam", registerBy: "Liam Example" } });
  }
  const soon = await db.shortCourse.create({ data: { orgId: ORG, siteId: "club_bishopstown", typeId: swim.id, capacity: 8, priceCents: 7500, instructorId: "sbx_sam", bookOnline: true, ...by } });
  for (let week = 0; week < 6; week++) await db.shortCourseSession.create({ data: { courseId: soon.id, date: day(10 + week * 7), startMinutes: 1200, endMinutes: 1245, place: "Learner pool" } });
  for (const name of ["Hal Sample", "Ivy Sample", "Jo Sample"]) await db.shortCourseParticipant.create({ data: { courseId: soon.id, name, email: `${name.split(" ")[0].toLowerCase()}@example.invalid`, payment: "owed", ...by } });
  // Open online: one invented person held a place on the booking site 80 hours ago (overdue).
  const heldAt = new Date(Date.now() - 80 * 3_600_000);
  await db.shortCourseParticipant.create({ data: { courseId: soon.id, name: "Kit Sample", email: "kit@example.invalid", phone: "000 000 0000", payment: "owed", source: "online",
    reference: "SC-SBX42", callTimes: ["evening"], callBy: new Date(heldAt.getTime() + 72 * 3_600_000), createdAt: heldAt, createdByName: "Online booking" } });
}

/** The CCTV log (docs/cctv.md): three invented viewings at Hillview, one with a note added later. */
async function seedCctv(db: PrismaClient) {
  const ORG = "org_leisureworld";
  const iso = (offset: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10); };
  const base = { orgId: ORG, siteId: "club_churchfield", othersPresent: "", copies: "" };
  const maya = { recordedById: "sbx_maya", recordedByName: "Maya Example", checkedBy: "Maya Example" };
  const orla = { recordedById: "sbx_orla", recordedByName: "Orla Example", checkedBy: "Orla Example" };
  await db.cctvViewing.create({ data: { ...base, ...maya, viewedOn: iso(-9), viewedAt: "16:40", reason: "complaint", background: "A parent said their child was pushed on the poolside steps during the 15:30 class.",
    purpose: "Whether anyone was pushed on the steps by the learner pool", cameras: "Camera 2, learner pool", footageOn: iso(-9), footageFrom: "15:25", footageTo: "16:05",
    findings: "Two children reach the steps together and one slips back into the water. Nobody is pushed. The teacher helps the child out within a few seconds." } });
  const theft = await db.cctvViewing.create({ data: { ...base, ...maya, viewedOn: iso(-4), viewedAt: "11:15", reason: "theft", othersPresent: "Garda Example, Hillview station", incidentNumber: 1,
    background: "A member reported their bag taken from locker 14 between 07:00 and 08:30.", purpose: "Who opened locker 14 in that time", cameras: "Camera 5, changing village corridor",
    footageOn: iso(-5), footageFrom: "07:00", footageTo: "08:30", findings: "At 07:52 a person in a grey hoodie opens locker 14 with a key and leaves with a black bag. They come in through the main door at 07:41.",
    copies: "One clip, 07:40 to 07:55, on a USB key given to Garda Example." } });
  await db.cctvViewingNote.create({ data: { viewingId: theft.id, text: "The Gardaí confirmed they have the USB key and logged it as evidence.", byId: "sbx_orla", byName: "Orla Example" } });
  await db.cctvViewing.create({ data: { ...base, ...orla, viewedOn: iso(-1), viewedAt: "09:05", reason: "incident", incidentNumber: 2,
    background: "A swimmer cut their foot near the deep end on Sunday morning.", purpose: "Whether there was glass or anything sharp on the poolside", cameras: "Camera 1, main pool deep end",
    footageOn: iso(-2), footageFrom: "10:00", footageTo: "10:45", findings: "Nothing relevant seen: the poolside is clear and nobody drops anything before the swimmer is hurt." } });
}

/** Stock (docs/stock.md): a dozen invented products in the migration's categories, a submitted
 *  count at Riverside a month ago, another last week, and today's still open with a few counted. */
async function seedStock(db: PrismaClient) {
  const ORG = "org_leisureworld";
  const day = (offset: number) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + offset); return d; };
  const cat = async (name: string) => (await db.stockCategory.findFirstOrThrow({ where: { orgId: ORG, name } })).id;
  const list: [string, string, string, number, number][] = [
    ["Junior goggles, blue", "Retail", "pair", 24, 18], ["Junior goggles, pink", "Retail", "pair", 20, 21], ["Adult goggles", "Retail", "pair", 15, 11],
    ["Armbands, 2 to 6", "Retail", "pair", 12, 9], ["Swim nappies, size 3 to 4", "Retail", "each", 40, 26], ["Swim hat, silicone", "Retail", "each", 30, 30],
    ["Locker tokens", "Equipment", "each", 200, 188], ["Still water 500ml", "Drink", "bottle", 48, 30], ["Sports drink 500ml", "Drink", "bottle", 36, 0],
    ["Crisps, ready salted", "Snack", "packet", 60, 41], ["Chocolate bar", "Confectionery", "each", 50, 33], ["Hand towel", "Retail", "each", 10, 10],
  ];
  const products = [];
  for (const [name, category, unitLabel] of list) products.push(await db.stockProduct.create({ data: { orgId: ORG, name, unitLabel, categoryId: await cat(category) } }));
  const by = { startedById: "sbx_maya", startedByName: "Maya Example" };
  const done = { submittedById: "sbx_maya", submittedByName: "Maya Example" };
  const month = await db.stockTake.create({ data: { orgId: ORG, siteId: "club_bishopstown", stockDate: day(-35), startedAt: day(-35), submittedAt: day(-35), ...by, ...done } });
  const week = await db.stockTake.create({ data: { orgId: ORG, siteId: "club_bishopstown", stockDate: day(-7), startedAt: day(-7), submittedAt: day(-7), ...by, ...done } });
  const open = await db.stockTake.create({ data: { orgId: ORG, siteId: "club_bishopstown", stockDate: day(0), ...by } });
  await db.stockTakeLine.createMany({ data: products.map((p, i) => ({ stockTakeId: month.id, productId: p.id, quantity: list[i][3], countedByName: "Maya Example" })) });
  // The hand towels were missed last week: they are not counted, not none.
  await db.stockTakeLine.createMany({ data: products.slice(0, -1).map((p, i) => ({ stockTakeId: week.id, productId: p.id, quantity: list[i][4], countedByName: "Maya Example" })) });
  await db.stockTakeLine.createMany({ data: products.slice(0, 4).map((p, i) => ({ stockTakeId: open.id, productId: p.id, quantity: Math.max(0, list[i][4] - 2), countedByName: "Maya Example" })) });
}
