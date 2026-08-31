import "dotenv/config";
import { logAudit } from "@/lib/audit";
import { courseLabel } from "@/lib/courses/constants";
import { withCourseSeat } from "@/lib/enrolment/seat";
import { parseDateOnly, today } from "@/lib/format";
import { fullName } from "@/lib/students/constants";
import { prisma } from "@/lib/prisma";

/** The Monday timetable and rosters, from the PDF of the club's existing
 *  system (31 Aug 2026). Same method and same rules as Friday and Saturday:
 *  pages rendered at 200dpi, capacity taken from each class card's own
 *  **Available** count, every enrolment through `withCourseSeat`, idempotent,
 *  audited, and refusing rather than guessing on a member-number clash.
 *
 *  **One judgement call, and it is reversible.** The two 17:30 **Rookies**
 *  classes — Bronze 1-3 and Silver 1-3 — are imported as two more levels of
 *  Water Safety & Fun rather than held back. Five things say they belong:
 *  the "N - " prefix every class in this programme carries and the Friday
 *  LeisureWorld Sharks class did not, the Main Pool, a Swim Instructor, a
 *  50-session block, and a capacity of 12 matching Sharks. The children are 9
 *  to 13, older than Sharks 2, so the ladder reads
 *  Starfish → Penguins → Turtles → Dolphins → Sharks 1 → Sharks 2 →
 *  Rookies Bronze → Rookies Silver. Only the price differs, EUR105 against
 *  EUR125, and price is not modelled here at all.
 *
 *  If that is wrong, it is 2 levels and 11 enrolments to move, and no
 *  attendance has been taken against them yet. */

const PROGRAMME = "Water Safety & Fun";
const DAY = "MONDAY" as const;

/** Appended after Sharks 2. See the judgement call above. */
const NEW_LEVELS = ["Rookies Bronze 1 - 3", "Rookies Silver 1 - 3"];

/** Transcribed exactly. Oddities in the club's own records, not misreadings.
 *  The two sibling pairs are the telling ones: the same surname spelled two
 *  ways on consecutive member numbers. */
const ODD_IN_SOURCE = new Map([
  ["LWB432399", "linnea Sandberg — lowercase first name"],
  ["LWB424647", "Andrea elizabeth Tom — lowercase middle name"],
  ["LWB434392", "Koa OSullivan — no apostrophe"],
  ["LWB431618", "Ríadh OSullivan — no apostrophe"],
  ["LWB86650", "Amira Ocallaghan — no apostrophe"],
  ["LWD419725", "Ali Oregan — no apostrophe"],
  ["LWB92910", "Sophie Oconnell Falvey — her sibling LWB92911 is O'Connell Falvey"],
  ["LWB422998", "Genevieve Mcswiney — her sibling LWB422996 is McSwiney"],
  ["LWB437240", "Roisin Mc Carthy O hara — spaced, and her siblings are O hara"],
]);

/** Readings I am least sure of even at this resolution. */
const UNCERTAIN = new Set([
  "LWC414008", // Kevin Witheephamich
  "LWB427448", // Jesimiel Kakkanadu Jomon
  "LWB426485", // Bethuel Alex Babin
  "LWB422707", // Maruzza Montalto
  "LWB94857", // Vladimir Naghi
  "LWD1716", // Daniel Adamczuk — unusually short member number
  "LWB426443", // Olivia Linehan Sreenan
]);

