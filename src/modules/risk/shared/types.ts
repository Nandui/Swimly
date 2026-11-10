import { Archive, CalendarCheck, CalendarClock, CalendarOff, CalendarX, Check, ChevronDown, ChevronsUp, ChevronUp, CircleCheck, Hourglass, MessageCircleQuestion, Minus, PencilLine, X } from "lucide-react";
import type { StatusMeta } from "@/lib/status";

/** Risk assessments' words, pure: server and client both read them. Each status, band and review
 *  state has its own icon, so colour is never the only signal. */

export const RISK_STATUSES = ["draft", "review", "approved", "archived"] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];
/** Draft is being written (grey); Waiting for sign-off needs its owner (orange); In force is
 *  signed off (green); Archived is kept, out of use (grey). */
export const RISK_STATUS_META = {
  draft: { label: "Draft", color: "gray", icon: PencilLine },
  review: { label: "Waiting for sign-off", color: "orange", icon: Hourglass },
  approved: { label: "In force", color: "green", icon: CircleCheck },
  archived: { label: "Archived", color: "gray", icon: Archive },
} as const satisfies Record<RiskStatus, StatusMeta>;

export const RISK_BANDS = ["low", "medium", "high", "very_high"] as const;
export type RiskBand = (typeof RISK_BANDS)[number];
/** Likelihood times severity, 1 to 25, in four bands. Only High (orange, needs action) and Very
 *  high (red, serious) are coloured; Low and Medium stay quiet. */
export const RISK_BAND_META = {
  low: { label: "Low", color: "gray", icon: ChevronDown },
  medium: { label: "Medium", color: "gray", icon: Minus },
  high: { label: "High", color: "orange", icon: ChevronUp },
  very_high: { label: "Very high", color: "red", icon: ChevronsUp },
} as const satisfies Record<RiskBand, StatusMeta>;
export const RISK_BAND_RANGE: Record<RiskBand, string> = { low: "1 to 4", medium: "5 to 9", high: "10 to 16", very_high: "17 to 25" };

export const REVIEW_STATES = ["overdue", "due", "ok", "none"] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];
/** Where an assessment's next review stands. Only one in force is on a schedule. */
export const RISK_REVIEW_META = {
  overdue: { label: "Review overdue", color: "red", icon: CalendarX },
  due: { label: "Review due soon", color: "orange", icon: CalendarClock },
  ok: { label: "Review scheduled", color: "gray", icon: CalendarCheck },
  none: { label: "No review scheduled", color: "gray", icon: CalendarOff },
} as const satisfies Record<ReviewState, StatusMeta>;
/** A review counts as due soon this many days ahead. */
export const DUE_SOON_DAYS = 30;

export const REQUEST_STATUSES = ["open", "actioned", "dismissed"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export const RISK_REQUEST_META = {
  open: { label: "To answer", color: "orange", icon: MessageCircleQuestion },
  actioned: { label: "Acted on", color: "green", icon: Check },
  dismissed: { label: "Dismissed", color: "gray", icon: X },
} as const satisfies Record<RequestStatus, StatusMeta>;

export const SUBJECT_TYPES = ["area", "job", "activity"] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];
export const SUBJECT_LABEL: Record<SubjectType, string> = { area: "Area", job: "Job", activity: "Activity" };
export const SUBJECT_HINT: Record<SubjectType, string> = {
  area: "A part of the site: the main pool, the gym, the plant room.",
  job: "The work one position does: lifeguard, receptionist.",
  activity: "Something done at the site: pool supervision, handling chemicals.",
};

export const RISK_CATEGORIES = ["physical", "chemical", "biological", "ergonomic", "psychosocial", "environmental"] as const;
export type RiskCategory = (typeof RISK_CATEGORIES)[number];
export const CATEGORY_LABEL: Record<RiskCategory, string> = {
  physical: "Physical", chemical: "Chemical", biological: "Biological", ergonomic: "Ergonomic", psychosocial: "Psychosocial", environmental: "Environmental",
};

/** Who a hazard could harm. Every hazard names one or more of these. */
export const PERSONS_AT_RISK = ["Staff", "Customers", "Children", "Contractors", "Visitors"] as const;
export type PersonAtRisk = (typeof PERSONS_AT_RISK)[number];

