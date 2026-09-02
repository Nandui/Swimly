import "dotenv/config";
import { FOUNDING_CLUB_ID } from "@/lib/clubs/constants";
import { logAudit } from "@/lib/audit";
import { courseLabel } from "@/lib/courses/constants";
import { withCourseSeat } from "@/lib/enrolment/seat";
import { parseDateOnly, today } from "@/lib/format";
import { fullName } from "@/lib/students/constants";
import { prisma } from "@/lib/prisma";

/** The Thursday timetable and rosters, from the PDF of the club's existing
 *  system (31 Aug 2026). Same method and same rules as Monday, Tuesday, Friday
 *  and Saturday: pages rendered from the source PDF, capacity taken from each
 *  class card's own **Available** count, every enrolment through
 *  `withCourseSeat`, idempotent, audited, and refusing rather than guessing on
 *  a member-number clash.
 *
 *  Twenty classes, 160 enrolment rows.
 *
 *  **One new level, and it does not go where the template puts it.** Thursday
 *  has a Rookies Gold 1 - 3 class, and that level is not in the curriculum yet.
 *  The Monday import created its Rookies levels in Water Safety & Fun on the
 *  strength of the "N - " prefix, and `move-levels.ts` had to move them to RLSS
 *  Lifesaving afterwards. The price is the tell the Monday import had and
 *  discounted: EUR105 for Rookies against EUR125 for Water Safety & Fun, and
 *  this card reads EUR105 like the other two. So Rookies Gold 1 - 3 is created
 *  in **RLSS Lifesaving** directly, next to Bronze and Silver, rather than
 *  being created in the wrong place and moved.
 *
 *  **Capacity, where the card says "Only Waiting List".** Six cards show a
 *  waiting list rather than a count of free places. Available is zero on those,
 *  so capacity is the enrolled count — 8 for Penguins, 10 for Turtles, 12 for
 *  Dolphins, matching every countable class at the same level.
 *
 *  **Two children are each in two Thursday classes.** Clodagh O'Donoghue
 *  (LWB427411) is on both Turtles (A) 15:45 and Turtles (B) 15:10, and Millie
 *  Ryan (LWB95857) is on both Dolphins 15:10 and Dolphins (A) 16:20. Both are
 *  transcribed, because both are what the club's system says. If they are
 *  errors there, they are theirs to correct, and dropping one would hide it.
 *
 *  **"Camp Instructor" is not a different role.** Penguins 15:10 (course
 *  00008183) reads Camp Instructor where every other card reads Swim
 *  Instructor. The club says the two mean the same thing, so nothing turns on
 *  it. Instructor is not modelled from the source here in any case — every
 *  class is attributed to the importing admin, as on every other day.
 *
 *  **Two children may share a name and still be two children.** Matching is on
 *  member number alone, never on the name, so same-name pairs become two
 *  student records as they should. A member number that names a *different*
 *  child than the app already has is refused rather than guessed at. */

const DAY = "THURSDAY" as const;

/** Where a level in `NEW_LEVELS` is created. The other days' imports use Water
 *  Safety & Fun here, which is why Monday's Rookies levels had to be moved
 *  afterwards. Thursday's one new level is a Rookies level, so it is created in
 *  its real home. Existing levels are still resolved by name across every
 *  programme, so this constant only governs what gets *created*. */
const LEVEL_HOME = "RLSS Lifesaving";

/** Appended after Rookies Silver 1 - 3, in RLSS Lifesaving. */
const NEW_LEVELS = ["Rookies Gold 1 - 3"];

