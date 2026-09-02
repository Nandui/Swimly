import "dotenv/config";
import { logAudit } from "@/lib/audit";
import { courseLabel } from "@/lib/courses/constants";
import { withCourseSeat } from "@/lib/enrolment/seat";
import { parseDateOnly, today } from "@/lib/format";
import { fullName } from "@/lib/students/constants";
import { prisma } from "@/lib/prisma";

/** The Friday timetable and rosters for LeisureWorld Churchfield, from the
 *  PDF of the club's existing system (2 Sep 2026). Fifteen weekly classes,
 *  Starfish to Sharks 2, and nothing else on the page — a plain day like
 *  Tuesday and Thursday. Same method and guards as the other Churchfield
 *  days: pages at 200dpi and every roster re-read at 400dpi, capacity from
 *  each class card's own **Available** count (a card showing "Only Waiting
 *  List" is full at the number it lists), every enrolment through
 *  `withCourseSeat`, idempotent, audited, levels looked up inside
 *  Churchfield's own programmes, a Bishopstown member number reported rather
 *  than matched. All 91 member numbers here were new to the app when this
 *  was written, checked against the live database before the run.
 *
 *  **Two Emma Healys.** Emma Healy LWB419602 here (Dolphins 17:30, 7, with
 *  Nathan Healy LWB419603 in Sharks 1) is not Wednesday's Emma Healy
 *  LWB422224 (Dolphins 16:20, 7, with Ryan Healy LWB422223). Both hold their
 *  membership at Bishopstown. Two member numbers means two swimmers here,
 *  because the member number is the only key; if the club's system has one
 *  child twice, that is for a person to merge, not a script to guess.
 *
 *  **Sixteen children have Bishopstown as their home facility** (LWB numbers)
 *  but swim at Churchfield on Fridays. They are Churchfield swimmers here;
 *  the note on each says where the membership is held.
 *
 *  **Three capacities look odd and are kept as the cards say.** Starfish
 *  16:20 works out at 6 places and Starfish 15:10 at 7, where Starfish
 *  usually holds 8; Penguins 15:45 has 8 in and 1 place, so 9. Every class is
 *  EUR125 a block, so there is no price tell to second-guess the levels with.
 *
 *  Not carried over: the source marks Grace Peyton (Dolphins 15:10) "Ready to
 *  move". The app decides readiness from competencies, not from a flag. */

const CLUB_ID = "club_churchfield";
const DAY = "FRIDAY" as const;

/** Transcribed exactly. Oddities in the club's own records, not misreadings. */
const ODD_IN_SOURCE = new Map([
  ["LWC431012", "ABEL SUMON JOSEPH — all capitals"],
  ["LWC424815", "Ollie O leary — lowercase l"],
  ["LWC427967", "Finn Osullivan — no apostrophe"],
  ["LWC425748", "Paige Osullivan — no apostrophe"],
  ["LWC421612", "Oisin O Niell — Niell as written"],
  ["LWC413318", "Darragh Mcsweeney — lowercase s"],
  ["LWC56726", "Tadgh Murphy — Tadgh as written"],
  ["LWC433308", "Molliemae Condon — one word"],
  ["LWC429113", "Giorgie Lawless — Giorgie as written"],
]);

/** Readings I am least sure of even at 400dpi: unfamiliar names where the
 *  source itself may hold the misspelling. */
const UNCERTAIN = new Set([
  "LWC434686", // Cody Howey
  "LWC38449", // Leighton Mylod
  "LWC430740", // Abdiasis Jiam
  "LWB86759", // Eoghan Bulgajewski
  "LWC423995", // Isabella Koumrouyan Vieira
]);

type Enrollee = {
  member: string;
  first: string;
  last: string;
  age: number;
  /** Home facility when it is not Churchfield: "B" = LW Bishopstown. */
  facility?: "B";
};

type Roster = {
  /** The club's course code, kept so a row here can be traced to their system. */
  code: string;
  course: string;
  level: string;
  start: string;
  capacity: number;
  location: string;
  enrollees: Enrollee[];
};

