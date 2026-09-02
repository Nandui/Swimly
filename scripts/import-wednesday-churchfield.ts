import "dotenv/config";
import { HOLDS_A_PLACE, sessionLabel } from "@/lib/assessments/constants";
import { withAssessmentSeat } from "@/lib/assessments/seat";
import { logAudit } from "@/lib/audit";
import { FOUNDING_CLUB_ID } from "@/lib/clubs/constants";
import { courseLabel } from "@/lib/courses/constants";
import { LIST_ORDER, LIVE } from "@/lib/curriculum/constants";
import { withCourseSeat } from "@/lib/enrolment/seat";
import { parseDateOnly, today } from "@/lib/format";
import { fullName } from "@/lib/students/constants";
import { prisma } from "@/lib/prisma";

/** The Wednesday timetable and rosters for LeisureWorld Churchfield, from the
 *  PDF of the club's existing system (2 Sep 2026). Fifteen weekly classes and,
 *  new to these imports, four one-off assessment sessions. Same method and
 *  guards as Monday and Tuesday: pages at 200dpi and every roster re-read at
 *  400dpi, capacity from each card's own **Available** count (a card showing
 *  "Only Waiting List" is full at the number it lists), every place taken
 *  under a row lock, idempotent, audited, refusing rather than guessing on a
 *  member-number clash, levels looked up inside Churchfield's own programmes,
 *  a Bishopstown member number reported rather than matched. All 103 member
 *  numbers here were new to the app when this was written, checked against
 *  the live database before the run.
 *
 *  **Rookies needed a programme.** Three Rookies classes run on a Wednesday
 *  and Rookies is RLSS Lifesaving, which Churchfield did not have. It is
 *  copied from Bishopstown the way `copyProgramme` does it — live levels,
 *  their competencies, the kinds of assessment; here three levels and nothing
 *  else — and only if Churchfield does not already have a programme by that
 *  name, so a re-run copies nothing twice.
 *
 *  **The assessments are sessions, not classes.** The club's system lists four
 *  "Swim School Assessments" at level "Pre-Assessments": one session each, on
 *  the Wednesdays of 2, 9, 16 and 23 September at 17:30 in the Learner Pool,
 *  free. The Bishopstown imports left these out because the app had nowhere
 *  to put them; it now has `AssessmentSession`, so they go there, one per
 *  date with the card's capacity, every child booked through
 *  `withAssessmentSeat`. Two things the source does not say had to be chosen:
 *  the programme they place into — Water Safety & Fun, the swim school's
 *  entry ladder — and the kind, created as "Pre-Assessments", the club's own
 *  label, rather than guessed onto "New swimmers". Both are a person's to
 *  change on the session and on the programme page.
 *
 *  **Eighteen children have Bishopstown as their home facility** (LWB
 *  numbers) but swim or are assessed at Churchfield on Wednesdays. They are
 *  Churchfield swimmers here; the note on each says where the membership is.
 *
 *  **Capacities kept as the cards say although they look odd.** Starfish
 *  16:20 is full at 7, Turtles 16:20 works out at 12 and Dolphins 16:20 is
 *  full at 13, and the three Rookies classes hold 6 each where Bishopstown's
 *  hold 12. Rookies and LeisureWorld Sharks are EUR105 a block against EUR125
 *  for the rest — the same price tell Bishopstown had, and this time the
 *  levels already sit in the right programmes. */

const CLUB_ID = "club_churchfield";
const DAY = "WEDNESDAY" as const;

/** Copied from Bishopstown if Churchfield lacks it. Levels only, in practice. */
const COPY_PROGRAMME = "RLSS Lifesaving";

/** Where the assessment sessions place children, and what the club calls them. */
const ASSESSMENT_PROGRAMME = "Water Safety & Fun";
const ASSESSMENT_KIND = "Pre-Assessments";

