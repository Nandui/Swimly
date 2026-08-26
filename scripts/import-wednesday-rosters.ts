import "dotenv/config";
import { logAudit } from "@/lib/audit";
import { courseLabel } from "@/lib/courses/constants";
import { withCourseSeat } from "@/lib/enrolment/seat";
import { parseDateOnly, today } from "@/lib/format";
import { fullName } from "@/lib/students/constants";
import { prisma } from "@/lib/prisma";

/** The Wednesday rosters, transcribed from screenshots of the club's existing
 *  system.
 *
 *  **Read this before trusting the data.** Names and member numbers were read
 *  off compressed screenshots, not an export. Every value here is a best
 *  reading; the ones marked `?` below are the ones worth checking against the
 *  source. A wrong digit in a member number is invisible in the app and only
 *  shows up when somebody tries to reconcile against the club's system.
 *
 *  Held to the app's rules:
 *  - **Idempotent** — students match on `memberNumber`, enrolments on
 *    (student, course), so a second run changes nothing.
 *  - **Locked** — enrolments go through `withCourseSeat`, the same single path
 *    the app uses, so capacity is enforced exactly as it would be at the desk.
 *  - **Audited** — one row per class naming who was added.
 *
 *  Dates of birth are not imported: the source shows an age in whole years,
 *  and inventing a birthday for a child would put a wrong date on a record
 *  that outlives the guess. The age at import goes in `notes` instead. */

const PROGRAMME = "Water Safety & Fun";
const DAY = "WEDNESDAY" as const;

/** Readings I am least sure of, reported again at the end of the run. */
const UNCERTAIN = new Set([
  "LWB419780", // "Faidh Omalony" — read as Fiadh O'Mahony
  "LWB429084", // "Faidh Murphy" — read as Fiadh Murphy
  "LWB62530", // "Siubhan Lucey" — read as Siobhan Lucey
  "LWB423366", // "Charlotte Driolane" — read as Charlotte Drislane
  "LWB410632", // "Tadhg OSullivon" — read as Tadhg O'Sullivan
  "LWB427786", // "Amilie O'Leary" — read as Amelie O'Leary
  "LWB437009", // "Molls Walsh" — read as Molly Walsh
  "LWB424383", // "Luka Karditzse" — surname genuinely unclear
  "LWB426598", // "Rayhan Abrium Robin" — all three parts unclear
  "LWB94997", // "Enrica Bergantion" — surname unclear
  "LWB425104", // "Ana Mae Beano" — surname unclear
  "LWB439291", // Alasdair Gill — the number is out of step with its neighbours
  "LWB428000", // Jimmy McCarthy — trailing zeroes hard to count
]);

type Enrollee = {
  member: string;
  first: string;
  last: string;
  age: number;
  /** "B" = LW Bishopstown, "C" = LW Churchfield. */
  facility?: "B" | "C";
};

type Roster = { course: string; level: string; start: string; enrollees: Enrollee[] };

