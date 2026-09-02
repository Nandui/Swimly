import "dotenv/config";
import { HOLDS_A_PLACE, sessionLabel } from "@/lib/assessments/constants";
import { withAssessmentSeat } from "@/lib/assessments/seat";
import { logAudit } from "@/lib/audit";
import { courseLabel } from "@/lib/courses/constants";
import { withCourseSeat } from "@/lib/enrolment/seat";
import { parseDateOnly, today } from "@/lib/format";
import { fullName } from "@/lib/students/constants";
import { prisma } from "@/lib/prisma";

/** The Saturday timetable and rosters for LeisureWorld Churchfield, from the
 *  PDF of the club's existing system (2 Sep 2026). The last and biggest day:
 *  twenty-three weekly classes from 09:00 to 12:10, Starfish to Sharks 2, and
 *  four one-off Swim School Assessments sessions at 12:30. Same method and
 *  guards as the other Churchfield days: pages at 200dpi and every roster
 *  re-read at 400dpi, capacity from each card's own **Available** count (a
 *  card showing "Only Waiting List" is full at the number it lists), every
 *  place taken under a row lock, idempotent, audited, levels looked up inside
 *  Churchfield's own programmes, a Bishopstown member number reported rather
 *  than matched. All 170 member numbers here were new to the app when this
 *  was written, checked against the live database before the run.
 *
 *  **The assessments follow Wednesday's precedent**: one `AssessmentSession`
 *  per Saturday (5, 12, 19 and 26 September, 12:30, Learner Pool, 15 places),
 *  placing into Water Safety & Fun under the kind "Pre-Assessments" that the
 *  Wednesday import created. Both choices are a person's to change. Luke
 *  Waterman LWC47171 is booked on two of the sessions, 12 and 19 September,
 *  exactly as the source has him; one row per child per session allows it.
 *
 *  **A third home facility.** Anushka Roy LWD430785 holds her membership at
 *  LeisureWorld Douglas. She is a Churchfield swimmer here like everyone
 *  else on the page, with the membership noted.
 *
 *  **Twenty children have Bishopstown as their home facility** (LWB numbers)
 *  and swim or are assessed at Churchfield on Saturdays.
 *
 *  **Capacities kept as the cards say although they look odd.** Penguins
 *  09:35 is full at 10 and Penguins 11:35 works out at 7, where Penguins
 *  usually holds 8; Turtles 09:35 and 10:10 are full at 11 and Turtles 11:00
 *  works out at 13; Dolphins 10:10 works out at 14. Every class is EUR125 a
 *  block, so there is no price tell to second-guess the levels with.
 *
 *  **One age that cannot be right.** Unnehani Shaikh LWC51256 is listed as
 *  1 year 4 months old, in a Dolphins class. The source says it, so the note
 *  says it, and it is listed below for a person to fix. */

const CLUB_ID = "club_churchfield";
const DAY = "SATURDAY" as const;

/** Where the assessment sessions place children, and what the club calls them. */
const ASSESSMENT_PROGRAMME = "Water Safety & Fun";
const ASSESSMENT_KIND = "Pre-Assessments";

/** Transcribed exactly. Oddities in the club's own records, not misreadings. */
const ODD_IN_SOURCE = new Map([
  ["LWC51256", "Unnehani Shaikh — age given as 1 year 4 months, in Dolphins; recorded as 1"],
  ["LWC47854", "Mohammad azlaan faraz — lowercase; his brother Mohammad arhaan faraz LWC47853 the same"],
  ["LWB427558", "EVA MORAES — all capitals"],
  ["LWC441172", "alex coughlan — all lowercase; so is hollie coughlan LWC441173"],
  ["LWC39286", "Katelyn O connor — lowercase c"],
  ["LWC429194", "Tiernan Mcgorman — lowercase g"],
  ["LWC31222", "Ronan Mc Sweeney — spaced"],
  ["LWC428654", "Gerogio Nakas — Gerogio as written"],
  ["LWC50391", "Isacc Colombini — Isacc as written"],
  ["LWC427838", "Mihulavan Sathish — three brothers spelled Mahilavan, Muhilavan and Mihulavan, as written"],
  ["LWC56339", "Chloe Farrells — Farrells as written"],
  ["LWC429040", "Aine Brennen — Brennen as written"],
]);

