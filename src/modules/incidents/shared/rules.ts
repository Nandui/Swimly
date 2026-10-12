import { z } from "zod";
import { addDaysIso, isDateOnly, today } from "@/lib/format";
import { ageGroups, incidentCategories, incidentKinds, MAX_WHYS, personTypes, type IncidentsActor } from "@/modules/incidents/shared/types";

/** Incidents' rules, pure so they can be tested without a database
 *  (docs/incidents.md). Actions call these before they write anything. */

export class IncidentError extends Error {}

const text = (max: number) => z.string().trim().max(max);
const keys = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

const personSchema = z.object({
  type: z.enum(keys(personTypes), { message: "Say who each person involved was." }),
  ageGroup: z.enum(keys(ageGroups), { message: "Say whether each person involved is a child or an adult." }),
  name: text(200), contact: text(200),
  injured: z.boolean(), bodyPart: text(200), injury: text(500),
  firstAid: text(1000), firstAidBy: text(200),
  ambulance: z.boolean(), hospital: z.boolean(),
});
export type PersonInput = z.input<typeof personSchema>;

export const reportSchema = z.object({
  siteId: z.string().min(1, "Choose the site it happened at."),
  area: text(120),
  kind: z.enum(keys(incidentKinds), { message: "Choose whether it was an accident, an incident or a near miss." }),
  category: z.enum(keys(incidentCategories), { message: "Choose what it was about." }),
  occurredOn: z.string().refine(isDateOnly, "Choose the day it happened."),
  occurredAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter the time it happened, such as 14:30."),
  description: text(4000).min(10, "Say what happened, in a sentence or two."),
  immediateAction: text(2000),
  raisedBy: text(200),
  people: z.array(personSchema).max(10, "Up to 10 people on one report. Add the rest as an addendum."),
  witnesses: z.array(z.object({ name: text(200).min(1, "Give each witness's name, or remove the row."), contact: text(200) })).max(10, "Up to 10 witnesses on one report."),
});
export type ReportInput = z.input<typeof reportSchema>;
export type Report = z.output<typeof reportSchema>;

/** Checks that need more than one field. Returns the first problem, if any. */
export function reportProblem(r: Report, now = new Date()): string | null {
  const day = today(now);
  if (r.occurredOn > day) return "It can't have happened in the future. Check the day.";
  if (r.occurredOn < addDaysIso(day, -365)) return "Report things from the last year here. Talk to your manager about anything older.";
  if (r.kind === "accident" && !r.people.some((p) => p.injured)) return "An accident means someone was hurt or became ill. Add them under People involved, or choose Incident.";
  return null;
}

/** A report alerts the managers at once when it says ambulance, hospital or a
 *  category that is always serious (a rescue, a chemical, a missing child). */
export function isSerious(r: Pick<Report, "category"> & { people: readonly { ambulance: boolean; hospital: boolean }[] }): boolean {
  return incidentCategories[r.category as keyof typeof incidentCategories]?.serious === true || r.people.some((p) => p.ambulance || p.hospital);
}

/** The level a report is handled at: the worse of what happened and what could have. */
export const levelOf = (actual: number, potential: number) => Math.max(actual, potential);

/** Weekdays only. Public holidays are not counted, so the date is never later than the law's. */
export function addWorkingDays(iso: string, days: number): string {
  let day = iso, left = days;
  while (left > 0) {
    day = addDaysIso(day, 1);
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    if (weekday !== 0 && weekday !== 6) left -= 1;
  }
  return day;
}
/** Irish law (Safety, Health and Welfare at Work (General Application)
 *  Regulations 2007, Part 14 as replaced by S.I. 370/2016, reg. 225): a written
 *  report within 10 working days, or 5 after a death, which is also told to the
 *  HSA or the Gardaí at once by the quickest means. */
export const HSA_WORKING_DAYS = 10;
export const HSA_FATAL_WORKING_DAYS = 5;

