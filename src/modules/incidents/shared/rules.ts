import { z } from "zod";
import { addDaysIso, isDateOnly, today } from "@/lib/format";
import { ageGroups, incidentCategories, incidentKinds, personTypes, type IncidentsActor } from "@/modules/incidents/shared/types";

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
export const HSA_WORKING_DAYS = 10;

const severity = z.coerce.number().int().min(1, "Choose a severity.").max(5, "Choose a severity.");
export const triageSchema = z.object({
  severityActual: severity,
  severityPotential: severity,
  staffOffOver3Days: z.boolean(),
  publicToDoctor: z.boolean(),
  deathOrDangerous: z.boolean(),
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
  const hsaReportable = t.staffOffOver3Days || t.publicToDoctor || t.deathOrDangerous;
  if (t.outcome === "close" && level >= 3) throw new IncidentError("Moderate and worse need investigating. Choose Investigate; a manager closes it.");
  if (t.outcome === "close" && hsaReportable) throw new IncidentError("A report for the HSA needs investigating. Choose Investigate.");
  return {
    status: t.outcome === "close" ? "closed" : "investigating",
    severityActual: t.severityActual, severityPotential: t.severityPotential,
    hsaReportable, hsaDueOn: hsaReportable ? addWorkingDays(row.occurredOn, HSA_WORKING_DAYS) : null,
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

export function closeDecision(row: ReportRow, who: IncidentsActor, c: z.output<typeof closeSchema>) {
  if (row.status !== "investigating") throw new IncidentError("Only a report under investigation can be closed. Refresh the page.");
  if (row.reporterId === who.id) throw new IncidentError("Someone else must close your own report.");
  if (needsSignoff(row) && !who.signoff) throw new IncidentError("A serious or moderate report needs a manager to close it.");
  if (row.hsaReportable && c.hsaReference.length < 3) throw new IncidentError("Record the HSA report's reference, or the date it was sent, before closing.");
  return { status: "closed", closeNote: c.note, hsaReference: c.hsaReference };
}

export const addendumSchema = z.object({ note: text(2000).min(3, "Write the addendum.") });
