import "dotenv/config";
import { logAudit } from "@/lib/audit";
import { courseLabel } from "@/lib/courses/constants";
import { withCourseSeat } from "@/lib/enrolment/seat";
import { parseDateOnly, today } from "@/lib/format";
import { fullName } from "@/lib/students/constants";
import { prisma } from "@/lib/prisma";

/** The Monday timetable and rosters for LeisureWorld Churchfield, from the PDF
 *  of the club's existing system (2 Sep 2026). The first import for the second
 *  club, and the same method as every Bishopstown day: pages rendered at
 *  200dpi and every roster re-read at 400dpi, capacity taken from each class
 *  card's own **Available** count (a card showing "Only Waiting List" is full
 *  at the number it lists), every enrolment through `withCourseSeat`,
 *  idempotent, audited, and refusing rather than guessing on a member-number
 *  clash.
 *
 *  **What is different about a second club.** Every row here is Churchfield's:
 *  the classes, the swimmers, the audit entries. Levels are looked up inside
 *  Churchfield's own programmes — the curriculum was copied across before this
 *  ran, so "Starfish" exists twice in the database and only one of them is
 *  ours. A member number that already belongs to a Bishopstown swimmer is a
 *  conflict, not a match: swimmers are never moved between clubs, so the child
 *  is reported and left out for a person to decide. None were expected — all
 *  99 member numbers in this source were new to the app when it was written —
 *  but the guard is what makes a re-run after a mistake safe.
 *
 *  **Ten children have Bishopstown as their home facility** (LWB numbers) but
 *  swim at Churchfield on Mondays. They are Churchfield swimmers here, because
 *  that is where their class is; the note on each says where the membership
 *  is held.
 *
 *  **Three capacities look odd and are kept as the cards say.** Starfish 17:30
 *  shows "Only Waiting List" with 7 in it, where the other Starfish classes
 *  hold 8; Penguins 17:30 has nobody in it and 7 places, where every other
 *  Penguins class has 8; and Turtles 15:10 has 7 swimmers and 4 places, so 11,
 *  where the other Turtles classes hold 10. The price is EUR125 a block for
 *  every class on the page, so unlike Bishopstown there is no Rookies-style
 *  tell to second-guess the levels with. */

const CLUB_ID = "club_churchfield";
const DAY = "MONDAY" as const;

/** Transcribed exactly. Oddities in the club's own records, not misreadings. */
const ODD_IN_SOURCE = new Map([
  ["LWC423792", "ARTHUR TOSCANO — all capitals"],
  ["LWC435124", "JJ O' Donoghue — space after the apostrophe"],
  ["LWC428510", "Grace Osullivan — no apostrophe"],
  ["LWB59788", "Ben Oleary — no apostrophe; Rían O'Leary LWC420900 shares his postcode"],
  ["LWC432538", "Réiltín O leary — lowercase l"],
  ["LWC432749", "Mathew Corbett — one t"],
]);

/** Readings I am least sure of even at 400dpi: unfamiliar names where one
 *  letterform could pass for another. */
