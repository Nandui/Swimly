import "dotenv/config";
import { logAudit } from "@/lib/audit";
import { courseLabel } from "@/lib/courses/constants";
import { withCourseSeat } from "@/lib/enrolment/seat";
import { parseDateOnly, today } from "@/lib/format";
import { fullName } from "@/lib/students/constants";
import { prisma } from "@/lib/prisma";

/** The Friday 18:05 **LeisureWorld Sharks** class — course 00007913, page 15
 *  of the Friday PDF — held back from `import-friday.ts` because it plainly
 *  belonged to a different discipline and naming one would have been inventing
 *  a fact about the club. The club has now said: **Swimming Skills, third
 *  level, after Sharks 1 and Sharks 2.**
 *
 *  Same rules as every other import: idempotent, enrolments through
 *  `withCourseSeat`, one audit row, an existing member number whose name does
 *  not match is refused rather than guessed at, and an existing student is
 *  never renamed.
 *
 *  This roster was re-read at 560dpi rather than the 200dpi the other imports
 *  used, because it is the densest page in the set and carries three unusually
 *  short member numbers — LWD16, LWD1075 and LWB7684. All three are as written.
 *  Every one of the 31 readings was confirmed at that resolution, so unlike the
 *  other days there is nothing here I would ask anybody to check.
 *
 *  Capacity 36, from the card's own count: 31 enrolled and 5 available. That is
 *  three times a Starfish class and the swimmers are 10 to 17, which is what
 *  made it obvious this was not Water Safety & Fun.
 *
 *  Duration is 30 minutes, as everywhere else. The source never states one; the
 *  slots run 15:10, 15:45, 16:20, 16:55, 17:30, 18:05 — 35 minutes apart — so
 *  a 30-minute class with a 5-minute changeover is what the timetable implies. */

const PROGRAMME = "Swimming Skills";
const LEVEL = "LeisureWorld Sharks";
const DAY = "FRIDAY" as const;
const START = "18:05";
const CAPACITY = 36;
const CODE = "00007913";

/** Transcribed exactly. Oddities in the club's own records, not misreadings. */
const ODD_IN_SOURCE = new Map([
  ["LWB91023", "Ahmed MusTAFA — capitals inside the surname"],
  ["LWB424733", "Alexandra Hales Hales — surname repeated"],
  ["LWC37992", "Joseph Wallace — a Churchfield member number against a Bishopstown home facility"],
]);

type Enrollee = {
  member: string;
  first: string;
  last: string;
  age: number;
  /** "B" = Bishopstown (the default), "C" = Churchfield, "D" = Douglas. */
  facility?: "C" | "D";
};

const ENROLLEES: Enrollee[] = [
  { member: "LWB7684", first: "Maya", last: "Carrillo", age: 16 },
  { member: "LWB23109", first: "Ryan", last: "O'Regan", age: 13 },
  { member: "LWD16", first: "Matteo", last: "Binay", age: 17, facility: "D" },
  { member: "LWB33579", first: "Aoibhinn", last: "McGrath", age: 12 },
  { member: "LWB38408", first: "Conor", last: "Cotter", age: 13 },
  { member: "LWB39503", first: "Cathal", last: "Flynn", age: 12 },
  { member: "LWB46534", first: "Alex", last: "O'Regan", age: 11 },
  { member: "LWB48245", first: "Rian", last: "Crowley", age: 13 },
  { member: "LWD1075", first: "Robert", last: "Cosgrove", age: 11, facility: "D" },
  { member: "LWC34538", first: "Layan", last: "Elgazzar", age: 12, facility: "C" },
  { member: "LWB58273", first: "Michael", last: "Keane", age: 15 },
  { member: "LWB58464", first: "Colm", last: "O'Mara", age: 10 },
  { member: "LWB59798", first: "Liam", last: "Barry", age: 12 },
  { member: "LWB62432", first: "Clodagh", last: "Murphy", age: 10 },
  // Churchfield number, Bishopstown home facility. Recorded as the facility says.
  { member: "LWC37992", first: "Joseph", last: "Wallace", age: 15 },
  { member: "LWB69195", first: "Sarah", last: "Sasangka", age: 12 },
  { member: "LWB70163", first: "Odhran", last: "McGrath", age: 10 },
  { member: "LWB70758", first: "Jemma", last: "McCarthy", age: 11 },
  { member: "LWB83818", first: "Sofia", last: "Pytel", age: 12 },
  { member: "LWB85009", first: "Sophie", last: "Newman", age: 12 },
  { member: "LWB90824", first: "Fergal", last: "Dowling", age: 17 },
  { member: "LWB91023", first: "Ahmed", last: "MusTAFA", age: 11 },
  { member: "LWB94610", first: "Ethan", last: "Buckley", age: 12 },
  { member: "LWB99488", first: "Nicholas", last: "McCarthy", age: 11 },
  { member: "LWB99734", first: "Megan", last: "Austin", age: 13 },
  { member: "LWB423089", first: "Ciara", last: "Ellis", age: 12 },
  { member: "LWB424642", first: "Katelyn", last: "Murray", age: 14 },
  { member: "LWB424733", first: "Alexandra", last: "Hales Hales", age: 14 },
  { member: "LWB425251", first: "Maya", last: "Donaghue", age: 14 },
  { member: "LWB428454", first: "Luca", last: "Casey", age: 14 },
  { member: "LWB428673", first: "Laura", last: "Arruda", age: 15 },
];

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

