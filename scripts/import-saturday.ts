import "dotenv/config";
import { FOUNDING_CLUB_ID } from "@/lib/clubs/constants";
import { logAudit } from "@/lib/audit";
import { courseLabel } from "@/lib/courses/constants";
import { withCourseSeat } from "@/lib/enrolment/seat";
import { parseDateOnly, today } from "@/lib/format";
import { fullName } from "@/lib/students/constants";
import { prisma } from "@/lib/prisma";

/** The Saturday timetable and rosters, from the PDF of the club's existing
 *  system (29 Aug 2026). Same method and same rules as the Friday import:
 *  pages rendered at 200dpi, capacity taken from the class card's own
 *  **Available** count rather than inferred, and every enrolment through
 *  `withCourseSeat`.
 *
 *  Idempotent, locked, audited. Two refusals carried over from Friday, both
 *  deliberate: an existing member number whose name does not match is not
 *  enrolled, and an existing student is never renamed.
 *
 *  One capacity here does not follow its level. **Penguins 12:50 holds nine**
 *  and shows "Only Waiting List", so its capacity is recorded as 9 rather than
 *  the 8 every other Penguins class carries. Capacity is read from each class,
 *  not from its level — an over-subscribed class is a fact about that class,
 *  and forcing it to 8 would have made the import reject a child who is really
 *  in the water.
 *
 *  Not imported, because neither belongs to this programme and naming one for
 *  them would be inventing a fact about the club:
 *
 *  - **Teen Fitness Academy**, two classes (Boys 15:00 with 8 enrolled, Girls
 *    14:00 empty). Level "Teen Fitness Academy Level 1", in Health & Fitness
 *    rather than the pool, taught by a Group Exercise Instructor, EUR130.
 *  - **Swim School Pre-Assessments**, nine one-off sessions on 29 Aug and each
 *    Saturday to 24 Oct at 13:30, EUR0, 77 children between them. These are
 *    single dated events, not a weekly class. `Course` here is weekly by
 *    design — it carries a weekday and a time and no dates — so importing
 *    these as courses would put a repeating Saturday 13:30 class in the
 *    timetable forever. That is the class-sessions seam DESIGN.md defers, and
 *    it should be opened deliberately rather than by accident. */

const PROGRAMME = "Water Safety & Fun";
const DAY = "SATURDAY" as const;

/** Transcribed exactly as the source has them. Not misreadings — oddities in
 *  the club's own records, reported so somebody can decide whether to tidy. */
const ODD_IN_SOURCE = new Map([
  ["LWB436989", "Partish DEV — surname in capitals"],
  ["LWD437354", "Agastya's Singh — apostrophe inside the first name"],
  ["LWB427358", "Leo Fitzgibbon rice — lowercase surname"],
  ["LWD428414", "Sonny SPILLANE — surname in capitals"],
  ["LWB430718", "HARRY Jacob — first name in capitals"],
  ["LWB419637", "Ethan HU — surname in capitals"],
  ["LWD418347", "afan afridi mohammed — all lowercase"],
  ["LWB81698", "david Plaice — lowercase first name"],
  ["LWB427466", "Finn GALVIN — surname in capitals"],
  ["LWB423720", "Maaidah Fatima ahmed — lowercase surname"],
  ["LWB414097", "SHAURYA KULKARNI — all capitals"],
  ["LWC64144", "Gracie O sullivan — lowercase surname"],
  ["LWB425135", "Ava O'Conner — spelled -er, where -or is the usual"],
]);