const UNCERTAIN = new Set([
  "LWC435969", // Deins Vengles
  "LWC436117", // Fiadh Neidland
  "LWC57632", // Emile Juciute
  "LWC59456", // Sofia Raies
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
    code: "00008279", course: "Starfish", level: "Starfish", start: "15:10",
    capacity: 8, location: LEARNER, // Only Waiting List: full at 8
    enrollees: [
      { member: "LWC58819", first: "Emmie", last: "O'Carroll", age: 7 },
      { member: "LWC415216", first: "Zara", last: "O'Connell", age: 7 },
      { member: "LWC432749", first: "Mathew", last: "Corbett", age: 5 },
      { member: "LWC433167", first: "Ada", last: "Murphy", age: 6 },
      { member: "LWC434425", first: "Phoebe", last: "Covaci", age: 5 },
      { member: "LWC435969", first: "Deins", last: "Vengles", age: 5 },
      { member: "LWC436033", first: "Arlo", last: "Falvey", age: 6 },
      { member: "LWC438588", first: "Ardán", last: "O'Donnell", age: 7 },
    ],
  },
  {
    code: "00008280", course: "Starfish", level: "Starfish", start: "15:45",
    capacity: 8, location: LEARNER, // 5 in, 3 available
    enrollees: [
      { member: "LWC423028", first: "Annabelle", last: "Lynch", age: 6 },
      { member: "LWC434377", first: "Rian", last: "O Callaghan", age: 5 },
      { member: "LWC434378", first: "Fionn", last: "O Callaghan", age: 5 },
      { member: "LWC434601", first: "Jack", last: "O'Connor", age: 5 },
      { member: "LWC436784", first: "Cillian", last: "O Mahony", age: 7 },
    ],
  },
  {
    code: "00008399", course: "Starfish", level: "Starfish", start: "17:30",
    capacity: 7, location: LEARNER, // Only Waiting List: full at 7
    enrollees: [
      { member: "LWC431098", first: "Donnacha", last: "Long", age: 5 },
      { member: "LWC431414", first: "Billy", last: "Casey", age: 5 },
      { member: "LWC432348", first: "Lottie", last: "Neville", age: 6 },
      { member: "LWC436766", first: "Lois", last: "O'Connell", age: 5 },
      { member: "LWC436767", first: "Gregor", last: "O'Connell", age: 5 },
      { member: "LWC437363", first: "Lilly", last: "Collins", age: 5 },
      { member: "LWB438889", first: "Faolan", last: "Hennessy", age: 7, facility: "B" },
    ],
  },

  // ---- Penguins ----
  {
    code: "00008284", course: "Penguins", level: "Penguins", start: "15:10",
    capacity: 8, location: LEARNER, // 2 in, 6 available
    enrollees: [
      { member: "LWC425933", first: "Danny", last: "O Brien", age: 6 },
      { member: "LWC436117", first: "Fiadh", last: "Neidland", age: 5 },
    ],
  },
  {
    code: "00008286", course: "Penguins", level: "Penguins", start: "15:45",
    capacity: 8, location: LEARNER, // 7 in, 1 available
    enrollees: [
      { member: "LWB411700", first: "Conor", last: "Murray", age: 6, facility: "B" },
      { member: "LWC428054", first: "Ollie", last: "Carroll", age: 8 },
      { member: "LWC431460", first: "Nathan", last: "Viris", age: 5 },
      { member: "LWC432840", first: "Rosie", last: "Deasy", age: 5 },
      { member: "LWC435124", first: "JJ", last: "O' Donoghue", age: 8 },
      { member: "LWC435360", first: "Conor", last: "O'Donoghue", age: 5 },
      { member: "LWC436785", first: "Tiernan", last: "O Mahony", age: 6 },
    ],
  },
  {
    code: "00008288", course: "Penguins", level: "Penguins", start: "16:20",
    capacity: 8, location: LEARNER, // 3 in, 5 available
    enrollees: [
      { member: "LWC420900", first: "Rían", last: "O'Leary", age: 5 },
      { member: "LWC424291", first: "Aisling", last: "Murphy", age: 6 },
      { member: "LWC432066", first: "Zach", last: "Craig", age: 6 },
    ],
  },
  {
    code: "00008283", course: "Penguins", level: "Penguins", start: "17:30",
    capacity: 7, location: LEARNER, // nobody in it yet, 7 available
    enrollees: [],
  },

  // ---- Turtles ----
  {
    code: "00008285", course: "Turtles", level: "Turtles", start: "15:10",
    capacity: 11, location: lane(1), // 7 in, 4 available
    enrollees: [
      { member: "LWC41604", first: "Ollie", last: "Lee", age: 7 },
      { member: "LWC57371", first: "Ryan", last: "Lucey", age: 7 },
      { member: "LWC62984", first: "Alfie", last: "Covaci", age: 7 },
      { member: "LWB410704", first: "Mollie Mae", last: "O Driscoll", age: 6, facility: "B" },
      { member: "LWC424603", first: "Alfie", last: "White", age: 6 },
      { member: "LWC424606", first: "Izzy", last: "D'Acci Triggs", age: 6 },
      { member: "LWC425951", first: "Emily", last: "Aldworth", age: 7 },
    ],
  },
  {
    code: "00008287", course: "Turtles", level: "Turtles", start: "15:45",
    capacity: 10, location: lane(1), // 6 in, 4 available
    enrollees: [
      { member: "LWC50677", first: "Vishvak", last: "Ramsankar", age: 10 },
      { member: "LWC60275", first: "Rían", last: "Viris", age: 8 },
      { member: "LWC63782", first: "Finbarr", last: "Lynch", age: 8 },
      { member: "LWC415678", first: "Henry", last: "Wade", age: 8 },
      { member: "LWC428055", first: "Zach", last: "Carroll", age: 7 },
      { member: "LWB429867", first: "Lily-Ann", last: "O'Connor", age: 8, facility: "B" },
    ],
  },
  {
    code: "00008397", course: "Turtles", level: "Turtles", start: "16:20",
    capacity: 10, location: lane(1), // 8 in, 2 available
    enrollees: [
      { member: "LWC63509", first: "Aoife", last: "O Callaghan", age: 7 },
      { member: "LWC64577", first: "George", last: "Bolster", age: 6 },
      { member: "LWC414539", first: "Louis Dean", last: "Murtagh", age: 6 },
      { member: "LWC423728", first: "Rían", last: "Dennehy", age: 6 },
      { member: "LWC424476", first: "Ivy", last: "Horgan", age: 7 },
      { member: "LWC425185", first: "Ada", last: "Fitzsimons", age: 7 },
      { member: "LWC429225", first: "Isabella", last: "Willis", age: 5 },
      { member: "LWC439887", first: "Grace", last: "Kenny", age: 10 },
    ],
  },
  {
    code: "00008398", course: "Turtles", level: "Turtles", start: "16:55",
    capacity: 10, location: lane(1), // 8 in, 2 available
    enrollees: [
      { member: "LWC410743", first: "Pippa", last: "Bolster", age: 6 },
      { member: "LWC414043", first: "Layla", last: "Rourke", age: 6 },
      { member: "LWC423689", first: "Jayden", last: "Healy", age: 7 },
      { member: "LWC423964", first: "Sarah", last: "Kennefick", age: 6 },
      { member: "LWC429734", first: "Mollie", last: "Coade", age: 6 },
      { member: "LWC432538", first: "Réiltín", last: "O leary", age: 7 },
      { member: "LWC433027", first: "Esme", last: "Jones", age: 6 },
      { member: "LWB438888", first: "Fiadh", last: "Hennessy", age: 10, facility: "B" },
    ],
  },

  // ---- Dolphins ----
  {
    code: "00008289", course: "Dolphins", level: "Dolphins", start: "16:20",
    capacity: 12, location: lane(2), // 11 in, 1 available
    enrollees: [
      { member: "LWB59788", first: "Ben", last: "Oleary", age: 8, facility: "B" },
      { member: "LWC52754", first: "Dylan", last: "Craig", age: 8 },
      { member: "LWC63651", first: "Marissa", last: "Coen", age: 7 },
      { member: "LWC64319", first: "Ricky", last: "O Callaghan", age: 7 },
      { member: "LWC409772", first: "Freya", last: "Walsh", age: 9 },
      { member: "LWC410022", first: "Adam", last: "O'Shea", age: 11 },
      { member: "LWC415134", first: "Jayden", last: "Nolan", age: 9 },
      { member: "LWC422978", first: "Sean", last: "Kennefick", age: 9 },
      { member: "LWB423760", first: "Amelia", last: "Horgan", age: 7, facility: "B" },
      { member: "LWC424290", first: "Blaithin", last: "Murphy", age: 9 },
      { member: "LWC427979", first: "Saoirse", last: "Williams", age: 11 },
    ],
  },

  // ---- Sharks ----
  {
    code: "00008290", course: "Sharks 1", level: "Sharks 1", start: "16:55",
    capacity: 12, location: lane(3), // Only Waiting List: full at 12
    enrollees: [
      { member: "LWC48496", first: "John", last: "Dworaczynski", age: 11 },
      { member: "LWC48497", first: "Pavel", last: "Dworaczynski", age: 11 },
      { member: "LWC57632", first: "Emile", last: "Juciute", age: 11 },
      { member: "LWC59696", first: "Conor", last: "Byrne", age: 9 },
      { member: "LWC61686", first: "Freya", last: "Murphy", age: 7 },
      { member: "LWC62048", first: "Eibhlin", last: "Buckley", age: 8 },
      { member: "LWC62801", first: "Kayla", last: "Hogan", age: 10 },
      { member: "LWB420579", first: "Bianka Elizabeth", last: "Csapo", age: 9, facility: "B" },
      { member: "LWC423643", first: "Abi", last: "McCarthy", age: 9 },
      { member: "LWB423761", first: "Daniel", last: "Horgan", age: 10, facility: "B" },
      { member: "LWC423792", first: "ARTHUR", last: "TOSCANO", age: 7 },
      { member: "LWC426352", first: "MJ", last: "O Connell", age: 9 },
    ],
  },
  {
    code: "00008292", course: "Sharks 1", level: "Sharks 1", start: "17:30",
    capacity: 12, location: lane(3), // 5 in, 7 available
    enrollees: [
      { member: "LWC37852", first: "Maddison", last: "O'Shea O'Sullivan", age: 9 },
      { member: "LWC50068", first: "Alasdair", last: "O Connell", age: 8 },
      { member: "LWC58264", first: "Jack", last: "Casey", age: 7 },
      { member: "LWC58916", first: "Jacob", last: "Collins", age: 10 },
      { member: "LWB422188", first: "Emily", last: "O'Driscoll", age: 8, facility: "B" },
    ],
  },
  {
    code: "00008291", course: "Sharks 2", level: "Sharks 2", start: "16:55",
    capacity: 12, location: lane(4), // 10 in, 2 available
    enrollees: [
      { member: "LWC39460", first: "Gearóid", last: "McCarthy", age: 11 },
      { member: "LWC49783", first: "Roisin", last: "McCarthy", age: 9 },
      { member: "LWC51349", first: "Harry", last: "Bolster", age: 10 },
      { member: "LWC59456", first: "Sofia", last: "Raies", age: 11 },
      { member: "LWC59695", first: "Daniel", last: "Byrne", age: 9 },
      { member: "LWC61734", first: "Jamie", last: "Stafford-Shaw", age: 10 },
      { member: "LWC415072", first: "Kailyn", last: "Casey", age: 11 },
      { member: "LWC423688", first: "Emily", last: "Healy", age: 10 },
      { member: "LWC425530", first: "Muhammad", last: "Furqan", age: 12 },
      { member: "LWC428510", first: "Grace", last: "Osullivan", age: 9 },
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
  let coursesCreated = 0;
  let studentsCreated = 0;
  let enrolled = 0;
  const problems: string[] = [];
  const conflicts: string[] = [];
  const otherClub: string[] = [];
  const renames: string[] = [];
  const alsoOnAnotherDay: string[] = [];

  // This club's live levels only. The same names exist under Bishopstown's
  // programmes, and a lookup that forgot the club would put Churchfield's
  // classes on Bishopstown's ladder. Unique within the club is asserted, not
  // assumed: two programmes here could each have a "Starfish".
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
      problems.push(
        `${club.name} has no level "${roster.level}" — ${roster.course} ${roster.start} skipped. Copy the programme across first.`
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
        summary: `Added ${courseLabel(course)} from ${club.name}'s Monday timetable (course ${roster.code}), capacity ${roster.capacity}`,
      });
    }

    const added: string[] = [];

    for (const e of roster.enrollees) {
      const existing = await prisma.student.findUnique({
        where: { memberNumber: e.member },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          clubId: true,
          club: { select: { name: true } },
          _count: { select: { enrolments: true } },
        },
      });

      let studentId: string;
      let name: string;

      if (existing) {
        if (existing.clubId !== club.id) {
          otherClub.push(
            `${e.member} "${e.first} ${e.last}" is already a ${existing.club.name} swimmer ("${existing.firstName} ${existing.lastName}") — not enrolled in ${roster.course} ${roster.start}. Swimmers are not moved between clubs; a person decides.`
          );
          continue;
        }
        if (normalise(existing.firstName, existing.lastName) !== normalise(e.first, e.last)) {
          conflicts.push(
            `${e.member} is "${existing.firstName} ${existing.lastName}" in the app but "${e.first} ${e.last}" in this source — not enrolled in ${roster.course} ${roster.start}.`
          );
          continue;
        }
        if (`${existing.firstName} ${existing.lastName}` !== `${e.first} ${e.last}`) {
          renames.push(
            `${e.member}: app has "${existing.firstName} ${existing.lastName}", source has "${e.first} ${e.last}" — left as it is.`
          );
        }
        if (existing._count.enrolments > 0) {
          alsoOnAnotherDay.push(
            `${existing.firstName} ${existing.lastName} (${e.member}) also swims on another day.`
          );
        }
        studentId = existing.id;
        name = fullName(existing);
      } else {
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
        problems.push(
          `${roster.course} ${roster.start} is full — ${name} (${e.member}) was not enrolled.`
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
        programmeId: course.level.programmeId,
        clubId: club.id,
        summary: `Imported ${club.name}'s Monday roster for ${courseLabel(course)} — ${added.length} enrolled (${added.slice(0, 6).join(", ")}${added.length > 6 ? ` and ${added.length - 6} others` : ""})`,
      });
    }

    console.log(`${roster.course.padEnd(10)} ${roster.start}  ${added.length} enrolled.`);
  }

  console.log(
    `\n${coursesCreated} classes created, ${studentsCreated} students created, ${enrolled} enrolments made — all in ${club.name}.`
  );

  if (otherClub.length) {
    console.log(`\nANOTHER CLUB'S SWIMMER — a member number already held elsewhere (${otherClub.length}):`);
    otherClub.forEach((c) => console.log(` ! ${c}`));
  }
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
  if (alsoOnAnotherDay.length) {
    console.log(`\nAlready swimming on another day (${alsoOnAnotherDay.length}):`);
    alsoOnAnotherDay.forEach((s) => console.log(` - ${s}`));
  }

  const fromBishopstown = ROSTERS.flatMap((r) => r.enrollees.filter((e) => e.facility === "B"));
  console.log(`\nHome facility LW Bishopstown, swimming here (${fromBishopstown.length}):`);
  for (const e of fromBishopstown) console.log(` - ${e.member}  ${e.first} ${e.last}`);

  console.log(`\nReadings to verify against the source (${UNCERTAIN.size}):`);
  for (const roster of ROSTERS) {
    for (const e of roster.enrollees) {
      if (UNCERTAIN.has(e.member)) console.log(` - ${e.member}  ${e.first} ${e.last}`);
    }
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
