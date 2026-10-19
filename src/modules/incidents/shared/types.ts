import { Ban, CheckCheck, CircleAlert, CircleCheck, CircleDot, Clock, Inbox, OctagonAlert, ScanSearch, TriangleAlert } from "lucide-react";
import type { StatusMeta } from "@/lib/status";

/** Where a report is (docs/incidents.md). Each status has its own icon shape,
 *  so colour is never the only signal. */
export const incidentStatuses = {
  reported: { label: "To triage", color: "blue", icon: Inbox },
  investigating: { label: "Investigating", color: "purple", icon: ScanSearch },
  closed: { label: "Closed", color: "green", icon: CheckCheck },
} satisfies Record<string, StatusMeta>;
export type IncidentStatus = keyof typeof incidentStatuses;

/** Shown beside the status on a report that alerted the managers. */
export const seriousMeta = { label: "Serious", color: "red", icon: TriangleAlert } satisfies StatusMeta;

export const incidentKinds = {
  accident: { label: "Accident", help: "Someone was hurt or became ill." },
  incident: { label: "Incident", help: "Something went wrong and nobody was hurt." },
  near_miss: { label: "Near miss", help: "It could have hurt someone and didn't." },
} as const;
export type IncidentKind = keyof typeof incidentKinds;

/** What it was about. `serious` ones alert the managers whatever else the report says. */
export const incidentCategories = {
  slip_trip_fall: { label: "Slip, trip or fall", serious: false },
  struck: { label: "Struck by or against something", serious: false },
  water_rescue: { label: "Rescue from the water", serious: true },
  illness: { label: "Illness or medical episode", serious: false },
  contamination: { label: "Pool contamination", serious: false },
  chemical: { label: "Chemical leak or exposure", serious: true },
  equipment: { label: "Equipment or building fault", serious: false },
  behaviour: { label: "Aggressive or unsafe behaviour", serious: false },
  lost_child: { label: "Lost or missing child", serious: true },
  security: { label: "Theft or security", serious: false },
  fire: { label: "Fire, alarm or evacuation", serious: false },
  staff: { label: "Staff conduct or welfare", serious: false },
  other: { label: "Something else", serious: false },
} as const;
export type IncidentCategory = keyof typeof incidentCategories;

export const personTypes = {
  public: "Member of the public",
  swimmer: "Swimmer or lesson pupil",
  staff: "Staff member",
  contractor: "Contractor or visitor",
} as const;
export type PersonType = keyof typeof personTypes;
export const ageGroups = { child: "Child (under 18)", adult: "Adult" } as const;
export type AgeGroup = keyof typeof ageGroups;

/** The one severity scale, judged twice at triage: what happened and the worst
 *  that realistically could have. Levels 3 and up need a manager to close. */
export const severities = {
  1: { label: "Minimal", help: "No injury, or a plaster." },
  2: { label: "Minor", help: "First aid on site, back to swimming or work the same day." },
  3: { label: "Moderate", help: "Seen by a GP or treated off site; a rescue; the pool closed." },
  4: { label: "Major", help: "Hospital, an ambulance, staff off more than 3 days, a dangerous occurrence." },
  5: { label: "Severe", help: "A death, or an injury that changes a life." },
} as const;
/** How a severity shows as a tag: its number and word, tone and icon. */
export const SEVERITY_META = {
  1: { label: "1 Minimal", color: "green", icon: CircleCheck },
  2: { label: "2 Minor", color: "green", icon: CircleDot },
  3: { label: "3 Moderate", color: "orange", icon: CircleAlert },
  4: { label: "4 Major", color: "red", icon: TriangleAlert },
  5: { label: "5 Severe", color: "red", icon: OctagonAlert },
} satisfies Record<number, StatusMeta>;
export type Severity = keyof typeof severities;

export const incidentActions = {
  submit: "Reported",
  triage: "Triaged",
  close: "Closed",
  addendum: "Addendum",
  statement: "Statement taken",
  investigation: "Investigation updated",
  action_add: "Action raised",
  action_done: "Action done",
  action_cancel: "Action cancelled",
  file_add: "File added",
  file_remove: "File removed",
  reopen: "Reopened",
  export: "Opened for the insurer",
} as const;
export type IncidentActionKey = keyof typeof incidentActions;

/** A corrective action's state. Overdue is an open action past its due day. */
export const actionStatuses = {
  open: { label: "Open", color: "blue", icon: CircleDot },
  overdue: { label: "Overdue", color: "red", icon: Clock },
  done: { label: "Done", color: "green", icon: CircleCheck },
  cancelled: { label: "Cancelled", color: "gray", icon: Ban },
} satisfies Record<string, StatusMeta>;
export type ActionStatus = keyof typeof actionStatuses;
export const actionStatus = (a: { status: string; dueOn: string }, today: string): ActionStatus =>
  a.status === "open" ? (a.dueOn < today ? "overdue" : "open") : (a.status as ActionStatus);

/** How many "why?" answers an investigation goes to. */
export const MAX_WHYS = 5;

export const incidentNumber = (n: number) => `INC-${String(n).padStart(5, "0")}`;

/** Who is looking: what they may do anywhere. Each report's own site is still
 *  checked with the policy engine before anything is shown or changed. */
export type IncidentsActor = { id: string; name: string; orgId: string | null; superadmin: boolean; review: boolean; signoff: boolean };

/** The level a report is handled at: the worse of what happened and what could have. Here rather
 *  than with the rules so screens that only show the level do not load the form validation. */
export const levelOf = (actual: number, potential: number) => Math.max(actual, potential);