/** Transcribed exactly. Oddities in the club's own records, not misreadings. */
const ODD_IN_SOURCE = new Map([
  ["LWB425891", "kylie yanez — both names in lowercase"],
  ["LWC425218", "Jayden kunz — lowercase surname"],
  ["LWB99916", "Holly Obrien — no apostrophe"],
  ["LWB421523", "Holly Mc Carthy — spaced, while LWB97479 is Sophie McCarthy"],
  ["LWB57612", "Abigal McGarry — 'Abigal', and LWB89760 is Pippa McGarry"],
  ["LWB419447", "Una Curtain — 'Curtain', while her siblings LWB419444 and LWB419445 are Curtin"],
  ["LWC411692", "Micheal O'Brien — 'Micheal', while LWB426111 is Olan O'Brien"],
  ["LWB407551", "Tadgh Fee — 'Tadgh', and LWB95495 is Liam Fee"],
  ["LWB56981", "Ben Ginty — postcode recorded as 0000"],
  ["LWB75665", "Charlie Phelan — postcode recorded as NONE, as for LWB75663 and LWB75662"],
  ["LWB427411", "Clodagh O'Donoghue — on both the Turtles (A) 15:45 and Turtles (B) 15:10 roster"],
  ["LWB95857", "Millie Ryan — on both the Dolphins 15:10 and Dolphins (A) 16:20 roster"],
]);