const LEARNER = "Learner Pool";
const lane = (n: number) => `Lane ${n}`;

const ROSTERS: Roster[] = [
  // ---- Starfish ----
  {
    code: "00008339", course: "Starfish", level: "Starfish", start: "15:10",
    capacity: 7, location: LEARNER, // nobody in it yet, 7 available
    enrollees: [],
  },
  {
    code: "00008340", course: "Starfish", level: "Starfish", start: "15:45",
    capacity: 8, location: LEARNER, // 3 in, 5 available
    enrollees: [
      { member: "LWC416220", first: "Danny", last: "Olden", age: 5 },
      { member: "LWC433308", first: "Molliemae", last: "Condon", age: 5 },
      { member: "LWC434686", first: "Cody", last: "Howey", age: 7 },
    ],
  },
  {
    code: "00008341", course: "Starfish", level: "Starfish", start: "16:20",
    capacity: 6, location: LEARNER, // 2 in, 4 available
    enrollees: [
      { member: "LWC62783", first: "Ollie", last: "Corcoran", age: 5 },
      { member: "LWC435788", first: "Joy", last: "Talesco", age: 5 },
    ],
  },

  // ---- Penguins ----
  {
    code: "00008345", course: "Penguins", level: "Penguins", start: "15:45",
    capacity: 9, location: LEARNER, // 8 in, 1 available
    enrollees: [
      { member: "LWC415794", first: "Liam", last: "O'Sullivan", age: 6 },
      { member: "LWC421612", first: "Oisin", last: "O Niell", age: 6 },
      { member: "LWC425513", first: "Isabel", last: "McGrath", age: 7 },
      { member: "LWC427640", first: "Isabella May", last: "Shortt", age: 6 },
      { member: "LWB429809", first: "Cara", last: "Nemtanu", age: 5, facility: "B" },
      { member: "LWB429811", first: "Milla", last: "Nemtanu", age: 5, facility: "B" },
      { member: "LWC429853", first: "Jasmine", last: "Foley", age: 5 },
      { member: "LWC431909", first: "Maddison", last: "Connolly Hegarty", age: 5 },
    ],
  },
  {
    code: "00008406", course: "Penguins", level: "Penguins", start: "16:55",
    capacity: 8, location: LEARNER, // 3 in, 5 available
    enrollees: [
      { member: "LWC45743", first: "Alva", last: "Burke", age: 6 },
      { member: "LWB425744", first: "Katelyn", last: "Crowley", age: 6, facility: "B" },
      { member: "LWC431012", first: "ABEL SUMON", last: "JOSEPH", age: 7 },
    ],
  },
  {
    code: "00008410", course: "Penguins", level: "Penguins", start: "17:30",
    capacity: 8, location: LEARNER, // 3 in, 5 available
    enrollees: [
      { member: "LWC424651", first: "Sorcha", last: "O Connor", age: 6 },
      { member: "LWC437535", first: "Artem", last: "Diachuk", age: 7 },
      { member: "LWC439903", first: "Corey", last: "Hussey", age: 8 },
    ],
  },

  // ---- Turtles ----
  {
    code: "00008352", course: "Turtles", level: "Turtles", start: "15:10",
    capacity: 10, location: lane(1), // 7 in, 3 available
    enrollees: [
      { member: "LWC38449", first: "Leighton", last: "Mylod", age: 8 },
      { member: "LWC424815", first: "Ollie", last: "O leary", age: 7 },
      { member: "LWC429113", first: "Giorgie", last: "Lawless", age: 8 },
      { member: "LWC431467", first: "Joel", last: "Peyton", age: 5 },
      { member: "LWC432051", first: "Evan", last: "English", age: 9 },
      { member: "LWC434789", first: "Max", last: "Beer", age: 9 },
      { member: "LWC434790", first: "Amelia", last: "Beer", age: 5 },
    ],
  },
  {
    code: "00008353", course: "Turtles", level: "Turtles", start: "15:45",
    capacity: 10, location: lane(1), // 5 in, 5 available
    enrollees: [
      { member: "LWC423045", first: "Erin", last: "O'Flaherty", age: 6 },
      { member: "LWC427252", first: "Beth", last: "McCann", age: 9 },
      { member: "LWC427967", first: "Finn", last: "Osullivan", age: 7 },
      { member: "LWC428411", first: "Chloe", last: "Gleeson", age: 6 },
      { member: "LWC436979", first: "Cian", last: "Gosal", age: 9 },
    ],
  },
  {
    code: "00008354", course: "Turtles", level: "Turtles", start: "16:20",
    capacity: 10, location: lane(1), // Only Waiting List: full at 10
    enrollees: [
      { member: "LWC54262", first: "Oisin", last: "Gallagher", age: 7 },
      { member: "LWC63935", first: "Savannah", last: "Lobo", age: 6 },
      { member: "LWC64320", first: "Enzo", last: "Torres", age: 7 },
      { member: "LWC423019", first: "Adrian", last: "Murphy", age: 7 },
      { member: "LWC426345", first: "Eolann", last: "McNamara", age: 6 },
      { member: "LWB426898", first: "Ailbhe", last: "Godfrey", age: 7, facility: "B" },
      { member: "LWB426900", first: "Esme", last: "Godfrey", age: 7, facility: "B" },
      { member: "LWC427177", first: "Jake", last: "Twohig", age: 8 },
      { member: "LWC429817", first: "Charlotte", last: "Byrd", age: 6 },
      { member: "LWC430740", first: "Abdiasis", last: "Jiam", age: 11 },
    ],
  },
  {
    code: "00008407", course: "Turtles", level: "Turtles", start: "16:55",
    capacity: 10, location: lane(1), // 8 in, 2 available
    enrollees: [
      { member: "LWB98638", first: "Nivansh", last: "Patil", age: 7, facility: "B" },
      { member: "LWC411911", first: "Isabell", last: "Frahill", age: 6 },
      { member: "LWC413318", first: "Darragh", last: "Mcsweeney", age: 6 },
      { member: "LWB415780", first: "Bonnie", last: "Adams", age: 8, facility: "B" },
      { member: "LWC427493", first: "Maya", last: "Kelleher", age: 7 },
      { member: "LWC427895", first: "Ellie", last: "Crean", age: 7 },
      { member: "LWC429278", first: "Éala", last: "O'Connor", age: 7 },
      { member: "LWC432899", first: "Sophie", last: "Pittorino", age: 7 },
    ],
  },

  // ---- Dolphins ----
  {
    code: "00008722", course: "Dolphins", level: "Dolphins", start: "15:10",
    capacity: 12, location: lane(2), // 6 in, 6 available
    enrollees: [
      { member: "LWC38717", first: "Adam", last: "Olden", age: 9 },
      { member: "LWC62109", first: "Fiadh", last: "O Donovan", age: 7 },
      { member: "LWC415769", first: "Harrison", last: "Foley", age: 8 },
      { member: "LWC424485", first: "Lillyrose", last: "Connolly", age: 8 },
      { member: "LWC424960", first: "Grace", last: "Peyton", age: 8 },
      { member: "LWC431580", first: "Emma", last: "Kenneally", age: 7 },
    ],
  },
  {
    code: "00008413", course: "Dolphins", level: "Dolphins", start: "16:20",
    capacity: 12, location: lane(3), // Only Waiting List: full at 12
    enrollees: [
      { member: "LWC45742", first: "Finn", last: "Burke", age: 7 },
      { member: "LWB81684", first: "Azzan", last: "Jalal", age: 8, facility: "B" },
      { member: "LWB84135", first: "Liam", last: "Hurley", age: 7, facility: "B" },
      { member: "LWB87427", first: "Seán", last: "Bishop", age: 8, facility: "B" },
      { member: "LWC57433", first: "Jacob", last: "Power", age: 8 },
      { member: "LWC59748", first: "Millie", last: "Power", age: 6 },
      { member: "LWC62782", first: "Danny", last: "Corcoran", age: 8 },
      { member: "LWC410501", first: "Taya", last: "Corbett", age: 7 },
      { member: "LWC420874", first: "Caoimhe", last: "McNamara", age: 7 },
      { member: "LWC423995", first: "Isabella", last: "Koumrouyan Vieira", age: 7 },
      { member: "LWC428338", first: "Micheal", last: "Collins", age: 7 },
      { member: "LWB432211", first: "Maya", last: "Young", age: 11, facility: "B" },
    ],
  },
  {
    code: "00008348", course: "Dolphins", level: "Dolphins", start: "17:30",
    capacity: 12, location: lane(2), // 10 in, 2 available
    enrollees: [
      { member: "LWB82565", first: "Sophie", last: "Joyce", age: 8, facility: "B" },
      { member: "LWC56726", first: "Tadgh", last: "Murphy", age: 9 },
      { member: "LWC60487", first: "Gunnar", last: "O'Leary Eriksson", age: 10 },
      { member: "LWB419602", first: "Emma", last: "Healy", age: 7, facility: "B" },
      { member: "LWC423894", first: "Sanvi", last: "Masali", age: 8 },
      { member: "LWC423959", first: "Paudie", last: "O Connor", age: 9 },
      { member: "LWC423960", first: "Seamus", last: "O Connor", age: 7 },
      { member: "LWC425748", first: "Paige", last: "Osullivan", age: 9 },
      { member: "LWC426453", first: "Faye", last: "Sharpe", age: 7 },
      { member: "LWC431048", first: "James", last: "Rushe", age: 10 },
    ],
  },

  // ---- Sharks ----
  {
    code: "00008408", course: "Sharks 1", level: "Sharks 1", start: "16:55",
    capacity: 12, location: lane(4), // 11 in, 1 available
    enrollees: [
      { member: "LWC30741", first: "Pippa", last: "Rushe", age: 11 },
      { member: "LWC50603", first: "Oscar", last: "Mohally", age: 10 },
      { member: "LWB81409", first: "Carly", last: "Crowley", age: 9, facility: "B" },
      { member: "LWC53735", first: "Juno", last: "Mohally", age: 8 },
      { member: "LWB86759", first: "Eoghan", last: "Bulgajewski", age: 9, facility: "B" },
      { member: "LWC59986", first: "Evie", last: "O Neill", age: 10 },
      { member: "LWB419603", first: "Nathan", last: "Healy", age: 9, facility: "B" },
      { member: "LWC427007", first: "Anastasiia", last: "Velychko", age: 13 },
      { member: "LWC428339", first: "Caoimhe", last: "Collins", age: 10 },
      { member: "LWC431988", first: "Ben", last: "O Shea", age: 12 },
      { member: "LWC431989", first: "Zack", last: "O Shea", age: 8 },
    ],
  },
  {
    code: "00008409", course: "Sharks 2", level: "Sharks 2", start: "17:30",
    capacity: 12, location: lane(4), // 3 in, 9 available
    enrollees: [
      { member: "LWC37847", first: "Lee", last: "Murray", age: 11 },
      { member: "LWC43717", first: "Jolan", last: "Williams", age: 10 },
      { member: "LWC49889", first: "Eli", last: "Frahill", age: 9 },
    ],
  },
];

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function noteFor(e: Enrollee): string {
  const facility = e.facility === "B" ? "LW Bishopstown" : "LW Churchfield";
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

type Club = { id: string; name: string };

type Report = {
  problems: string[];
  conflicts: string[];
  otherClub: string[];
  renames: string[];
  alsoElsewhere: string[];
};

/** Finds or creates the swimmer for one source row, in this club. Null means
 *  the row was refused and the reason is in the report. */
async function resolveStudent(
  e: Enrollee,
  club: Club,
  where: string,
  report: Report,
  counters: { studentsCreated: number }
): Promise<{ studentId: string; name: string } | null> {
  const existing = await prisma.student.findUnique({
    where: { memberNumber: e.member },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      clubId: true,
      club: { select: { name: true } },
      _count: { select: { enrolments: true, assessmentBookings: true } },
    },
  });

  if (!existing) {
    const created = await prisma.student.create({
      data: {
        clubId: club.id,
        memberNumber: e.member,
        firstName: e.first,
        lastName: e.last,
        notes: noteFor(e),
      },
      select: { id: true, firstName: true, lastName: true },
    });
    counters.studentsCreated += 1;
    return { studentId: created.id, name: fullName(created) };
  }

  if (existing.clubId !== club.id) {
    report.otherClub.push(
      `${e.member} "${e.first} ${e.last}" is already a ${existing.club.name} swimmer ("${existing.firstName} ${existing.lastName}") — left out of ${where}. Swimmers are not moved between clubs; a person decides.`
    );
    return null;
  }
  if (normalise(existing.firstName, existing.lastName) !== normalise(e.first, e.last)) {
    report.conflicts.push(
      `${e.member} is "${existing.firstName} ${existing.lastName}" in the app but "${e.first} ${e.last}" in this source — left out of ${where}.`
    );
    return null;
  }
  if (`${existing.firstName} ${existing.lastName}` !== `${e.first} ${e.last}`) {
    report.renames.push(
      `${e.member}: app has "${existing.firstName} ${existing.lastName}", source has "${e.first} ${e.last}" — left as it is.`
    );
  }
  if (existing._count.enrolments + existing._count.assessmentBookings > 0) {
    report.alsoElsewhere.push(
      `${existing.firstName} ${existing.lastName} (${e.member}) is already in a class or booked on a session.`
    );
  }
  return { studentId: existing.id, name: fullName(existing) };
}

