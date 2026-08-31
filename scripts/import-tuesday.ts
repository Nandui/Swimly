import "dotenv/config";
import { logAudit } from "@/lib/audit";
import { courseLabel } from "@/lib/courses/constants";
import { withCourseSeat } from "@/lib/enrolment/seat";
import { parseDateOnly, today } from "@/lib/format";
import { fullName } from "@/lib/students/constants";
import { prisma } from "@/lib/prisma";

/** The Tuesday timetable and rosters, from the PDF of the club's existing
 *  system (31 Aug 2026). Same method and same rules as Monday, Friday and
 *  Saturday: pages rendered from the source PDF, capacity taken from each class
 *  card's own **Available** count, every enrolment through `withCourseSeat`,
 *  idempotent, audited, and refusing rather than guessing on a member-number
 *  clash.
 *
 *  Twenty classes across six levels, 160 enrolment rows. No new levels: every
 *  level Tuesday uses already exists, including Sharks 1 and Sharks 2, which
 *  `move-levels.ts` put in Swimming Skills after the Monday import. Levels are
 *  looked up by name across every programme for exactly that reason.
 *
 *  **Capacity, where the card says "Only Waiting List".** Nine of the twenty
 *  cards show a waiting list rather than a count of free places. Available is
 *  zero on those, so capacity is the enrolled count — 8 for Penguins, 10 for
 *  Turtles, 12 for Dolphins and Sharks 2, which is what every countable class
 *  at the same level shows. Read off, not assumed, but it is the one figure
 *  here the source states only indirectly.
 *
 *  **One child is in two Tuesday classes.** Leah McSweeney (LWB80338) is on the
 *  roster for Turtles 15:10 and for Turtles 16:55. Both are transcribed,
 *  because both are what the club's system says. If it is an error there, it is
 *  theirs to correct, and dropping one here would only hide it. */

const PROGRAMME = "Water Safety & Fun";
const DAY = "TUESDAY" as const;

/** Every level Tuesday needs is already in the curriculum. */
const NEW_LEVELS: string[] = [];

/** Transcribed exactly. Oddities in the club's own records, not misreadings. */
const ODD_IN_SOURCE = new Map([
  ["LWB427989", "BOBBY Cumming — first name in capitals"],
  ["LWB432307", "FIONN Colohan — first name in capitals"],
  ["LWB432503", "Mason Slavin O'leary — lowercase L after the apostrophe"],
  ["LWB84440", "Avril O'connor — lowercase C, while LWB84680 is Evie O'Connor"],
  ["LWC57431", "Oscar O' Reilly — a space after the apostrophe"],
  ["LWB427753", "Tadgh Tanner — 'Tadgh', while LWB426778 is Tadhg Murphy"],
  ["LWB420291", "Tadgh Murphy — 'Tadgh' again, and a different child to LWB426778"],
  ["LWB95712", "Cian Canning — postcode recorded as 00000"],
  ["LWB80338", "Leah McSweeney — on both the 15:10 and the 16:55 Turtles roster"],
  ["LWB411691", "Aoibhlin O'Connor — 'Aoibhlin', while LWB98649 is Aoibhinn O'Sullivan"],
]);

