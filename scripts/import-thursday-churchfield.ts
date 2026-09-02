import "dotenv/config";
import { logAudit } from "@/lib/audit";
import { courseLabel } from "@/lib/courses/constants";
import { withCourseSeat } from "@/lib/enrolment/seat";
import { parseDateOnly, today } from "@/lib/format";
import { fullName } from "@/lib/students/constants";
import { prisma } from "@/lib/prisma";

/** The Thursday timetable and rosters for LeisureWorld Churchfield, from the
 *  PDF of the club's existing system (2 Sep 2026). Fifteen weekly classes,
 *  Starfish to Sharks 2, and nothing else on the page: no Rookies and no
 *  assessment sessions, so this is a plain day like Tuesday. Same method and
 *  guards as the other Churchfield days: pages at 200dpi and every roster
 *  re-read at 400dpi, capacity from each class card's own **Available** count
 *  (a card showing "Only Waiting List" is full at the number it lists), every
 *  enrolment through `withCourseSeat`, idempotent, audited, levels looked up
 *  inside Churchfield's own programmes, a Bishopstown member number reported
 *  rather than matched. All 79 member numbers here were new to the app when
 *  this was written, checked against the live database before the run.
 *
 *  **Siblings across days, not the same child.** Aibhlinn Daly LWC428945 here
 *  sits one number from James Daly LWC428946 on Wednesday; Zach Viris
 *  LWC60274 one from Rían Viris LWC60275 on Tuesday. Different numbers,
 *  different children, and the member number is the only key.
 *
 *  **Five children have Bishopstown as their home facility** (LWB numbers)
 *  but swim at Churchfield on Thursdays. They are Churchfield swimmers here;
 *  the note on each says where the membership is held.
 *
 *  **Two capacities look odd and are kept as the cards say.** Both Turtles
 *  classes work out at 11 — one full at 11, one with 9 in and 2 places —
 *  where the other days' Turtles classes hold 10. Every class is EUR125 a
 *  block, so there is no price tell to second-guess the levels with. */

const CLUB_ID = "club_churchfield";
const DAY = "THURSDAY" as const;

/** Transcribed exactly. Oddities in the club's own records, not misreadings. */
const ODD_IN_SOURCE = new Map([
  ["LWC432092", "nora Daly — lowercase first name"],
  ["LWC425559", "Natalie OLeary — no apostrophe; so is Amy OLeary LWC425561"],
  ["LWC413042", "Mia Odonovan — no apostrophe"],
  ["LWC33450", "Cillian O Conor — one n"],
  ["LWC51830", "Julitte Kellher — as written; both words look like misspellings"],
  ["LWC410166", "Domink Chojnowski — Domink as written"],
  ["LWC417291", "Kitty Sheilds — Sheilds as written, and her sister Tara LWC417292 the same; Dylan Shields LWC413003 is not"],
  ["LWC439293", "Emilee Barrington — Emilee as written"],
  ["LWC428930", "Daryla Mae Slattery — Daryla as written"],
]);

/** Readings I am least sure of even at 400dpi: unfamiliar names where the
 *  source itself may hold the misspelling. */
