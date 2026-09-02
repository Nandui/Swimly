import "dotenv/config";
import { logAudit } from "@/lib/audit";
import { courseLabel } from "@/lib/courses/constants";
import { withCourseSeat } from "@/lib/enrolment/seat";
import { parseDateOnly, today } from "@/lib/format";
import { fullName } from "@/lib/students/constants";
import { prisma } from "@/lib/prisma";

/** The Tuesday timetable and rosters for LeisureWorld Churchfield, from the
 *  PDF of the club's existing system (2 Sep 2026). Second day for the second
 *  club, and the same method as Monday (`import-monday-churchfield.ts`):
 *  pages rendered at 200dpi and every roster re-read at 400dpi, capacity taken
 *  from each class card's own **Available** count (a card showing "Only
 *  Waiting List" is full at the number it lists), every enrolment through
 *  `withCourseSeat`, idempotent, audited, and refusing rather than guessing on
 *  a member-number clash. Levels are looked up inside Churchfield's own
 *  programmes; a member number already held by a Bishopstown swimmer is
 *  reported and left out, because swimmers are not moved between clubs. A
 *  Churchfield swimmer who is already in from Monday is matched by member
 *  number and simply gains a second class. Neither case arose: all 105 member
 *  numbers here were new to the app when this was written, checked against
 *  the live database before the run.
 *
 *  **Same name is not the same child.** Freya Walsh LWC428806 (Starfish, 5)
 *  is not Freya Walsh LWC409772 (Dolphins, 9, Monday); Jack O'Connor
 *  LWC409507 is not Jack O'Connor LWC434601. The member number decides, which
 *  is why nothing here is matched on a name.
 *
 *  **Eight children have Bishopstown as their home facility** (LWB numbers)
 *  but swim at Churchfield on Tuesdays. They are Churchfield swimmers here,
 *  because that is where their class is; the note on each says where the
 *  membership is held.
 *
 *  **Four capacities look odd and are kept as the cards say.** Starfish 15:45,
 *  Starfish 16:20 and Penguins 15:10 each work out at 7 places, where the
 *  other Learner Pool classes hold 8; and Turtles 16:20 has 10 swimmers and 1
 *  place, so 11, where the other Turtles classes hold 10. Monday had the same
 *  pattern, so it looks like how the club sets these up rather than a
 *  misreading. Every class is EUR125 a block, so there is no price tell to
 *  second-guess the levels with. */

const CLUB_ID = "club_churchfield";
const DAY = "TUESDAY" as const;

/** Transcribed exactly. Oddities in the club's own records, not misreadings. */
const ODD_IN_SOURCE = new Map([
  ["LWC439591", "Daisy 0 Flaherty — a digit zero where the O should be"],
  ["LWC61930", "oisin price — all lowercase"],
  ["LWC436035", "kyren O Connor — lowercase first name"],
  ["LWC432380", "Eve STAFFORD-SHAW — surname in capitals; Cooper Stafford-Shaw LWC61733 is not"],
  ["LWC36042", "Tadhg Cunninham — no g; Rian Cunningham LWC58209 has one"],
  ["LWC424529", "Jj Power — lowercase second j"],
  ["LWC434676", "George O hara — lowercase h"],
  ["LWC41181", "Fionn O keeffe — lowercase k; his brother LWC41180 is spelled the same way"],
  ["LWC432384", "Jaxon Odea Leahy — no apostrophe"],
]);

/** Readings I am least sure of even at 400dpi: unfamiliar names where the
 *  source itself may hold the misspelling. */