/** Transcribed exactly. Oddities in the club's own records, not misreadings. */
const ODD_IN_SOURCE = new Map([
  ["LWB91559", "Hayley Obrien — no apostrophe"],
  ["LWC432007", "Paidi OSullivan — no apostrophe"],
  ["LWC440987", "August Mccarthy — lowercase c; so are Amzie LWB440968 and Grady LWC440988"],
  ["LWC425264", "Taidgh Saunders — Taidgh as written, an unusual spelling of Tadhg"],
  ["LWC63505", "Lillie O'Sullivan Cronin — Lillie as written"],
]);

/** Readings I am least sure of even at 400dpi: unfamiliar names where the
 *  source itself may hold the misspelling. */
const UNCERTAIN = new Set([
  "LWC437001", // Riley Langbien
  "LWB97895", // Aoife Santorelly
  "LWC432459", // Balqis Shaa
  "LWC435691", // Asma Mswabi
  "LWC56934", // Brian Konuch
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

type Session = {
  code: string;
  /** YYYY-MM-DD. All Wednesdays. */
  date: string;
  start: string;
  capacity: number;
  location: string;
  bookings: Enrollee[];
};

const LEARNER = "Learner Pool";
const lane = (n: number) => `Lane ${n}`;

const ROSTERS: Roster[] = [
  // ---- Starfish ----
  {
    code: "00008310", course: "Starfish", level: "Starfish", start: "15:45",
    capacity: 8, location: LEARNER, // 3 in, 5 available
    enrollees: [
      { member: "LWB421848", first: "Mattie", last: "Twomey", age: 8, facility: "B" },
      { member: "LWC428927", first: "Molly Rea", last: "Slattery", age: 6 },
      { member: "LWC431271", first: "Stephen", last: "Ahern", age: 6 },
    ],
  },
  {
    code: "00008311", course: "Starfish", level: "Starfish", start: "16:20",
    capacity: 7, location: LEARNER, // Only Waiting List: full at 7
    enrollees: [
      { member: "LWC422991", first: "Eli", last: "Byrne", age: 6 },
      { member: "LWC429690", first: "Liam", last: "Collins", age: 6 },
      { member: "LWC430571", first: "Josh", last: "Murray", age: 6 },
      { member: "LWC436553", first: "Ornaith", last: "Quigley", age: 7 },
      { member: "LWC436967", first: "Leah", last: "Greaney", age: 7 },
      { member: "LWC437005", first: "Harry", last: "Moran", age: 7 },
      { member: "LWC439606", first: "Ada", last: "Greaney", age: 5 },
    ],
  },

  // ---- Penguins ----
  {
    code: "00008312", course: "Penguins", level: "Penguins", start: "15:10",
    capacity: 8, location: LEARNER, // Only Waiting List: full at 8
    enrollees: [
      { member: "LWC57242", first: "Odhran", last: "Ahern", age: 7 },
      { member: "LWC63661", first: "Ryan", last: "Lenihan", age: 10 },
      { member: "LWC411714", first: "Hayley", last: "O'Leary", age: 7 },
      { member: "LWB418372", first: "Nahal", last: "Noor", age: 7, facility: "B" },
      { member: "LWB418373", first: "Amal", last: "Noor", age: 7, facility: "B" },
      { member: "LWC422288", first: "Harper", last: "Murphy", age: 5 },
      { member: "LWC428605", first: "Donnacha", last: "Clinton", age: 6 },
      { member: "LWC432345", first: "Evan", last: "O'Leary", age: 5 },
    ],
  },
  {
    code: "00008313", course: "Penguins", level: "Penguins", start: "15:45",
    capacity: 8, location: LEARNER, // 6 in, 2 available
    enrollees: [
      { member: "LWB410293", first: "Evie", last: "Forde", age: 6, facility: "B" },
      { member: "LWC415694", first: "Roisin", last: "McAuliffe", age: 6 },
      { member: "LWC424100", first: "Logan", last: "Hinchion", age: 6 },
      { member: "LWC428946", first: "James", last: "Daly", age: 6 },
      { member: "LWC431270", first: "Lacey", last: "Ahern", age: 7 },
      { member: "LWC433158", first: "Archie", last: "Streete", age: 5 },
    ],
  },
  {
    code: "00008315", course: "Penguins", level: "Penguins", start: "16:55",
    capacity: 8, location: LEARNER, // 4 in, 4 available
    enrollees: [
      { member: "LWC430466", first: "Molly", last: "O Callaghan", age: 6 },
      { member: "LWC433311", first: "Ryan", last: "Lomasney", age: 5 },
      { member: "LWC435691", first: "Asma", last: "Mswabi", age: 8 },
      { member: "LWB436219", first: "Darragh", last: "McCarthy", age: 6, facility: "B" },
    ],
  },

  // ---- Turtles ----
  {
    code: "00008317", course: "Turtles", level: "Turtles", start: "15:45",
    capacity: 10, location: lane(1), // 4 in, 6 available
    enrollees: [
      { member: "LWC406854", first: "Lucas", last: "Brennan", age: 7 },
      { member: "LWC423690", first: "Róisín", last: "Streete", age: 6 },
      { member: "LWC437377", first: "Eva", last: "Cashman", age: 8 },
      { member: "LWC437378", first: "Cian", last: "Cashman", age: 7 },
    ],
  },
  {
    code: "00008318", course: "Turtles", level: "Turtles", start: "16:20",
    capacity: 12, location: lane(1), // 6 in, 6 available
    enrollees: [
      { member: "LWC63777", first: "Rían", last: "Fahy", age: 6 },
      { member: "LWB99612", first: "Alice", last: "O'Leary", age: 8, facility: "B" },
      { member: "LWB422223", first: "Ryan", last: "Healy", age: 8, facility: "B" },
      { member: "LWC425264", first: "Taidgh", last: "Saunders", age: 9 },
      { member: "LWC425276", first: "Charlie", last: "O Brien", age: 10 },
      { member: "LWC437001", first: "Riley", last: "Langbien", age: 7 },
    ],
  },
  {
    code: "00008394", course: "Turtles", level: "Turtles", start: "16:55",
    capacity: 10, location: lane(3), // 5 in, 5 available
    enrollees: [
      { member: "LWC44051", first: "Killian", last: "McCarthy", age: 9 },
      { member: "LWB82188", first: "Donagh", last: "O'Regan", age: 11, facility: "B" },
      { member: "LWC422475", first: "Bobby", last: "Hurley", age: 6 },
      { member: "LWC424996", first: "Eoghan", last: "Sheehan", age: 6 },
      { member: "LWC432007", first: "Paidi", last: "OSullivan", age: 6 },
    ],
  },

  // ---- Dolphins. Two at 15:10, so the club's (A)/(B) is kept. ----
  {
    code: "00008401", course: "Dolphins (A)", level: "Dolphins", start: "15:10",
    capacity: 12, location: lane(3), // 4 in, 8 available
    enrollees: [
      { member: "LWC58789", first: "Olivia", last: "Brady", age: 8 },
      { member: "LWC421908", first: "Leo", last: "Ricken", age: 7 },
      { member: "LWC424098", first: "Eli", last: "Hinchion", age: 9 },
      { member: "LWC425617", first: "Mia", last: "Kiely", age: 7 },
    ],
  },
  {
    code: "00008717", course: "Dolphins (B)", level: "Dolphins", start: "15:10",
    capacity: 12, location: lane(2), // 1 in, 11 available
    enrollees: [
      { member: "LWC424261", first: "Emma", last: "Rock", age: 7 },
    ],
  },
  {
    code: "00008402", course: "Dolphins", level: "Dolphins", start: "16:20",
    capacity: 13, location: lane(3), // Only Waiting List: full at 13
    enrollees: [
      { member: "LWB82130", first: "Joshua", last: "Lomasney", age: 8, facility: "B" },
      { member: "LWB91559", first: "Hayley", last: "Obrien", age: 7, facility: "B" },
      { member: "LWB97895", first: "Aoife", last: "Santorelly", age: 7, facility: "B" },
      { member: "LWC63505", first: "Lillie", last: "O'Sullivan Cronin", age: 7 },
      { member: "LWC63924", first: "Kyran", last: "Cassidy", age: 7 },
      { member: "LWC64142", first: "Freddie", last: "O Mahony", age: 6 },
      { member: "LWC415679", first: "Billy", last: "O'Leary", age: 8 },
      { member: "LWB422224", first: "Emma", last: "Healy", age: 7, facility: "B" },
      { member: "LWC423730", first: "Rowan", last: "O Brien Regan", age: 7 },
      { member: "LWC428973", first: "Zoe", last: "Lomasney", age: 7 },
      { member: "LWC431428", first: "Jamie", last: "Cahalane", age: 7 },
      { member: "LWC432459", first: "Balqis", last: "Shaa", age: 12 },
      { member: "LWC436552", first: "Cailin", last: "Quigley", age: 11 },
    ],
  },

  // ---- Sharks ----
  {
    code: "00008403", course: "LeisureWorld Sharks", level: "LeisureWorld Sharks", start: "16:55",
    capacity: 12, location: lane(4), // 8 in, 4 available
    enrollees: [
      { member: "LWC28965", first: "Ethan", last: "O Sullivan", age: 13 },
      { member: "LWC32218", first: "Geordie", last: "Mosconi", age: 16 },
      { member: "LWC33730", first: "Faith", last: "Mooney", age: 10 },
      { member: "LWC33731", first: "Willow", last: "Mooney", age: 12 },
      { member: "LWC49745", first: "Ciara", last: "Foran", age: 10 },
      { member: "LWC51257", first: "Muhammad Najeeb", last: "Shaikh", age: 10 },
      { member: "LWC56934", first: "Brian", last: "Konuch", age: 12 },
      { member: "LWC423731", first: "Odhran", last: "O Brien Regan", age: 10 },
    ],
  },

  // ---- Rookies: RLSS Lifesaving, copied across above. ----
  {
    code: "00008321", course: "Rookies Bronze", level: "Rookies Bronze 1 - 3", start: "17:30",
    capacity: 6, location: lane(1), // Only Waiting List: full at 6
    enrollees: [
      { member: "LWC33308", first: "Julia", last: "Twomey", age: 14 },
      { member: "LWC33624", first: "Isabelle", last: "O Donovan", age: 12 },
      { member: "LWC34273", first: "Aoife", last: "Banks Marshall", age: 12 },
      { member: "LWC36335", first: "Georgia", last: "O Donovan Kenny", age: 11 },
      { member: "LWB68055", first: "Hannah", last: "Hurley", age: 10, facility: "B" },
      { member: "LWC49984", first: "Treasa", last: "Hurley", age: 8 },
    ],
  },
  {
    code: "00008322", course: "Rookies Silver", level: "Rookies Silver 1 - 3", start: "17:30",
    capacity: 6, location: lane(2), // Only Waiting List: full at 6
    enrollees: [
      { member: "LWB36425", first: "Ellen", last: "Cone", age: 12, facility: "B" },
      { member: "LWC31590", first: "Max", last: "O Mahony", age: 11 },
      { member: "LWB54917", first: "Robert", last: "Cone", age: 10, facility: "B" },
      { member: "LWB59461", first: "Grace", last: "Harris", age: 11, facility: "B" },
      { member: "LWC45638", first: "Abbie", last: "Cooper", age: 9 },
      { member: "LWC56873", first: "Jack", last: "Power", age: 12 },
    ],
  },
  {
    code: "00008323", course: "Rookies Gold", level: "Rookies Gold 1 - 3", start: "17:30",
    capacity: 6, location: lane(3), // nobody in it yet, 6 available
    enrollees: [],
  },
];

/** "Swim School Assessments", one session each, 17:30 in the Learner Pool. */
const SESSIONS: Session[] = [
  {
    code: "00008874", date: "2026-09-02", start: "17:30",
    capacity: 11, location: LEARNER, // Only Waiting List: full at 11
    bookings: [
      { member: "LWC423637", first: "Mia", last: "Forde", age: 6 },
      { member: "LWC440869", first: "Aisling", last: "Feeney", age: 9 },
      { member: "LWB440968", first: "Amzie", last: "Mccarthy", age: 10, facility: "B" },
      { member: "LWC440984", first: "Odhran", last: "Fitzgerald", age: 7 },
      { member: "LWC440985", first: "Iarla", last: "Fitzgerald", age: 5 },
      { member: "LWC440987", first: "August", last: "Mccarthy", age: 9 },
      { member: "LWC440988", first: "Grady", last: "Mccarthy", age: 5 },
      { member: "LWC440989", first: "Réidín", last: "O'Neill", age: 5 },
      { member: "LWC441007", first: "Lily", last: "Forde", age: 5 },
      { member: "LWC441061", first: "Ollie", last: "O'Sullivan", age: 7 },
      { member: "LWC441185", first: "Theo", last: "O'Sullivan", age: 5 },
    ],
  },
  {
    code: "00008875", date: "2026-09-09", start: "17:30",
    capacity: 10, location: LEARNER, // Only Waiting List: full at 10
    bookings: [
      { member: "LWB80519", first: "Mark", last: "Morrison", age: 8, facility: "B" },
      { member: "LWC54224", first: "Dylan", last: "Morrison", age: 6 },
      { member: "LWC440992", first: "Cora", last: "Dennehy", age: 10 },
      { member: "LWC440993", first: "Sara", last: "Dennehy", age: 7 },
      { member: "LWC441067", first: "Noah", last: "O Connell", age: 8 },
      { member: "LWC441106", first: "Kelsey", last: "Callanan", age: 6 },
      { member: "LWC441116", first: "Kodi", last: "Cronin", age: 6 },
      { member: "LWC441218", first: "Teddy", last: "O Driscoll", age: 6 },
      { member: "LWC441236", first: "Grace", last: "Keane", age: 6 },
      { member: "LWC441247", first: "Charlie", last: "Madden", age: 5 },
    ],
  },
  {
    code: "00008876", date: "2026-09-16", start: "17:30",
    capacity: 10, location: LEARNER, // 1 in, 9 available
    bookings: [
      { member: "LWC441244", first: "Aaliyah", last: "Carroll", age: 5 },
    ],
  },
  {
    code: "00008877", date: "2026-09-23", start: "17:30",
    capacity: 10, location: LEARNER, // nobody in it yet, 10 available
    bookings: [],
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

type Actor = { id: string; name: string };
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

/** Churchfield gets Bishopstown's programme of this name if it has none: the
 *  live levels, their live competencies and the live kinds of assessment,
 *  exactly as `copyProgramme` does it from the programme page. */
async function ensureProgramme(name: string, club: Club, admin: Actor): Promise<boolean> {
  const existing = await prisma.programme.findFirst({
    where: { clubId: club.id, name, archivedAt: null },
    select: { id: true },
  });
  if (existing) return false;

  const source = await prisma.programme.findFirst({
    where: { clubId: FOUNDING_CLUB_ID, name, archivedAt: null },
    select: {
      name: true,
      description: true,
      club: { select: { name: true } },
      levels: {
        where: LIVE,
        orderBy: [...LIST_ORDER],
        select: {
          name: true,
          description: true,
          sortOrder: true,
          competencies: {
            where: LIVE,
            orderBy: [...LIST_ORDER],
            select: { name: true, description: true, sortOrder: true },
          },
        },
      },
      assessmentTypes: {
        where: LIVE,
        orderBy: [...LIST_ORDER],
        select: { name: true, description: true, sortOrder: true },
      },
    },
  });
  if (!source) throw new Error(`Bishopstown has no live programme called "${name}" to copy.`);

  const last = await prisma.programme.findFirst({
    where: { clubId: club.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const created = await prisma.programme.create({
    data: {
      clubId: club.id,
      name: source.name,
      description: source.description,
      sortOrder: (last?.sortOrder ?? -1) + 1,
      levels: {
        create: source.levels.map((level) => ({
          name: level.name,
          description: level.description,
          sortOrder: level.sortOrder,
          competencies: {
            create: level.competencies.map((c) => ({
              name: c.name,
              description: c.description,
              sortOrder: c.sortOrder,
            })),
          },
        })),
      },
      assessmentTypes: {
        create: source.assessmentTypes.map((t) => ({
          name: t.name,
          description: t.description,
          sortOrder: t.sortOrder,
        })),
      },
    },
    select: { id: true },
  });

  const competencies = source.levels.reduce((n, level) => n + level.competencies.length, 0);
  await logAudit({
    actorId: admin.id,
    actorName: admin.name,
    action: "create",
    entity: "Programme",
    entityId: created.id,
    programmeId: created.id,
    clubId: club.id,
    summary:
      `Copied programme ${source.name} from ${source.club.name} to ${club.name}: ` +
      `${source.levels.length} ${source.levels.length === 1 ? "level" : "levels"}, ` +
      `${competencies} ${competencies === 1 ? "competency" : "competencies"} — for the Wednesday Rookies classes`,
  });
  return true;
}

/** The kind the sessions are given, by the club's own name for them. */
async function ensureKind(
  programme: { id: string; name: string },
  name: string,
  club: Club,
  admin: Actor
): Promise<{ id: string; created: boolean }> {
  const existing = await prisma.assessmentType.findFirst({
    where: { programmeId: programme.id, name },
    select: { id: true, archivedAt: true },
  });
  if (existing) {
    if (existing.archivedAt) {
      throw new Error(`${programme.name} has an archived kind called "${name}". Restore it first.`);
    }
    return { id: existing.id, created: false };
  }

  const last = await prisma.assessmentType.findFirst({
    where: { programmeId: programme.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const created = await prisma.assessmentType.create({
    data: {
      programmeId: programme.id,
      name,
      description:
        "Swim School Assessments, as the club's system calls them. Imported from the Wednesday timetable.",
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
    select: { id: true },
  });
  await logAudit({
    actorId: admin.id,
    actorName: admin.name,
    action: "create",
    entity: "AssessmentType",
    entityId: created.id,
    programmeId: programme.id,
    clubId: club.id,
    summary: `Added assessment type ${name} to ${programme.name}, the club's own name for its Swim School Assessments`,
  });
  return { id: created.id, created: true };
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
  let sessionsCreated = 0;
  let booked = 0;
  const report: Report = { problems: [], conflicts: [], otherClub: [], renames: [], alsoElsewhere: [] };

  const copied = await ensureProgramme(COPY_PROGRAMME, club, admin);
  console.log(
    copied
      ? `Copied ${COPY_PROGRAMME} from Bishopstown to ${club.name}.`
      : `${club.name} already has ${COPY_PROGRAMME}.`
  );

  // This club's live levels only, after the copy. Unique within the club is
  // asserted, not assumed.
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

  // ---- Weekly classes ----
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
        summary: `Added ${courseLabel(course)} from ${club.name}'s Wednesday timetable (course ${roster.code}), capacity ${roster.capacity}`,
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
        summary: `Imported ${club.name}'s Wednesday roster for ${courseLabel(course)} — ${added.length} enrolled (${added.slice(0, 6).join(", ")}${added.length > 6 ? ` and ${added.length - 6} others` : ""})`,
      });
    }

    console.log(`${roster.course.padEnd(20)} ${roster.start}  ${added.length} enrolled.`);
  }

  // ---- Assessment sessions ----
  const programme = await prisma.programme.findFirst({
    where: { clubId: club.id, name: ASSESSMENT_PROGRAMME, archivedAt: null },
    select: { id: true, name: true },
  });
  if (!programme) throw new Error(`${club.name} has no programme called "${ASSESSMENT_PROGRAMME}".`);

  const kind = await ensureKind(programme, ASSESSMENT_KIND, club, admin);
  console.log(
    kind.created
      ? `Added the kind "${ASSESSMENT_KIND}" to ${programme.name}.`
      : `${programme.name} already has the kind "${ASSESSMENT_KIND}".`
  );

  for (const s of SESSIONS) {
    const date = parseDateOnly(s.date);
    const startMinutes = toMinutes(s.start);
    const select = { id: true, date: true, startMinutes: true, capacity: true, programmeId: true } as const;

    let session = await prisma.assessmentSession.findFirst({
      where: { clubId: club.id, programmeId: programme.id, date, startMinutes },
      select,
    });

    if (!session) {
      session = await prisma.assessmentSession.create({
        data: {
          clubId: club.id,
          programmeId: programme.id,
          typeId: kind.id,
          date,
          startMinutes,
          durationMinutes: 30,
          capacity: s.capacity,
          location: s.location,
          instructorId: admin.id,
          notes: `Imported from the club's Wednesday timetable (course ${s.code}).`,
        },
        select,
      });
      sessionsCreated += 1;
      await logAudit({
        actorId: admin.id,
        actorName: admin.name,
        action: "create",
        entity: "AssessmentSession",
        entityId: session.id,
        programmeId: programme.id,
        clubId: club.id,
        summary: `Added a ${ASSESSMENT_KIND} assessment session for ${programme.name} on ${sessionLabel(session)} with ${s.capacity} places, from ${club.name}'s Wednesday timetable (course ${s.code})`,
      });
    }

    const added: string[] = [];
    const where = `the assessment on ${sessionLabel(session)}`;

    for (const e of s.bookings) {
      const resolved = await resolveStudent(e, club, where, report, counters);
      if (!resolved) continue;
      const { studentId, name } = resolved;
      const current = session;

      const outcome = await withAssessmentSeat(current.id, async (tx) => {
        const existing = await tx.assessmentBooking.findUnique({
          where: { sessionId_studentId: { sessionId: current.id, studentId } },
          select: { id: true, status: true },
        });
        if (existing && HOLDS_A_PLACE.includes(existing.status)) return "already" as const;

        const taken = await tx.assessmentBooking.count({
          where: { sessionId: current.id, status: { in: HOLDS_A_PLACE } },
        });
        if (current.capacity !== null && taken >= current.capacity) return "full" as const;

        if (existing) {
          await tx.assessmentBooking.update({
            where: { id: existing.id },
            data: { status: "BOOKED", bookedById: admin.id, bookedByName: admin.name },
          });
        } else {
          await tx.assessmentBooking.create({
            data: {
              sessionId: current.id,
              studentId,
              status: "BOOKED",
              bookedById: admin.id,
              bookedByName: admin.name,
            },
          });
        }
        return "booked" as const;
      });

      if (outcome === "booked") {
        booked += 1;
        added.push(name);
      } else if (outcome === "full") {
        report.problems.push(`${where} is full — ${name} (${e.member}) was not booked.`);
      }
    }

    if (added.length > 0) {
      await logAudit({
        actorId: admin.id,
        actorName: admin.name,
        action: "book",
        entity: "AssessmentBooking",
        entityId: session.id,
        programmeId: programme.id,
        clubId: club.id,
        summary: `Imported ${added.length} ${added.length === 1 ? "booking" : "bookings"} onto ${where} (${added.slice(0, 6).join(", ")}${added.length > 6 ? ` and ${added.length - 6} others` : ""})`,
      });
    }

    console.log(`Assessment ${s.date} ${s.start}  ${added.length} booked.`);
  }

  console.log(
    `\n${coursesCreated} classes created, ${sessionsCreated} assessment sessions created, ${counters.studentsCreated} students created, ${enrolled} enrolments and ${booked} bookings made — all in ${club.name}.`
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

  const everyone = [...ROSTERS.flatMap((r) => r.enrollees), ...SESSIONS.flatMap((s) => s.bookings)];
  const fromBishopstown = everyone.filter((e) => e.facility === "B");
  console.log(`\nHome facility LW Bishopstown, swimming or assessed here (${fromBishopstown.length}):`);
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
