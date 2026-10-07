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
  await seedHelpExamples(ctx.prisma);
  await seedTraining(ctx.prisma);
  if (ctx.hrUrl) await seedHr(ctx.prisma, ctx.hrUrl);
  await seedRota(ctx.prisma);
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
  // The organisation's activity list: Teaching takes the swim classes.
  await db.rotaActivityType.createMany({ data: [
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
  for (const offset of dates) await db.rotaNeed.create({ data: { orgId: ORG, siteId: HILLVIEW, date: day(offset), typeId: "rat_guard", place: "Learner pool (school)", startMinutes: 570, endMinutes: 690, places: 1, repeatId: lessons.id, ...by } });
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