/** Readings I am least sure of even at this resolution. */
const UNCERTAIN = new Set([
  "LWB412424", // Kinsco McNamara
  "LWB434657", // Varnika Chandran
  "LWB435800", // Felix Hayler Lange
  "LWB436244", // Leia Sofia Sabou
  "LWB424230", // Nandanasree Arun Prakash
  "LWB99260", // Thaswika Allenki
  "LWB93621", // Dominic Joseph Csatho
  "LWB91106", // Yukti Bhavanibhatla
  "LWB407806", // Aanya Patnaik
  "LWB62218", // Jason Danylyuk
  "LWB92590", // Rose Massalve
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
    code: "00008227", course: "Starfish", level: "Starfish", start: "09:00",
    capacity: 8, location: LEARNER,
    enrollees: [
      { member: "LWB98264", first: "Laoise", last: "Griffin", age: 5 },
      { member: "LWC423026", first: "Doireann", last: "Mullan", age: 7, facility: "C" },
      { member: "LWB436235", first: "Jasmine", last: "Anufionwu", age: 7 },
      { member: "LWB436236", first: "Isabella", last: "Anufionwu", age: 5 },
      { member: "LWB437017", first: "Kiara", last: "Lohana", age: 6 },
    ],
  },
  {
    code: "00008247", course: "Starfish", level: "Starfish", start: "09:35",
    capacity: 8, location: LEARNER,
    enrollees: [
      { member: "LWC429713", first: "Sam", last: "Mccabe", age: 6, facility: "C" },
      { member: "LWB430149", first: "Ania", last: "Danter", age: 5 },
      { member: "LWB431068", first: "Isaac", last: "Hayes", age: 5 },
      { member: "LWB431474", first: "Mick", last: "Keohane", age: 5 },
      { member: "LWB433364", first: "Ben", last: "Moloney", age: 5 },
      { member: "LWB437346", first: "Fleur", last: "Horgan", age: 5 },
      { member: "LWD437354", first: "Agastya's", last: "Singh", age: 5, facility: "D" },
      { member: "LWB438400", first: "Alan", last: "Nag", age: 7 },
    ],
  },
  {
    code: "00008248", course: "Starfish", level: "Starfish", start: "10:10",
    capacity: 8, location: LEARNER,
    enrollees: [
      { member: "LWB431676", first: "Ben", last: "Nyhan", age: 6 },
      { member: "LWB434459", first: "Hazel", last: "Galvin", age: 5 },
      { member: "LWB434657", first: "Varnika", last: "Chandran", age: 6 },
      { member: "LWB435594", first: "Mila", last: "Michaut", age: 5 },
      { member: "LWB435800", first: "Felix", last: "Hayler Lange", age: 5 },
      { member: "LWC435988", first: "Afnan", last: "Afridi", age: 5, facility: "C" },
      { member: "LWB436244", first: "Leia Sofia", last: "Sabou", age: 5 },
      { member: "LWB436989", first: "Partish", last: "DEV", age: 5 },
    ],
  },
  {
    code: "00008249", course: "Starfish", level: "Starfish", start: "10:45",
    capacity: 8, location: LEARNER,
    enrollees: [
      { member: "LWB89747", first: "Rosie", last: "Behan", age: 5 },
      { member: "LWB430913", first: "Sophie", last: "Groeger-Tan", age: 5 },
      { member: "LWB432108", first: "Reilly", last: "Murphy", age: 5 },
      { member: "LWB434398", first: "Ellie", last: "O'Connor", age: 5 },
      { member: "LWB435666", first: "Elias Mathew", last: "Gilson", age: 7 },
      { member: "LWB435695", first: "Izahaak Joseph", last: "Gilson", age: 5 },
      { member: "LWB436234", first: "Billy", last: "Horgan", age: 5 },
      { member: "LWB437411", first: "Roman", last: "Johnston", age: 5 },
    ],
  },
  {
    code: "00008250", course: "Starfish", level: "Starfish", start: "11:20",
    capacity: 8, location: LEARNER,
    enrollees: [
      { member: "LWB423097", first: "Alizeh", last: "Maryam", age: 6 },
      { member: "LWB423103", first: "Louise", last: "Massalve", age: 6 },
      { member: "LWB426262", first: "Jumari", last: "Quiton", age: 6 },
      { member: "LWB428371", first: "Tommy", last: "Ryan", age: 7 },
      { member: "LWB429268", first: "Emmie", last: "Nunan", age: 5 },
      { member: "LWB430614", first: "Lily", last: "Forde", age: 5 },
      { member: "LWB432081", first: "Aoibhinn", last: "Murphy", age: 5 },
      { member: "LWB434365", first: "Jack", last: "Newman", age: 5 },
    ],
  },
  {
    code: "00008251", course: "Starfish", level: "Starfish", start: "12:15",
    capacity: 8, location: LEARNER,
    enrollees: [
      { member: "LWC63851", first: "Faye", last: "McNamara", age: 7, facility: "C" },
      { member: "LWB429109", first: "Omar", last: "Morsy", age: 6 },
      { member: "LWB432427", first: "James", last: "Gill", age: 6 },
      { member: "LWB433442", first: "Erin", last: "Finn", age: 7 },
      { member: "LWB434395", first: "Tess", last: "Murphy", age: 5 },
      { member: "LWB434801", first: "Dougie", last: "Herbert", age: 5 },
      { member: "LWB435071", first: "Cian", last: "Finn", age: 6 },
      { member: "LWB435662", first: "Cecil", last: "Boby", age: 7 },
    ],
  },
  {
    code: "00008252", course: "Starfish", level: "Starfish", start: "12:50",
    capacity: 8, location: LEARNER,
    enrollees: [
      { member: "LWB419395", first: "Ismail", last: "Kazi", age: 7 },
      { member: "LWB422210", first: "Victoria", last: "Yarochkin", age: 6 },
      { member: "LWB422218", first: "Yulianna", last: "Yarochkin", age: 5 },
      { member: "LWB432438", first: "Clodagh", last: "Lucey", age: 5 },
      { member: "LWB434430", first: "Jack", last: "O'Leary", age: 6 },
      { member: "LWB436485", first: "Christopher", last: "Cafferky", age: 7 },
      { member: "LWB436991", first: "Leah", last: "Fehily", age: 5 },
    ],
  },

  // ---- Penguins ----
  {
    code: "00008237", course: "Penguins", level: "Penguins", start: "09:00",
    capacity: 8, location: MAIN,
    enrollees: [
      { member: "LWB81555", first: "Amir", last: "Cosgrove", age: 5 },
      { member: "LWB410624", first: "Maia", last: "Cionca", age: 6 },
      { member: "LWB419680", first: "Aiden", last: "Vino", age: 8 },
      { member: "LWB423022", first: "Micheal", last: "Mullan", age: 7 },
      { member: "LWB426078", first: "Mariam", last: "Yasin", age: 7 },
      { member: "LWB430718", first: "HARRY", last: "Jacob", age: 5 },
      { member: "LWB431047", first: "Joshua", last: "Last", age: 6 },
      { member: "LWB437274", first: "Kate", last: "O'Sullivan", age: 6 },
    ],
  },
  {
    code: "00008253", course: "Penguins", level: "Penguins", start: "09:35",
    capacity: 8, location: MAIN,
    enrollees: [
      { member: "LWB93949", first: "Noah", last: "Mccabe", age: 8 },
      { member: "LWB418321", first: "Mehak", last: "Haroon", age: 6 },
      { member: "LWB419609", first: "Charlie", last: "Conway", age: 7 },
      { member: "LWB423471", first: "Tristan", last: "Hayes", age: 8 },
      { member: "LWB427506", first: "Victor", last: "Wielgopolan", age: 7 },
      { member: "LWB427953", first: "Harshith", last: "Manikandan", age: 7 },
      { member: "LWB432483", first: "Caragh", last: "Healy", age: 5 },
      { member: "LWB432660", first: "Emma", last: "Murphy", age: 5 },
    ],
  },
  {
    code: "00008254", course: "Penguins", level: "Penguins", start: "10:10",
    capacity: 8, location: MAIN,
    enrollees: [
      { member: "LWB90299", first: "Eyad", last: "Cosgrove", age: 8 },
      { member: "LWB97602", first: "Pádraig", last: "Lynch", age: 5 },
      { member: "LWB98313", first: "Aadhya", last: "Akula", age: 7 },
      { member: "LWB419724", first: "Pranika", last: "Panthi", age: 6 },
      { member: "LWB420297", first: "Grace", last: "Carey", age: 6 },
      { member: "LWD421490", first: "Drishya", last: "Gaykar", age: 8, facility: "D" },
      { member: "LWC428858", first: "Hannah", last: "Goggin", age: 5, facility: "C" },
      { member: "LWB430545", first: "Billy", last: "Scannell", age: 5 },
    ],
  },
  {
    code: "00008255", course: "Penguins", level: "Penguins", start: "10:45",
    capacity: 8, location: MAIN,
    enrollees: [
      { member: "LWB418124", first: "Jaswika Sai", last: "Kinnera", age: 7 },
      { member: "LWB427199", first: "Khadijah", last: "Ahmed", age: 6 },
      { member: "LWB427358", first: "Leo", last: "Fitzgibbon rice", age: 6 },
      { member: "LWB431500", first: "Ben", last: "Rochford", age: 5 },
      { member: "LWB432013", first: "Mohammad Abdur Razzaq", last: "Khurram", age: 6 },
      { member: "LWB432041", first: "Jayden", last: "Connell", age: 6 },
      { member: "LWB436216", first: "Nitya", last: "Jain", age: 6 },
    ],
  },
  {
    code: "00008256", course: "Penguins", level: "Penguins", start: "11:20",
    capacity: 8, location: MAIN,
    enrollees: [
      { member: "LWB98973", first: "Ellie", last: "Young", age: 6 },
      { member: "LWB416212", first: "Amelia", last: "Kiely", age: 6 },
      { member: "LWB419407", first: "Rían", last: "Moloney", age: 8 },
      { member: "LWB422827", first: "Daniel", last: "Theckaneth", age: 7 },
      { member: "LWB426704", first: "Adam", last: "McSweeney", age: 7 },
      { member: "LWD428414", first: "Sonny", last: "SPILLANE", age: 7, facility: "D" },
      { member: "LWB428606", first: "Wamukelwe", last: "Masuku", age: 7 },
      { member: "LWB430615", first: "Úna", last: "Kyte", age: 5 },
    ],
  },
  {
    code: "00008257", course: "Penguins", level: "Penguins", start: "12:15",
    capacity: 8, location: MAIN,
    enrollees: [
      { member: "LWB55933", first: "Cillian", last: "Flaherty", age: 8 },
      { member: "LWB407747", first: "Nivaan", last: "Jorlin", age: 7 },
      { member: "LWD410826", first: "Dev", last: "Naidu", age: 6, facility: "D" },
      { member: "LWB425575", first: "Emily Rose", last: "O Sullivan", age: 6 },
      { member: "LWC427922", first: "Olivia", last: "O'Sullivan", age: 6, facility: "C" },
      { member: "LWB432511", first: "Aariket", last: "Saini", age: 5 },
      { member: "LWB433148", first: "Caoimhe", last: "O'Callaghan", age: 6 },
    ],
  },
  {
    // Nine enrolled and no free space: capacity 9, not the 8 its level carries.
    code: "00008258", course: "Penguins", level: "Penguins", start: "12:50",
    capacity: 9, location: MAIN,
    enrollees: [
      { member: "LWB84749", first: "Isabel", last: "Scott", age: 8 },
      { member: "LWB84750", first: "Zoe", last: "Scott", age: 8 },
      { member: "LWC56955", first: "Paige", last: "Murphy", age: 6, facility: "C" },
      { member: "LWC64144", first: "Gracie", last: "O sullivan", age: 7, facility: "C" },
      { member: "LWB418307", first: "Ben", last: "Wade", age: 5 },
      { member: "LWB423805", first: "Tadhg", last: "Durham", age: 6 },
      { member: "LWB427094", first: "James", last: "Collins", age: 6 },
      { member: "LWB430608", first: "Khang", last: "Le", age: 7 },
      { member: "LWB431482", first: "Darragh", last: "O Callaghan", age: 6 },
    ],
  },

  // ---- Turtles ----
  {
    code: "00008238", course: "Turtles", level: "Turtles", start: "09:00",
    capacity: 10, location: MAIN,
    enrollees: [
      { member: "LWB69150", first: "Alannah", last: "O'Brien", age: 7 },
      { member: "LWC60100", first: "Anna", last: "Murphy", age: 6, facility: "C" },
      { member: "LWB98263", first: "Cormac", last: "Griffin", age: 6 },
      { member: "LWB99497", first: "Wyatt", last: "O'Regan", age: 7 },
      { member: "LWB419500", first: "Isaac", last: "Gaya", age: 7 },
      { member: "LWB419637", first: "Ethan", last: "HU", age: 7 },
      { member: "LWB420267", first: "Fiadh", last: "Ahern", age: 7 },
      { member: "LWB420308", first: "Alex", last: "Mullane", age: 7 },
    ],
  },
  {
    code: "00008259", course: "Turtles", level: "Turtles", start: "09:35",
    capacity: 10, location: MAIN,
    enrollees: [
      { member: "LWB90971", first: "Lily", last: "Keohane", age: 7 },
      { member: "LWC416583", first: "Parikshith", last: "Ramprabhu", age: 8 },
      { member: "LWB424469", first: "Penelope", last: "Wilson", age: 7 },
      { member: "LWB425312", first: "Ted", last: "Ferriter", age: 6 },
      { member: "LWB427434", first: "Eve", last: "O'Mahony", age: 8 },
      { member: "LWB427442", first: "Alice Jane", last: "McKenzie", age: 6 },
      { member: "LWB427951", first: "Hanshith", last: "Manikandan", age: 9 },
      { member: "LWC428538", first: "Agnes", last: "Bodin Carey", age: 6, facility: "C" },
    ],
  },
  {
    code: "00008260", course: "Turtles", level: "Turtles", start: "10:10",
    capacity: 10, location: MAIN,
    enrollees: [
      { member: "LWB93600", first: "Lewis", last: "Murphy", age: 8 },
      { member: "LWB96335", first: "Evie", last: "Austin", age: 8 },
      { member: "LWB97241", first: "Gabriella", last: "O'Dowling", age: 8 },
      { member: "LWB413717", first: "Hannah", last: "Kiely", age: 6 },
      { member: "LWB419394", first: "Oliver", last: "Nagle", age: 7 },
      { member: "LWB422988", first: "Kostas", last: "Vasileiou", age: 8 },
      { member: "LWB427190", first: "Deema", last: "Hamed", age: 7 },
      { member: "LWC428857", first: "Matthew", last: "Goggin", age: 7, facility: "C" },
    ],
  },
  {
    code: "00008261", course: "Turtles", level: "Turtles", start: "10:45",
    capacity: 10, location: MAIN,
    enrollees: [
      { member: "LWB81136", first: "Aadhya", last: "Sripada", age: 7 },
      { member: "LWB85608", first: "Sakinah", last: "Ahmed", age: 8 },
      { member: "LWB93030", first: "Niamh", last: "Cunningham", age: 7 },
      { member: "LWB423013", first: "Afiya", last: "Ahmed", age: 7 },
      { member: "LWB423090", first: "Zach", last: "Carroll Lordan", age: 6 },
      { member: "LWB423133", first: "Isobel", last: "Ronayne", age: 6 },
      { member: "LWB423916", first: "Cora", last: "Purcell", age: 8 },
      { member: "LWB424514", first: "Sam", last: "Horgan", age: 6 },
      { member: "LWB429087", first: "Mila", last: "O'Riordan", age: 7 },
      { member: "LWB432602", first: "Sophie", last: "Hennessy", age: 7 },
    ],
  },
  {
    code: "00008262", course: "Turtles", level: "Turtles", start: "11:20",
    capacity: 10, location: MAIN,
    enrollees: [
      { member: "LWB92965", first: "Tommy", last: "O'Brien", age: 7 },
      { member: "LWB96142", first: "Milan", last: "Balaji", age: 8 },
      { member: "LWB407644", first: "Alayna", last: "Dziya", age: 7 },
      { member: "LWB408748", first: "Róisín", last: "McCarthy", age: 10 },
      { member: "LWB412424", first: "Kinsco", last: "McNamara", age: 7 },
      { member: "LWB418301", first: "Oliver", last: "McCarthy", age: 7 },
      { member: "LWB419435", first: "Orla", last: "O'Keeffe", age: 7 },
      { member: "LWB423005", first: "Grace", last: "Casey", age: 6 },
      { member: "LWB426261", first: "Sophia", last: "Quiton", age: 9 },
      { member: "LWC431071", first: "Niya Shatakshi", last: "Sathiendran", age: 7, facility: "C" },
    ],
  },
  {
    code: "00008263", course: "Turtles", level: "Turtles", start: "12:15",
    capacity: 10, location: MAIN,
    enrollees: [
      { member: "LWB93807", first: "Una", last: "Hayes", age: 9 },
      { member: "LWB98766", first: "Ròise", last: "O'Donovan", age: 8 },
      { member: "LWB418298", first: "Alexandra", last: "Fitzgibbon", age: 6 },
      { member: "LWB423027", first: "Darragh", last: "Duggan", age: 8 },
      { member: "LWB423082", first: "Emiliia", last: "Zubrytska", age: 7 },
      { member: "LWB423099", first: "Mary-Jane", last: "Murphy", age: 6 },
      { member: "LWB423727", first: "Ava", last: "Lucey", age: 8 },
      { member: "LWB424376", first: "Krethik", last: "Santosh", age: 6 },
      { member: "LWB427931", first: "Nessa", last: "Edmonds", age: 10 },
      { member: "LWB433219", first: "Pixie", last: "Drummond", age: 6 },
    ],
  },
  {
    code: "00008264", course: "Turtles", level: "Turtles", start: "12:50",
    capacity: 10, location: MAIN,
    enrollees: [
      { member: "LWB68921", first: "Jake", last: "Tanner", age: 6 },
      { member: "LWB413675", first: "Jamie", last: "Collins", age: 7 },
      { member: "LWB419508", first: "Nova", last: "Josy", age: 8 },
      { member: "LWB422239", first: "Ailbhe", last: "Sharvin", age: 7 },
      { member: "LWB423060", first: "Darragh", last: "Casey", age: 7 },
      { member: "LWB423071", first: "Callan", last: "Murphy", age: 6 },
      { member: "LWB424848", first: "Conor Liam", last: "O'Callaghan", age: 8 },
      { member: "LWB427421", first: "Alayna", last: "Bolton", age: 7 },
      { member: "LWB429137", first: "Ollie", last: "Larkin", age: 10 },
      { member: "LWB430008", first: "Daniel", last: "Davin", age: 6 },
    ],
  },

  // ---- Dolphins ----
  {
    code: "00008239", course: "Dolphins", level: "Dolphins", start: "09:00",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB78581", first: "Maryam", last: "Haroon", age: 10 },
      { member: "LWC57593", first: "Laura", last: "Bourke", age: 8, facility: "C" },
      { member: "LWB91587", first: "Shruthi", last: "Thiyagarajan", age: 11 },
      { member: "LWB92270", first: "Reyanna", last: "Elkhawaga", age: 6 },
      { member: "LWB93946", first: "Bianca", last: "Diogo", age: 8 },
      { member: "LWB94811", first: "Meabh", last: "Danter", age: 7 },
      { member: "LWB94886", first: "Bobbie Rose", last: "O'Driscoll", age: 7 },
      { member: "LWB419675", first: "Ella-Mai", last: "Crowley", age: 9 },
      { member: "LWB427769", first: "Mohamed", last: "Elkashef", age: 10 },
      { member: "LWB427770", first: "Omar", last: "Elkashef", age: 13 },
      { member: "LWB431061", first: "Isabelle", last: "Goold", age: 8 },
      { member: "LWB431062", first: "Emmie", last: "Goold", age: 7 },
    ],
  },
  {
    code: "00008265", course: "Dolphins", level: "Dolphins", start: "09:35",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB58454", first: "Millie", last: "Gavin", age: 13 },
      { member: "LWB79150", first: "Evie", last: "Hennessy", age: 7 },
      { member: "LWB81482", first: "Alex", last: "Spillane", age: 9 },
      { member: "LWB81698", first: "david", last: "Plaice", age: 10 },
      { member: "LWC53142", first: "Molly", last: "Cary", age: 7, facility: "C" },
      { member: "LWB94791", first: "Dawid", last: "Ogalabu", age: 9 },
      { member: "LWB419610", first: "Theo", last: "Conway", age: 7 },
      { member: "LWB419715", first: "Hannah", last: "O'Donovan", age: 8 },
      { member: "LWB421988", first: "Jack", last: "Buckley", age: 8 },
      { member: "LWB424287", first: "Evie", last: "Ryan", age: 8 },
      { member: "LWB424321", first: "Amelia", last: "Wegierska-Stoyanova", age: 8 },
      { member: "LWB427168", first: "Vlad", last: "Mazalu", age: 8 },
    ],
  },
  {
    code: "00008266", course: "Dolphins", level: "Dolphins", start: "10:10",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB87694", first: "Fiadh", last: "McSweeney", age: 9 },
      { member: "LWB88481", first: "Fionn", last: "O'keefe", age: 9 },
      { member: "LWB88482", first: "Feile", last: "O'keefe", age: 11 },
      { member: "LWB91106", first: "Yukti", last: "Bhavanibhatla", age: 8 },
      { member: "LWB93621", first: "Dominic Joseph", last: "Csatho", age: 9 },
      { member: "LWB99158", first: "Saoirse", last: "Deane", age: 7 },
      { member: "LWB422200", first: "Zoe", last: "Crowley", age: 8 },
      { member: "LWB423720", first: "Maaidah Fatima", last: "ahmed", age: 8 },
      { member: "LWB424230", first: "Nandanasree", last: "Arun Prakash", age: 12 },
      { member: "LWB427466", first: "Finn", last: "GALVIN", age: 8 },
      { member: "LWB427728", first: "Ciara", last: "Gough", age: 8 },
    ],
  },
  {
    code: "00008267", course: "Dolphins", level: "Dolphins", start: "10:45",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB61259", first: "Lawson", last: "MacKay", age: 7 },
      { member: "LWB80370", first: "Daisy", last: "Behan", age: 8 },
      { member: "LWC58859", first: "Tomas", last: "Spillane", age: 8, facility: "C" },
      { member: "LWB99050", first: "Isabella", last: "Ryan", age: 8 },
      { member: "LWB99051", first: "Jessica", last: "Ryan", age: 8 },
      { member: "LWB99492", first: "Aodhán", last: "Barrett", age: 11 },
      { member: "LWB411683", first: "Fionn", last: "O'Brien", age: 7 },
      { member: "LWD418347", first: "afan", last: "afridi mohammed", age: 11, facility: "D" },
      { member: "LWB419647", first: "Muhammad Khuzaima", last: "Aleem", age: 9 },
      { member: "LWB422590", first: "Sophie", last: "Scannell", age: 10 },
      { member: "LWB428057", first: "Lily", last: "Tong", age: 8 },
      { member: "LWB436227", first: "Vivan", last: "Jain", age: 12 },
    ],
  },
  {
    code: "00008268", course: "Dolphins", level: "Dolphins", start: "11:20",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWC51049", first: "Eoghan", last: "O'Farrell", age: 8, facility: "C" },
      { member: "LWB84037", first: "Liam", last: "Quigley", age: 8 },
      { member: "LWB87159", first: "John", last: "O'Regan", age: 12 },
      { member: "LWB90115", first: "Pippa", last: "Gill", age: 9 },
      { member: "LWB90670", first: "Riley", last: "Sexton", age: 8 },
      { member: "LWB92590", first: "Rose", last: "Massalve", age: 9 },
      { member: "LWB95813", first: "Liam", last: "Burns", age: 9 },
      { member: "LWB96364", first: "Sienna", last: "Houlihan", age: 8 },
      { member: "LWB413716", first: "Zoe", last: "Edwards", age: 8 },
      { member: "LWB418324", first: "Connie", last: "Kissane", age: 7 },
      { member: "LWB422186", first: "Cali", last: "Horgan", age: 9 },
      { member: "LWB422253", first: "Ellie", last: "Lynch", age: 8 },
    ],
  },
  {
    code: "00008269", course: "Dolphins", level: "Dolphins", start: "12:15",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB29844", first: "Charles", last: "Tshilela", age: 13 },
      { member: "LWB82751", first: "Nay Zin", last: "Tun", age: 11 },
      { member: "LWB88256", first: "Pierce", last: "McCarthy", age: 8 },
      { member: "LWB91022", first: "Muhammad Abubakr", last: "Shakeel", age: 8 },
      { member: "LWB93113", first: "Rebecca", last: "Lynch", age: 8 },
      { member: "LWB411275", first: "Michael", last: "Dunne", age: 8 },
      { member: "LWB413269", first: "Muhammad Ruhaan", last: "Haq", age: 8 },
      { member: "LWB416674", first: "Lucy", last: "Ryan", age: 9 },
      { member: "LWB419434", first: "Denis", last: "O'Keeffe", age: 10 },
      { member: "LWC423723", first: "Maya R", last: "dos Santos", age: 7, facility: "C" },
      { member: "LWB425135", first: "Ava", last: "O'Conner", age: 11 },
    ],
  },
  {
    code: "00008270", course: "Dolphins", level: "Dolphins", start: "12:50",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB81286", first: "Joey", last: "McNamara-McSweeney", age: 11 },
      { member: "LWB90228", first: "Isabelle", last: "O'Leary", age: 8 },
      { member: "LWB91551", first: "Tadhg", last: "O'Riordan", age: 10 },
      { member: "LWB91552", first: "Darragh", last: "Lucey", age: 8 },
      { member: "LWB92787", first: "Max", last: "Tanner", age: 8 },
      { member: "LWB409857", first: "Sam", last: "O'Donoghue", age: 9 },
      { member: "LWB411250", first: "Lucy", last: "Wade", age: 8 },
      { member: "LWB415033", first: "Leo", last: "OSullivan Matthews", age: 8 },
      { member: "LWC416376", first: "Fionn", last: "McGahern", age: 9, facility: "C" },
      { member: "LWB423110", first: "Dhwani", last: "Sudheesh", age: 9 },
      { member: "LWB425764", first: "Yameen", last: "Habib", age: 9 },
      { member: "LWB425928", first: "Rory", last: "Murphy", age: 8 },
    ],
  },

  // ---- Sharks 1 ----
  {
    code: "00008240", course: "Sharks 1", level: "Sharks 1", start: "09:00",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWC46799", first: "Mia", last: "Murphy", age: 8, facility: "C" },
      { member: "LWB81734", first: "Ellen", last: "Carey", age: 9 },
      { member: "LWB83031", first: "Eamonn", last: "Burke", age: 10 },
      { member: "LWB84448", first: "Henry", last: "O'Driscoll", age: 10 },
      { member: "LWB94885", first: "Aoife", last: "O'Driscoll", age: 9 },
      { member: "LWB412031", first: "Siaara", last: "Vijay", age: 11 },
      { member: "LWB417701", first: "Amelia", last: "Corcoran", age: 10 },
      { member: "LWB420266", first: "Caoimhe", last: "Ahern", age: 11 },
    ],
  },
  {
    code: "00008386", course: "Sharks 1", level: "Sharks 1", start: "09:35",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB58453", first: "Harry", last: "Gavin", age: 13 },
      { member: "LWB61871", first: "Abbey", last: "Murphy", age: 10 },
      { member: "LWB63131", first: "Hannah", last: "Keohane", age: 9 },
      { member: "LWB70794", first: "Eanna", last: "Cunningham", age: 9 },
      { member: "LWB83227", first: "Conor", last: "Dineen", age: 8 },
      { member: "LWB94527", first: "Caoimhe", last: "Tubridy", age: 10 },
      { member: "LWC406842", first: "Anika", last: "Phogat", age: 8, facility: "C" },
      { member: "LWB419710", first: "Clodagh", last: "O'Leary", age: 10 },
      { member: "LWB421987", first: "Harry", last: "Buckley", age: 10 },
      { member: "LWB427955", first: "Shasana", last: "Manikandan", age: 10 },
      { member: "LWB428252", first: "Holly", last: "Healy", age: 8 },
    ],
  },
  {
    code: "00008242", course: "Sharks 1", level: "Sharks 1", start: "10:10",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB62218", first: "Jason", last: "Danylyuk", age: 12 },
      { member: "LWB70182", first: "Safwan", last: "Afridi", age: 10 },
      { member: "LWB83009", first: "Evie", last: "O'Brien", age: 10 },
      { member: "LWB87695", first: "Caimin", last: "McSweeney", age: 11 },
      { member: "LWB87886", first: "Sophie", last: "McCarthy", age: 9 },
      { member: "LWB97323", first: "Mícheál", last: "Lynch", age: 8 },
      { member: "LWB99159", first: "Katie", last: "Deane", age: 8 },
      { member: "LWC411226", first: "Leo", last: "Donnelly", age: 9, facility: "C" },
      { member: "LWB420862", first: "Méabh", last: "Scannell", age: 8 },
      { member: "LWB423721", first: "Mominah Fatima", last: "Ahmed", age: 9 },
    ],
  },
  {
    code: "00008244", course: "Sharks 1", level: "Sharks 1", start: "11:20",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWC45718", first: "Ellen", last: "O'Callaghan", age: 8, facility: "C" },
      { member: "LWB79813", first: "Katie", last: "Bermingham", age: 11 },
      { member: "LWC51047", first: "Charlotte", last: "Kerr", age: 10, facility: "C" },
      { member: "LWB85903", first: "Cole", last: "Finnegan", age: 10 },
      { member: "LWB88709", first: "Thomas", last: "Newman", age: 9 },
      { member: "LWB96145", first: "Tushita", last: "Balaji", age: 11 },
      { member: "LWB99052", first: "Matthew", last: "Ryan", age: 10 },
    ],
  },
  {
    code: "00008246", course: "Sharks 1", level: "Sharks 1", start: "12:50",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB40539", first: "Matthew", last: "O'Sullivan", age: 12 },
      { member: "LWB48051", first: "Zoya", last: "Bilal", age: 11 },
      { member: "LWB80704", first: "Harry", last: "Fitton", age: 9 },
      { member: "LWB81285", first: "Annie", last: "McNamara-McSweeny", age: 9 },
      { member: "LWB81626", first: "Emily", last: "Galvin", age: 9 },
      { member: "LWB94208", first: "Kayla", last: "Kilany", age: 9 },
      { member: "LWB98636", first: "Soham", last: "Gavate", age: 9 },
      { member: "LWB419507", first: "Niya", last: "Josy", age: 11 },
      { member: "LWB425109", first: "Felix", last: "Mohite", age: 13 },
      { member: "LWB425765", first: "Raheel", last: "Habib", age: 11 },
      { member: "LWB431964", first: "Muireann", last: "Fitzgibbon", age: 9 },
    ],
  },

  // ---- Sharks 2 ----
  {
    code: "00008243", course: "Sharks 2", level: "Sharks 2", start: "10:45",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWC38027", first: "Abbie", last: "O'Connor", age: 11, facility: "C" },
      { member: "LWB70205", first: "Holly", last: "McCarthy", age: 9 },
      { member: "LWB82315", first: "Abdullah", last: "Tanveer", age: 10 },
      { member: "LWB86938", first: "Charlie", last: "Twohig", age: 9 },
      { member: "LWB88056", first: "Niamh", last: "O'Leary", age: 9 },
      { member: "LWB93201", first: "Grace", last: "O'Leary", age: 7 },
      { member: "LWB96521", first: "Aoibheann", last: "Lynch", age: 9 },
      { member: "LWB407806", first: "Aanya", last: "Patnaik", age: 10 },
      { member: "LWB414097", first: "SHAURYA", last: "KULKARNI", age: 12 },
      { member: "LWD419714", first: "Zoya", last: "Ahmed", age: 10, facility: "D" },
    ],
  },
  {
    code: "00008245", course: "Sharks 2", level: "Sharks 2", start: "12:15",
    capacity: 12, location: MAIN,
    enrollees: [
      { member: "LWB37174", first: "Aidan Mathew", last: "Binny", age: 15 },
      { member: "LWB40503", first: "Rian", last: "Mac Aogain", age: 11 },
      { member: "LWB52358", first: "Tiernan", last: "McCarthy", age: 13 },
      { member: "LWB52632", first: "Ronan", last: "O'Donovan", age: 11 },
      { member: "LWB58469", first: "Eimear", last: "Fitzgibbon", age: 11 },
      { member: "LWB84613", first: "Miles", last: "Finnegan", age: 12 },
      { member: "LWB93456", first: "Ailbhe", last: "Duff", age: 10 },
      { member: "LWB94685", first: "Daniel", last: "O'Connor", age: 10 },
      { member: "LWB94687", first: "Charlie", last: "O'Connor", age: 8 },
      { member: "LWB99260", first: "Thaswika", last: "Allenki", age: 10 },
      { member: "LWB407746", first: "Joana", last: "Jorlin", age: 11 },
      { member: "LWB425927", first: "Aoife", last: "Murphy", age: 11 },
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
  let coursesCreated = 0;
  let studentsCreated = 0;
  let enrolled = 0;
  const problems: string[] = [];
  const conflicts: string[] = [];
  const renames: string[] = [];
  const alsoOnAnotherDay: string[] = [];

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
        summary: `Added ${courseLabel(course)} from the club's Saturday timetable (course ${roster.code}), capacity ${roster.capacity}`,
      });
    }

    const added: string[] = [];

    for (const e of roster.enrollees) {
      const existing = await prisma.student.findUnique({
        where: { memberNumber: e.member },
        select: { id: true, firstName: true, lastName: true, _count: { select: { enrolments: true } } },
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
        summary: `Imported the Saturday roster for ${courseLabel(course)} — ${added.length} enrolled (${added.slice(0, 6).join(", ")}${added.length > 6 ? ` and ${added.length - 6} others` : ""})`,
      });
    }

    console.log(`${roster.course.padEnd(10)} ${roster.start}  ${added.length} enrolled.`);
  }

  console.log(
    `\n${coursesCreated} classes created, ${studentsCreated} students created, ${enrolled} enrolments made.`
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