const ROSTERS: Roster[] = [
  {
    course: "N - Starfish",
    level: "Starfish",
    start: "15:10",
    enrollees: [
      { member: "LWB96079", first: "Darragh", last: "Coughlan", age: 5 },
      { member: "LWC421105", first: "Caoilinn", last: "Casey", age: 5, facility: "C" },
      { member: "LWB428614", first: "Rian", last: "Murphy", age: 8 },
      { member: "LWB436355", first: "Alex", last: "O'Carroll", age: 5 },
    ],
  },
  {
    course: "N - Starfish (B)",
    level: "Starfish",
    start: "15:45",
    enrollees: [
      { member: "LWB418296", first: "James", last: "Quinn", age: 5 },
      { member: "LWB423559", first: "Jayda", last: "O Driscoll O Sullivan", age: 5 },
      { member: "LWB426633", first: "Lauren", last: "Walsh", age: 9 },
      { member: "LWB432605", first: "Daithi", last: "Freeley", age: 7 },
      { member: "LWB433667", first: "Lily-Rose", last: "Green", age: 5 },
      { member: "LWB437414", first: "Rian", last: "O'Sullivan", age: 6 },
    ],
  },
  {
    course: "N - Starfish",
    level: "Starfish",
    start: "16:55",
    enrollees: [
      { member: "LWB423004", first: "Darragh", last: "Casey", age: 6 },
      { member: "LWB433556", first: "Sean", last: "Walsh", age: 6 },
      { member: "LWB434396", first: "Grace", last: "Cooney", age: 5 },
      { member: "LWB436419", first: "Amber", last: "Long", age: 6 },
      { member: "LWB438429", first: "Roisin", last: "O'Donovan", age: 5 },
    ],
  },
  {
    course: "N - Penguins",
    level: "Penguins",
    start: "15:10",
    enrollees: [
      { member: "LWB97470", first: "Isabelle", last: "Nolan", age: 6 },
      { member: "LWC430126", first: "Zoe", last: "Crowley", age: 6, facility: "C" },
      { member: "LWB434437", first: "Orla", last: "O Donnell", age: 5 },
      { member: "LWB432608", first: "Clodagh", last: "Downey", age: 5 },
      { member: "LWB434175", first: "Eduardo", last: "Gusmao", age: 5 },
      { member: "LWB435328", first: "Theo", last: "McDonnell", age: 5 },
    ],
  },
  {
    course: "N - Penguins",
    level: "Penguins",
    start: "16:20",
    enrollees: [
      { member: "LWB98893", first: "Tom", last: "McCarthy", age: 6 },
      { member: "LWB410313", first: "Quinn", last: "McCarthy", age: 7 },
      { member: "LWB412433", first: "Adam", last: "McCormack", age: 6 },
      { member: "LWB414095", first: "Donnchadh", last: "Carroll", age: 6 },
      { member: "LWB424630", first: "Haniya", last: "Hafeez", age: 7 },
      { member: "LWB432496", first: "Jack", last: "Farrugia", age: 6 },
      { member: "LWB435603", first: "Harriet", last: "Murphy", age: 5 },
      { member: "LWB435604", first: "Darcy", last: "Murphy", age: 5 },
    ],
  },
  {
    course: "N - Penguins",
    level: "Penguins",
    start: "16:55",
    enrollees: [
      { member: "LWB94997", first: "Enrica", last: "Bergantion", age: 7 },
      { member: "LWB410632", first: "Tadhg", last: "O'Sullivan", age: 7 },
      { member: "LWB419414", first: "Olivia", last: "Conlon", age: 6 },
      { member: "LWB422194", first: "Lucy", last: "O Dea", age: 7 },
      { member: "LWB422375", first: "Jack", last: "Culhane", age: 7 },
      { member: "LWB423366", first: "Charlotte", last: "Drislane", age: 7 },
      { member: "LWB434808", first: "Mia", last: "McDermott", age: 7 },
      { member: "LWB435042", first: "Willow", last: "Weste", age: 5 },
    ],
  },
  {
    course: "N - Penguins",
    level: "Penguins",
    start: "17:30",
    enrollees: [
      { member: "LWB407924", first: "Aidan", last: "Bermingham", age: 7 },
      { member: "LWB410317", first: "Alex", last: "Mumuni", age: 5 },
      { member: "LWB416418", first: "Leon", last: "Kotarski", age: 7 },
      { member: "LWB419789", first: "Luka", last: "Rodrigues", age: 6 },
      { member: "LWB425926", first: "Harper", last: "Compagno", age: 6 },
      { member: "LWB425927", first: "Halle", last: "Compagno", age: 6 },
      { member: "LWB428398", first: "Eva", last: "Hickey", age: 6 },
      { member: "LWB430146", first: "Jeremiah", last: "Cooney", age: 5 },
    ],
  },
  {
    course: "N - Turtles",
    level: "Turtles",
    start: "15:10",
    enrollees: [
      { member: "LWB92657", first: "Ben", last: "Mulligan", age: 8 },
      { member: "LWB99464", first: "Sienna", last: "Steels", age: 7 },
      { member: "LWB99788", first: "Bobby", last: "Thomas", age: 8 },
      { member: "LWB419273", first: "Josh", last: "Gubbins", age: 7 },
      { member: "LWB419780", first: "Fiadh", last: "O'Mahony", age: 8 },
      { member: "LWC421184", first: "Alanis", last: "Casey", age: 8, facility: "C" },
      { member: "LWB422741", first: "Charlie", last: "Sexton", age: 7 },
      { member: "LWB429081", first: "Savannah", last: "McCarthy", age: 6 },
      { member: "LWB428000", first: "Jimmy", last: "McCarthy", age: 8 },
      { member: "LWB429084", first: "Fiadh", last: "Murphy", age: 9 },
    ],
  },
  {
    course: "N - Turtles",
    level: "Turtles",
    start: "15:45",
    enrollees: [
      { member: "LWB79221", first: "Caleb", last: "Hegarty", age: 8 },
      { member: "LWB62530", first: "Siobhan", last: "Lucey", age: 8 },
      { member: "LWB92842", first: "Hannah", last: "McCarthy", age: 8 },
      { member: "LWB92846", first: "Conor", last: "Quinn", age: 7 },
      { member: "LWB99164", first: "Teddy", last: "O'Sullivan", age: 7 },
      { member: "LWB96901", first: "Lucy", last: "Cronin Mc Cormack", age: 7 },
      { member: "LWB424383", first: "Luka", last: "Karditzse", age: 8 },
      { member: "LWB427592", first: "Nikhil", last: "Mathew Thomas", age: 8 },
      { member: "LWB433291", first: "Jamie", last: "Bennis", age: 8 },
      { member: "LWB437007", first: "Ben", last: "Walsh", age: 9 },
    ],
  },
  {
    course: "N - Turtles",
    level: "Turtles",
    start: "16:20",
    enrollees: [
      { member: "LWB98244", first: "Conrad", last: "McCarthy", age: 7 },
      { member: "LWB412432", first: "Daniel", last: "McCormack", age: 8 },
      { member: "LWB423424", first: "Alison", last: "Switzer", age: 8 },
      { member: "LWB425104", first: "Ana Mae", last: "Beano", age: 8 },
      { member: "LWB425195", first: "Frankie", last: "Deane", age: 6 },
      { member: "LWB426598", first: "Rayhan", last: "Abrium Robin", age: 6 },
      { member: "LWB439291", first: "Alasdair", last: "Gill", age: 7 },
      { member: "LWB432471", first: "Ciara", last: "Barry-White", age: 5 },
      { member: "LWB432495", first: "Megan", last: "Farrugia", age: 9 },
      { member: "LWB434834", first: "Ria", last: "Sweetman", age: 7 },
    ],
  },
  {
    course: "N - Dolphins",
    level: "Dolphins",
    start: "15:10",
    enrollees: [
      { member: "LWB83674", first: "Henry", last: "McDonnell", age: 7 },
      { member: "LWB89340", first: "Oisin", last: "Cummins", age: 7 },
      { member: "LWB91828", first: "Emma", last: "Thornhill", age: 7 },
      { member: "LWB97529", first: "Evelyn", last: "Downey", age: 7 },
      { member: "LWB407210", first: "Rayaan", last: "O'Malley", age: 11 },
      { member: "LWB415636", first: "Tom", last: "Galvin", age: 7 },
      { member: "LWB423710", first: "Hugo Iwan", last: "Wojcik", age: 7 },
      { member: "LWB427062", first: "Ben", last: "O Mahony", age: 11 },
      { member: "LWB427065", first: "Tom", last: "O Mahony", age: 8 },
      { member: "LWC429983", first: "Anya", last: "Saladukha", age: 10, facility: "C" },
    ],
  },
  {
    course: "N - Dolphins",
    level: "Dolphins",
    start: "16:20",
    enrollees: [
      { member: "LWB80685", first: "Fionn", last: "Whelan", age: 9 },
      { member: "LWB80182", first: "Fiachra", last: "Carroll", age: 9 },
      { member: "LWB92988", first: "Jane", last: "Murray", age: 7 },
      { member: "LWB93789", first: "Alyssa Kim", last: "MacDonald", age: 9 },
      { member: "LWB94491", first: "Aisling", last: "Coughlan", age: 8 },
      { member: "LWB96732", first: "Charlie", last: "Kelleher", age: 10 },
      { member: "LWB96738", first: "Kayla", last: "Kelleher", age: 8 },
      { member: "LWB407537", first: "Rian", last: "Duncliffe", age: 8 },
      { member: "LWB417603", first: "Dylan", last: "Kavanagh", age: 9 },
      { member: "LWB427786", first: "Amelie", last: "O'Leary", age: 7 },
      { member: "LWB430285", first: "Andrew", last: "Gill", age: 9 },
      { member: "LWB431194", first: "Eliza", last: "Murphy", age: 8 },
    ],
  },
  {
    course: "N - Dolphins",
    level: "Dolphins",
    start: "16:45",
    enrollees: [
      { member: "LWB93196", first: "Aisha", last: "Sasangka", age: 7 },
      { member: "LWC43266", first: "Doireann", last: "Lucey", age: 9, facility: "C" },
      { member: "LWB81073", first: "Jackson", last: "Ryan", age: 9 },
      { member: "LWB83325", first: "Muhammad", last: "Ibrahim", age: 8 },
      { member: "LWC63206", first: "Chloe", last: "Bennis", age: 8, facility: "C" },
      { member: "LWB411249", first: "Aoibheann", last: "Carley", age: 8 },
      { member: "LWB413307", first: "Caoimhe", last: "Noonan", age: 8 },
      { member: "LWB421075", first: "Paddy", last: "Ahern", age: 9 },
      { member: "LWB429152", first: "Sadie Mae", last: "Drinan", age: 10 },
      { member: "LWB437009", first: "Molly", last: "Walsh", age: 9 },
    ],
  },
];

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function noteFor(e: Enrollee): string {
  const facility = e.facility === "C" ? "LW Churchfield" : "LW Bishopstown";
  return `${facility} · Age ${e.age} as at ${today()} — date of birth not in the source system.`;
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
  const seenNumbers = new Set<string>();
  let studentsCreated = 0;
  let enrolled = 0;
  const problems: string[] = [];

  for (const roster of ROSTERS) {
    const course = await prisma.course.findFirst({
      where: {
        name: roster.course,
        dayOfWeek: DAY,
        startMinutes: toMinutes(roster.start),
        level: { name: roster.level, programmeId: programme.id },
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
    if (!course) {
      problems.push(`No course ${roster.course} ${roster.start} (${roster.level}).`);
      continue;
    }

    const added: string[] = [];

    for (const e of roster.enrollees) {
      if (seenNumbers.has(e.member)) {
        problems.push(`${e.member} (${e.first} ${e.last}) appears more than once — check the source.`);
      }
      seenNumbers.add(e.member);

      const student = await prisma.student.upsert({
        where: { memberNumber: e.member },
        update: { firstName: e.first, lastName: e.last },
        create: {
          memberNumber: e.member,
          firstName: e.first,
          lastName: e.last,
          notes: noteFor(e),
        },
        select: { id: true, firstName: true, lastName: true, createdAt: true, updatedAt: true },
      });
      if (student.createdAt.getTime() === student.updatedAt.getTime()) studentsCreated += 1;

      // The same single locking path the app uses, so capacity is enforced
      // here exactly as it would be at the front desk.
      const outcome = await withCourseSeat(course.id, async (tx) => {
        const open = await tx.enrolment.findFirst({
          where: {
            studentId: student.id,
            courseId: course.id,
            status: { in: ["ACTIVE", "WAITLISTED"] },
          },
          select: { id: true },
        });
        if (open) return "already" as const;

        const taken = await tx.enrolment.count({
          where: { courseId: course.id, status: "ACTIVE" },
        });
        if (course.capacity !== null && taken >= course.capacity) return "full" as const;

        await tx.enrolment.create({
          data: {
            studentId: student.id,
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
        added.push(fullName(student));
      } else if (outcome === "full") {
        problems.push(
          `${roster.course} ${roster.start} is full — ${fullName(student)} (${e.member}) was not enrolled.`
        );
      }
    }

    if (added.length > 0) {
      await logAudit({
        actorId: admin.id,
        actorName: admin.name,
        action: "enrol",
        entity: "Course",
        entityId: course.id,
        programmeId: programme.id,
        summary: `Imported the roster for ${courseLabel(course)} — ${added.length} enrolled (${added.slice(0, 6).join(", ")}${added.length > 6 ? ` and ${added.length - 6} others` : ""})`,
      });
    }

    console.log(`${roster.course} ${roster.start}: ${added.length} enrolled.`);
  }

  console.log(`\n${studentsCreated} students created, ${enrolled} enrolments made.`);
  if (problems.length) {
    console.log(`\nPROBLEMS:`);
    problems.forEach((p) => console.log(` - ${p}`));
  }
  console.log(`\nReadings to verify against the source (${UNCERTAIN.size}):`);
  for (const roster of ROSTERS) {
    for (const e of roster.enrollees) {
      if (UNCERTAIN.has(e.member)) console.log(` - ${e.member}  ${e.first} ${e.last}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
