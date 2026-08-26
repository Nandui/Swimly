import "dotenv/config";
import type { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

/** Removes the invented data — the seeded curriculum and the students, courses
 *  and results made while building the app — leaving only the club's own
 *  records, imported from their existing system on 26 Aug 2026.
 *
 *  **This deletes rows and there is no undo.** So it names every target
 *  explicitly rather than inferring one, and refuses to run if what it finds
 *  is not exactly what is written here: a rule like "anything not created
 *  today" would quietly widen the moment somebody adds a real class.
 *
 *  Dry run by default. Pass --confirm to write.
 *
 *  What survives, deliberately:
 *
 *  - **Water Safety & Fun**, its four levels and their competencies — the
 *    club's real curriculum, and what every real enrolment is pinned to.
 *  - **Fernando's account**, and every Wednesday class and swimmer.
 *
 *  The audit rows describing the removed rows go with them, so `/activity`
 *  reads as a history of the club rather than of the build. This is the one
 *  place the app rewrites its own log, and it is a deliberate exception rather
 *  than a precedent: it is matched on the ids being deleted in the same
 *  transaction, so it can only ever take rows whose subject no longer exists.
 *  One row is written afterwards saying what was taken. */

/** The seeded curriculum. Fiction from `scripts/seed-curriculum.ts`. */
const PROGRAMMES = ["Learn to Swim", "Adult Lessons"];

/** Classes that never ran. Two are seeded, two I made while testing the
 *  enrolment and register screens. The club's real timetable is Wednesday. */
const COURSES: { name: string | null; day: string; start: number }[] = [
  { name: "Tadpoles", day: "MONDAY", start: 990 },
  { name: "Starfish", day: "MONDAY", start: 990 },
  // Named for its level rather than in its own right, so `name` is null.
  { name: null, day: "TUESDAY", start: 1050 },
  { name: "Otters Wednesday", day: "WEDNESDAY", start: 1020 },
];

/** Invented children. Every real swimmer either carries a member number or came
 *  off the 15:45 Starfish register on 26 Aug. */
const STUDENTS = [
  "Ava Byrne",
  "Tom Rae",
  "Niamh Kelly",
  "Dara Walsh",
  "Lil John",
];

function fail(message: string): never {
  console.error(`\nRefusing to run: ${message}`);
  console.error("Nothing was deleted. Re-check the inventory before trying again.");
  process.exit(1);
}

async function main() {
  const confirm = process.argv.includes("--confirm");

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) fail("there is no active admin to attribute this to.");

  // ---- Find every target, and check it is the one that was meant. ----

  const programmes = await prisma.programme.findMany({
    where: { name: { in: PROGRAMMES } },
    select: { id: true, name: true, levels: { select: { id: true, name: true } } },
  });
  if (programmes.length !== PROGRAMMES.length) {
    fail(`expected ${PROGRAMMES.length} seeded programmes, found ${programmes.length}.`);
  }
  const programmeIds = programmes.map((p) => p.id);
  const levelIds = programmes.flatMap((p) => p.levels.map((l) => l.id));

  const courses = await prisma.course.findMany({
    where: {
      OR: [
        { levelId: { in: levelIds } },
        ...COURSES.map((c) => ({
          name: c.name,
          dayOfWeek: c.day as Prisma.CourseWhereInput["dayOfWeek"],
          startMinutes: c.start,
        })),
      ],
    },
    select: {
      id: true,
      name: true,
      dayOfWeek: true,
      startMinutes: true,
      level: { select: { name: true } },
      _count: { select: { enrolments: true, attendance: true } },
    },
  });
  if (courses.length !== COURSES.length) {
    fail(
      `expected ${COURSES.length} classes to remove, found ${courses.length}:\n` +
        courses.map((c) => `  ${c.dayOfWeek} ${c.startMinutes} ${c.name ?? c.level.name}`).join("\n")
    );
  }
  const courseIds = courses.map((c) => c.id);

  const students = await prisma.student.findMany({
    where: {
      OR: STUDENTS.map((full) => {
        const [firstName, ...rest] = full.split(" ");
        return { firstName, lastName: rest.join(" ") };
      }),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      memberNumber: true,
      enrolments: { select: { courseId: true } },
    },
  });
  if (students.length !== STUDENTS.length) {
    fail(`expected ${STUDENTS.length} invented students, found ${students.length}.`);
  }
  const withNumber = students.filter((s) => s.memberNumber);
  if (withNumber.length > 0) {
    fail(
      `these carry a club member number, so they are real: ${withNumber
        .map((s) => `${s.firstName} ${s.lastName} (${s.memberNumber})`)
        .join(", ")}`
    );
  }
  const studentIds = students.map((s) => s.id);

  // The load-bearing check. If an invented student sits in a class that is
  // staying, or a class being removed holds a real swimmer, the separation is
  // not clean and this script is the wrong tool.
  const strayEnrolment = students
    .flatMap((s) => s.enrolments.map((e) => ({ student: s, courseId: e.courseId })))
    .find((e) => !courseIds.includes(e.courseId));
  if (strayEnrolment) {
    fail(
      `${strayEnrolment.student.firstName} ${strayEnrolment.student.lastName} is enrolled in a class that is staying.`
    );
  }

  const realInDoomedCourse = await prisma.enrolment.count({
    where: { courseId: { in: courseIds }, studentId: { notIn: studentIds } },
  });
  if (realInDoomedCourse > 0) {
    fail(`${realInDoomedCourse} enrolments in those classes belong to swimmers that are staying.`);
  }

  // ---- Say what will go. ----

  console.log("\nProgrammes");
  for (const p of programmes) {
    console.log(`   ${p.name} — ${p.levels.length} levels (${p.levels.map((l) => l.name).join(", ")})`);
  }
  console.log("\nClasses");
  for (const c of courses) {
    console.log(
      `   ${c.dayOfWeek.slice(0, 3)} ${String(Math.floor(c.startMinutes / 60)).padStart(2, "0")}:${String(c.startMinutes % 60).padStart(2, "0")}` +
        ` ${(c.name ?? c.level.name).padEnd(18)} ${c._count.enrolments} enrolments, ${c._count.attendance} attendance rows`
    );
  }
  console.log("\nSwimmers");
  for (const s of students) console.log(`   ${s.firstName} ${s.lastName}`);

  if (!confirm) {
    console.log("\nDry run — nothing was deleted. Re-run with --confirm to remove all of the above.");
    await prisma.$disconnect();
    return;
  }

  // ---- Delete, innermost first: every relation is onDelete: Restrict, so
  //      the order is the constraint graph read backwards. ----

  const byStudentOrCourse = {
    OR: [{ studentId: { in: studentIds } }, { courseId: { in: courseIds } }],
  };

  // Read the ids of everything about to go, so the audit purge can match on
  // them. After the deletes there would be nothing left to ask.
  const [competencies, enrolments] = await Promise.all([
    prisma.competency.findMany({ where: { levelId: { in: levelIds } }, select: { id: true } }),
    prisma.enrolment.findMany({
      where: {
        OR: [
          { studentId: { in: studentIds } },
          { courseId: { in: courseIds } },
          { levelId: { in: levelIds } },
        ],
      },
      select: { id: true },
    }),
  ]);
  const doomedIds = [
    ...programmeIds,
    ...levelIds,
    ...courseIds,
    ...studentIds,
    ...competencies.map((c) => c.id),
    ...enrolments.map((e) => e.id),
  ];

  const writes: Prisma.PrismaPromise<unknown>[] = [
    prisma.attendanceRecord.deleteMany({ where: byStudentOrCourse }),
    prisma.competencyResult.deleteMany({
      where: {
        OR: [{ studentId: { in: studentIds } }, { competency: { levelId: { in: levelIds } } }],
      },
    }),
    prisma.levelCompletion.deleteMany({
      where: { OR: [{ studentId: { in: studentIds } }, { levelId: { in: levelIds } }] },
    }),
    prisma.classNote.deleteMany({ where: { courseId: { in: courseIds } } }),
    prisma.enrolment.deleteMany({
      where: {
        OR: [
          { studentId: { in: studentIds } },
          { courseId: { in: courseIds } },
          { levelId: { in: levelIds } },
        ],
      },
    }),
    prisma.course.deleteMany({ where: { id: { in: courseIds } } }),
    prisma.student.deleteMany({ where: { id: { in: studentIds } } }),
    prisma.competency.deleteMany({ where: { levelId: { in: levelIds } } }),
    prisma.level.deleteMany({ where: { id: { in: levelIds } } }),
    prisma.programme.deleteMany({ where: { id: { in: programmeIds } } }),
    prisma.auditLog.deleteMany({
      where: {
        OR: [{ entityId: { in: doomedIds } }, { programmeId: { in: programmeIds } }],
      },
    }),
  ];

  const [attend, marks, done, notes, enrols, classes, swimmers, comps, levels, progs, log] =
    (await prisma.$transaction(writes)) as { count: number }[];

  console.log(
    `\nRemoved: ${progs.count} programmes, ${levels.count} levels, ${comps.count} competencies, ` +
      `${classes.count} classes, ${swimmers.count} swimmers, ${enrols.count} enrolments, ` +
      `${attend.count} attendance rows, ${marks.count} assessments, ${done.count} level completions, ` +
      `${notes.count} class notes, ${log.count} audit rows.`
  );

  await logAudit({
    actorId: admin.id,
    actorName: admin.name,
    action: "delete",
    entity: "Programme",
    summary:
      `Removed the sample data the app was built against — ${PROGRAMMES.join(" and ")}, ` +
      `${classes.count} classes that never ran and ${swimmers.count} invented swimmers, ` +
      `with their ${enrols.count} enrolments, ${attend.count} attendance rows, ${marks.count} assessments ` +
      `and the ${log.count} log entries describing them. Everything remaining came from the club's own system.`,
  });

  await prisma.$disconnect();
}

void main();
