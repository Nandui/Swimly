/** Activities are what the centre runs for customers. Each activity type says
 *  which shared features it uses, so camps, pool hire or fitness classes can
 *  join without pretending to be swim lessons.
 *
 *  Today every programme is Swim school. When a second type arrives, give
 *  `Programme` an additive `activityType` column (default "swim-school") and
 *  register the type here; screens then ask `hasFeature` instead of assuming
 *  levels and competencies exist. See docs/architecture.md. */

export type ActivityFeature =
  /** Levels and competencies, marked on the deck, with level completion and moves. */
  | "progression"
  /** Dated assessment sessions that place new customers at a level. */
  | "assessments"
  /** Guardians see progress and book through the parent app. */
  | "parentApp"
  /** Full classes keep an ordered waitlist. */
  | "waitlists"
  /** Instructors declare cover when teaching someone else's class. */
  | "cover";

export type ActivityType = {
  key: string;
  /** What staff call it, e.g. "Swim school". */
  name: string;
  /** What one customer is called within it, e.g. "swimmer". */
  participant: string;
  features: readonly ActivityFeature[];
};

export const ACTIVITY_TYPES = {
  "swim-school": {
    key: "swim-school",
    name: "Swim school",
    participant: "swimmer",
    features: ["progression", "assessments", "parentApp", "waitlists", "cover"],
  },
} as const satisfies Record<string, ActivityType>;

export type ActivityTypeKey = keyof typeof ACTIVITY_TYPES;

const DEFAULT_ACTIVITY_TYPE: ActivityTypeKey = "swim-school";

/** The type a programme belongs to. Programmes have no type column yet, so
 *  everything is Swim school; an unknown stored key also falls back to it. */
export function activityTypeOf(programme?: { activityType?: string | null } | null): ActivityType {
  const key = programme?.activityType;
  return key && key in ACTIVITY_TYPES ? ACTIVITY_TYPES[key as ActivityTypeKey] : ACTIVITY_TYPES[DEFAULT_ACTIVITY_TYPE];
}

export function hasFeature(programme: { activityType?: string | null } | null | undefined, feature: ActivityFeature): boolean {
  return activityTypeOf(programme).features.includes(feature);
}
