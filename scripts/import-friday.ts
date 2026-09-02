import "dotenv/config";
import { FOUNDING_CLUB_ID } from "@/lib/clubs/constants";
import { logAudit } from "@/lib/audit";
import { courseLabel } from "@/lib/courses/constants";
import { withCourseSeat } from "@/lib/enrolment/seat";
import { parseDateOnly, today } from "@/lib/format";
import { fullName } from "@/lib/students/constants";
import { prisma } from "@/lib/prisma";

/** The Friday timetable and rosters, from the PDF of the club's existing
 *  system (28 Aug 2026).
 *
 *  Unlike the Wednesday import this source was a PDF rendered at 200dpi rather
 *  than compressed screenshots, so the readings are markedly more reliable.
 *  It also states **Available** per class, which gives capacity outright —
 *  enrolled + available — rather than leaving it to be inferred. Every one of
 *  those sums agrees with the capacities already in the app.
 *
 *  Held to the app's rules, exactly as the Wednesday import was:
 *  - **Idempotent** — levels, courses and students all match before they
 *    create, so a second run changes nothing.
 *  - **Locked** — every enrolment goes through `withCourseSeat`, the one path
 *    the front desk uses, so capacity is enforced here as it is there.
 *  - **Audited** — one row per class naming who was added.
 *
 *  Two deliberate refusals:
 *
 *  1. **An existing member number whose name does not match is not enrolled.**
 *     A number that maps to a different child means one of the two readings is
 *     wrong, and putting the wrong swimmer on a poolside register is worse
 *     than leaving a gap. They are listed as CONFLICTS at the end.
 *  2. **An existing student is never renamed.** The upsert updates nothing, so
 *     a correction somebody made by hand survives a re-run. Where this source
 *     disagrees with what is stored, it is reported rather than applied.
 *
 *  Dates of birth are not imported, for the same reason as before: the source
 *  gives an age in whole years, and a birthday invented to fit would outlive
 *  the guess. The age at import goes in `notes`.
 *
 *  Not included here: the 18:05 **LeisureWorld Sharks** class (course 00007913,
 *  31 swimmers). Its own level name, €105 rather than €125, a capacity of 36
 *  and swimmers aged 10 to 17 all said it was a different discipline, and
 *  filing it under Water Safety & Fun would have been inventing a fact about
 *  the club's curriculum. The club has since placed it as the third level of
 *  **Swimming Skills**; `import-leisureworld-sharks.ts` carries it. */

const PROGRAMME = "Water Safety & Fun";
const DAY = "FRIDAY" as const;

/** Levels this source introduces. Created in Water Safety & Fun when this
 *  first ran; both have since moved to **Swimming Skills**, where the club
 *  says they belong. The guard below matches by name across every programme,
 *  so a re-run finds them there rather than making empty duplicates here. */
const NEW_LEVELS = ["Sharks 1", "Sharks 2"];

/** Transcribed exactly as the source has them, oddities included. Reported at
 *  the end so somebody can decide whether to tidy the club's own records —
 *  these are not misreadings. */
const ODD_IN_SOURCE = new Map([
  ["LWB419676", "ELIYAH AWAN — all capitals in the source"],
  ["LWB85600", "ADHI SANKAR MOOTHEDATH ANIL KUMAR — all capitals in the source"],
  ["LWB422986", "Pádraig coughlan — lowercase surname in the source"],
  ["LWB419670", "Darragh o'dwyer — lowercase surname in the source"],
  ["LWB419669", "Rachel o'dwyer — lowercase surname in the source"],
  ["LWB96985", "Lylah O sullivan — lowercase surname in the source"],
  ["LWB424027", "Ben O'keeffe — lowercase k in the source"],
  ["LWB82202", "Christopher Baker Dob — 'Dob' may be a truncated surname"],
  ["LWB423012", "Alastar Glynn — spelled without the second i in the source"],
]);