/** The 1 to 5 scales, index 0 for a rating of 1. */
export const LIKELIHOOD_LABELS = ["Improbable", "Possible", "Very possible", "Probable", "Almost certain"] as const;
export const SEVERITY_LABELS = ["Insignificant", "Minor", "Moderate", "Major", "Fatal"] as const;
export const SEVERITY_HINTS = [
  "Minor first aid, no time off",
  "Lost time, recoverable: a strain, sprain or cut",
  "Temporary disability, recoverable: a minor fracture, concussion",
  "Permanent disability: a major fracture, amputation, poisoning",
  "Death of one or more people",
] as const;

export const REVIEW_OUTCOMES = ["no_changes", "updated", "escalated"] as const;
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];
export const OUTCOME_LABEL: Record<ReviewOutcome, string> = { no_changes: "No changes needed", updated: "Updated", escalated: "Escalated" };

export const REVIEW_MONTHS = [1, 3, 6, 12, 24, 36] as const;
const REVIEW_MONTHS_LABEL: Record<number, string> = { 1: "Every month", 3: "Every 3 months", 6: "Every 6 months", 12: "Every year", 24: "Every 2 years", 36: "Every 3 years" };
export const reviewEvery = (months: number) => REVIEW_MONTHS_LABEL[months] ?? `Every ${months} months`;

/** The history's words for each step. */
export const RISK_ACTIONS = {
  create: "Draft started",
  import: "Brought over from Risk Management",
  edit: "Details changed",
  hazard_add: "Hazard added",
  hazard_edit: "Hazard changed",
  hazard_remove: "Hazard removed",
  submit: "Sent for sign-off",
  owner_approve: "Signed off by its owner",
  owner_withdraw: "Owner’s sign-off withdrawn",
  exec_approve: "Executive sign-off given",
  exec_withdraw: "Executive sign-off withdrawn",
  signoff_reset: "Sign-off cleared",
  review: "Review logged",
  request: "Review asked for",
  request_actioned: "Review request acted on",
  request_dismissed: "Review request dismissed",
  archive: "Archived",
  restore: "Brought back",
} as const;
export type RiskAction = keyof typeof RISK_ACTIONS;

/** The moves on an assessment's page that change where it stands. */
export const MOVES = ["submit", "owner_approve", "owner_withdraw", "exec_approve", "exec_withdraw", "archive", "restore"] as const;
export type Move = (typeof MOVES)[number];

/** One assessment as screens see it: no platform rows, only ids and names. */
export type RiskAssessmentView = {
  id: string; reference: string; status: RiskStatus; version: number;
  siteId: string; siteName: string; subjectType: SubjectType; subject: string; scope: string;
  departmentId: string | null; departmentName: string; ownerId: string | null; ownerName: string; assessorName: string;
  assessedOn: string; reviewMonths: number; targetScore: number; lastReviewedOn: string | null; nextReviewOn: string;
  ownerApprovedByName: string | null; ownerApprovedAt: string | null; execApprovedById: string | null; execApprovedByName: string | null; execApprovedAt: string | null;
  createdByName: string; createdAt: string; updatedAt: string;
};
export type RiskHazardView = {
  id: string; seq: number; reference: string; hazard: string; riskFactor: string; personsAtRisk: PersonAtRisk[]; consequence: string;
  inherentLikelihood: number; inherentSeverity: number; controls: string; likelihood: number; severity: number; score: number;
  furtherAction: string; category: RiskCategory;
};
export type RiskReviewView = { id: string; reviewedOn: string; reviewerName: string; outcome: ReviewOutcome; notes: string; nextReviewOn: string };
export type RiskRequestView = {
  id: string; assessmentId: string; hazardId: string | null; hazardLabel: string; requestedByName: string; notes: string; status: RequestStatus;
  resolvedByName: string | null; resolvedAt: string | null; resolutionNote: string; sourceIncidentId: string | null; sourceIncidentRef: string; createdAt: string;
};
export type RiskHistory = { id: string; action: RiskAction; actorName: string; note: string; createdAt: string };
export type RiskResult = { ok: true; id: string } | { ok: false; error: string };