/** Readings I am least sure of even at 400dpi: unfamiliar names where the
 *  source itself may hold the misspelling. */
const UNCERTAIN = new Set([
  "LWC433273", // Viktoria Yahoudzik
  "LWC428947", // Majia Bintel Jones
  "LWC64435", // Krithik Gotal
  "LWC57370", // Cillian Walerowski
  "LWC441003", // Tashwik Mohan
]);

type Enrollee = {
  member: string;
  first: string;
  last: string;
  age: number;
  /** Home facility when it is not Churchfield: "B" = LW Bishopstown, "D" = LW Douglas. */
  facility?: "B" | "D";
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
  /** YYYY-MM-DD. All Saturdays. */
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
    code: "00008357", course: "Starfish", level: "Starfish", start: "09:00",
    capacity: 8, location: LEARNER, // 7 in, 1 available
    enrollees: [
      { member: "LWC60104", first: "Zara", last: "Forde", age: 7 },
      { member: "LWC407454", first: "Liam", last: "Daly", age: 7 },
      { member: "LWC425284", first: "Molly", last: "Cooper", age: 6 },
      { member: "LWC431522", first: "Gracie", last: "Walsh", age: 5 },
      { member: "LWB435213", first: "Oisín", last: "Murphy", age: 5, facility: "B" },
      { member: "LWC438436", first: "Chloe", last: "Maguire", age: 6 },
      { member: "LWC439849", first: "Aiden", last: "O Flynn", age: 5 },
    ],
  },
  {
    code: "00008358", course: "Starfish", level: "Starfish", start: "09:35",
    capacity: 8, location: LEARNER, // 7 in, 1 available
    enrollees: [
      { member: "LWB87428", first: "Grace", last: "Bishop", age: 5, facility: "B" },
      { member: "LWC423219", first: "Sonny", last: "Hogan", age: 7 },
      { member: "LWB428224", first: "Ben", last: "Martin", age: 5, facility: "B" },
      { member: "LWC434930", first: "Esmée", last: "O'Dwyer", age: 6 },
      { member: "LWC438019", first: "Isobel", last: "Dean", age: 5 },
      { member: "LWC438213", first: "Benjamin", last: "Bourassin", age: 5 },
      { member: "LWC440047", first: "Saifan", last: "Chowdhury", age: 6 },
    ],
  },
  {
    code: "00008359", course: "Starfish", level: "Starfish", start: "10:10",
    capacity: 8, location: LEARNER, // 2 in, 6 available
    enrollees: [
      { member: "LWC431916", first: "Isla", last: "Ahern", age: 5 },
      { member: "LWC438297", first: "Daisy", last: "Ronan", age: 5 },
    ],
  },
  {
    code: "00008360", course: "Starfish", level: "Starfish", start: "11:00",
    capacity: 8, location: LEARNER, // 5 in, 3 available
    enrollees: [
      { member: "LWC47854", first: "Mohammad", last: "azlaan faraz", age: 6 },
      { member: "LWC63001", first: "Sean", last: "O Mahony", age: 9 },
      { member: "LWC430321", first: "Logan", last: "Creed", age: 6 },
      { member: "LWB430492", first: "Leah", last: "Byrne", age: 6, facility: "B" },
      { member: "LWC435675", first: "Robbie", last: "Ronan", age: 5 },
    ],
  },
  {
    code: "00008361", course: "Starfish", level: "Starfish", start: "11:35",
    capacity: 8, location: LEARNER, // 2 in, 6 available
    enrollees: [
      { member: "LWB426292", first: "Sadhbh", last: "Desmond", age: 5, facility: "B" },
      { member: "LWC427166", first: "Antoni", last: "Foriasz", age: 6 },
    ],
  },
  {
    code: "00008362", course: "Starfish", level: "Starfish", start: "12:10",
    capacity: 8, location: LEARNER, // 5 in, 3 available
    enrollees: [
      { member: "LWB410528", first: "Pranavi", last: "Rahul", age: 5, facility: "B" },
      { member: "LWC435103", first: "Amraha", last: "Shems", age: 5 },
      { member: "LWC435104", first: "Alyan", last: "Shems", age: 6 },
      { member: "LWC436930", first: "Areesha", last: "Toheed", age: 7 },
      { member: "LWC436931", first: "Muhammad Hashir", last: "Toheed", age: 5 },
    ],
  },

  // ---- Penguins ----
  {
    code: "00008364", course: "Penguins", level: "Penguins", start: "09:35",
    capacity: 10, location: LEARNER, // Only Waiting List: full at 10
    enrollees: [
      { member: "LWC61504", first: "Fionn", last: "Scully", age: 7 },
      { member: "LWC407532", first: "Hunter", last: "Mooney", age: 6 },
      { member: "LWC423072", first: "Violet", last: "Dean", age: 6 },
      { member: "LWC424585", first: "Evie", last: "McGinley", age: 6 },
      { member: "LWC426922", first: "Mackenzie", last: "Lawless", age: 7 },
      { member: "LWB427558", first: "EVA", last: "MORAES", age: 6, facility: "B" },
      { member: "LWC429194", first: "Tiernan", last: "Mcgorman", age: 7 },
      { member: "LWC429514", first: "Clodagh", last: "Archer", age: 6 },
      { member: "LWC433273", first: "Viktoria", last: "Yahoudzik", age: 9 },
      { member: "LWB435949", first: "Archie", last: "Miller", age: 5, facility: "B" },
    ],
  },
  {
    code: "00008366", course: "Penguins", level: "Penguins", start: "11:00",
    capacity: 8, location: LEARNER, // 7 in, 1 available
    enrollees: [
      { member: "LWC422073", first: "Zan", last: "Shaikh", age: 6 },
      { member: "LWC425283", first: "Ciara", last: "Vainqueur", age: 6 },
      { member: "LWC427720", first: "Emily", last: "Moloney", age: 7 },
      { member: "LWC428654", first: "Gerogio", last: "Nakas", age: 8 },
      { member: "LWC429040", first: "Aine", last: "Brennen", age: 5 },
      { member: "LWC433075", first: "Ronan", last: "Dillon", age: 5 },
      { member: "LWC435151", first: "Lily", last: "Manning", age: 6 },
    ],
  },
  {
    code: "00008367", course: "Penguins", level: "Penguins", start: "11:35",
    capacity: 7, location: LEARNER, // 6 in, 1 available
    enrollees: [
      { member: "LWC61238", first: "Mark", last: "Zmitrovic", age: 8 },
      { member: "LWC414186", first: "Axel", last: "Scannell", age: 6 },
      { member: "LWC423051", first: "Jack", last: "Noonan", age: 6 },
      { member: "LWC423052", first: "Tommy", last: "Noonan", age: 6 },
      { member: "LWC425507", first: "Ash", last: "Knight", age: 6 },
      { member: "LWC425876", first: "John", last: "Murphy", age: 6 },
    ],
  },
  {
    code: "00008368", course: "Penguins", level: "Penguins", start: "12:10",
    capacity: 8, location: LEARNER, // 6 in, 2 available
    enrollees: [
      { member: "LWB408660", first: "Ben", last: "Ryan", age: 6, facility: "B" },
      { member: "LWB410407", first: "Chloe", last: "Ryan", age: 6, facility: "B" },
      { member: "LWC424712", first: "Tobi", last: "Robertson", age: 7 },
      { member: "LWC427413", first: "Darcy", last: "Robertson", age: 6 },
      { member: "LWB429300", first: "Nathan", last: "O Hanlon", age: 8, facility: "B" },
      { member: "LWC436031", first: "Cora", last: "Rodrigues", age: 5 },
    ],
  },

  // ---- Turtles ----
  {
    code: "00008369", course: "Turtles", level: "Turtles", start: "09:00",
    capacity: 10, location: lane(1), // 2 in, 8 available
    enrollees: [
      { member: "LWC424922", first: "Colla", last: "Hegarty", age: 6 },
      { member: "LWC434628", first: "Evie", last: "Murphy", age: 7 },
    ],
  },
  {
    code: "00008370", course: "Turtles", level: "Turtles", start: "09:35",
    capacity: 11, location: lane(1), // Only Waiting List: full at 11
    enrollees: [
      { member: "LWC50147", first: "Lottie", last: "Murphy", age: 8 },
      { member: "LWC59416", first: "Shriyans", last: "Dash", age: 7 },
      { member: "LWC62688", first: "Mark", last: "McGuinn", age: 7 },
      { member: "LWC409519", first: "Sachit", last: "Kumar", age: 8 },
      { member: "LWC412561", first: "John", last: "Spillane", age: 6 },
      { member: "LWC415870", first: "Zara", last: "Brassil", age: 6 },
      { member: "LWC423087", first: "Grace", last: "Bermingham", age: 6 },
      { member: "LWC423216", first: "Davy", last: "Hogan", age: 9 },
      { member: "LWC427739", first: "Cian", last: "Moloney", age: 8 },
      { member: "LWC428188", first: "Cody", last: "Langham", age: 9 },
      { member: "LWC429513", first: "Macdara", last: "Archer", age: 7 },
    ],
  },
  {
    code: "00008371", course: "Turtles", level: "Turtles", start: "10:10",
    capacity: 11, location: lane(1), // Only Waiting List: full at 11
    enrollees: [
      { member: "LWC57561", first: "Dara", last: "Scully", age: 10 },
      { member: "LWC411100", first: "Amelie", last: "Ronan", age: 7 },
      { member: "LWC415488", first: "Kai", last: "Brennan", age: 7 },
      { member: "LWC419608", first: "Bella", last: "O'Brien", age: 6 },
      { member: "LWC423966", first: "Robert", last: "Robinson", age: 8 },
      { member: "LWC424654", first: "Aadvika", last: "Binjola", age: 8 },
      { member: "LWC424821", first: "Rosie", last: "Melichar", age: 5 },
      { member: "LWC425223", first: "Teagan", last: "Dutel", age: 7 },
      { member: "LWC425877", first: "Emma", last: "Murphy", age: 7 },
      { member: "LWC433074", first: "Nathan", last: "Dillon", age: 7 },
      { member: "LWC438255", first: "Katelyn", last: "O Halloran", age: 10 },
    ],
  },
  {
    code: "00008372", course: "Turtles", level: "Turtles", start: "11:00",
    capacity: 13, location: lane(1), // 12 in, 1 available
    enrollees: [
      { member: "LWC31222", first: "Ronan", last: "Mc Sweeney", age: 10 },
      { member: "LWC47853", first: "Mohammad", last: "arhaan faraz", age: 7 },
      { member: "LWC56339", first: "Chloe", last: "Farrells", age: 6 },
      { member: "LWC59865", first: "Millie", last: "Nolan", age: 7 },
      { member: "LWC60999", first: "Macdara", last: "Ryan", age: 8 },
      { member: "LWC411099", first: "Ryan", last: "Ronan", age: 7 },
      { member: "LWC423100", first: "Musab Waqas", last: "Bhatti", age: 7 },
      { member: "LWC423648", first: "Mila", last: "Kearney", age: 7 },
      { member: "LWC424202", first: "Holly", last: "Moore", age: 8 },
      { member: "LWC424607", first: "Ellie", last: "Hourigan", age: 7 },
      { member: "LWC426938", first: "Amelia", last: "Walsh", age: 6 },
      { member: "LWC433348", first: "Harry", last: "Murphy", age: 5 },
    ],
  },

  // ---- Dolphins ----
  {
    code: "00008373", course: "Dolphins", level: "Dolphins", start: "09:00",
    capacity: 12, location: lane(2), // 6 in, 6 available
    enrollees: [
      { member: "LWC41303", first: "Cole", last: "Mooney", age: 8 },
      { member: "LWC64183", first: "Jayden", last: "Lawless", age: 9 },
      { member: "LWC423079", first: "Oliver", last: "Coade", age: 9 },
      { member: "LWC427216", first: "Aarav", last: "Kalal", age: 7 },
      { member: "LWB430980", first: "Fiadh", last: "Kirby", age: 10, facility: "B" },
      { member: "LWC434929", first: "Nessa", last: "O'Dwyer", age: 8 },
    ],
  },
  {
    code: "00008374", course: "Dolphins", level: "Dolphins", start: "09:35",
    capacity: 12, location: lane(2), // 8 in, 4 available
    enrollees: [
      { member: "LWB91450", first: "Léa", last: "Bourassin", age: 7, facility: "B" },
      { member: "LWC422898", first: "Emilia", last: "Keenan", age: 8 },
      { member: "LWC423284", first: "Victoria", last: "Tranchese", age: 7 },
      { member: "LWC427835", first: "Mahilavan", last: "Sathish", age: 9 },
      { member: "LWC427837", first: "Muhilavan", last: "Sathish", age: 8 },
      { member: "LWC427838", first: "Mihulavan", last: "Sathish", age: 7 },
      { member: "LWC428947", first: "Majia", last: "Bintel Jones", age: 9 },
      { member: "LWC429990", first: "Ray", last: "Healy", age: 12 },
    ],
  },
  {
    code: "00008375", course: "Dolphins", level: "Dolphins", start: "10:10",
    capacity: 14, location: lane(2), // 11 in, 3 available
    enrollees: [
      { member: "LWC50391", first: "Isacc", last: "Colombini", age: 9 },
      { member: "LWC50770", first: "Alex", last: "Cordeddu", age: 7 },
      { member: "LWC51062", first: "Sophia", last: "Condon", age: 9 },
      { member: "LWC51256", first: "Unnehani", last: "Shaikh", age: 1 },
      { member: "LWC57388", first: "Remi", last: "Waters", age: 7 },
      { member: "LWC424820", first: "Mikey", last: "Melichar", age: 9 },
      { member: "LWC425972", first: "Sophia", last: "Philpott", age: 8 },
      { member: "LWC425973", first: "Isabelle", last: "Philpott", age: 8 },
      { member: "LWC427576", first: "Faye", last: "Bracken", age: 8 },
      { member: "LWC429805", first: "Emily", last: "Moynihan", age: 8 },
      { member: "LWD430785", first: "Anushka", last: "Roy", age: 10, facility: "D" },
    ],
  },
  {
    code: "00008376", course: "Dolphins", level: "Dolphins", start: "11:00",
    capacity: 12, location: lane(2), // 7 in, 5 available
    enrollees: [
      { member: "LWC43045", first: "Jackson", last: "Kenneally", age: 9 },
      { member: "LWC52188", first: "Joish", last: "Jobin", age: 8 },
      { member: "LWC52492", first: "Ellen", last: "Burke", age: 9 },
      { member: "LWC57370", first: "Cillian", last: "Walerowski", age: 8 },
      { member: "LWC64435", first: "Krithik", last: "Gotal", age: 9 },
      { member: "LWC427972", first: "Sara", last: "Kubny", age: 8 },
      { member: "LWC439690", first: "Shahdat", last: "Hossain", age: 10 },
    ],
  },

  // ---- Sharks ----
  {
    code: "00008377", course: "Sharks 1", level: "Sharks 1", start: "11:35",
    capacity: 12, location: lane(3), // 9 in, 3 available
    enrollees: [
      { member: "LWC31041", first: "Sean", last: "Murphy", age: 11 },
      { member: "LWC50527", first: "Adam", last: "Packer", age: 10 },
      { member: "LWC51453", first: "Hazel", last: "Murphy", age: 8 },
      { member: "LWC56857", first: "Nathan", last: "Kearney", age: 10 },
      { member: "LWC60881", first: "Edie", last: "Byrne", age: 7 },
      { member: "LWC62162", first: "Leo", last: "Knight", age: 9 },
      { member: "LWC63579", first: "Nikhil", last: "Thiagu", age: 11 },
      { member: "LWC63989", first: "Cian", last: "Condron", age: 7 },
      { member: "LWC410749", first: "Hanish", last: "Voruganti", age: 11 },
    ],
  },
  {
    code: "00008378", course: "Sharks 1", level: "Sharks 1", start: "12:10",
    capacity: 12, location: lane(3), // 5 in, 7 available
    enrollees: [
      { member: "LWB410527", first: "Ishanvi", last: "Rahul", age: 11, facility: "B" },
      { member: "LWC423299", first: "Mohammed Noman", last: "Siddiqui", age: 9 },
      { member: "LWC427736", first: "Ben", last: "Murphy", age: 10 },
      { member: "LWC430533", first: "Jack", last: "Teresinski", age: 9 },
      { member: "LWC430534", first: "Jasmine", last: "Teresinska", age: 8 },
    ],
  },
  {
    code: "00008411", course: "Sharks 2", level: "Sharks 2", start: "09:00",
    capacity: 12, location: lane(4), // 2 in, 10 available
    enrollees: [
      { member: "LWB62413", first: "Sadie", last: "Walsh", age: 11, facility: "B" },
      { member: "LWC37987", first: "Olive", last: "Lucy", age: 10 },
    ],
  },
  {
    code: "00008379", course: "Sharks 2", level: "Sharks 2", start: "11:35",
    capacity: 12, location: lane(4), // 5 in, 7 available
    enrollees: [
      { member: "LWB70223", first: "Mia", last: "Beadle", age: 9, facility: "B" },
      { member: "LWC44388", first: "Sophie", last: "Harris", age: 9 },
      { member: "LWC60363", first: "Lucy", last: "Byrne", age: 10 },
      { member: "LWC410817", first: "Srikar", last: "Voruganti", age: 15 },
      { member: "LWC423102", first: "Ayesha", last: "Waqas", age: 10 },
    ],
  },
  {
    code: "00008380", course: "Sharks 2", level: "Sharks 2", start: "12:10",
    capacity: 12, location: lane(4), // 2 in, 10 available
    enrollees: [
      { member: "LWC58839", first: "Darcy", last: "Buckley", age: 8 },
      { member: "LWB432866", first: "Avyan", last: "Maurya", age: 7, facility: "B" },
    ],
  },
];

