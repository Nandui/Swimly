import type {
  AssessmentSession,
  ClubId,
  Competency,
  DeskData,
  LessonData,
  SwimClass,
  Swimmer,
} from "./types";

export const APP_NAME = "Swimly";
export const DEMO_DATE = "2026-09-08";
export const CLUBS: Record<ClubId, string> = {
  bishopstown: "Bishopstown",
  churchfield: "Churchfield",
};
// These records are invented for the prototype, never copied from club records.
const PEOPLE = [
  ["Ava Bennett", 7, "AB", "Rory Bennett"],
  ["Leo Ellis", 8, "LE", "Morgan Ellis"],
  ["Sophie Hayes", 7, "SH", "Jamie Hayes"],
  ["Noah Parker", 8, "NP", "Alex Parker"],
  ["Mia Brooks", 6, "MB", "Taylor Brooks"],
  ["Oliver Reed", 7, "OR", "Casey Reed"],
  ["Isla Morgan", 9, "IM", "Robin Morgan"],
  ["Finn Hart", 8, "FH", "Sam Hart"],
  ["Emily Lane", 6, "EL", "Charlie Lane"],
  ["Oscar Wells", 9, "OW", "Drew Wells"],
  ["Grace Linden", 7, "GL", "Rowan Linden"],
  ["Theo Quinn", 8, "TQ", "Harper Quinn"],
] as const;
export const SWIMMERS: Swimmer[] = (Object.keys(CLUBS) as ClubId[]).flatMap(
  (clubId, clubIndex) =>
    PEOPLE.map(([name, age, initials, contact], i) => ({
      id: `${clubId}-${i + 1}`,
      clubId,
      name: clubIndex
        ? name.replace(
            /^[^ ]+/,
            [
              "Ruby",
              "Max",
              "Lily",
              "Ben",
              "Zoe",
              "Eli",
              "Ella",
              "Jude",
              "Aria",
              "Hugo",
              "Lucy",
              "Adam",
            ][i],
          )
        : name,
      age,
      initials: clubIndex
        ? [
            "RB",
            "ME",
            "LH",
            "BP",
            "ZB",
            "ER",
            "EM",
            "JH",
            "AL",
            "HW",
            "LL",
            "AQ",
          ][i]
        : initials,
      contact,
      email: `family${clubIndex * 12 + i + 1}@example.com`,
      phone: "Phone not recorded",
      memberNumber: `${clubIndex ? "LWC" : "LWB"}-DEMO-${String(i + 1).padStart(3, "0")}`,
      note:
        i === 0
          ? "Prefers a demonstration before trying a new skill."
          : i === 3
            ? "Check the care note with the instructor before the lesson."
            : undefined,
      level: i < 6 ? "Turtles" : i < 9 ? "Dolphins" : "Penguins",
      active: i !== 11,
    })),
);
export const CLASSES: SwimClass[] = (Object.keys(CLUBS) as ClubId[]).flatMap(
  (clubId) => [
    {
      id: `${clubId}-turtles`,
      clubId,
      level: "Turtles",
      start: "15:30",
      location: "Learner pool",
      instructor: "Alex Murphy",
      capacity: 8,
      swimmerIds: [1, 2, 3, 4, 5, 6].map((i) => `${clubId}-${i}`),
    },
    {
      id: `${clubId}-dolphins`,
      clubId,
      level: "Dolphins",
      start: "15:30",
      location: "Main pool · Lane 2",
      instructor: "Jordan Kelly",
      capacity: 6,
      swimmerIds: [7, 8, 9].map((i) => `${clubId}-${i}`),
    },
    {
      id: `${clubId}-penguins`,
      clubId,
      level: "Penguins",
      start: "16:00",
      location: "Learner pool",
      instructor: "Alex Murphy",
      capacity: 6,
      swimmerIds: [10].map((i) => `${clubId}-${i}`),
    },
    {
      id: `${clubId}-turtles-later`,
      clubId,
      level: "Turtles",
      start: "16:00",
      location: "Main pool · Lane 1",
      instructor: "Riley Walsh",
      capacity: 8,
      swimmerIds: [],
    },
    {
      id: `${clubId}-sharks`,
      clubId,
      level: "Sharks 1",
      start: "16:30",
      location: "Main pool · Lane 3",
      instructor: "Alex Murphy",
      capacity: 2,
      swimmerIds: [7, 8].map((i) => `${clubId}-${i}`),
    },
  ],
);
export const COMPETENCIES: Competency[] = [
  {
    id: "float",
    name: "Float on front and back",
    description:
      "Hold a relaxed float for five seconds, then return to standing.",
  },
  {
    id: "glide",
    name: "Push and glide",
    description:
      "Push away from the wall with arms extended and a streamlined body.",
  },
  {
    id: "kick",
    name: "Kick with a float",
    description: "Maintain a steady leg kick while travelling five metres.",
  },
  {
    id: "breathe",
    name: "Breathe into the water",
    description: "Put the face in the water and breathe out steadily.",
  },
  {
    id: "travel",
    name: "Swim five metres",
    description: "Travel five metres independently with a controlled finish.",
  },
];
export const ASSESSMENTS: AssessmentSession[] = (
  Object.keys(CLUBS) as ClubId[]
).flatMap((clubId) => [
  {
    id: `${clubId}-assessment-1`,
    clubId,
    date: "Saturday 12 September",
    time: "10:00",
    capacity: 4,
  },
  {
    id: `${clubId}-assessment-2`,
    clubId,
    date: "Saturday 12 September",
    time: "10:30",
    capacity: 2,
  },
]);
export function initialLesson(course: SwimClass): LessonData {
  return {
    attendance: Object.fromEntries(
      course.swimmerIds.map((id) => [id, "ABSENT"]),
    ),
    competencies: Object.fromEntries(
      course.swimmerIds.map((id, index) => [
        id,
        Object.fromEntries(
          COMPETENCIES.map((skill, j) => [
            skill.id,
            j < (index === 0 ? 4 : index % 4) ? "ACHIEVED" : null,
          ]),
        ),
      ]),
    ),
    note: "",
    attendanceDone: false,
    cover: null,
    completedSwimmers: [],
  };
}
export function initialDesk(): DeskData {
  return { classes: structuredClone(CLASSES), bookings: [], activity: [] };
}
export function lessonKey(course: SwimClass) {
  return `${course.clubId}:${course.id}:${DEMO_DATE}`;
}
export function initials(name: string) {
  return name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("");
}
