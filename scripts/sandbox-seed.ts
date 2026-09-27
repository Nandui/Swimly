import { createHash } from "node:crypto";
import type { PrismaClient } from "../src/generated/prisma/client";

/** Extra fictional data for `npm run sandbox`, loaded by scripts/sandbox.mts.
 *  Everything here is synthetic and only ever written to the throwaway PGlite
 *  databases the sandbox starts. Never import this from app code. */

const DAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;

type Ctx = { prisma: PrismaClient; docsUrl: string; hrUrl: string | null; roles: Record<string, string> };

export async function seed(ctx: Ctx) {
  await seedAquatics(ctx.prisma);
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