/** "Swim School Assessments", one session each, 12:30 in the Learner Pool. */
const SESSIONS: Session[] = [
  {
    code: "00008870", date: "2026-09-05", start: "12:30",
    capacity: 15, location: LEARNER, // Only Waiting List: full at 15
    bookings: [
      { member: "LWC60917", first: "Ginevra", last: "Balestrino", age: 11 },
      { member: "LWB437671", first: "Conan", last: "Chan", age: 5, facility: "B" },
      { member: "LWC441001", first: "Clémentine", last: "Leader", age: 6 },
      { member: "LWC441003", first: "Tashwik", last: "Mohan", age: 5 },
      { member: "LWC441028", first: "Clara", last: "Machado", age: 5 },
      { member: "LWC441084", first: "Sean", last: "Thornton", age: 8 },
      { member: "LWC441085", first: "Aoibhinn", last: "Thornton", age: 6 },
      { member: "LWB441097", first: "Arjun", last: "Agrawal", age: 10, facility: "B" },
      { member: "LWC441167", first: "Madison", last: "Murphy", age: 10 },
      { member: "LWC441168", first: "Rían", last: "O Mahony", age: 7 },
      { member: "LWC441172", first: "alex", last: "coughlan", age: 6 },
      { member: "LWC441173", first: "hollie", last: "coughlan", age: 8 },
      { member: "LWC441176", first: "Fiadh", last: "McBride", age: 7 },
      { member: "LWC441177", first: "Liam", last: "McBride", age: 5 },
      { member: "LWC441215", first: "Rylee", last: "Denehey", age: 5 },
    ],
  },
  {
    code: "00008871", date: "2026-09-12", start: "12:30",
    capacity: 15, location: LEARNER, // 6 in, 9 available
    bookings: [
      { member: "LWC47171", first: "Luke", last: "Waterman", age: 7 },
      { member: "LWC408915", first: "Réaltín", last: "Ruby", age: 9 },
      { member: "LWB432510", first: "Hannah", last: "Moynihan", age: 6, facility: "B" },
      { member: "LWC438728", first: "Niamh", last: "Rea", age: 5 },
      { member: "LWC441010", first: "Noah", last: "O'Brien", age: 5 },
      { member: "LWC441209", first: "Fiadh", last: "McCusker", age: 6 },
    ],
  },
  {
    code: "00008872", date: "2026-09-19", start: "12:30",
    capacity: 15, location: LEARNER, // 2 in, 13 available
    bookings: [
      { member: "LWC39286", first: "Katelyn", last: "O connor", age: 6 },
      { member: "LWC47171", first: "Luke", last: "Waterman", age: 7 },
    ],
  },
  {
    code: "00008873", date: "2026-09-26", start: "12:30",
    capacity: 15, location: LEARNER, // nobody in it yet, 15 available
    bookings: [],
  },
];

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