type Enrollee = {
  member: string;
  first: string;
  last: string;
  age: number;
  /** "B" = Bishopstown (the default), "C" = Churchfield, "D" = Douglas. */
  facility?: "C" | "D";
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

const MAIN = "Main Pool";
const LEARNER = "Learner Pool";

const ROSTERS: Roster[] = [
  // ---- Starfish ----
  {
    code: "00008128", course: "Starfish (A)", level: "Starfish", start: "15:10",
    capacity: 8, location: LEARNER,
    enrollees: [
      { member: "LWC414008", first: "Kevin", last: "Witheephamich", age: 7, facility: "C" },
      { member: "LWB431618", first: "Ríadh", last: "OSullivan", age: 5 },
      { member: "LWB435556", first: "Lewis", last: "Parkes", age: 5 },
    ],
  },
  {
    code: "00008129", course: "Starfish (B)", level: "Starfish", start: "15:10",
    capacity: 8, location: LEARNER,
    enrollees: [
      { member: "LWB423046", first: "Jamie", last: "McSweeney", age: 6 },
      { member: "LWB425360", first: "Liam", last: "Cashman", age: 6 },
      { member: "LWB427435", first: "Seán", last: "Murphy", age: 6 },
      { member: "LWB428762", first: "Eliza", last: "Mountjoy", age: 6 },
      { member: "LWB432399", first: "linnea", last: "Sandberg", age: 6 },
      { member: "LWB434426", first: "Kiernan", last: "McSweeney", age: 5 },
      { member: "LWB437147", first: "Pearle", last: "Wyley", age: 6 },
    ],
  },
  {
    code: "00008139", course: "Starfish", level: "Starfish", start: "16:20",
    capacity: 8, location: LEARNER,
    enrollees: [
      { member: "LWB430332", first: "Adam", last: "Bursey", age: 7 },
      { member: "LWB431006", first: "Ellen", last: "Burke", age: 5 },
      { member: "LWB432574", first: "Jayden", last: "Ryan", age: 6 },
      { member: "LWB434392", first: "Koa", last: "OSullivan", age: 5 },
      { member: "LWB434403", first: "Aarna", last: "Sujith", age: 5 },
      { member: "LWB437240", first: "Roisin", last: "Mc Carthy O hara", age: 5 },
      { member: "LWB437241", first: "Brody", last: "O hara", age: 6 },
      { member: "LWB437810", first: "Arthur", last: "O Callaghan", age: 5 },
    ],
  },
  {
    code: "00008143", course: "Starfish", level: "Starfish", start: "16:55",
    capacity: 8, location: LEARNER,
    enrollees: [
      { member: "LWB429621", first: "Osin", last: "Muller-O'Driscoll", age: 6 },
      { member: "LWB431069", first: "Cúan", last: "Lynch", age: 5 },
      { member: "LWB432149", first: "Isaac", last: "Good", age: 5 },
      { member: "LWB432158", first: "Kane", last: "O'Connor", age: 5 },
      { member: "LWB435802", first: "Eloise", last: "Walsh", age: 5 },
      { member: "LWC436187", first: "George", last: "Ionita", age: 5, facility: "C" },
      { member: "LWB437239", first: "Thomas", last: "O hara", age: 7 },
    ],
  },

  // ---- Penguins ----
  {
    code: "00008135", course: "Penguins (A)", level: "Penguins", start: "15:45",
    capacity: 8, location: MAIN,
    enrollees: [
      { member: "LWB419418", first: "Holly", last: "Byrne-Kelly", age: 7 },
      { member: "LWB419419", first: "Lily", last: "Byrne-Kelly", age: 7 },
      { member: "LWB423990", first: "Max", last: "McCarthy", age: 6 },
      { member: "LWB424647", first: "Andrea elizabeth", last: "Tom", age: 6 },
      { member: "LWB425693", first: "Aoife", last: "Kelleher", age: 7 },
      { member: "LWB427891", first: "Noah", last: "Dinneen", age: 6 },
      { member: "LWB428208", first: "Alexandra", last: "Crowley", age: 6 },
      { member: "LWB428567", first: "Finn", last: "O'Donoghue", age: 7 },
    ],
  },
  {
    code: "00008136", course: "Penguins (B)", level: "Penguins", start: "15:45",
    capacity: 8, location: MAIN,
    enrollees: [
      { member: "LWB415748", first: "James", last: "Cullinane", age: 6 },
      { member: "LWB418302", first: "Alice", last: "Teahan", age: 6 },
      { member: "LWB427470", first: "Emma", last: "Gately", age: 5 },
      { member: "LWB427496", first: "Ella", last: "Jacob", age: 6 },
      { member: "LWB428123", first: "Oonagh", last: "Sheehan", age: 7 },
      { member: "LWB432036", first: "Jack", last: "O'Donovan", age: 6 },
      { member: "LWB432037", first: "Holly", last: "O'Donovan", age: 5 },
      { member: "LWB432446", first: "Ryan", last: "O Callaghan", age: 6 },
    ],
  },
  {
    code: "00008140", course: "Penguins", level: "Penguins", start: "16:20",
    capacity: 8, location: MAIN,
    enrollees: [
      { member: "LWB98969", first: "Julia", last: "O'Mahony", age: 6 },
      { member: "LWB427724", first: "Aine", last: "Twohig", age: 7 },
      { member: "LWB428047", first: "Alicia", last: "Jasionek", age: 7 },
      { member: "LWB428545", first: "Aibhin", last: "Lyons", age: 7 },
      { member: "LWB432130", first: "Isabelle", last: "Millner", age: 5 },
      { member: "LWB434374", first: "Jayden", last: "O'Callahan", age: 5 },
      { member: "LWB434779", first: "Lillian", last: "O'Connor", age: 7 },
      { member: "LWB435778", first: "Sarah", last: "Hellstern", age: 7 },
    ],
  },
  {
    code: "00008144", course: "Penguins", level: "Penguins", start: "16:55",
    capacity: 8, location: MAIN,
    enrollees: [
      { member: "LWB69041", first: "Kate", last: "O'Keeffe", age: 5 },
      { member: "LWB418289", first: "Bobby", last: "Kenny", age: 6 },
      { member: "LWB419636", first: "Kodi", last: "O Connor", age: 8 },
      { member: "LWB427455", first: "Saoirse", last: "Cronin", age: 6 },
      { member: "LWB428906", first: "Aoife", last: "Holmes", age: 6 },
      { member: "LWB434483", first: "Alexandra", last: "O'Flynn", age: 7 },
      { member: "LWB437796", first: "Danah", last: "Elsamman", age: 6 },
      { member: "LWB437808", first: "Isaac", last: "O Callaghan", age: 7 },
    ],
  },

  // ---- Turtles ----
  {
    code: "00008131", course: "Turtles", level: "Turtles", start: "15:10",
    capacity: 10, location: MAIN,
    enrollees: [
      { member: "LWB66445", first: "Domhnall", last: "Ó Luasa", age: 8 },
      { member: "LWB99336", first: "Alex", last: "Foley", age: 8 },
      { member: "LWB99759", first: "Bobby", last: "Thomas", age: 6 },
      { member: "LWB420282", first: "Róisín", last: "O'Sullivan", age: 6 },
      { member: "LWB420294", first: "Ella", last: "Hendrickson", age: 6 },
      { member: "LWB420295", first: "Carly", last: "Hendrickson", age: 6 },
      { member: "LWB423257", first: "Isaac", last: "Parkes", age: 8 },
      { member: "LWB427448", first: "Jesimiel", last: "Kakkanadu Jomon", age: 7 },
      { member: "LWB428565", first: "Matthew", last: "O'Donoghue", age: 9 },
      { member: "LWB437150", first: "Ivor", last: "Wyley", age: 8 },
    ],
  },
  {
    code: "00008137", course: "Turtles", level: "Turtles", start: "15:45",
    capacity: 10, location: MAIN,
    enrollees: [
      { member: "LWB88622", first: "Tadhg", last: "Hansberry", age: 8 },
      { member: "LWB93688", first: "Leo", last: "McCarthy", age: 10 },
      { member: "LWB407142", first: "Oisín", last: "Jiang", age: 6 },
      { member: "LWB418300", first: "Hannah", last: "Teahan", age: 8 },
      { member: "LWD419725", first: "Ali", last: "Oregan", age: 7, facility: "D" },
      { member: "LWB422993", first: "Alexandra", last: "McCarthy", age: 6 },
      { member: "LWB424648", first: "Aiden Joseph", last: "Tom", age: 11 },
      { member: "LWB427792", first: "James", last: "Looney", age: 9 },
      { member: "LWC428802", first: "Ruby-Rose", last: "Callanan", age: 7, facility: "C" },
      { member: "LWC430450", first: "Zoe", last: "Lynch", age: 7, facility: "C" },
    ],
  },
  {
    code: "00008141", course: "Turtles", level: "Turtles", start: "16:20",
    capacity: 10, location: MAIN,
    enrollees: [
      { member: "LWB93031", first: "Theo", last: "Drain", age: 8 },
      { member: "LWB406969", first: "Katelyn", last: "Burke", age: 6 },
      { member: "LWB412327", first: "Ben", last: "Drain", age: 10 },
      { member: "LWB413676", first: "Ella", last: "Collins", age: 7 },
      { member: "LWB419567", first: "Clodagh", last: "O'Donoghue", age: 7 },
      { member: "LWB422203", first: "Isabelle", last: "Ryan", age: 6 },
      { member: "LWB426170", first: "Jack", last: "Moore", age: 7 },
      { member: "LWB427209", first: "Aoibhín", last: "Kelleher", age: 7 },
      { member: "LWB427265", first: "Aoibh", last: "Crowley", age: 7 },
      { member: "LWB435779", first: "Michael", last: "Hellstern", age: 7 },
    ],
  },
  {
    code: "00008145", course: "Turtles", level: "Turtles", start: "16:55",
    capacity: 10, location: MAIN,
    enrollees: [
      { member: "LWB78166", first: "Joseph", last: "Hickey", age: 6 },
      { member: "LWB82150", first: "Noah", last: "Daly", age: 8 },
      { member: "LWB86005", first: "Aoibhe", last: "Muldoon", age: 7 },
      { member: "LWB419665", first: "Robyn", last: "Byrne", age: 6 },
      { member: "LWB423708", first: "Jackson", last: "Byrne", age: 7 },
      { member: "LWB424135", first: "Billy", last: "Longworth", age: 8 },
      { member: "LWB427409", first: "Eva", last: "Somers", age: 8 },
      { member: "LWB427584", first: "Beibhin", last: "O Sullivan", age: 6 },
      { member: "LWB428194", first: "Ollie", last: "Murphy", age: 8 },
      { member: "LWB431007", first: "Dawid", last: "Jagiela", age: 7 },
    ],
  },

  // ---- Dolphins ----
  {
    code: "00008132", course: "Dolphins", level: "Dolphins", start: "15:10",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB93595", first: "Michael", last: "Kelleher", age: 8 },
      { member: "LWB94857", first: "Vladimir", last: "Naghi", age: 10 },
      { member: "LWB98768", first: "Evan", last: "Connolly Duffy", age: 11 },
      { member: "LWB412081", first: "Jenny", last: "Nolan", age: 7 },
      { member: "LWB420856", first: "Maryam", last: "Yousaf", age: 7 },
      { member: "LWD422248", first: "Darragh", last: "Phelan", age: 10, facility: "D" },
      { member: "LWB428903", first: "Mia", last: "Power", age: 8 },
    ],
  },
  {
    code: "00008138", course: "Dolphins", level: "Dolphins", start: "15:45",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB88623", first: "Roisin", last: "Hansberry", age: 9 },
      { member: "LWB93870", first: "Leah", last: "McCarthy", age: 7 },
      { member: "LWB94990", first: "Ben", last: "Clark", age: 8 },
      { member: "LWB96442", first: "Reeva", last: "O'Sullivan", age: 8 },
      { member: "LWB97412", first: "Joe", last: "Buttimer", age: 9 },
      { member: "LWB97715", first: "Daniel", last: "O'Leary", age: 8 },
      { member: "LWB98317", first: "Beth", last: "Davis", age: 10 },
      { member: "LWB419568", first: "Ross", last: "O'Donoghue", age: 10 },
      { member: "LWB423367", first: "Tommy", last: "Drislane", age: 9 },
      { member: "LWB426485", first: "Bethuel Alex", last: "Babin", age: 9 },
    ],
  },
  {
    code: "00008142", course: "Dolphins", level: "Dolphins", start: "16:20",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWC36981", first: "Cian", last: "Blake", age: 10, facility: "C" },
      { member: "LWB82071", first: "Laoise", last: "Ryan", age: 8 },
      { member: "LWB82351", first: "Una", last: "O'Mahony", age: 8 },
      { member: "LWB86650", first: "Amira", last: "Ocallaghan", age: 7 },
      { member: "LWB92147", first: "Harry", last: "Carty", age: 7 },
      { member: "LWB94058", first: "Seán", last: "Hynes", age: 7 },
      { member: "LWB94323", first: "Aaron", last: "Wolf", age: 9 },
      { member: "LWB419723", first: "Marlene", last: "O'Donoghue", age: 12 },
      { member: "LWB423077", first: "Hugo Kai", last: "Desmond", age: 9 },
      { member: "LWB426443", first: "Olivia", last: "Linehan Sreenan", age: 10 },
      { member: "LWB427208", first: "Oisín", last: "Kelleher", age: 8 },
      { member: "LWB427264", first: "Fionn", last: "Crowley", age: 9 },
    ],
  },

  // ---- Sharks ----
  {
    code: "00008146", course: "Sharks 1", level: "Sharks 1", start: "16:55",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB70994", first: "Joe", last: "O Mahony", age: 9 },
      { member: "LWC51046", first: "Matthew", last: "Kerr", age: 9, facility: "C" },
      { member: "LWB86004", first: "Oisin", last: "Muldoon", age: 9 },
      { member: "LWB91155", first: "Jack", last: "Kenny", age: 8 },
      { member: "LWB93512", first: "Matthew", last: "Mulcahy", age: 8 },
      { member: "LWB93869", first: "Luke", last: "McCarthy", age: 9 },
      { member: "LWB95282", first: "Lucy", last: "Purcell", age: 9 },
      { member: "LWB96412", first: "Ciara", last: "Noonan", age: 10 },
      { member: "LWB97892", first: "Oisín", last: "Lynch", age: 9 },
      { member: "LWB419827", first: "Éabha", last: "Meaney", age: 9 },
      { member: "LWB423890", first: "Luke", last: "O'Connor", age: 11 },
      { member: "LWB427395", first: "Alexandra", last: "Carp", age: 11 },
    ],
  },
  {
    code: "00008737", course: "Sharks 2", level: "Sharks 2", start: "17:30",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB59613", first: "Sean", last: "McCarthy", age: 10 },
      { member: "LWB67262", first: "Peter", last: "O'Leary", age: 11 },
      { member: "LWB79809", first: "Evelyn", last: "Aherne", age: 9 },
      { member: "LWC51658", first: "Frankie", last: "Sisk", age: 8, facility: "C" },
      { member: "LWB94348", first: "Mary", last: "De Paor", age: 9 },
      { member: "LWD1716", first: "Daniel", last: "Adamczuk", age: 12, facility: "D" },
      { member: "LWB422707", first: "Maruzza", last: "Montalto", age: 10 },
      { member: "LWB426048", first: "Fiach", last: "Hawkins", age: 11 },
      { member: "LWB426749", first: "Laura", last: "Dolan", age: 10 },
      { member: "LWB431011", first: "Kuba", last: "Jagiela", age: 12 },
      { member: "LWB431311", first: "Alex", last: "Long", age: 12 },
    ],
  },

  // ---- Rookies. See the judgement call at the top of this file. ----
  {
    code: "00008231", course: "Rookies Bronze", level: "Rookies Bronze 1 - 3", start: "17:30",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWC50846", first: "Jack", last: "Wiley", age: 10, facility: "C" },
      { member: "LWB84219", first: "Jackie", last: "Kerins", age: 9 },
      { member: "LWB92910", first: "Sophie", last: "Oconnell Falvey", age: 9 },
      { member: "LWB92911", first: "Lili", last: "O'Connell Falvey", age: 9 },
      { member: "LWB93518", first: "Abigail", last: "Mulcahy", age: 11 },
      { member: "LWB410267", first: "Katie-Anne", last: "Keane", age: 13 },
    ],
  },
  {
    code: "00008232", course: "Rookies Silver", level: "Rookies Silver 1 - 3", start: "17:30",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB64450", first: "Odhran", last: "McCarthy", age: 10 },
      { member: "LWB85447", first: "Laoise", last: "O'Sullivan", age: 9 },
      { member: "LWB422996", first: "Vivienne", last: "McSwiney", age: 11 },
      { member: "LWB422998", first: "Genevieve", last: "Mcswiney", age: 11 },
      { member: "LWB423767", first: "Billy", last: "Browne", age: 9 },
    ],
  },
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
  let levelsCreated = 0;
  let coursesCreated = 0;
  let studentsCreated = 0;
  let enrolled = 0;
  const problems: string[] = [];
  const conflicts: string[] = [];
  const renames: string[] = [];
  const alsoOnAnotherDay: string[] = [];

  const lastLevel = await prisma.level.findFirst({
    where: { programmeId: programme.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  let sortOrder = (lastLevel?.sortOrder ?? -1) + 1;

  for (const name of NEW_LEVELS) {
    const existing = await prisma.level.findUnique({
      where: { programmeId_name: { programmeId: programme.id, name } },
      select: { id: true },
    });
    if (existing) continue;

    const level = await prisma.level.create({
      data: {
        programmeId: programme.id,
        name,
        description: "Imported from the club's Monday timetable. No competencies recorded yet.",
        sortOrder: sortOrder++,
      },
      select: { id: true },
    });
    levelsCreated += 1;
    await logAudit({
      actorId: admin.id,
      actorName: admin.name,
      action: "create",
      entity: "Level",
      entityId: level.id,
      programmeId: programme.id,
      summary: `Added level ${name} to ${programme.name}, from the Monday timetable`,
    });
  }

  const levels = new Map(
    (
      await prisma.level.findMany({
        where: { programmeId: programme.id },
        select: { id: true, name: true },
      })
    ).map((l) => [l.name, l.id])
  );

  for (const roster of ROSTERS) {
    const levelId = levels.get(roster.level);
    if (!levelId) {
      problems.push(`No level "${roster.level}" — ${roster.course} ${roster.start} skipped.`);
      continue;
    }

    const startMinutes = toMinutes(roster.start);
    let course = await prisma.course.findFirst({
      where: { name: roster.course, dayOfWeek: DAY, startMinutes, levelId },
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
          levelId,
          name: roster.course,
          dayOfWeek: DAY,
          startMinutes,
          durationMinutes: 30,
          capacity: roster.capacity,
          location: roster.location,
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
      coursesCreated += 1;
      await logAudit({
        actorId: admin.id,
        actorName: admin.name,
        action: "create",
        entity: "Course",
        entityId: course.id,
        programmeId: programme.id,
        summary: `Added ${courseLabel(course)} from the club's Monday timetable (course ${roster.code}), capacity ${roster.capacity}`,
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
          _count: { select: { enrolments: true } },
        },
      });

      let studentId: string;
      let name: string;

      if (existing) {
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
        programmeId: programme.id,
        summary: `Imported the Monday roster for ${courseLabel(course)} — ${added.length} enrolled (${added.slice(0, 6).join(", ")}${added.length > 6 ? ` and ${added.length - 6} others` : ""})`,
      });
    }

    console.log(`${roster.course.padEnd(14)} ${roster.start}  ${added.length} enrolled.`);
  }

  console.log(
    `\n${levelsCreated} levels created, ${coursesCreated} classes created, ${studentsCreated} students created, ${enrolled} enrolments made.`
  );

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