async function main() {
  const club = await prisma.club.findFirst({
    where: { id: CLUB_ID, archivedAt: null },
    select: { id: true, name: true },
  });
  if (!club) throw new Error(`No live club with id "${CLUB_ID}". Run the clubs migration first.`);

  // Whoever can manage staff and has been here longest: the seeded admin.
  const admin = await prisma.user.findFirst({
    where: { isActive: true, staffRole: { permissions: { has: "staff.manage" } } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!admin) throw new Error("No admin account to attribute the import to.");

  const startedOn = parseDateOnly(today());
  const counters = { studentsCreated: 0 };
  let coursesCreated = 0;
  let enrolled = 0;
  const report: Report = { problems: [], conflicts: [], otherClub: [], renames: [], alsoElsewhere: [] };

  // This club's live levels only. The same names exist under Bishopstown's
  // programmes, and a lookup that forgot the club would put Churchfield's
  // classes on Bishopstown's ladder. Unique within the club is asserted, not
  // assumed.
  const levelRows = await prisma.level.findMany({
    where: { archivedAt: null, programme: { clubId: club.id, archivedAt: null } },
    select: { id: true, name: true, programme: { select: { name: true } } },
  });
  const levels = new Map<string, string>();
  for (const l of levelRows) {
    if (levels.has(l.name)) {
      throw new Error(
        `${club.name} has two live levels called "${l.name}" (one in ${l.programme.name}). Name the programme explicitly here.`
      );
    }
    levels.set(l.name, l.id);
  }

  for (const roster of ROSTERS) {
    const levelId = levels.get(roster.level);
    if (!levelId) {
      report.problems.push(
        `${club.name} has no level "${roster.level}" — ${roster.course} ${roster.start} skipped.`
      );
      continue;
    }

    const startMinutes = toMinutes(roster.start);
    const select = {
      id: true,
      name: true,
      capacity: true,
      dayOfWeek: true,
      startMinutes: true,
      levelId: true,
      level: { select: { name: true, programmeId: true } },
    } as const;

    let course = await prisma.course.findFirst({
      where: { clubId: club.id, name: roster.course, dayOfWeek: DAY, startMinutes, levelId },
      select,
    });

    if (!course) {
      course = await prisma.course.create({
        data: {
          clubId: club.id,
          levelId,
          name: roster.course,
          dayOfWeek: DAY,
          startMinutes,
          durationMinutes: 30,
          capacity: roster.capacity,
          location: roster.location,
          instructorId: admin.id,
        },
        select,
      });
      coursesCreated += 1;
      await logAudit({
        actorId: admin.id,
        actorName: admin.name,
        action: "create",
        entity: "Course",
        entityId: course.id,
        programmeId: course.level.programmeId,
        clubId: club.id,
        summary: `Added ${courseLabel(course)} from ${club.name}'s Friday timetable (course ${roster.code}), capacity ${roster.capacity}`,
      });
    }

    const added: string[] = [];
    const where = `${roster.course} ${roster.start}`;

    for (const e of roster.enrollees) {
      const resolved = await resolveStudent(e, club, where, report, counters);
      if (!resolved) continue;
      const { studentId, name } = resolved;

      const outcome = await withCourseSeat(course.id, async (tx) => {
        const open = await tx.enrolment.findFirst({
          where: { studentId, courseId: course.id, status: { in: ["ACTIVE", "WAITLISTED"] } },
          select: { id: true },
        });
        if (open) return "already" as const;

        const taken = await tx.enrolment.count({
          where: { courseId: course.id, status: "ACTIVE" },
        });
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
        report.problems.push(`${where} is full — ${name} (${e.member}) was not enrolled.`);
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
        clubId: club.id,
        summary: `Imported ${club.name}'s Friday roster for ${courseLabel(course)} — ${added.length} enrolled (${added.slice(0, 6).join(", ")}${added.length > 6 ? ` and ${added.length - 6} others` : ""})`,
      });
    }

    console.log(`${roster.course.padEnd(10)} ${roster.start}  ${added.length} enrolled.`);
  }

  console.log(
    `\n${coursesCreated} classes created, ${counters.studentsCreated} students created, ${enrolled} enrolments made — all in ${club.name}.`
  );

  if (report.otherClub.length) {
    console.log(`\nANOTHER CLUB'S SWIMMER — a member number already held elsewhere (${report.otherClub.length}):`);
    report.otherClub.forEach((c) => console.log(` ! ${c}`));
  }
  if (report.conflicts.length) {
    console.log(`\nCONFLICTS — a member number that names a different child (${report.conflicts.length}):`);
    report.conflicts.forEach((c) => console.log(` ! ${c}`));
  }
  if (report.problems.length) {
    console.log(`\nPROBLEMS (${report.problems.length}):`);
    report.problems.forEach((p) => console.log(` - ${p}`));
  }
  if (report.renames.length) {
    console.log(`\nSpelled differently here than in the app (${report.renames.length}):`);
    report.renames.forEach((r) => console.log(` - ${r}`));
  }
  if (report.alsoElsewhere.length) {
    console.log(`\nAlready in a class or booked on a session (${report.alsoElsewhere.length}):`);
    report.alsoElsewhere.forEach((s) => console.log(` - ${s}`));
  }

  const everyone = ROSTERS.flatMap((r) => r.enrollees);
  const fromBishopstown = everyone.filter((e) => e.facility === "B");
  console.log(`\nHome facility LW Bishopstown, swimming here (${fromBishopstown.length}):`);
  for (const e of fromBishopstown) console.log(` - ${e.member}  ${e.first} ${e.last}`);

  console.log(`\nReadings to verify against the source (${UNCERTAIN.size}):`);
  for (const e of everyone) {
    if (UNCERTAIN.has(e.member)) console.log(` - ${e.member}  ${e.first} ${e.last}`);
  }

  console.log(`\nTranscribed exactly, but odd in the source itself (${ODD_IN_SOURCE.size}):`);
  for (const [member, note] of ODD_IN_SOURCE) console.log(` - ${member}  ${note}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