const UNCERTAIN = new Set([
  "LWC53516", // Saoirse Hebert
  "LWC428357", // Kira Masalitin
  "LWC62983", // Sirpika Raja
  "LWC423638", // Laitisse Murray
  "LWB440368", // Alice Wieloch
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
    code: "00008324", course: "Starfish", level: "Starfish", start: "15:10",
    capacity: 8, location: LEARNER, // 2 in, 6 available
    enrollees: [
      { member: "LWC436400", first: "Amelia Rose", last: "O Sullivan", age: 5 },
      { member: "LWC439648", first: "Darcy", last: "Byrne", age: 5 },
    ],
  },
  {
    code: "00008452", course: "Starfish", level: "Starfish", start: "15:45",
    capacity: 8, location: LEARNER, // 3 in, 5 available
    enrollees: [
      { member: "LWC431314", first: "Hania Fatima", last: "Dar", age: 5 },
      { member: "LWC432090", first: "Georgia", last: "O Donovan", age: 7 },
      { member: "LWC433419", first: "Bonnie", last: "O Connor", age: 5 },
    ],
  },
  {
    code: "00008326", course: "Starfish", level: "Starfish", start: "16:20",
    capacity: 8, location: LEARNER, // 4 in, 4 available
    enrollees: [
      { member: "LWC424972", first: "Arron", last: "McCarthy", age: 7 },
      { member: "LWC436512", first: "Nevaeh", last: "O'Mahony Whitley", age: 7 },
      { member: "LWC436593", first: "Oisin Patrick", last: "Leahy Vella", age: 6 },
      { member: "LWC438930", first: "Ben", last: "O Driscoll", age: 5 },
    ],
  },
  {
    code: "00008327", course: "Starfish", level: "Starfish", start: "16:55",
    capacity: 8, location: LEARNER, // 4 in, 4 available
    enrollees: [
      { member: "LWC63557", first: "Akshat Raj", last: "Verma", age: 5 },
      { member: "LWC428178", first: "Darragh", last: "O'Neill", age: 5 },
      { member: "LWC436183", first: "Amelia", last: "Greaney", age: 6 },
      { member: "LWB436294", first: "Kayla", last: "Walsh Moore", age: 5, facility: "B" },
    ],
  },
  {
    code: "00008328", course: "Starfish", level: "Starfish", start: "17:30",
    capacity: 8, location: LEARNER, // 2 in, 6 available
    enrollees: [
      { member: "LWC434763", first: "Sienna", last: "Ford", age: 6 },
      { member: "LWB440368", first: "Alice", last: "Wieloch", age: 5, facility: "B" },
    ],
  },

  // ---- Penguins ----
  {
    code: "00008329", course: "Penguins", level: "Penguins", start: "15:10",
    capacity: 8, location: LEARNER, // nobody in it yet, 8 available
    enrollees: [],
  },
  {
    code: "00008331", course: "Penguins", level: "Penguins", start: "16:20",
    capacity: 8, location: LEARNER, // 6 in, 2 available
    enrollees: [
      { member: "LWC423639", first: "Santanna", last: "Murray", age: 6 },
      { member: "LWC424533", first: "William", last: "Coyle", age: 6 },
      { member: "LWC428582", first: "Robin", last: "Boyle", age: 6 },
      { member: "LWC428583", first: "Ruby", last: "Boyle", age: 6 },
      { member: "LWC430987", first: "Alexander", last: "Kelleher", age: 6 },
      { member: "LWC437787", first: "Ivy", last: "Lubke", age: 5 },
    ],
  },

  // ---- Turtles ----
  {
    code: "00008334", course: "Turtles", level: "Turtles", start: "15:45",
    capacity: 11, location: lane(1), // Only Waiting List: full at 11
    enrollees: [
      { member: "LWC63955", first: "Elaine Anna", last: "Shalom", age: 7 },
      { member: "LWC411980", first: "Jacob", last: "Daly", age: 7 },
      { member: "LWC413713", first: "Theo", last: "Barry", age: 7 },
      { member: "LWC417291", first: "Kitty", last: "Sheilds", age: 6 },
      { member: "LWC417292", first: "Tara", last: "Sheilds", age: 8 },
      { member: "LWC426714", first: "Emma", last: "O Connell", age: 7 },
      { member: "LWC427498", first: "Lucas", last: "Sheehan", age: 7 },
      { member: "LWC428945", first: "Aibhlinn", last: "Daly", age: 9 },
      { member: "LWC429677", first: "Ashton", last: "O Donovan", age: 8 },
      { member: "LWC432092", first: "nora", last: "Daly", age: 9 },
      { member: "LWC432290", first: "Henry", last: "Dineen", age: 5 },
    ],
  },
  {
    code: "00008335", course: "Turtles", level: "Turtles", start: "16:20",
    capacity: 11, location: lane(1), // 9 in, 2 available
    enrollees: [
      { member: "LWC58229", first: "Iarla", last: "Sherlock", age: 7 },
      { member: "LWC413522", first: "Scarlett", last: "Packer", age: 6 },
      { member: "LWC418290", first: "Éirinn", last: "Morey", age: 7 },
      { member: "LWC424999", first: "Conor", last: "McCarthy", age: 9 },
      { member: "LWC431417", first: "Maci", last: "Morey", age: 7 },
      { member: "LWC432332", first: "Fionn", last: "Wallace Lyons", age: 7 },
      { member: "LWB435850", first: "Faye", last: "Morey", age: 6, facility: "B" },
      { member: "LWB435851", first: "Jake", last: "Morey", age: 7, facility: "B" },
      { member: "LWC439293", first: "Emilee", last: "Barrington", age: 11 },
    ],
  },

  // ---- Dolphins ----
  {
    code: "00008405", course: "Dolphins", level: "Dolphins", start: "15:10",
    capacity: 12, location: lane(3), // 1 in, 11 available
    enrollees: [
      { member: "LWC60274", first: "Zach", last: "Viris", age: 11 },
    ],
  },
  {
    code: "00008721", course: "Dolphins", level: "Dolphins", start: "15:45",
    capacity: 12, location: lane(2), // 4 in, 8 available
    enrollees: [
      { member: "LWC413003", first: "Dylan", last: "Shields", age: 8 },
      { member: "LWC423605", first: "Mohammad Ahmed", last: "Dar", age: 7 },
      { member: "LWC428930", first: "Daryla Mae", last: "Slattery", age: 8 },
      { member: "LWC432048", first: "Harry", last: "Buckley", age: 7 },
    ],
  },
  {
    code: "00008336", course: "Dolphins", level: "Dolphins", start: "16:55",
    capacity: 12, location: lane(2), // 4 in, 8 available
    enrollees: [
      { member: "LWC51830", first: "Julitte", last: "Kellher", age: 8 },
      { member: "LWC53516", first: "Saoirse", last: "Hebert", age: 8 },
      { member: "LWC60659", first: "Jamie", last: "Crowley", age: 7 },
      { member: "LWC428357", first: "Kira", last: "Masalitin", age: 9 },
    ],
  },

  // ---- Sharks ----
  {
    code: "00008404", course: "Sharks 1", level: "Sharks 1", start: "16:55",
    capacity: 12, location: lane(4), // Only Waiting List: full at 12
    enrollees: [
      { member: "LWC57558", first: "Advik", last: "Verma", age: 8 },
      { member: "LWC58227", first: "Seán Óg", last: "Sherlock", age: 9 },
      { member: "LWC59261", first: "Zoé", last: "Denis", age: 9 },
      { member: "LWC59567", first: "Shay", last: "Foley", age: 10 },
      { member: "LWC60657", first: "Jake", last: "Crowley", age: 10 },
      { member: "LWC62983", first: "Sirpika", last: "Raja", age: 8 },
      { member: "LWC418287", first: "Caoimhe", last: "Morey", age: 10 },
      { member: "LWC423638", first: "Laitisse", last: "Murray", age: 8 },
      { member: "LWC423741", first: "Ava", last: "Moriarty", age: 7 },
      { member: "LWC425559", first: "Natalie", last: "OLeary", age: 11 },
      { member: "LWC425561", first: "Amy", last: "OLeary", age: 7 },
      { member: "LWC425686", first: "Sadie", last: "Gibbons", age: 9 },
    ],
  },
  {
    code: "00008337", course: "Sharks 1", level: "Sharks 1", start: "17:30",
    capacity: 12, location: lane(3), // 5 in, 7 available
    enrollees: [
      { member: "LWC51039", first: "Eadaoin", last: "O Connor", age: 8 },
      { member: "LWC55357", first: "Aoibhinn", last: "O Ceallaigh", age: 9 },
      { member: "LWC57736", first: "Scott", last: "Mullins", age: 9 },
      { member: "LWB95041", first: "Killian", last: "Moynihan", age: 11, facility: "B" },
      { member: "LWC410166", first: "Domink", last: "Chojnowski", age: 7 },
    ],
  },
  {
    code: "00008338", course: "Sharks 2", level: "Sharks 2", start: "17:30",
    capacity: 12, location: lane(4), // Only Waiting List: full at 12
    enrollees: [
      { member: "LWC33450", first: "Cillian", last: "O Conor", age: 10 },
      { member: "LWC36591", first: "Lucy", last: "Sheehan", age: 10 },
      { member: "LWC38145", first: "Clara", last: "O Riordan Cummins", age: 10 },
      { member: "LWC43517", first: "Kaia", last: "Humphries", age: 10 },
      { member: "LWC48030", first: "Colm", last: "McAuliffe", age: 10 },
      { member: "LWC48031", first: "Cillian", last: "McAuliffe", age: 9 },
      { member: "LWC48526", first: "Layla", last: "Murphy", age: 9 },
      { member: "LWC55356", first: "Ruaidhri", last: "O Ceallaigh", age: 11 },
      { member: "LWC59528", first: "Rosie", last: "O Hanlon", age: 8 },
      { member: "LWC410239", first: "Mason", last: "Dunne", age: 13 },
      { member: "LWC413042", first: "Mia", last: "Odonovan", age: 10 },
      { member: "LWC415962", first: "Riley", last: "Conway", age: 10 },
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
        summary: `Added ${courseLabel(course)} from ${club.name}'s Thursday timetable (course ${roster.code}), capacity ${roster.capacity}`,
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
        summary: `Imported ${club.name}'s Thursday roster for ${courseLabel(course)} — ${added.length} enrolled (${added.slice(0, 6).join(", ")}${added.length > 6 ? ` and ${added.length - 6} others` : ""})`,
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