const severity = z.coerce.number().int().min(1, "Choose a severity.").max(5, "Choose a severity.");
export const triageSchema = z.object({
  severityActual: severity,
  severityPotential: severity,
  staffOffOver3Days: z.boolean(),
  publicToDoctor: z.boolean(),
  deathOrDangerous: z.boolean(),
  fatal: z.boolean().default(false),
  parentInformed: text(500),
  outcome: z.enum(["investigate", "close"], { message: "Choose whether to investigate or close it." }),
  note: text(4000).min(3, "Say briefly why you rated it this way."),
});
export type TriageInput = z.input<typeof triageSchema>;

type ReportRow = { status: string; reporterId: string; occurredOn: string; serious: boolean; severityActual: number | null; severityPotential: number | null; hsaReportable: boolean | null };

/** What triage changes, or why it can't. Nobody triages their own report. */
export function triageDecision(row: ReportRow & { hasChild: boolean }, who: IncidentsActor, t: z.output<typeof triageSchema>) {
  if (row.status !== "reported") throw new IncidentError("This report has already been triaged. Refresh the page.");
  if (row.reporterId === who.id) throw new IncidentError("Someone else must triage your own report.");
  if (row.hasChild && t.parentInformed.length < 3) throw new IncidentError("A child was involved: say who told their parent or guardian, and when.");
  const level = levelOf(t.severityActual, t.severityPotential);
  const hsaReportable = t.staffOffOver3Days || t.publicToDoctor || t.deathOrDangerous || t.fatal;
  if (t.outcome === "close" && level >= 3) throw new IncidentError("Moderate and worse need investigating. Choose Investigate; a manager closes it.");
  if (t.outcome === "close" && hsaReportable) throw new IncidentError("A report for the HSA needs investigating. Choose Investigate.");
  return {
    status: t.outcome === "close" ? "closed" : "investigating",
    severityActual: t.severityActual, severityPotential: t.severityPotential,
    hsaReportable, hsaFatal: t.fatal,
    hsaDueOn: hsaReportable ? addWorkingDays(row.occurredOn, t.fatal ? HSA_FATAL_WORKING_DAYS : HSA_WORKING_DAYS) : null,
    parentInformed: t.parentInformed, triageNote: t.note,
  };
}

/** Closing needs a manager when the report is serious or rated moderate or worse. */
export function needsSignoff(row: Pick<ReportRow, "serious" | "severityActual" | "severityPotential">) {
  return row.serious || levelOf(row.severityActual ?? 0, row.severityPotential ?? 0) >= 3;
}

export const closeSchema = z.object({
  note: text(4000).min(10, "Say what was found and what changed, in a sentence or two."),
  hsaReference: text(200),
});
export type CloseInput = z.input<typeof closeSchema>;

/** Closing an investigated report: nothing left open, and from moderate up a
 *  root cause, because the point of investigating is fixing the cause. */
export function closeDecision(row: ReportRow & { rootCause: string }, who: IncidentsActor, c: z.output<typeof closeSchema>, openActions: number) {
  if (row.status !== "investigating") throw new IncidentError("Only a report under investigation can be closed. Refresh the page.");
  if (row.reporterId === who.id) throw new IncidentError("Someone else must close your own report.");
  if (needsSignoff(row) && !who.signoff) throw new IncidentError("A serious or moderate report needs a manager to close it.");
  if (openActions > 0) throw new IncidentError(openActions === 1 ? "One action is still open. Mark it done or cancel it first." : `${openActions} actions are still open. Mark them done or cancel them first.`);
  if (needsRootCause(row) && row.rootCause.length < 3) throw new IncidentError("Record the root cause under Investigation before closing.");
  if (row.hsaReportable && c.hsaReference.length < 3) throw new IncidentError("Record the HSA report's reference, or the date it was sent, before closing.");
  return { status: "closed", closeNote: c.note, hsaReference: c.hsaReference };
}

export const addendumSchema = z.object({ note: text(2000).min(3, "Write the addendum.") });

/** A root cause is required to close a report rated moderate or worse, or a serious one. */
export const needsRootCause = needsSignoff;