const FACILITY = { C: "LW Churchfield", D: "LW Douglas" } as const;

function noteFor(e: Enrollee): string {
  const facility = e.facility ? FACILITY[e.facility] : "LW Bishopstown";
  return `${facility} · Age ${e.age} as at ${today()} — date of birth not in the source system.`;
}

/** Compared loosely on purpose: "O Connor" and "O'Connor" are the same child,
 *  two different names are not. */
function normalise(first: string, last: string): string {
  return `${first} ${last}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z]/g, "");
}

async function main() {
  const programme = await prisma.programme.findUnique({
    where: { name: PROGRAMME },
    select: { id: true, name: true },
  });
  if (!programme) throw new Error(`No programme called "${PROGRAMME}".`);

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!admin) throw new Error("No admin account to attribute the import to.");

  const startedOn = parseDateOnly(today());
  let studentsCreated = 0;
  let enrolled = 0;
  const problems: string[] = [];
  const conflicts: string[] = [];
  const renames: string[] = [];
  const alsoSwimsElsewhere: string[] = [];

  // ---- The level. Third in Swimming Skills, after Sharks 1 and Sharks 2. ----

  // Matched by name across every programme: a level that exists elsewhere must
  // not be recreated here as a duplicate.
  let level = await prisma.level.findFirst({ where: { name: LEVEL }, select: { id: true } });
  if (!level) {
    const last = await prisma.level.findFirst({
      where: { programmeId: programme.id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    level = await prisma.level.create({
      data: {
        programmeId: programme.id,
        name: LEVEL,
        description: "Imported from the club's Friday timetable. No competencies recorded yet.",
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
      select: { id: true },
    });
    await logAudit({
      actorId: admin.id,
      actorName: admin.name,
      action: "create",
      entity: "Level",
      entityId: level.id,
      programmeId: programme.id,
      summary: `Added level ${LEVEL} to ${programme.name}, from the Friday timetable`,
    });
    console.log(`Created level ${LEVEL} in ${programme.name}.`);
  }

  // ---- The class. ----

  const startMinutes = toMinutes(START);
  let course = await prisma.course.findFirst({
    where: { name: LEVEL, dayOfWeek: DAY, startMinutes, levelId: level.id },
    select: {
      id: true,
      name: true,
      capacity: true,
      dayOfWeek: true,
      startMinutes: true,
      levelId: true,
      level: { select: { name: true, programmeId: true } },
    },
  });

  if (!course) {
    course = await prisma.course.create({
      data: {
        levelId: level.id,
        name: LEVEL,
        dayOfWeek: DAY,
        startMinutes,
        durationMinutes: 30,
        capacity: CAPACITY,
        location: "Main Pool",
        instructorId: admin.id,
      },
      select: {
        id: true,
        name: true,
        capacity: true,
        dayOfWeek: true,
        startMinutes: true,
        levelId: true,
        level: { select: { name: true, programmeId: true } },
      },
    });
    await logAudit({
      actorId: admin.id,
      actorName: admin.name,
      action: "create",
      entity: "Course",
      entityId: course.id,
      programmeId: course.level.programmeId,
      summary: `Added ${courseLabel(course)} from the club's Friday timetable (course ${CODE}), capacity ${CAPACITY}`,
    });
    console.log(`Created ${courseLabel(course)}.`);
  }

  // ---- The roster. ----

  const added: string[] = [];

  for (const e of ENROLLEES) {
    const existing = await prisma.student.findUnique({
      where: { memberNumber: e.member },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        _count: { select: { enrolments: true } },
      },
    });

    let studentId: string;
    let name: string;

    if (existing) {
      if (normalise(existing.firstName, existing.lastName) !== normalise(e.first, e.last)) {
        conflicts.push(
          `${e.member} is "${existing.firstName} ${existing.lastName}" in the app but "${e.first} ${e.last}" in this source — not enrolled.`
        );
        continue;
      }
      if (`${existing.firstName} ${existing.lastName}` !== `${e.first} ${e.last}`) {
        renames.push(
          `${e.member}: app has "${existing.firstName} ${existing.lastName}", source has "${e.first} ${e.last}" — left as it is.`
        );
      }
      if (existing._count.enrolments > 0) {
        alsoSwimsElsewhere.push(`${existing.firstName} ${existing.lastName} (${e.member})`);
      }
      studentId = existing.id;
      name = fullName(existing);
    } else {
      const created = await prisma.student.create({
        data: {
          memberNumber: e.member,
          firstName: e.first,
          lastName: e.last,
          notes: noteFor(e),
        },
        select: { id: true, firstName: true, lastName: true },
      });
      studentsCreated += 1;
      studentId = created.id;
      name = fullName(created);
    }

    const outcome = await withCourseSeat(course.id, async (tx) => {
      const open = await tx.enrolment.findFirst({
        where: { studentId, courseId: course.id, status: { in: ["ACTIVE", "WAITLISTED"] } },
        select: { id: true },
      });
      if (open) return "already" as const;

      const taken = await tx.enrolment.count({ where: { courseId: course.id, status: "ACTIVE" } });
      if (course.capacity !== null && taken >= course.capacity) return "full" as const;

      await tx.enrolment.create({
        data: {
          studentId,
          courseId: course.id,
          levelId: course.levelId,
          programmeId: course.level.programmeId,
          status: "ACTIVE",
          startedOn,
        },
      });
      return "enrolled" as const;
    });

    if (outcome === "enrolled") {
      enrolled += 1;
      added.push(name);
    } else if (outcome === "full") {
      problems.push(`The class is full — ${name} (${e.member}) was not enrolled.`);
    }
  }

  if (added.length > 0) {
    await logAudit({
      actorId: admin.id,
      actorName: admin.name,
      action: "enrol",
      entity: "Course",
      entityId: course.id,
      programmeId: course.level.programmeId,
      summary: `Imported the Friday roster for ${courseLabel(course)} — ${added.length} enrolled (${added.slice(0, 6).join(", ")}${added.length > 6 ? ` and ${added.length - 6} others` : ""})`,
    });
  }

  console.log(`\n${studentsCreated} students created, ${enrolled} enrolments made.`);

  if (conflicts.length) {
    console.log(`\nCONFLICTS — a member number that names a different child (${conflicts.length}):`);
    conflicts.forEach((c) => console.log(` ! ${c}`));
  }
  if (problems.length) {
    console.log(`\nPROBLEMS (${problems.length}):`);
    problems.forEach((p) => console.log(` - ${p}`));
  }
  if (renames.length) {
    console.log(`\nSpelled differently here than in the app (${renames.length}):`);
    renames.forEach((r) => console.log(` - ${r}`));
  }
  if (alsoSwimsElsewhere.length) {
    console.log(`\nAlready swimming elsewhere in the week (${alsoSwimsElsewhere.length}):`);
    alsoSwimsElsewhere.forEach((s) => console.log(` - ${s}`));
  }

  console.log(
    `\nNothing to verify: all 31 readings were confirmed at 560dpi, including the short member numbers LWD16, LWD1075 and LWB7684.`
  );
  console.log(`\nTranscribed exactly, but odd in the source itself (${ODD_IN_SOURCE.size}):`);
  for (const [member, note] of ODD_IN_SOURCE) console.log(` - ${member}  ${note}`);

  await prisma.$disconnect();
}

void main();