const UNCERTAIN = new Set([
  "LWC425521", // Victoria Koweal
  "LWC434495", // Noah Giavaroto Soares
  "LWB94392", // Rory Talesco
  "LWC435950", // Johanna Sebastina
  "LWC62971", // Llewyn Fox
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
    code: "00008294", course: "Starfish", level: "Starfish", start: "15:10",
    capacity: 8, location: LEARNER, // 3 in, 5 available
    enrollees: [
      { member: "LWC44538", first: "Darragh", last: "Broderick", age: 5 },
      { member: "LWC437179", first: "Conor", last: "Barrett", age: 5 },
      { member: "LWC438337", first: "Ben", last: "O Connor", age: 5 },
    ],
  },
  {
    code: "00008297", course: "Starfish", level: "Starfish", start: "15:45",
    capacity: 7, location: LEARNER, // 1 in, 6 available
    enrollees: [
      { member: "LWC439591", first: "Daisy", last: "0 Flaherty", age: 6 },
    ],
  },
  {
    code: "00008300", course: "Starfish", level: "Starfish", start: "16:20",
    capacity: 7, location: LEARNER, // 3 in, 4 available
    enrollees: [
      { member: "LWC407780", first: "Zoe", last: "Lawlor", age: 7 },
      { member: "LWC425521", first: "Victoria", last: "Koweal", age: 6 },
      { member: "LWC426562", first: "Charlie", last: "Henebry", age: 5 },
    ],
  },
  {
    code: "00008303", course: "Starfish", level: "Starfish", start: "16:55",
    capacity: 8, location: LEARNER, // 4 in, 4 available
    enrollees: [
      { member: "LWC428806", first: "Freya", last: "Walsh", age: 5 },
      { member: "LWC432119", first: "Jack", last: "Corkery", age: 5 },
      { member: "LWC437520", first: "Aj", last: "Long", age: 5 },
      { member: "LWC438912", first: "Isabelle", last: "Wade", age: 7 },
    ],
  },

  // ---- Penguins ----
  {
    code: "00008295", course: "Penguins", level: "Penguins", start: "15:10",
    capacity: 7, location: LEARNER, // 5 in, 2 available
    enrollees: [
      { member: "LWC41181", first: "Fionn", last: "O keeffe", age: 6 },
      { member: "LWC406921", first: "Kallum", last: "Harris", age: 7 },
      { member: "LWC434495", first: "Noah", last: "Giavaroto Soares", age: 6 },
      { member: "LWC434497", first: "Tommy", last: "Foley", age: 5 },
      { member: "LWC437573", first: "Freya", last: "O Callaghan", age: 5 },
    ],
  },
  {
    code: "00008298", course: "Penguins", level: "Penguins", start: "15:45",
    capacity: 8, location: LEARNER, // 3 in, 5 available
    enrollees: [
      { member: "LWC434400", first: "Caitlin", last: "Colson", age: 5 },
      { member: "LWC434676", first: "George", last: "O hara", age: 6 },
      { member: "LWC434802", first: "Liadh", last: "O'Sullivan", age: 5 },
    ],
  },
  {
    code: "00008306", course: "Penguins", level: "Penguins", start: "17:30",
    capacity: 8, location: LEARNER, // Only Waiting List: full at 8
    enrollees: [
      { member: "LWC416436", first: "Holly", last: "Kelleher", age: 6 },
      { member: "LWC425811", first: "Donnchadh", last: "Nolan", age: 7 },
      { member: "LWB426942", first: "Maebh", last: "O'Sullivan", age: 6, facility: "B" },
      { member: "LWC428805", first: "Frankie", last: "Walsh", age: 7 },
      { member: "LWC432384", first: "Jaxon", last: "Odea Leahy", age: 7 },
      { member: "LWC436521", first: "Sadie", last: "Hurley", age: 5 },
      { member: "LWC436523", first: "Brodie", last: "Hurley", age: 5 },
      { member: "LWC437031", first: "Priya", last: "Korrapati", age: 8 },
    ],
  },

  // ---- Turtles ----
  {
    code: "00008296", course: "Turtles", level: "Turtles", start: "15:10",
    capacity: 10, location: lane(1), // 9 in, 1 available
    enrollees: [
      { member: "LWC41180", first: "Darragh", last: "O keeffe", age: 7 },
      { member: "LWC61930", first: "oisin", last: "price", age: 10 },
      { member: "LWC417034", first: "Holly", last: "Carter", age: 6 },
      { member: "LWC424529", first: "Jj", last: "Power", age: 7 },
      { member: "LWB425136", first: "Lewis", last: "Cooley", age: 8, facility: "B" },
      { member: "LWB425137", first: "Shay", last: "Cooley", age: 6, facility: "B" },
      { member: "LWC425191", first: "Evie", last: "O Callaghan", age: 6 },
      { member: "LWC426567", first: "Molly", last: "Flynn", age: 7 },
      { member: "LWC438418", first: "Kehlani", last: "O'Connell", age: 7 },
    ],
  },
  {
    code: "00008299", course: "Turtles", level: "Turtles", start: "15:45",
    capacity: 10, location: lane(1), // Only Waiting List: full at 10
    enrollees: [
      { member: "LWC42754", first: "Matthew", last: "Farmer", age: 7 },
      { member: "LWC63599", first: "Hannah", last: "Colson", age: 6 },
      { member: "LWC411459", first: "Molly", last: "Fitzgerald", age: 6 },
      { member: "LWC417125", first: "Masie", last: "Hurley", age: 7 },
      { member: "LWC423644", first: "Jack", last: "McCarthy", age: 7 },
      { member: "LWC424269", first: "Alex", last: "Murphy", age: 8 },
      { member: "LWC425465", first: "Sadie", last: "Murphy", age: 6 },
      { member: "LWC427578", first: "Connell", last: "Gralak", age: 6 },
      { member: "LWC430969", first: "Carley", last: "Constant", age: 6 },
      { member: "LWC436035", first: "kyren", last: "O Connor", age: 6 },
    ],
  },
  {
    code: "00008302", course: "Turtles", level: "Turtles", start: "16:20",
    capacity: 11, location: lane(1), // 10 in, 1 available
    enrollees: [
      { member: "LWC47529", first: "Harper", last: "Healy", age: 7 },
      { member: "LWC58209", first: "Rian", last: "Cunningham", age: 7 },
      { member: "LWC63036", first: "Oliver", last: "Cronin", age: 7 },
      { member: "LWC414777", first: "Brooklyn", last: "Herlihy", age: 7 },
      { member: "LWC417874", first: "Rian", last: "O'Flynn", age: 7 },
      { member: "LWC423136", first: "Grace", last: "Harrington", age: 6 },
      { member: "LWC426201", first: "Holly", last: "Hegarty", age: 8 },
      { member: "LWC427914", first: "Finn", last: "Cotter", age: 6 },
      { member: "LWC428288", first: "Zach", last: "McCarthy", age: 6 },
      { member: "LWC432380", first: "Eve", last: "STAFFORD-SHAW", age: 5 },
    ],
  },
  {
    code: "00008304", course: "Turtles", level: "Turtles", start: "16:55",
    capacity: 10, location: lane(1), // 9 in, 1 available
    enrollees: [
      { member: "LWC60642", first: "Fionn", last: "Long", age: 9 },
      { member: "LWC62971", first: "Llewyn", last: "Fox", age: 6 },
      { member: "LWC412238", first: "Cillian", last: "Murphy", age: 7 },
      { member: "LWC422167", first: "Tadhg", last: "Tracey", age: 7 },
      { member: "LWC423158", first: "Ashuthosh", last: "Ashoka", age: 7 },
      { member: "LWB424289", first: "Sanjana", last: "Saravana", age: 8, facility: "B" },
      { member: "LWC425810", first: "Colm", last: "Nolan", age: 8 },
      { member: "LWC427582", first: "Arisha", last: "Muhamad", age: 7 },
      { member: "LWC427804", first: "Tommy", last: "Crowley", age: 8 },
    ],
  },

  // ---- Dolphins ----
  {
    code: "00008400", course: "Dolphins", level: "Dolphins", start: "16:20",
    capacity: 12, location: lane(3), // Only Waiting List: full at 12
    enrollees: [
      { member: "LWC36042", first: "Tadhg", last: "Cunninham", age: 10 },
      { member: "LWB63959", first: "Hailey", last: "Henebry", age: 7, facility: "B" },
      { member: "LWC58818", first: "Acadia", last: "O'Carroll", age: 13 },
      { member: "LWC59121", first: "Fiadh", last: "Lordan", age: 7 },
      { member: "LWC61733", first: "Cooper", last: "Stafford-Shaw", age: 10 },
      { member: "LWC63841", first: "Anna", last: "Maher", age: 6 },
      { member: "LWC411242", first: "Arielle", last: "Murphy", age: 8 },
      { member: "LWC411243", first: "Arlo", last: "Murphy", age: 8 },
      { member: "LWC414250", first: "Emmett", last: "Culhane", age: 8 },
      { member: "LWC424540", first: "Laurie", last: "Carmody", age: 10 },
      { member: "LWC426716", first: "Alex", last: "O Connell", age: 9 },
      { member: "LWC431042", first: "Sadhbh", last: "O'Sullivan", age: 8 },
    ],
  },
  {
    code: "00008305", course: "Dolphins", level: "Dolphins", start: "16:55",
    capacity: 12, location: lane(2), // 11 in, 1 available
    enrollees: [
      { member: "LWC56876", first: "Aodán", last: "O Neill", age: 7 },
      { member: "LWC56902", first: "Holly", last: "Lucey", age: 8 },
      { member: "LWC409507", first: "Jack", last: "O'Connor", age: 7 },
      { member: "LWB420886", first: "Andrew", last: "Kisamo", age: 8, facility: "B" },
      { member: "LWC426886", first: "Oisin", last: "Donovan", age: 7 },
      { member: "LWC427402", first: "Conor", last: "Korodi", age: 11 },
      { member: "LWC428400", first: "Nella", last: "Miszczuk", age: 6 },
      { member: "LWC428943", first: "Chloe", last: "Wade", age: 9 },
      { member: "LWC434717", first: "Jeremiah Sebastian", last: "Shibin", age: 8 },
      { member: "LWC434720", first: "Joshua", last: "Shibin", age: 9 },
      { member: "LWC437032", first: "Samar Wyse", last: "Korrapati", age: 11 },
    ],
  },
  {
    code: "00008307", course: "Dolphins", level: "Dolphins", start: "17:30",
    capacity: 12, location: lane(2), // 11 in, 1 available
    enrollees: [
      { member: "LWC33523", first: "Charlie", last: "O'Donovan", age: 11 },
      { member: "LWC34575", first: "Joy", last: "Mungai", age: 10 },
      { member: "LWC46130", first: "Cici", last: "Horgan", age: 7 },
      { member: "LWC52187", first: "Minerva", last: "Lobo", age: 9 },
      { member: "LWB89605", first: "Eli", last: "Conroy", age: 7, facility: "B" },
      { member: "LWB94392", first: "Rory", last: "Talesco", age: 7, facility: "B" },
      { member: "LWC412138", first: "Bella", last: "Murphy", age: 6 },
      { member: "LWC413701", first: "Ben", last: "Dowd", age: 7 },
      { member: "LWC416435", first: "Clara", last: "Kelleher", age: 8 },
      { member: "LWC424222", first: "Kajetan", last: "Zajac", age: 7 },
      { member: "LWC428124", first: "Oran", last: "Galvin", age: 8 },
    ],
  },

  // ---- Sharks ----
  {
    code: "00008521", course: "Sharks 1", level: "Sharks 1", start: "17:30",
    capacity: 12, location: lane(3), // 6 in, 6 available
    enrollees: [
      { member: "LWC38815", first: "Zara", last: "Spillane", age: 11 },
      { member: "LWC58629", first: "Stellar", last: "Lim", age: 7 },
      { member: "LWC63411", first: "Seamus", last: "O Callaghan", age: 7 },
      { member: "LWC63412", first: "Tomás", last: "O Callaghan", age: 7 },
      { member: "LWC413702", first: "Michael", last: "Dowd", age: 10 },
      { member: "LWC435950", first: "Johanna", last: "Sebastina", age: 12 },
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
        summary: `Added ${courseLabel(course)} from ${club.name}'s Tuesday timetable (course ${roster.code}), capacity ${roster.capacity}`,
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
        summary: `Imported ${club.name}'s Tuesday roster for ${courseLabel(course)} — ${added.length} enrolled (${added.slice(0, 6).join(", ")}${added.length > 6 ? ` and ${added.length - 6} others` : ""})`,
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