/** The investigation's steps (docs/incidents.md, phase 2). Only someone who
 *  triages at the site works on a report under investigation, never their own. */
export function investigable(row: { status: string; reporterId: string }, who: { id: string }) {
  if (row.status !== "investigating") throw new IncidentError("Only a report under investigation can be worked on. Refresh the page.");
  if (row.reporterId === who.id) throw new IncidentError("Someone else must investigate your own report.");
}

export const statementSchema = z.object({
  givenBy: text(200).min(2, "Say who gave the statement."),
  givenAs: text(200),
  takenOn: z.string().refine(isDateOnly, "Choose the day it was given."),
  text: text(8000).min(10, "Write the statement in their words."),
});
export type StatementInput = z.input<typeof statementSchema>;
export function statementProblem(s: z.output<typeof statementSchema>, occurredOn: string, now = new Date()) {
  if (s.takenOn > today(now)) return "A statement can't be from the future. Check the day.";
  if (s.takenOn < occurredOn) return "A statement can't be from before it happened. Check the day.";
  return null;
}

export const investigationSchema = z.object({
  whys: z.array(text(500)).max(MAX_WHYS, `Up to ${MAX_WHYS} answers.`),
  rootCause: text(2000),
});
export type InvestigationInput = z.input<typeof investigationSchema>;
/** Blank answers are dropped, and the order kept: each why asks why of the one before. */
export const cleanWhys = (whys: string[]) => whys.filter(Boolean);

export const actionSchema = z.object({
  title: text(300).min(5, "Say what will change, in a few words."),
  ownerId: z.string().min(1, "Choose who owns it."),
  dueOn: z.string().refine(isDateOnly, "Choose the day it is due."),
});
export type ActionInput = z.input<typeof actionSchema>;
export function actionProblem(a: z.output<typeof actionSchema>, now = new Date()) {
  const day = today(now);
  if (a.dueOn < day) return "The due day has passed. Choose today or later.";
  if (a.dueOn > addDaysIso(day, 366)) return "Choose a due day within the next year.";
  return null;
}

export const actionOutcomeSchema = z.object({
  outcome: z.enum(["done", "cancelled"]),
  note: text(2000).min(3, "Say what was done, or why it was dropped."),
});
export type ActionOutcomeInput = z.input<typeof actionOutcomeSchema>;

/** Reopening a closed report (Manage at the site, never your own): new facts,
 *  or an action that did not work. The reason is kept in the history. */
export const reopenSchema = z.object({ reason: text(2000).min(10, "Say why it is being reopened, in a sentence or two.") });
export function reopenDecision(row: { status: string; reporterId: string }, who: { id: string; signoff: boolean }) {
  if (row.status !== "closed") throw new IncidentError("Only a closed report can be reopened. Refresh the page.");
  if (row.reporterId === who.id) throw new IncidentError("Someone else must reopen your own report.");
  if (!who.signoff) throw new IncidentError("Only a manager who signs off reports at this site can reopen one.");
  return { status: "investigating", closedById: null, closedByName: null, closedAt: null };
}

/** Photos and documents: what a file may be, checked against its first bytes,
 *  not only its name. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_FILES = 10;
export function fileProblem(file: { name: string; type: string; size: number }, bytes: Buffer): string | null {
  const formats = {
    "application/pdf": { extension: /\.pdf$/i, valid: bytes.subarray(0, 5).toString() === "%PDF-" },
    "image/jpeg": { extension: /\.jpe?g$/i, valid: bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 },
    "image/png": { extension: /\.png$/i, valid: bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
    "image/webp": { extension: /\.webp$/i, valid: bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP" },
  };
  const format = formats[file.type as keyof typeof formats];
  if (!format || !format.valid || !format.extension.test(file.name) || file.size !== bytes.length || !bytes.length || bytes.length > MAX_FILE_BYTES)
    return "Use a photo (JPEG, PNG or WebP) or a PDF, up to 4 MB.";
  return null;
}
export const safeFileName = (name: string) => name.replace(/[\x00-\x1f\/\\]/g, "_").slice(0, 200);