/** Readings I am least sure of even at this resolution. */
const UNCERTAIN = new Set([
  "LWB71851", // Aaruthra Boopathy
  "LWB93699", // Tomson Lijo Maniangattu
  "LWB425291", // Seon Manuel Dsouza
  "LWB428901", // Francis Gabryelczak-Florczak
  "LWB434397", // Andrea Zara Lynch Rubino
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
  {
    code: "00008202",
    course: "Starfish",
    level: "Starfish",
    start: "15:10",
    capacity: 8,
    location: LEARNER,
    enrollees: [
      { member: "LWD423628", first: "Líadh", last: "O Connor", age: 5, facility: "D" },
      { member: "LWB434547", first: "Owen", last: "Keane", age: 5 },
      { member: "LWB437083", first: "Flynn", last: "O'Hara", age: 5 },
      { member: "LWB438471", first: "Rowan", last: "Collins", age: 6 },
    ],
  },
  {
    code: "00008212",
    course: "Starfish",
    level: "Starfish",
    start: "16:20",
    capacity: 8,
    location: LEARNER,
    enrollees: [
      { member: "LWB92722", first: "Louis", last: "Landers", age: 5 },
      { member: "LWB419631", first: "Orlando", last: "Sanders", age: 7 },
      { member: "LWB424049", first: "Ibrahim", last: "Kamil", age: 6 },
      { member: "LWB430338", first: "Lily", last: "Kelleher", age: 5 },
      { member: "LWB430457", first: "Katie", last: "Good", age: 5 },
      { member: "LWB435562", first: "Alex", last: "Cronin", age: 5 },
      { member: "LWB437284", first: "Tommy", last: "Considine", age: 5 },
      { member: "LWB437614", first: "Kyllian", last: "Sutton", age: 5 },
    ],
  },
  {
    code: "00008217",
    course: "Starfish",
    level: "Starfish",
    start: "16:55",
    capacity: 8,
    location: LEARNER,
    enrollees: [
      { member: "LWB419404", first: "Kate", last: "Harrington", age: 7 },
      { member: "LWB423091", first: "Fionn", last: "De Burca", age: 8 },
      { member: "LWB424027", first: "Ben", last: "O'keeffe", age: 7 },
      { member: "LWB430552", first: "Patrick", last: "Whelan", age: 5 },
      { member: "LWB433399", first: "Willow", last: "De Burca", age: 6 },
      { member: "LWB435941", first: "Kit", last: "Finnegan", age: 5 },
    ],
  },
  {
    code: "00008222",
    course: "Starfish",
    level: "Starfish",
    start: "17:30",
    capacity: 8,
    location: LEARNER,
    enrollees: [
      { member: "LWB423262", first: "Grace", last: "Cotter", age: 6 },
      { member: "LWB424295", first: "Zunaira", last: "Azher", age: 6 },
      { member: "LWB431832", first: "Dylan", last: "O Halloran", age: 5 },
      { member: "LWB432011", first: "Molly", last: "Nagle", age: 5 },
      { member: "LWB434541", first: "Ada", last: "Pyne", age: 5 },
      { member: "LWB436203", first: "Leah", last: "Punch", age: 6 },
    ],
  },

  {
    code: "00008203",
    course: "Penguins",
    level: "Penguins",
    start: "15:10",
    capacity: 8,
    location: MAIN,
    enrollees: [
      { member: "LWB422219", first: "Emilia", last: "John", age: 7 },
      { member: "LWB422257", first: "Ruan", last: "Foran", age: 6 },
      { member: "LWB424766", first: "Thady", last: "Murphy", age: 6 },
      { member: "LWB427464", first: "Muhammad", last: "Tanweer", age: 7 },
      { member: "LWB427928", first: "AJ", last: "O Connor", age: 8 },
      { member: "LWB428217", first: "Noah", last: "Twomey", age: 5 },
      { member: "LWB430621", first: "Isla", last: "Lyons", age: 9 },
      { member: "LWB432156", first: "Doireann", last: "O'Callahan", age: 5 },
    ],
  },
  {
    code: "00008207",
    course: "Penguins (A)",
    level: "Penguins",
    start: "15:45",
    capacity: 8,
    location: MAIN,
    enrollees: [
      { member: "LWB419676", first: "ELIYAH", last: "AWAN", age: 6 },
      { member: "LWB422344", first: "Renee", last: "Arora", age: 6 },
      { member: "LWB429226", first: "Ben", last: "Meaney", age: 6 },
      { member: "LWB431882", first: "Adekanmi", last: "Idowu", age: 6 },
      { member: "LWB434448", first: "John", last: "Walsh", age: 8 },
      { member: "LWB435516", first: "Dara", last: "O leary", age: 6 },
    ],
  },
  {
    code: "00008208",
    course: "Penguins (B)",
    level: "Penguins",
    start: "15:45",
    capacity: 8,
    location: MAIN,
    enrollees: [
      { member: "LWB416132", first: "Doireann", last: "O'Shea", age: 7 },
      { member: "LWB419728", first: "Mehaan", last: "Gupta", age: 7 },
      { member: "LWB432319", first: "Caoimhe", last: "Brady", age: 5 },
      { member: "LWB434460", first: "Kai", last: "Cullinane", age: 5 },
    ],
  },
  {
    code: "00008609",
    course: "Penguins",
    level: "Penguins",
    start: "16:20",
    capacity: 8,
    location: LEARNER,
    enrollees: [
      { member: "LWB413875", first: "Dara", last: "Doyle", age: 7 },
      { member: "LWB419537", first: "Vedanshika", last: "Yarram", age: 6 },
      { member: "LWB419615", first: "Éabha", last: "Good", age: 6 },
      { member: "LWB422238", first: "Sarah", last: "Biju", age: 9 },
      { member: "LWB426145", first: "Oisín", last: "Geaney", age: 6 },
      { member: "LWB427420", first: "Hannah", last: "Buttimer", age: 6 },
      { member: "LWB428901", first: "Francis", last: "Gabryelczak-Florczak", age: 8 },
    ],
  },
  {
    code: "00008218",
    course: "Penguins",
    level: "Penguins",
    start: "16:55",
    capacity: 8,
    location: MAIN,
    enrollees: [
      { member: "LWB97880", first: "Tyler", last: "Denedo", age: 7 },
      { member: "LWB413663", first: "Diego", last: "Bertoli", age: 6 },
      { member: "LWB422244", first: "Amelia", last: "Lubraks", age: 6 },
      { member: "LWB422245", first: "Freya", last: "Lubraks", age: 6 },
      { member: "LWC423738", first: "Salah", last: "Muhammad", age: 6, facility: "C" },
      { member: "LWB430603", first: "Maximilian", last: "Kietschke", age: 5 },
      { member: "LWB432488", first: "Ailbhe", last: "Coleman", age: 8 },
      { member: "LWB434397", first: "Andrea Zara", last: "Lynch Rubino", age: 6 },
    ],
  },
  {
    code: "00008223",
    course: "Penguins",
    level: "Penguins",
    start: "17:30",
    capacity: 8,
    location: MAIN,
    enrollees: [
      { member: "LWB76839", first: "Finn", last: "Doheny", age: 5 },
      { member: "LWB412556", first: "Carly", last: "Moore", age: 6 },
      { member: "LWB419781", first: "Bobby", last: "Magan", age: 6 },
      { member: "LWB422205", first: "Victoria", last: "McWilliams", age: 7 },
      { member: "LWB425435", first: "Anna", last: "Farrell", age: 6 },
      { member: "LWB427130", first: "Robyn", last: "McManus Coughlan", age: 6 },
      { member: "LWB430751", first: "Ted", last: "Kenny", age: 6 },
      { member: "LWB434368", first: "Roisin", last: "O'Keeffe", age: 5 },
    ],
  },

  {
    code: "00008204",
    course: "Turtles",
    level: "Turtles",
    start: "15:10",
    capacity: 10,
    location: MAIN,
    enrollees: [
      { member: "LWB63862", first: "Anna Marie", last: "Murphy", age: 8 },
      { member: "LWC407923", first: "Chloe", last: "Lynch", age: 7, facility: "C" },
      { member: "LWB408184", first: "Luan", last: "Denton-Bradbury", age: 7 },
      { member: "LWB410012", first: "Aoibhín", last: "Murphy", age: 6 },
      { member: "LWC415850", first: "Liam", last: "McNally", age: 6, facility: "C" },
      { member: "LWB422986", first: "Pádraig", last: "coughlan", age: 7 },
      { member: "LWB423035", first: "Seán", last: "O'Donovan", age: 6 },
      { member: "LWD423627", first: "Caragh", last: "O Connor", age: 7, facility: "D" },
      { member: "LWB427868", first: "Harry", last: "O Connor", age: 5 },
    ],
  },
  {
    code: "00008209",
    course: "Turtles (A)",
    level: "Turtles",
    start: "15:45",
    capacity: 10,
    location: MAIN,
    enrollees: [
      { member: "LWB96985", first: "Lylah", last: "O sullivan", age: 6 },
      { member: "LWB411674", first: "Ella", last: "Ahearne", age: 7 },
      { member: "LWB423011", first: "David", last: "Glynn", age: 8 },
      { member: "LWB423012", first: "Alastar", last: "Glynn", age: 6 },
      { member: "LWB425842", first: "Grace", last: "Twomey", age: 7 },
      { member: "LWB426525", first: "Ryleigh", last: "Coombs", age: 8 },
      { member: "LWB428000", first: "Julie", last: "McLean", age: 8 },
      { member: "LWB428713", first: "Ronan", last: "OKeeffe", age: 8 },
      { member: "LWB428920", first: "Aalia", last: "Asad", age: 8 },
      { member: "LWB433640", first: "Emma", last: "Sheehan", age: 7 },
    ],
  },
  {
    code: "00008210",
    course: "Turtles (B)",
    level: "Turtles",
    start: "15:45",
    capacity: 10,
    location: MAIN,
    enrollees: [
      { member: "LWB95711", first: "Cathal", last: "Harrington", age: 7 },
      { member: "LWB96156", first: "Lily", last: "Blyth", age: 9 },
      { member: "LWB98182", first: "Muireann", last: "McSweeney", age: 6 },
      { member: "LWB99614", first: "Cillian", last: "Dunne", age: 8 },
      { member: "LWB413664", first: "Sophia", last: "Bertoli", age: 6 },
      { member: "LWB423041", first: "Shauna", last: "Hurley", age: 7 },
      { member: "LWB423093", first: "Eabha", last: "O'Connell", age: 7 },
      { member: "LWB423105", first: "Donnacha", last: "O'Hara", age: 8 },
      { member: "LWB425291", first: "Seon Manuel", last: "Dsouza", age: 8 },
      { member: "LWB427682", first: "Brianna", last: "Salame", age: 7 },
    ],
  },
  {
    code: "00008214",
    course: "Turtles",
    level: "Turtles",
    start: "16:20",
    capacity: 10,
    location: MAIN,
    enrollees: [
      { member: "LWB77212", first: "Stephanie", last: "Considine", age: 8 },
      { member: "LWB84434", first: "Jack", last: "McCarthy", age: 7 },
      { member: "LWC58513", first: "Nicolas", last: "Coffey", age: 8, facility: "C" },
      { member: "LWB99207", first: "Rebecca", last: "Bambury", age: 7 },
      { member: "LWB419670", first: "Darragh", last: "o'dwyer", age: 6 },
      { member: "LWB420870", first: "Conor", last: "Trunwit", age: 7 },
      { member: "LWB422214", first: "Charlie", last: "O'Connor", age: 7 },
      { member: "LWB424232", first: "Roisin", last: "Wood", age: 8 },
      { member: "LWB425279", first: "Ailis", last: "Collins", age: 6 },
      { member: "LWB425281", first: "Aine M", last: "Collins", age: 7 },
    ],
  },
  {
    code: "00008219",
    course: "Turtles",
    level: "Turtles",
    start: "16:55",
    capacity: 10,
    location: MAIN,
    enrollees: [
      { member: "LWB82629", first: "Daithi", last: "O Conchuir", age: 8 },
      { member: "LWB91431", first: "Tom", last: "Lynch", age: 8 },
      { member: "LWB99834", first: "Aimal Adeel", last: "Arfi", age: 9 },
      { member: "LWD410278", first: "Rudransh", last: "Hampalle", age: 10, facility: "D" },
      { member: "LWB411551", first: "Jake", last: "Broderick", age: 6 },
      { member: "LWB418293", first: "Olivia", last: "O'Regan", age: 7 },
      { member: "LWB420276", first: "Maya", last: "Horan", age: 7 },
      { member: "LWB422191", first: "Sara", last: "Buckley", age: 7 },
    ],
  },

  {
    code: "00008206",
    course: "Dolphins",
    level: "Dolphins",
    start: "15:10",
    capacity: 12,
    location: MAIN,
    enrollees: [
      { member: "LWB85600", first: "ADHI SANKAR", last: "MOOTHEDATH ANIL KUMAR", age: 10 },
      { member: "LWC56852", first: "Ellie", last: "Lynch", age: 9, facility: "C" },
      { member: "LWB93285", first: "Darragh", last: "Murphy", age: 9 },
      { member: "LWB94709", first: "Hannah", last: "Ali", age: 8 },
      { member: "LWB95653", first: "Isabella", last: "Giglione", age: 8 },
      { member: "LWB95869", first: "Fiachra", last: "Coughlan", age: 9 },
      { member: "LWB419721", first: "Anna", last: "Jang", age: 9 },
      { member: "LWB423160", first: "Hugh", last: "Taaffe", age: 9 },
      { member: "LWB427504", first: "Maria Grazia", last: "Angioletti", age: 10 },
      { member: "LWB427715", first: "Donagh", last: "O'Callahan", age: 7 },
      { member: "LWB427867", first: "Hayley", last: "O Connor", age: 8 },
      { member: "LWB438470", first: "James", last: "Collins", age: 9 },
    ],
  },
  {
    code: "00008211",
    course: "Dolphins",
    level: "Dolphins",
    start: "15:45",
    capacity: 12,
    location: MAIN,
    enrollees: [
      { member: "LWB78650", first: "Liadh", last: "McHugh", age: 8 },
      { member: "LWC52706", first: "Tessie", last: "Dwane", age: 11, facility: "C" },
      { member: "LWB87162", first: "Sophie", last: "Mills", age: 8 },
      { member: "LWB90394", first: "Yatharth", last: "Singh", age: 10 },
      { member: "LWB91087", first: "Finbarr", last: "Ahearne", age: 8 },
      { member: "LWC58530", first: "Paddy", last: "O'Sullivan", age: 8, facility: "C" },
      { member: "LWB93443", first: "Laoise", last: "Ni Chathain", age: 11 },
      { member: "LWB95281", first: "Lauren", last: "Harrington", age: 9 },
      { member: "LWB98637", first: "Aarohi", last: "Kale", age: 8 },
      { member: "LWB420303", first: "Emily Anna", last: "Humphreys", age: 8 },
      { member: "LWB425308", first: "Maura", last: "Gleeson", age: 9 },
      { member: "LWB430140", first: "Ellen", last: "Mclean", age: 9 },
    ],
  },
  {
    code: "00008215",
    course: "Dolphins",
    level: "Dolphins",
    start: "16:20",
    capacity: 12,
    location: MAIN,
    enrollees: [
      { member: "LWB77159", first: "Fiadh", last: "Kinsella", age: 8 },
      { member: "LWC57793", first: "Emma Hazel", last: "Appolonia", age: 8, facility: "C" },
      { member: "LWC58511", first: "Isabelle", last: "Coffey", age: 10, facility: "C" },
      { member: "LWB93701", first: "Tania Elizabeth", last: "Lijo", age: 8 },
      { member: "LWB407336", first: "Hannah", last: "Cremin", age: 8 },
      { member: "LWB413874", first: "Lily", last: "Doyle", age: 7 },
      { member: "LWB420304", first: "Conor", last: "Blewitt", age: 7 },
      { member: "LWB420869", first: "Donagh", last: "Trunwit", age: 9 },
      { member: "LWB421723", first: "Nick", last: "Sherlock", age: 11 },
      { member: "LWB425474", first: "Eve", last: "Cremin", age: 8 },
      { member: "LWB428536", first: "Lily", last: "Cronin", age: 8 },
      { member: "LWB437282", first: "Eric", last: "Considine", age: 10 },
    ],
  },
  {
    code: "00008220",
    course: "Dolphins (A)",
    level: "Dolphins",
    start: "16:55",
    capacity: 12,
    location: MAIN,
    enrollees: [
      { member: "LWB71851", first: "Aaruthra", last: "Boopathy", age: 8 },
      { member: "LWB96090", first: "Lauren", last: "Cadogan", age: 7 },
      { member: "LWC407495", first: "Amy", last: "Long", age: 6, facility: "C" },
      { member: "LWB411593", first: "Olivia", last: "Carthy", age: 9 },
      { member: "LWB419403", first: "Meabh", last: "Harrington", age: 10 },
      { member: "LWB419635", first: "Jake", last: "McCarthy", age: 7 },
      { member: "LWB419655", first: "Sofia", last: "O'Shea", age: 7 },
      { member: "LWB422757", first: "Viren", last: "Jaybhaye", age: 12 },
      { member: "LWB422983", first: "Laura", last: "Fitzgerald", age: 7 },
      { member: "LWB425328", first: "Eve", last: "O'Neill", age: 9 },
      { member: "LWB427757", first: "Harry", last: "Kelly", age: 7 },
    ],
  },
  {
    code: "00008221",
    course: "Dolphins (B)",
    level: "Dolphins",
    start: "16:55",
    capacity: 12,
    location: MAIN,
    enrollees: [
      { member: "LWB90084", first: "Ava", last: "Curtin", age: 9 },
      { member: "LWB90973", first: "Grace", last: "Stewart", age: 7 },
      { member: "LWB94771", first: "Fiadh", last: "Mcgrath", age: 6 },
      { member: "LWB97391", first: "Oisin", last: "O'Regan", age: 8 },
      { member: "LWB407483", first: "Oisin", last: "Harrington", age: 8 },
      { member: "LWB407484", first: "Saoirse", last: "Harrington", age: 9 },
      { member: "LWB410059", first: "Alexander", last: "Donovan", age: 7 },
      { member: "LWB419632", first: "Luke", last: "McCarthy", age: 9 },
      { member: "LWC423737", first: "Muhammad", last: "Abubakr", age: 8, facility: "C" },
      { member: "LWB427871", first: "Lucy", last: "Rochford", age: 9 },
    ],
  },

  {
    code: "00008608",
    course: "Sharks 1",
    level: "Sharks 1",
    start: "15:10",
    capacity: 12,
    location: MAIN,
    enrollees: [
      { member: "LWB82202", first: "Christopher", last: "Baker Dob", age: 12 },
      { member: "LWC57463", first: "Molly", last: "Hanevy", age: 8, facility: "C" },
      { member: "LWB92525", first: "Nur Fatima", last: "Tanweer", age: 9 },
      { member: "LWB92526", first: "Muhammad Hasan", last: "Tanweer", age: 10 },
      { member: "LWB92844", first: "Luke", last: "Giglione", age: 9 },
      { member: "LWB93423", first: "Ellie", last: "O'Donovan", age: 8 },
      { member: "LWB419465", first: "Rachel", last: "Stewart", age: 9 },
      { member: "LWB419466", first: "Ethan", last: "Stewart", age: 9 },
      { member: "LWB419722", first: "Ella", last: "Jang", age: 9 },
      { member: "LWB432014", first: "Darragh", last: "O'Donovan", age: 8 },
    ],
  },
  {
    code: "00008519",
    course: "Sharks 1",
    level: "Sharks 1",
    start: "16:20",
    capacity: 12,
    location: MAIN,
    enrollees: [
      { member: "LWB63138", first: "Ben", last: "Mills", age: 11 },
      { member: "LWB81658", first: "Brendan", last: "O'Brádaigh", age: 8 },
      { member: "LWB86647", first: "Odhran", last: "McSweeney", age: 9 },
      { member: "LWB86926", first: "Jocelyn", last: "Landers", age: 9 },
      { member: "LWB90090", first: "Cathal", last: "Buttimer", age: 9 },
      { member: "LWB93699", first: "Tomson Lijo", last: "Maniangattu", age: 11 },
      { member: "LWB407172", first: "Darragh", last: "Brady", age: 9 },
      { member: "LWB419669", first: "Rachel", last: "o'dwyer", age: 10 },
      { member: "LWB423915", first: "Daniel", last: "Blewitt", age: 9 },
      { member: "LWB427756", first: "Charlie", last: "Kelly", age: 9 },
      { member: "LWB432528", first: "Leo", last: "Sherlock", age: 10 },
      { member: "LWB433335", first: "Liam", last: "O'Sullivan", age: 8 },
    ],
  },
  {
    code: "00008224",
    course: "Sharks 1 (A)",
    level: "Sharks 1",
    start: "17:30",
    capacity: 12,
    location: MAIN,
    enrollees: [
      { member: "LWB86211", first: "Ethan", last: "Wycherley", age: 12 },
      { member: "LWB86612", first: "Charlotte", last: "Lubraks", age: 9 },
      { member: "LWB87208", first: "Oisin", last: "Newman", age: 8 },
      { member: "LWB94611", first: "Fionn", last: "Buckley", age: 10 },
      { member: "LWB97392", first: "Charlie", last: "O'Callaghan", age: 9 },
      { member: "LWB99360", first: "Alexandra", last: "Walsh-McLoughlin", age: 9 },
      { member: "LWB413271", first: "Katie", last: "O Halloran", age: 11 },
      { member: "LWC427685", first: "Daisy", last: "Sexton", age: 11, facility: "C" },
    ],
  },
  {
    code: "00008225",
    course: "Sharks 1 (B)",
    level: "Sharks 1",
    start: "17:30",
    capacity: 12,
    location: MAIN,
    enrollees: [
      { member: "LWB82693", first: "Alice", last: "McSweeney", age: 11 },
      { member: "LWB83474", first: "Ellie", last: "Farrell", age: 9 },
      { member: "LWB84185", first: "Ritheshaa", last: "Sharath Kumar", age: 10 },
      { member: "LWB84186", first: "Rithvekaa", last: "Sharath Kumar", age: 10 },
      { member: "LWB91052", first: "Callum", last: "Durkan", age: 9 },
      { member: "LWB93853", first: "Mazen", last: "Elgazzar", age: 9 },
      { member: "LWB411677", first: "Isabella", last: "Lynch", age: 9 },
    ],
  },
  {
    code: "00008226",
    course: "Sharks 2",
    level: "Sharks 2",
    start: "17:30",
    capacity: 12,
    location: MAIN,
    enrollees: [
      { member: "LWB54548", first: "Laoise", last: "Ni Chonchuir", age: 12 },
      { member: "LWB59795", first: "Ollie", last: "Magan", age: 10 },
      { member: "LWB60216", first: "Nollaig", last: "Ni Chonchuir", age: 10 },
      { member: "LWB62972", first: "Jack", last: "Taylor", age: 12 },
      { member: "LWC38576", first: "Zach", last: "Hurley", age: 11, facility: "C" },
      { member: "LWC43329", first: "Sophie", last: "Kelleher", age: 9, facility: "C" },
      { member: "LWB71737", first: "Daniel", last: "O'Donovan", age: 11 },
      { member: "LWC52137", first: "Harriet", last: "O'Brien", age: 9, facility: "C" },
      { member: "LWB91051", first: "Katie", last: "Durkan", age: 9 },
      { member: "LWB427722", first: "Ellie", last: "O' Riordan", age: 9 },
      { member: "LWB428904", first: "Emma", last: "Power", age: 10 },
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
 *  "Julie McLean" and "Jimmy McCarthy" are not. */
function normalise(first: string, last: string): string {
  return `${first} ${last}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z]/g, "");
}

async function main() {
  const programme = await prisma.programme.findFirst({
    where: { name: PROGRAMME, clubId: FOUNDING_CLUB_ID },
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

  // ---- Levels. Appended after the four already there, in swimming order. ----

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
        description: "Imported from the club's timetable. No competencies recorded yet.",
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
      summary: `Added level ${name} to ${programme.name}, from the Friday timetable`,
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

  // ---- Courses, then rosters. ----

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
        summary: `Added ${courseLabel(course)} from the club's Friday timetable (course ${roster.code}), capacity ${roster.capacity}`,
      });
    }

    const added: string[] = [];

    for (const e of roster.enrollees) {
      const existing = await prisma.student.findUnique({
        where: { memberNumber: e.member },
        select: { id: true, firstName: true, lastName: true },
      });

      let studentId: string;
      let name: string;

      if (existing) {
        // A number that maps to a different child means one of the two
        // readings is wrong. Refuse rather than put the wrong swimmer on a
        // register.
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
        summary: `Imported the Friday roster for ${courseLabel(course)} — ${added.length} enrolled (${added.slice(0, 6).join(", ")}${added.length > 6 ? ` and ${added.length - 6} others` : ""})`,
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
