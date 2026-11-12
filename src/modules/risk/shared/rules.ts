import { z } from "zod";
import { isDateOnly } from "@/lib/format";
import { DUE_SOON_DAYS, MOVES, PERSONS_AT_RISK, REVIEW_OUTCOMES, RISK_CATEGORIES, SUBJECT_TYPES, type Move, type PersonAtRisk, type ReviewState, type RiskBand, type RiskStatus } from "./types";

/** Risk assessments' rules, pure (tested in rules.test.ts). */

/** A problem a person can fix by changing what they entered; shown beside the form. */
export class RiskError extends Error {}

// ---- Scores -----------------------------------------------------------------------------------

/** A rating on the 1 to 5 scales. */
export function clampRating(n: number) {
  return Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : 1;
}
/** Likelihood times severity: 1 to 25. */
export const riskScore = (likelihood: number, severity: number) => clampRating(likelihood) * clampRating(severity);
/** Low 1 to 4, Medium 5 to 9, High 10 to 16, Very high 17 to 25. */
export function riskBand(score: number): RiskBand {
  return score <= 4 ? "low" : score <= 9 ? "medium" : score <= 16 ? "high" : "very_high";
}
/** The score from which a hazard is on the high-risk list: High and Very high. */
export const HIGH_RISK_FROM = 10;
export const isHighRisk = (score: number) => score >= HIGH_RISK_FROM;
/** An assessment's overall risk with its controls in place: the rounded mean of its hazards'
 *  scores; null with no hazards. */
export function overallScore(hazards: readonly { score: number }[]): number | null {
  return hazards.length ? Math.round(hazards.reduce((sum, h) => sum + h.score, 0) / hazards.length) : null;
}
export function highestScore(hazards: readonly { score: number }[]): number | null {
  return hazards.length ? Math.max(...hazards.map((h) => h.score)) : null;
}

// ---- Days -------------------------------------------------------------------------------------

/** The same day `months` later; the month's last day when it has no such day (31 January plus one
 *  month is 28 or 29 February). */
export function addMonthsIso(iso: string, months: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}
/** Whole days from one day to another; negative when `to` is earlier. */
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}
/** Where the next review stands. Only an assessment in force is on a schedule: a draft, one
 *  waiting for sign-off and an archived one have none. */
export function reviewStateOf(a: { status: string; nextReviewOn: string }, today: string): { state: ReviewState; days: number } {
  if (a.status !== "approved") return { state: "none", days: 0 };
  const days = daysBetween(today, a.nextReviewOn);
  return { state: days < 0 ? "overdue" : days <= DUE_SOON_DAYS ? "due" : "ok", days };
}
/** The same in words: "Overdue by 12 days", "Due today", "Due in 5 days". */
export function reviewLine({ state, days }: { state: ReviewState; days: number }) {
  if (state === "none") return "No review scheduled";
  if (days < 0) return `Overdue by ${-days} ${days === -1 ? "day" : "days"}`;
  return days === 0 ? "Due today" : `Due in ${days} ${days === 1 ? "day" : "days"}`;
}

// ---- References -------------------------------------------------------------------------------

