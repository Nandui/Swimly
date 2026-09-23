import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { visibleScreens, type ScreenKey } from "@/lib/staff/screens";

export const RECEPTION_PORTAL_HOME = "reception-portal";
export const RECEPTION_PORTAL_PATH = "/reception-portal";
export const RECEPTION_PORTAL_NAME = "Turnfin Reception Portal";

type ReceptionLink = {
  id: string;
  label: string;
  description?: string;
  href: string;
  screen: ScreenKey;
  permission?: PermissionKey;
};

const TASKS: readonly ReceptionLink[] = [
  { id: "swimmers", label: "Find a swimmer", description: "Details, progress and enrolment", href: "/students", screen: "students" },
  { id: "classes", label: "Find a class", description: "Times, instructors and spaces", href: "/courses", screen: "courses" },
  { id: "add", label: "Add a swimmer", description: "Create a new swimmer record", href: "/students", screen: "students", permission: "students.manage" },
  { id: "assessments", label: "Book an assessment", description: "Find a session and book a place", href: "/assessments", screen: "assessments", permission: "enrolment.manage" },
  { id: "siblings", label: "Find sibling times", description: "Lessons that work for the family", href: "/together", screen: "together" },
];

const FOLLOW_UP: readonly ReceptionLink[] = [
  { id: "enrolment", label: "Awaiting enrolment", href: "/awaiting-enrolment", screen: "awaiting-enrolment" },
  { id: "moves", label: "Ready to move", href: "/awaiting-enrolment?view=moves", screen: "awaiting-enrolment" },
  { id: "agreements", label: "Legend agreements", href: "/legend-agreements", screen: "legend-agreements" },
  { id: "parents", label: "Parent access requests", href: "/students/parents", screen: "students", permission: "parents.manage" },
];

const RECEPTION_SCREENS: readonly ScreenKey[] = [
  "students", "courses", "calendar", "together", "assessments", "awaiting-enrolment", "legend-agreements",
];

/** A portal only offers existing destinations; it never grants access to them.
 * Keep this pure so the server, navigation and synthetic checks share the rules. */
export function receptionPortalAccess(permissions: readonly string[], screens: readonly string[]) {
  const held = expandPermissions(permissions);
  const visible = visibleScreens(screens, held);
  const allowed = (link: ReceptionLink) => visible.has(link.screen) && (!link.permission || held.has(link.permission));
  const aquatics = RECEPTION_SCREENS.some(screen => visible.has(screen));
  const docs = visible.has("docs");
  const refunds = visible.has("refunds");
  return {
    available: aquatics || docs || refunds,
    aquatics,
    docs,
    refunds,
    tasks: TASKS.filter(allowed),
    followUp: FOLLOW_UP.filter(allowed),
  };
}

export type ReceptionPortalAccess = ReturnType<typeof receptionPortalAccess>;

/** The stored landing preference is explicit. Never infer a job from a role
 * name or from action permissions shared by several different staff jobs. */
export function staffPortalPath(home: string, permissions: readonly string[], screens: readonly string[]) {
  return home === RECEPTION_PORTAL_HOME && receptionPortalAccess(permissions, screens).available
    ? RECEPTION_PORTAL_PATH
    : "/modules";
}