const FACILITY = { B: "LW Bishopstown", D: "LW Douglas" } as const;

function noteFor(e: Enrollee): string {
  const facility = e.facility ? FACILITY[e.facility] : "LW Churchfield";
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

/** The kind the sessions are given, by the club's own name for them. Made by
 *  the Wednesday import; created here only if it has since gone missing. */
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
        "Swim School Assessments, as the club's system calls them. Imported from the Saturday timetable.",
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

  // This club's live levels only. Unique within the club is asserted, not
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
        summary: `Added ${courseLabel(course)} from ${club.name}'s Saturday timetable (course ${roster.code}), capacity ${roster.capacity}`,
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
        summary: `Imported ${club.name}'s Saturday roster for ${courseLabel(course)} — ${added.length} enrolled (${added.slice(0, 6).join(", ")}${added.length > 6 ? ` and ${added.length - 6} others` : ""})`,
      });
    }

    console.log(`${roster.course.padEnd(10)} ${roster.start}  ${added.length} enrolled.`);
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
          notes: `Imported from the club's Saturday timetable (course ${s.code}).`,
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
        summary: `Added a ${ASSESSMENT_KIND} assessment session for ${programme.name} on ${sessionLabel(session)} with ${s.capacity} places, from ${club.name}'s Saturday timetable (course ${s.code})`,
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
  const elsewhere = everyone.filter((e) => e.facility);
  console.log(`\nHome facility elsewhere, swimming or assessed here (${elsewhere.length}):`);
  for (const e of elsewhere) console.log(` - ${e.member}  ${e.first} ${e.last} — ${FACILITY[e.facility!]}`);

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