/** Readings I am least sure of even at this resolution. */
const UNCERTAIN = new Set([
  "LWB98519", // Nakshathra Balakrishnan
  "LWB432133", // Cúán Murray
  "LWB418109", // Hoshmita Alavala — her sibling LWB418108 reads Yoshita
  "LWB432894", // Bella Marcondes Aguiar
  "LWB425352", // Tessa Heffernan
  "LWB432533", // Claudia Domlyn
  "LWB96140", // Aleksandra Grinyov
  "LWB428190", // Nicola Jasiowka
  "LWB58880", // Andrea Chiribuca
  "LWB419711", // Renad Margham
  "LWB98975", // Seimi Murphy
  "LWB40504", // Calida O Sullivan
  "LWB69737", // Joshua Rohan-Long
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
    code: "00008192", course: "Starfish (A)", level: "Starfish", start: "16:20",
    capacity: 8, location: LEARNER,
    enrollees: [
      { member: "LWC51647", first: "Emily", last: "Naude", age: 5, facility: "C" },
      { member: "LWB91091", first: "Ali", last: "Naveed", age: 6 },
      { member: "LWB98525", first: "Lucy", last: "Casey", age: 5 },
      { member: "LWB422869", first: "Ruan", last: "O'Grady", age: 6 },
      { member: "LWB431454", first: "Maggie", last: "O'Brien", age: 6 },
      { member: "LWB432310", first: "Tommy", last: "Connolly", age: 6 },
      { member: "LWB434632", first: "Eve", last: "Murphy", age: 5 },
    ],
  },
  {
    code: "00008626", course: "Starfish", level: "Starfish", start: "17:30",
    capacity: 8, location: LEARNER,
    enrollees: [
      { member: "LWB75665", first: "Charlie", last: "Phelan", age: 6 },
      { member: "LWB98519", first: "Nakshathra", last: "Balakrishnan", age: 6 },
      { member: "LWB431503", first: "Haneen", last: "Hassan", age: 5 },
      { member: "LWB432133", first: "Cúán", last: "Murray", age: 5 },
      { member: "LWC438515", first: "Gustaf", last: "Murray", age: 6, facility: "C" },
    ],
  },

  // ---- Penguins (Main Pool, 8 a class) ----
  {
    code: "00008183", course: "Penguins", level: "Penguins", start: "15:10",
    capacity: 8, location: MAIN,
    enrollees: [
      { member: "LWB419709", first: "Emily", last: "Desmond", age: 8 },
      { member: "LWB424892", first: "Giulia", last: "Bitsch", age: 6 },
      { member: "LWC425218", first: "Jayden", last: "kunz", age: 7, facility: "C" },
      { member: "LWB430214", first: "Luke", last: "Foolkes", age: 6 },
      { member: "LWB431841", first: "Sean", last: "Condon", age: 5 },
      { member: "LWB435977", first: "Aida", last: "O'Connell", age: 5 },
      { member: "LWB436508", first: "Grainne", last: "O'Shea", age: 5 },
    ],
  },
  {
    code: "00008187", course: "Penguins (A)", level: "Penguins", start: "15:45",
    capacity: 8, location: MAIN,
    enrollees: [
      { member: "LWB407551", first: "Tadgh", last: "Fee", age: 6 },
      { member: "LWB431049", first: "Alfie", last: "O Regan-Mullins", age: 5 },
      { member: "LWB432585", first: "Jamie", last: "Maguire", age: 6 },
      { member: "LWB432894", first: "Bella", last: "Marcondes Aguiar", age: 5 },
    ],
  },
  {
    code: "00008188", course: "Penguins (B)", level: "Penguins", start: "15:45",
    capacity: 8, location: MAIN,
    enrollees: [
      { member: "LWB421523", first: "Holly", last: "Mc Carthy", age: 5 },
      { member: "LWB422266", first: "Amelia", last: "Lee", age: 6 },
      { member: "LWD430846", first: "Tom", last: "Mythen", age: 7, facility: "D" },
      { member: "LWD430847", first: "Kate", last: "Mythen", age: 6, facility: "D" },
      { member: "LWB436023", first: "Ben", last: "Taylor", age: 5 },
    ],
  },
  {
    code: "00008198", course: "Penguins", level: "Penguins", start: "16:55",
    capacity: 8, location: MAIN,
    enrollees: [
      { member: "LWB411253", first: "Grace", last: "Fullam", age: 6 },
      { member: "LWC411692", first: "Micheal", last: "O'Brien", age: 7, facility: "C" },
      { member: "LWB428103", first: "Darragh", last: "Crowley", age: 6 },
      { member: "LWB428950", first: "Harry", last: "Buckley", age: 7 },
      { member: "LWB430617", first: "Luke", last: "Lyons", age: 7 },
      { member: "LWB430618", first: "Georgia", last: "Lyons", age: 5 },
      { member: "LWC430624", first: "Liam", last: "Mulcahy", age: 5, facility: "C" },
      { member: "LWB433315", first: "Charlie", last: "Horgan", age: 7 },
    ],
  },

  // ---- Turtles (Main Pool, 10 a class) ----
  {
    code: "00008184", course: "Turtles (A)", level: "Turtles", start: "15:10",
    capacity: 10, location: MAIN,
    enrollees: [
      { member: "LWB413273", first: "Olivia", last: "Garry", age: 7 },
      { member: "LWC427485", first: "Keelan", last: "Crowley Kelleher", age: 7, facility: "C" },
      { member: "LWB427764", first: "Grace", last: "Keohane", age: 7 },
      { member: "LWB436506", first: "Niamh", last: "O'Shea", age: 7 },
    ],
  },
  {
    code: "00008185", course: "Turtles (B)", level: "Turtles", start: "15:10",
    capacity: 10, location: MAIN,
    enrollees: [
      { member: "LWB69737", first: "Joshua", last: "Rohan-Long", age: 6 },
      { member: "LWB98400", first: "Noah", last: "Garry", age: 9 },
      { member: "LWB414101", first: "Isabella", last: "Twomey", age: 7 },
      { member: "LWB423799", first: "Johannah", last: "George", age: 8 },
      { member: "LWB427411", first: "Clodagh", last: "O'Donoghue", age: 6 },
      { member: "LWB427847", first: "Eli", last: "Barry", age: 7 },
      { member: "LWB428490", first: "Andrew", last: "Busteed", age: 7 },
    ],
  },
  {
    code: "00008189", course: "Turtles (A)", level: "Turtles", start: "15:45",
    capacity: 10, location: MAIN,
    enrollees: [
      { member: "LWB78474", first: "Sophie", last: "O Regan Mullins", age: 7 },
      { member: "LWB96956", first: "Davy", last: "Coote", age: 7 },
      { member: "LWB97479", first: "Sophie", last: "McCarthy", age: 8 },
      { member: "LWB98645", first: "Luke", last: "Lehane", age: 9 },
      { member: "LWB99195", first: "Josie", last: "Buckley", age: 7 },
      { member: "LWB99916", first: "Holly", last: "Obrien", age: 7 },
      { member: "LWB425889", first: "Meghan", last: "Martinez", age: 7 },
      { member: "LWB427411", first: "Clodagh", last: "O'Donoghue", age: 6 },
      { member: "LWB428130", first: "Jack", last: "Hanlon", age: 6 },
      { member: "LWD430845", first: "Sam", last: "Mythen", age: 10, facility: "D" },
    ],
  },
  {
    code: "00008190", course: "Turtles (B)", level: "Turtles", start: "15:45",
    capacity: 10, location: MAIN,
    enrollees: [
      { member: "LWB95495", first: "Liam", last: "Fee", age: 8 },
      { member: "LWB98646", first: "Killian", last: "Lehane", age: 7 },
      { member: "LWB98970", first: "Conn", last: "Hodnett", age: 10 },
      { member: "LWB410288", first: "Ryan", last: "Hourihane", age: 7 },
      { member: "LWB421070", first: "Rian", last: "O'Toole", age: 6 },
      { member: "LWB421935", first: "Séadna", last: "O'Grady", age: 8 },
      { member: "LWB425891", first: "kylie", last: "yanez", age: 6 },
      { member: "LWB428751", first: "Sarah", last: "Coote", age: 6 },
      { member: "LWC435766", first: "Nollaig", last: "Murphy", age: 6, facility: "C" },
    ],
  },
  {
    code: "00008194", course: "Turtles", level: "Turtles", start: "16:20",
    capacity: 10, location: MAIN,
    enrollees: [
      { member: "LWB91090", first: "Meena", last: "Naveed", age: 8 },
      { member: "LWB418109", first: "Hoshmita", last: "Alavala", age: 7 },
      { member: "LWB420828", first: "Darren", last: "Quilligan", age: 7 },
      { member: "LWB423064", first: "Alice", last: "Lynch", age: 6 },
      { member: "LWB426111", first: "Olan", last: "O'Brien", age: 7 },
      { member: "LWB428586", first: "Sophie", last: "Hennessey", age: 9 },
      { member: "LWC430421", first: "Liam", last: "Murphy", age: 8, facility: "C" },
      { member: "LWB434797", first: "Holly", last: "O'Sullivan", age: 6 },
      { member: "LWB434873", first: "Leo", last: "Roche", age: 7 },
      { member: "LWB435501", first: "Fred", last: "Cooney", age: 9 },
    ],
  },
  {
    code: "00008201", course: "Turtles", level: "Turtles", start: "16:55",
    capacity: 10, location: MAIN,
    enrollees: [
      { member: "LWB48362", first: "Sam", last: "Walsh", age: 8 },
      { member: "LWB89760", first: "Pippa", last: "McGarry", age: 7 },
      { member: "LWB411252", first: "Rian", last: "Fullam", age: 8 },
      { member: "LWB411925", first: "Conor", last: "Gallagher", age: 7 },
      { member: "LWB419711", first: "Renad", last: "Margham", age: 8 },
      { member: "LWB424484", first: "Sarah", last: "Condon", age: 7 },
      { member: "LWB425352", first: "Tessa", last: "Heffernan", age: 6 },
      { member: "LWC429088", first: "Leah", last: "Kavanagh", age: 9, facility: "C" },
      { member: "LWC429089", first: "Billy", last: "Kavanagh", age: 7, facility: "C" },
      { member: "LWB432533", first: "Claudia", last: "Domlyn", age: 6 },
    ],
  },

  // ---- Dolphins (Main Pool, 12 a class) ----
  {
    code: "00008186", course: "Dolphins", level: "Dolphins", start: "15:10",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB75663", first: "Sophie", last: "Phelan", age: 8 },
      { member: "LWB91045", first: "Noah", last: "O'Sullivan", age: 7 },
      { member: "LWB93534", first: "Amy", last: "McAuliffe", age: 9 },
      { member: "LWB93535", first: "Ava", last: "McAuliffe", age: 8 },
      { member: "LWB93795", first: "Samuel", last: "Vinten", age: 8 },
      { member: "LWB95857", first: "Millie", last: "Ryan", age: 8 },
      { member: "LWB415281", first: "Isaac", last: "O'Connell", age: 8 },
      { member: "LWB421433", first: "Amber", last: "Bambrick", age: 8 },
      { member: "LWB423034", first: "Rory", last: "Sheehan", age: 9 },
      { member: "LWB427763", first: "James", last: "Keohane", age: 9 },
      { member: "LWB428489", first: "Alicia", last: "Busteed", age: 10 },
    ],
  },
  {
    code: "00008195", course: "Dolphins (A)", level: "Dolphins", start: "16:20",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB79478", first: "Conor", last: "Horan", age: 10 },
      { member: "LWB79479", first: "Will", last: "Horan", age: 8 },
      { member: "LWB93188", first: "Siún", last: "Power", age: 8 },
      { member: "LWB93189", first: "Aisling", last: "Power", age: 8 },
      { member: "LWB95857", first: "Millie", last: "Ryan", age: 8 },
      { member: "LWB98065", first: "Elly", last: "Pozza", age: 8 },
      { member: "LWB98975", first: "Seimi", last: "Murphy", age: 7 },
      { member: "LWB411690", first: "Conor", last: "Doyle", age: 7 },
      { member: "LWB418108", first: "Yoshita", last: "Alavala", age: 9 },
      { member: "LWB419506", first: "Jane", last: "Howard", age: 7 },
      { member: "LWB422246", first: "Ada", last: "Sheehan", age: 7 },
      { member: "LWB434796", first: "Kate", last: "O'Sullivan", age: 8 },
    ],
  },
  {
    code: "00008196", course: "Dolphins (B)", level: "Dolphins", start: "16:20",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWC51645", first: "Kingsley", last: "Naude", age: 7, facility: "C" },
      { member: "LWC52297", first: "Oscar", last: "Horan", age: 7, facility: "C" },
      { member: "LWB91184", first: "Cillian", last: "Lynch", age: 8 },
      { member: "LWB96140", first: "Aleksandra", last: "Grinyov", age: 8 },
      { member: "LWB98524", first: "Cathal", last: "Casey", age: 8 },
      { member: "LWB99709", first: "Don", last: "Keane", age: 7 },
      { member: "LWB410069", first: "Harry", last: "McCarthy", age: 8 },
      { member: "LWB418283", first: "Sophie", last: "Browne", age: 8 },
      { member: "LWB420826", first: "Charlotte", last: "Quilligan", age: 8 },
      { member: "LWB422995", first: "Lewis", last: "McNulty", age: 8 },
      { member: "LWB427132", first: "Lana", last: "Taylor", age: 9 },
      { member: "LWB427741", first: "James", last: "Murphy", age: 7 },
    ],
  },

  // ---- Sharks 1 (Main Pool, 12 a class) ----
  {
    code: "00008482", course: "Sharks 1", level: "Sharks 1", start: "16:55",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB70659", first: "Charlie", last: "Gallagher", age: 9 },
      { member: "LWC47697", first: "Aoibheann", last: "Dorgan", age: 10, facility: "C" },
      { member: "LWB80908", first: "Riona", last: "Hickey", age: 9 },
      { member: "LWB82075", first: "Sadhbh", last: "Lynch", age: 9 },
      { member: "LWB90310", first: "Barry", last: "Keane", age: 8 },
      { member: "LWB90819", first: "Tom", last: "Howard", age: 9 },
      { member: "LWB418375", first: "Phoebe", last: "Spillane", age: 9 },
      { member: "LWB427673", first: "Bobby", last: "Brennan", age: 8 },
      { member: "LWB428102", first: "Caitlin", last: "Crowley", age: 9 },
    ],
  },
  {
    code: "00008606", course: "Sharks 1", level: "Sharks 1", start: "17:30",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWC51635", first: "Caoimhe", last: "Fitzpatrick", age: 9, facility: "C" },
      { member: "LWB87673", first: "Isabella", last: "Kelleher", age: 11 },
      { member: "LWB428190", first: "Nicola", last: "Jasiowka", age: 10 },
      { member: "LWB429104", first: "Culann", last: "Murray", age: 10 },
    ],
  },

  // ---- Sharks 2 (Main Pool, 12 a class) ----
  {
    code: "00008200", course: "Sharks 2", level: "Sharks 2", start: "16:55",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB57612", first: "Abigal", last: "McGarry", age: 10 },
      { member: "LWB80443", first: "Allannah", last: "O'Sullivan", age: 8 },
      { member: "LWB98064", first: "Emilio", last: "Pozza", age: 9 },
      { member: "LWB411688", first: "Luke", last: "McCarthy", age: 9 },
      { member: "LWB419444", first: "Darragh", last: "Curtin", age: 10 },
      { member: "LWB419445", first: "Orla", last: "Curtin", age: 9 },
      { member: "LWB419447", first: "Una", last: "Curtain", age: 9 },
      { member: "LWB428390", first: "Nick", last: "Oldham", age: 9 },
    ],
  },

  // ---- Rookies, RLSS Lifesaving. See the note at the top of this file. ----
  {
    code: "00008234", course: "Rookies Bronze", level: "Rookies Bronze 1 - 3", start: "17:30",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB58880", first: "Andrea", last: "Chiribuca", age: 12 },
      { member: "LWC35541", first: "Zoey", last: "O'Connell", age: 11, facility: "C" },
      { member: "LWB63990", first: "Harry", last: "O'Connor", age: 9 },
      { member: "LWB66751", first: "Ella", last: "Wolowicz", age: 12 },
      { member: "LWB75662", first: "Katie Rose", last: "Phelan", age: 11 },
      { member: "LWB84163", first: "Saoirse", last: "McCarthy", age: 10 },
      { member: "LWB423076", first: "Clodagh Faye", last: "Desmond", age: 11 },
      { member: "LWB431297", first: "Annie", last: "Roche", age: 8 },
    ],
  },
  {
    code: "00008236", course: "Rookies Gold", level: "Rookies Gold 1 - 3", start: "17:30",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB40504", first: "Calida", last: "O Sullivan", age: 12 },
      { member: "LWB52373", first: "Charlie", last: "O'Mahony", age: 11 },
      { member: "LWB53952", first: "Josh", last: "Ginty", age: 12 },
      { member: "LWB55508", first: "Sophie", last: "O'Mahony", age: 10 },
      { member: "LWB56981", first: "Ben", last: "Ginty", age: 11 },
      { member: "LWB58272", first: "Anne", last: "Keane", age: 11 },
      { member: "LWB59519", first: "Zach", last: "Crowley", age: 10 },
      { member: "LWB61730", first: "Culann", last: "Murphy", age: 11 },
      { member: "LWB67425", first: "Max", last: "Nowak", age: 10 },
      { member: "LWC438516", first: "Annie", last: "Murray", age: 11, facility: "C" },
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
  const levelHome = await prisma.programme.findFirst({
    where: { name: LEVEL_HOME, clubId: FOUNDING_CLUB_ID },
    select: { id: true, name: true },
  });
  if (!levelHome) throw new Error(`No programme called "${LEVEL_HOME}".`);

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
    where: { programmeId: levelHome.id },
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
        programmeId: levelHome.id,
        name,
        description: "Imported from the club's Thursday timetable. No competencies recorded yet.",
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
      programmeId: levelHome.id,
      summary: `Added level ${name} to ${levelHome.name}, from the Thursday timetable`,
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
        data: { clubId: FOUNDING_CLUB_ID,
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
        summary: `Added ${courseLabel(course)} from the club's Thursday timetable (course ${roster.code}), capacity ${roster.capacity}`,
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
          data: { clubId: FOUNDING_CLUB_ID,
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
        summary: `Imported the Thursday roster for ${courseLabel(course)} — ${added.length} enrolled (${added.slice(0, 6).join(", ")}${added.length > 6 ? ` and ${added.length - 6} others` : ""})`,
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