/** Readings I am least sure of even at this resolution. */
const UNCERTAIN = new Set([
  "LWB433325", // Chris Dave Nithin
  "LWB433327", // Mikha Elsa Aju
  "LWB436985", // Páidi Bouse
  "LWB431052", // Dominic Kantaravicius — his sibling LWB431051 is Kantaraviciute
  "LWB428289", // Matteo Javid Buan
  "LWB79762", // Vivin Bharat Thivari
  "LWB428649", // Kornelia Swiecichowska
  "LWB70812", // Eleanor Ní Bhrádaigh
  "LWB416197", // Roisin Ni Ghliasain
  "LWB85195", // Andi Hadarig
  "LWB54158", // Leah Boukamel
  "LWB428245", // Marta Verse
  "LWB432114", // LJ O Sullivan — initials, not a shortened name
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
  // ---- Starfish (Learner Pool, 8 a class) ----
  {
    code: "00008600", course: "Starfish", level: "Starfish", start: "15:10",
    capacity: 8, location: LEARNER,
    enrollees: [
      { member: "LWB427758", first: "Zaina", last: "Barkat", age: 7 },
      { member: "LWB431506", first: "Cristiano", last: "Araujo", age: 7 },
      { member: "LWB432503", first: "Mason", last: "Slavin O'leary", age: 5 },
      { member: "LWB433334", first: "Caitlin", last: "Clarke", age: 5 },
      { member: "LWB433373", first: "Iseult", last: "Fitzpatrick", age: 6 },
      { member: "LWB434982", first: "Cian", last: "O'Regan", age: 5 },
    ],
  },
  {
    code: "00008151", course: "Starfish (A)", level: "Starfish", start: "15:45",
    capacity: 8, location: LEARNER,
    enrollees: [
      { member: "LWB433325", first: "Chris Dave", last: "Nithin", age: 5 },
      { member: "LWB433327", first: "Mikha Elsa", last: "Aju", age: 7 },
      { member: "LWB433553", first: "Maks", last: "Blin", age: 7 },
      { member: "LWB436349", first: "Aaron", last: "Mulcahy", age: 5 },
      { member: "LWB436350", first: "Luke", last: "Mulcahy", age: 7 },
    ],
  },
  {
    code: "00008152", course: "Starfish (B)", level: "Starfish", start: "15:45",
    capacity: 8, location: LEARNER,
    enrollees: [
      { member: "LWB433533", first: "Kaya", last: "Long", age: 6 },
      { member: "LWB436985", first: "Páidi", last: "Bouse", age: 5 },
      { member: "LWB436993", first: "Henry", last: "O Mahony", age: 6 },
    ],
  },
  {
    code: "00008155", course: "Starfish", level: "Starfish", start: "16:20",
    capacity: 8, location: LEARNER,
    enrollees: [
      { member: "LWB429340", first: "Ryaan", last: "Pushparaj", age: 6 },
      { member: "LWB431052", first: "Dominic", last: "Kantaravicius", age: 5 },
      { member: "LWB434514", first: "Kimberley", last: "Varian", age: 5 },
      { member: "LWB436165", first: "Ava", last: "Lynch", age: 5 },
      { member: "LWB437528", first: "Ciara", last: "Hanrahan", age: 5 },
      { member: "LWB437697", first: "Sam", last: "Kelliher", age: 6 },
      { member: "LWB437735", first: "Roswitha", last: "Almeida", age: 6 },
    ],
  },
  {
    code: "00008159", course: "Starfish", level: "Starfish", start: "16:55",
    capacity: 8, location: LEARNER,
    enrollees: [
      { member: "LWB427866", first: "Ava", last: "O Connor", age: 8 },
      { member: "LWB433307", first: "Liam", last: "Power", age: 5 },
      { member: "LWB435828", first: "Matthew", last: "Sheehan", age: 6 },
      { member: "LWB435981", first: "Reyna", last: "Fitzgerald", age: 5 },
    ],
  },
  {
    code: "00008601", course: "Starfish", level: "Starfish", start: "17:30",
    capacity: 8, location: LEARNER,
    enrollees: [
      { member: "LWB428641", first: "Darragh", last: "Coghlan", age: 5 },
      { member: "LWB432545", first: "Maya", last: "Coyd", age: 5 },
      { member: "LWB433449", first: "Salma", last: "Mahmoud", age: 5 },
      { member: "LWB434085", first: "Aarin", last: "Sobhrajani", age: 5 },
      { member: "LWB437097", first: "Emma", last: "Kearney", age: 5 },
    ],
  },

  // ---- Penguins (Main Pool, 8 a class) ----
  {
    code: "00008147", course: "Penguins", level: "Penguins", start: "15:10",
    capacity: 8, location: MAIN,
    enrollees: [
      { member: "LWB413241", first: "Charlie", last: "Carey", age: 6 },
      { member: "LWB418356", first: "Skye", last: "Honour", age: 6 },
      { member: "LWB426432", first: "Jonathan", last: "Byrne", age: 6 },
      { member: "LWB427989", first: "BOBBY", last: "Cumming", age: 6 },
      { member: "LWB428152", first: "Hannah", last: "McAuliffe", age: 7 },
      { member: "LWB433392", first: "Ayla", last: "Frost", age: 7 },
      { member: "LWC436696", first: "Albie", last: "Blake", age: 7, facility: "C" },
      { member: "LWB438440", first: "Ellen", last: "Broderick", age: 5 },
    ],
  },
  {
    code: "00008156", course: "Penguins", level: "Penguins", start: "16:20",
    capacity: 8, location: MAIN,
    enrollees: [
      { member: "LWB408745", first: "Liam", last: "Kiely", age: 5 },
      { member: "LWB426778", first: "Tadhg", last: "Murphy", age: 5 },
      { member: "LWB427753", first: "Tadgh", last: "Tanner", age: 6 },
      { member: "LWB428289", first: "Matteo Javid", last: "Buan", age: 9 },
      { member: "LWB428688", first: "Grace", last: "O'Shea", age: 6 },
      { member: "LWB429339", first: "Aadhav", last: "Pushparaj", age: 9 },
      { member: "LWC430241", first: "Fatima", last: "Rahman", age: 9, facility: "C" },
      { member: "LWB431051", first: "Lauryn", last: "Kantaraviciute", age: 7 },
    ],
  },
  {
    code: "00008160", course: "Penguins", level: "Penguins", start: "16:55",
    capacity: 8, location: MAIN,
    enrollees: [
      { member: "LWB90475", first: "Luke", last: "Curtin", age: 8 },
      { member: "LWB408356", first: "Humaid", last: "Sajjad", age: 8 },
      { member: "LWB411698", first: "Ellis", last: "Watkins", age: 7 },
      { member: "LWB419628", first: "Holly", last: "Higgins", age: 7 },
      { member: "LWB431691", first: "Faye", last: "Connelly", age: 6 },
      { member: "LWB432115", first: "Jude", last: "O Sullivan", age: 6 },
      { member: "LWB432307", first: "FIONN", last: "Colohan", age: 5 },
      { member: "LWB434833", first: "Noah", last: "Murphy", age: 6 },
    ],
  },

  // ---- Turtles (Main Pool, 10 a class) ----
  {
    code: "00008149", course: "Turtles", level: "Turtles", start: "15:10",
    capacity: 10, location: MAIN,
    enrollees: [
      { member: "LWB80338", first: "Leah", last: "McSweeney", age: 7 },
      { member: "LWB91185", first: "Jamie", last: "Browne", age: 7 },
      { member: "LWB93956", first: "Darragh", last: "Carey", age: 7 },
      { member: "LWB407893", first: "Alice", last: "Ramalho Oliveira", age: 9 },
      { member: "LWB408588", first: "Eanna", last: "Casey", age: 7 },
      { member: "LWB411691", first: "Aoibhlin", last: "O'Connor", age: 8 },
      { member: "LWB419621", first: "Alex", last: "O Leary", age: 7 },
    ],
  },
  {
    code: "00008271", course: "Turtles", level: "Turtles", start: "15:45",
    capacity: 10, location: MAIN,
    enrollees: [
      { member: "LWB73248", first: "Ivy", last: "Burke", age: 6 },
      { member: "LWC45533", first: "Annie", last: "O'Sullivan", age: 8, facility: "C" },
      { member: "LWC47009", first: "Olivia", last: "O Leary O Sullivan", age: 7, facility: "C" },
      { member: "LWB91083", first: "Darragh", last: "Anderson", age: 7 },
      { member: "LWB412072", first: "Paudie", last: "O'Sullivan", age: 7 },
      { member: "LWB417703", first: "Isabel", last: "Corcoran", age: 6 },
      { member: "LWB420291", first: "Tadgh", last: "Murphy", age: 7 },
      { member: "LWB428483", first: "Olivia", last: "Hannon", age: 10 },
      { member: "LWB428503", first: "Finn", last: "Anderson", age: 7 },
      { member: "LWB437410", first: "Isabel", last: "Hannon", age: 7 },
    ],
  },
  {
    code: "00008157", course: "Turtles", level: "Turtles", start: "16:20",
    capacity: 10, location: MAIN,
    enrollees: [
      { member: "LWB85845", first: "Róisín", last: "Twomey", age: 7 },
      { member: "LWB86509", first: "Dónal", last: "Twomey", age: 7 },
      { member: "LWB94149", first: "Beth", last: "McCarthy", age: 7 },
      { member: "LWB95517", first: "Faye", last: "Fahy", age: 7 },
      { member: "LWB98756", first: "Tom", last: "Van Riel", age: 6 },
      { member: "LWB99205", first: "Harry", last: "Mullins", age: 7 },
      { member: "LWB408744", first: "Cian", last: "Kiely", age: 6 },
      { member: "LWB418360", first: "James", last: "O Flynn", age: 6 },
      { member: "LWC430242", first: "Sanjida", last: "Rahman", age: 9, facility: "C" },
      { member: "LWB432114", first: "LJ", last: "O Sullivan", age: 8 },
    ],
  },
  {
    code: "00008161", course: "Turtles", level: "Turtles", start: "16:55",
    capacity: 10, location: MAIN,
    enrollees: [
      { member: "LWB72677", first: "Saoirse", last: "Brennan", age: 6 },
      { member: "LWB79762", first: "Vivin Bharat", last: "Thivari", age: 6 },
      { member: "LWB80338", first: "Leah", last: "McSweeney", age: 7 },
      { member: "LWB82527", first: "Catherine", last: "Mountjoy", age: 8 },
      { member: "LWB93594", first: "Aoibhinn", last: "Wyllie", age: 8 },
      { member: "LWB95612", first: "Aoife", last: "Morrissey", age: 6 },
      { member: "LWB99477", first: "Siún", last: "O Connor", age: 7 },
      { member: "LWB407765", first: "Conor", last: "Canning", age: 7 },
      { member: "LWB426467", first: "Leo", last: "Nolan", age: 7 },
      { member: "LWB428649", first: "Kornelia", last: "Swiecichowska", age: 8 },
    ],
  },

  // ---- Dolphins (Main Pool, 12 a class) ----
  {
    code: "00008150", course: "Dolphins", level: "Dolphins", start: "15:10",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB33668", first: "Cian", last: "Giltinan", age: 10 },
      { member: "LWB80488", first: "Ray", last: "Guest", age: 9 },
      { member: "LWB93717", first: "Rose", last: "Guest", age: 7 },
      { member: "LWB95484", first: "Liam", last: "Long", age: 7 },
      { member: "LWB423920", first: "Roisin", last: "Anderson", age: 7 },
    ],
  },
  {
    code: "00008814", course: "Dolphins", level: "Dolphins", start: "15:45",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB73247", first: "Elliot", last: "Burke", age: 8 },
      { member: "LWB80110", first: "Cathal", last: "Murphy", age: 8 },
      { member: "LWC56938", first: "Alfie", last: "Duggan", age: 7, facility: "C" },
      { member: "LWC57431", first: "Oscar", last: "O' Reilly", age: 8, facility: "C" },
      { member: "LWB98145", first: "Saoirse", last: "Somers", age: 7 },
      { member: "LWB416197", first: "Roisin", last: "Ni Ghliasain", age: 7 },
      { member: "LWB417702", first: "Oisín", last: "Corcoran", age: 8 },
      { member: "LWB419672", first: "Nathan", last: "Cattoen-Marcelin", age: 8 },
      { member: "LWB424297", first: "Freya", last: "Meade", age: 8 },
      { member: "LWB426049", first: "Conall", last: "Hawkins", age: 8 },
    ],
  },
  {
    code: "00008158", course: "Dolphins", level: "Dolphins", start: "16:20",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB70812", first: "Eleanor", last: "Ní Bhrádaigh", age: 8 },
      { member: "LWB81424", first: "Charlotte", last: "Mullins", age: 10 },
      { member: "LWB90274", first: "Saoirse", last: "O'Regan", age: 8 },
      { member: "LWB91985", first: "Anna", last: "Kenneally", age: 7 },
      { member: "LWB92602", first: "Eoin", last: "Van Riel", age: 8 },
      { member: "LWB92906", first: "Eadaoin", last: "Dempsey", age: 8 },
      { member: "LWB95712", first: "Cian", last: "Canning", age: 8 },
      { member: "LWB98568", first: "Rose", last: "Lynch", age: 8 },
      { member: "LWB99375", first: "Andrew", last: "Brady", age: 7 },
      { member: "LWB423123", first: "Benjamin", last: "Szelec", age: 8 },
      { member: "LWB425556", first: "Luiza", last: "Pop", age: 9 },
      { member: "LWB427587", first: "James", last: "Cosgrave", age: 8 },
    ],
  },
  {
    code: "00008162", course: "Dolphins", level: "Dolphins", start: "16:55",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB90802", first: "Holly", last: "Hegarty", age: 8 },
      { member: "LWB90988", first: "Charlie", last: "Byrd", age: 9 },
      { member: "LWB92419", first: "Matthew", last: "Moynihan", age: 8 },
      { member: "LWB92583", first: "Conor", last: "Power", age: 8 },
      { member: "LWB93593", first: "Róisín", last: "Wyllie", age: 9 },
      { member: "LWB94425", first: "Cian", last: "Lehane", age: 8 },
      { member: "LWB98650", first: "Cara", last: "O'Sullivan", age: 6 },
      { member: "LWB100069", first: "Evie", last: "Connolly", age: 8 },
      { member: "LWB408355", first: "Barirah", last: "Sajjad", age: 9 },
      { member: "LWB419627", first: "Ava", last: "Colohan", age: 7 },
      { member: "LWB420264", first: "Caitlin Therese", last: "Brosnan", age: 7 },
      { member: "LWB424479", first: "Cian", last: "Kelleher", age: 8 },
    ],
  },

  // ---- Sharks 1 (Main Pool, 12 a class) ----
  {
    code: "00008163", course: "Sharks 1 (A)", level: "Sharks 1", start: "17:30",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB63316", first: "Max", last: "Nosek", age: 9 },
      { member: "LWB81244", first: "Alex", last: "Sexton", age: 10 },
      { member: "LWB81748", first: "Olivia", last: "Buckley", age: 9 },
      { member: "LWB82637", first: "Bobby", last: "Barry", age: 9 },
      { member: "LWB91187", first: "Hannah", last: "Coghlan", age: 8 },
      { member: "LWB100066", first: "Ellie", last: "Connolly", age: 11 },
      { member: "LWB415672", first: "James", last: "O'Brien", age: 10 },
      { member: "LWB423066", first: "Eoin", last: "Lynch", age: 10 },
      { member: "LWB434414", first: "Ruadhan", last: "McCarthy", age: 8 },
    ],
  },
  {
    code: "00008164", course: "Sharks 1 (B)", level: "Sharks 1", start: "17:30",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB54158", first: "Leah", last: "Boukamel", age: 10 },
      { member: "LWB84295", first: "Emma", last: "Avram", age: 9 },
      { member: "LWB85195", first: "Andi", last: "Hadarig", age: 9 },
      { member: "LWB94670", first: "Grace", last: "McMahon", age: 9 },
      { member: "LWB94677", first: "Lily", last: "McMahon", age: 10 },
      { member: "LWB96146", first: "Jacob", last: "O'Connor", age: 9 },
      { member: "LWB98649", first: "Aoibhinn", last: "O'Sullivan", age: 9 },
      { member: "LWB423069", first: "Leon", last: "O'Mahony", age: 7 },
      { member: "LWB428706", first: "Calum", last: "Kent", age: 11 },
    ],
  },

  // ---- Sharks 2 (Main Pool, 12 a class) ----
  {
    code: "00008165", course: "Sharks 2 (A)", level: "Sharks 2", start: "17:30",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB59292", first: "Aaliyah", last: "Fitzgerald Cambridge", age: 11 },
      { member: "LWB59293", first: "Sophia", last: "Fitzgerald Cambridge", age: 11 },
      { member: "LWB66751", first: "Ella", last: "Wolowicz", age: 12 },
      { member: "LWB84440", first: "Avril", last: "O'connor", age: 11 },
      { member: "LWB84680", first: "Evie", last: "O'Connor", age: 9 },
      { member: "LWB90801", first: "Thomas", last: "Hegarty", age: 11 },
      { member: "LWB94424", first: "Emily", last: "Lehane", age: 8 },
      { member: "LWB94620", first: "Ben", last: "Condon", age: 9 },
      { member: "LWB410070", first: "Charlie", last: "McCarthy", age: 9 },
      { member: "LWB410515", first: "Adira", last: "Sobhrajani", age: 12 },
      { member: "LWB420263", first: "Aoife Marie", last: "Brosnan", age: 10 },
      { member: "LWB428245", first: "Marta", last: "Verse", age: 11 },
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
    // By name alone, across every programme: a level that has since been moved
    // must not be recreated here as an empty duplicate.
    const existing = await prisma.level.findFirst({ where: { name }, select: { id: true } });
    if (existing) continue;

    const level = await prisma.level.create({
      data: {
        programmeId: programme.id,
        name,
        description: "Imported from the club's Tuesday timetable. No competencies recorded yet.",
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
      summary: `Added level ${name} to ${programme.name}, from the Tuesday timetable`,
    });
  }

  // Looked up by name across every programme, not inside one. Sharks 1 and
  // Sharks 2 moved to Swimming Skills after this import first ran, and a script
  // that records how the data got here has to stay a clean no-op afterwards.
  // Level names are unique across the curriculum; this asserts it rather than
  // trusting it.
  const levelRows = await prisma.level.findMany({ select: { id: true, name: true } });
  const levels = new Map<string, string>();
  for (const l of levelRows) {
    if (levels.has(l.name)) {
      throw new Error(`Two levels are called "${l.name}". Name the programme explicitly here.`);
    }
    levels.set(l.name, l.id);
  }

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
        programmeId: course.level.programmeId,
        summary: `Added ${courseLabel(course)} from the club's Tuesday timetable (course ${roster.code}), capacity ${roster.capacity}`,
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
        programmeId: course.level.programmeId,
        summary: `Imported the Tuesday roster for ${courseLabel(course)} — ${added.length} enrolled (${added.slice(0, 6).join(", ")}${added.length > 6 ? ` and ${added.length - 6} others` : ""})`,
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