/** A site's two letters in a reference: its code, else the first two letters of its name. */
export function siteCodeOf(site: { name: string; code?: string | null }) {
  const code = (site.code ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  return code || site.name.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase() || "XX";
}
export const referencePrefix = (code: string) => `RA-${code}-`;
export const riskReference = (code: string, n: number) => `${referencePrefix(code)}${String(n).padStart(4, "0")}`;
/** The number at the end of a reference with this prefix; 0 when it is not one. */
export function referenceNumber(reference: string, prefix: string) {
  const rest = reference.startsWith(prefix) ? reference.slice(prefix.length) : "";
  return /^\d+$/.test(rest) ? Number(rest) : 0;
}
export const hazardReference = (reference: string, seq: number) => `${reference}-HZ-${String(seq).padStart(3, "0")}`;

// ---- Who is at risk ---------------------------------------------------------------------------

const PERSON_WORDS: { person: PersonAtRisk; re: RegExp }[] = [
  { person: "Staff", re: /\b(staff|employee|reception|maintenance|clean|lifeguard|instructor|coach|trainer|warden|personnel|worker|attendant|operative|officer|teacher|supervisor|manager|caretaker)/i },
  { person: "Customers", re: /\b(customer|member|patron|participant|swimmer|bather|client|gym|attendee|user)/i },
  { person: "Children", re: /\b(child|kid|junior|minor|infant|toddler|pupil|school)/i },
  { person: "Contractors", re: /\b(contractor|sub-?contractor|supplier|deliver|vendor|engineer|tradesperson|installer)/i },
  { person: "Visitors", re: /\b(visitor|public|spectator|parent|guardian|guest|observer|viewer|passer)/i },
];
/** Free text ("Members of the public, staff") as the standard names, in their order. Text brought
 *  over from the old app goes through this; "members of the public" are Visitors, not Customers. */
export function personsFrom(raw: string | null | undefined): PersonAtRisk[] {
  if (!raw) return [];
  const text = ` ${raw.toLowerCase()} `.replace(/members?\s+of\s+the\s+public/g, " public ");
  return PERSONS_AT_RISK.filter((person) => PERSON_WORDS.some((w) => w.person === person && w.re.test(text)));
}
/** How the names are kept, and read back. */
export const personsText = (persons: readonly PersonAtRisk[]) => PERSONS_AT_RISK.filter((p) => persons.includes(p)).join(", ");
export const personsOf = (stored: string) => PERSONS_AT_RISK.filter((p) => stored.split(", ").includes(p));

// ---- What is sent -----------------------------------------------------------------------------

const text = (max: number) => z.string().trim().max(max);
const day = (problem: string) => z.string().refine(isDateOnly, problem);
const rating = (problem: string) => z.number({ error: problem }).int(problem).min(1, problem).max(5, problem);

const details = {
  subjectType: z.enum(SUBJECT_TYPES, { error: "Choose what the assessment is about: an area, a job or an activity." }),
  subject: text(160).min(2, "Choose what the assessment is about."),
  scope: text(4000).default(""),
  departmentId: text(100).default(""),
  ownerId: text(100).default(""),
  assessorName: text(120).default(""),
  assessedOn: day("Give the day the assessment was carried out."),
  reviewMonths: z.number({ error: "Choose how often it is reviewed." }).int().min(1, "Choose how often it is reviewed.").max(60, "Review at least every five years."),
  targetScore: z.number({ error: "Give the target risk, from 1 to 25." }).int("Give the target risk, from 1 to 25.").min(1, "Give the target risk, from 1 to 25.").max(25, "Give the target risk, from 1 to 25."),
};
export type DetailFields = { subjectType: z.infer<typeof details.subjectType>; subject: string; scope: string; departmentId: string; ownerId: string; assessorName: string; assessedOn: string; reviewMonths: number; targetScore: number };

/** A new draft. `id` and `operationId` come from the form, so sending twice saves once. */
export const createSchema = z.object({ id: z.uuid(), operationId: z.uuid(), siteId: z.string().min(1, "Choose a site."), ...details });
export type CreateInput = z.input<typeof createSchema>;
/** Changing the details. The site stays: its code is in the reference. */
export const editSchema = z.object({ id: z.string().min(1), operationId: z.uuid(), version: z.number().int().positive(), ...details });
export type EditInput = z.input<typeof editSchema>;

const hazard = {
  hazard: text(300).min(2, "Say what the hazard is, such as ‘Wet floor at the pool edge’."),
  riskFactor: text(1000).default(""),
  personsAtRisk: z.array(z.enum(PERSONS_AT_RISK)).min(1, "Choose who could be harmed."),
  consequence: text(1000).default(""),
  inherentLikelihood: rating("Rate how likely it is before any controls, 1 to 5."),
  inherentSeverity: rating("Rate how severe it could be before any controls, 1 to 5."),
  controls: text(4000).default(""),
  likelihood: rating("Rate how likely it is with the controls in place, 1 to 5."),
  severity: rating("Rate how severe it could be with the controls in place, 1 to 5."),
  furtherAction: text(4000).default(""),
  category: z.enum(RISK_CATEGORIES, { error: "Choose the kind of hazard." }),
};
const onAssessment = { assessmentId: z.string().min(1), operationId: z.uuid(), version: z.number().int().positive() };
export const addHazardSchema = z.object({ ...onAssessment, hazardId: z.uuid(), ...hazard });
export type AddHazardInput = z.input<typeof addHazardSchema>;
export const editHazardSchema = z.object({ ...onAssessment, hazardId: z.string().min(1), ...hazard });
export type EditHazardInput = z.input<typeof editHazardSchema>;
export const removeHazardSchema = z.object({ ...onAssessment, hazardId: z.string().min(1) });
export type RemoveHazardInput = z.input<typeof removeHazardSchema>;
export type HazardFields = { hazard: string; riskFactor: string; personsAtRisk: PersonAtRisk[]; consequence: string; inherentLikelihood: number; inherentSeverity: number; controls: string; likelihood: number; severity: number; furtherAction: string; category: z.infer<typeof hazard.category> };

export const moveSchema = z.object({ id: z.string().min(1), operationId: z.uuid(), version: z.number().int().positive(), move: z.enum(MOVES), note: text(1000).default("") });
export type MoveInput = z.input<typeof moveSchema>;

export const reviewSchema = z.object({
  id: z.string().min(1), operationId: z.uuid(), version: z.number().int().positive(),
  reviewedOn: day("Give the day the review was carried out."),
  outcome: z.enum(REVIEW_OUTCOMES, { error: "Choose what the review found." }),
  notes: text(2000).default(""),
});
export type ReviewInput = z.input<typeof reviewSchema>;

export const requestSchema = z.object({
  id: z.string().min(1), operationId: z.uuid(), hazardId: text(100).default(""),
  notes: text(2000).min(3, "Say what should be looked at again, and why."),
});
export type RequestInput = z.input<typeof requestSchema>;

export const answerSchema = z.object({ requestId: z.string().min(1), operationId: z.uuid(), answer: z.enum(["actioned", "dismissed"]), note: text(2000).default("") });
export type AnswerInput = z.input<typeof answerSchema>;

/** The first problem in what was sent, in the person's words. */
export function problemOf(error: z.ZodError) {
  return error.issues[0]?.message ?? "Check the details and try again.";
}

// ---- What a change does -----------------------------------------------------------------------

/** The hazard columns as kept: the names as text, and the score beside its two ratings. */
export function hazardData(f: HazardFields) {
  return { ...f, personsAtRisk: personsText(f.personsAtRisk), score: riskScore(f.likelihood, f.severity) };
}

/** When the next review falls: so many months after the last one, or after the assessment while
 *  it has never been reviewed. */
export function nextReviewFor(a: { assessedOn: string; lastReviewedOn: string | null; reviewMonths: number }) {
  return addMonthsIso(a.lastReviewedOn ?? a.assessedOn, a.reviewMonths);
}

const NO_SIGNOFF = { ownerApprovedById: null, ownerApprovedByName: null, ownerApprovedAt: null, execApprovedById: null, execApprovedByName: null, execApprovedAt: null };
type Signed = { status: string; ownerApprovedAt: Date | null; execApprovedAt: Date | null };

/** What changing an assessment's content does to where it stands: a signed-off assessment is no
 *  longer what was signed, so it loses its sign-off and waits for it again. A draft stays a draft;
 *  an archived one is brought back first. */
export function afterContentChange(row: Signed): { data: Partial<typeof NO_SIGNOFF> & { status?: RiskStatus }; cleared: boolean } {
  if (row.status === "archived") throw new RiskError("This assessment is archived. Bring it back before changing it.");
  const cleared = !!(row.ownerApprovedAt || row.execApprovedAt);
  return { data: { ...(cleared ? NO_SIGNOFF : {}), ...(row.status === "approved" ? { status: "review" as const } : {}) }, cleared };
}

/** The permission each move needs at the assessment's site. */
export const MOVE_NEEDS = {
  submit: "risk.write", owner_approve: "risk.write", owner_withdraw: "risk.write",
  exec_approve: "risk.signoff", exec_withdraw: "risk.signoff", archive: "risk.manage", restore: "risk.manage",
} as const satisfies Record<Move, string>;

type MoveRow = Signed & { archivedFrom: string; ownerId: string | null; ownerName: string; hazards: number };
/** The change one move makes, or why it cannot be made. Only the owner signs off or withdraws
 *  that; the executive sign-off sits on top of it and never comes from the owner. */
export function moveChange(row: MoveRow, move: Move, note: string, who: { id: string; name: string }, now: Date) {
  const owner = !!row.ownerId && row.ownerId === who.id;
  const notOwner = `Only its owner${row.ownerName ? `, ${row.ownerName},` : ""} does this.`;
  if (move === "submit") {
    if (row.status !== "draft") throw new RiskError("Only a draft is sent for sign-off. Refresh to see where it stands.");
    if (!row.ownerId) throw new RiskError("Choose who owns this assessment first: its owner signs it off.");
    if (!row.hazards) throw new RiskError("Add at least one hazard before sending it for sign-off.");
    return { status: "review" as const };
  }
  if (move === "owner_approve") {
    if (row.status !== "review") throw new RiskError("Only an assessment waiting for sign-off can be signed off. Refresh to see where it stands.");
    if (!owner) throw new RiskError(notOwner);
    if (!row.hazards) throw new RiskError("Add at least one hazard before signing it off.");
    return { status: "approved" as const, ownerApprovedById: who.id, ownerApprovedByName: who.name, ownerApprovedAt: now };
  }
  if (move === "owner_withdraw") {
    if (row.status !== "approved") throw new RiskError("This assessment is not in force. Refresh to see where it stands.");
    if (!owner) throw new RiskError(notOwner);
    if (note.length < 3) throw new RiskError("Say why the sign-off is withdrawn.");
    return { status: "review" as const, ...NO_SIGNOFF };
  }
  if (move === "exec_approve") {
    if (row.status !== "approved" || !row.ownerApprovedAt) throw new RiskError("The executive sign-off follows the owner’s. This assessment is not in force yet.");
    if (owner) throw new RiskError("The executive sign-off comes from someone other than the owner.");
    if (row.execApprovedAt) throw new RiskError("It already has the executive sign-off. Refresh the page.");
    return { execApprovedById: who.id, execApprovedByName: who.name, execApprovedAt: now };
  }
  if (move === "exec_withdraw") {
    if (!row.execApprovedAt) throw new RiskError("It has no executive sign-off to withdraw. Refresh the page.");
    if (owner) throw new RiskError("The executive sign-off is withdrawn by someone other than the owner.");
    if (note.length < 3) throw new RiskError("Say why the sign-off is withdrawn.");
    return { execApprovedById: null, execApprovedByName: null, execApprovedAt: null };
  }
  if (move === "archive") {
    if (row.status === "archived") throw new RiskError("It is already archived. Refresh the page.");
    return { status: "archived" as const, archivedFrom: row.status };
  }
  if (row.status !== "archived") throw new RiskError("It is not archived. Refresh the page.");
  const back = row.archivedFrom === "approved" && !row.ownerApprovedAt ? "review" : row.archivedFrom;
  return { status: (["draft", "review", "approved"].includes(back) ? back : "draft") as RiskStatus, archivedFrom: "" };
}

const DETAIL_LABELS = {
  subjectType: "what it is about", subject: "what it is about", scope: "what it covers", departmentId: "department", ownerId: "owner",
  assessorName: "assessor", assessedOn: "assessment day", reviewMonths: "how often it is reviewed", targetScore: "target risk",
} as const satisfies Record<keyof DetailFields, string>;
/** The details an edit changed, in words, for the history. */
export function changedDetails(old: { [K in keyof DetailFields]: DetailFields[K] | null }, next: DetailFields) {
  const keys = (Object.keys(DETAIL_LABELS) as (keyof DetailFields)[]).filter((k) => (old[k] ?? "") !== next[k]);
  return [...new Set(keys.map((k) => DETAIL_LABELS[k]))];
}
