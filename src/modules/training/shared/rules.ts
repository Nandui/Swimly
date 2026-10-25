/** Compliance autopilot (e-learning phase 4): who must take a
 *  course, and when it is due again. Pure, so the rules page can say what a
 *  rule will do before it is saved, and the daily run and the matrix agree. */
import { toDateOnlyString } from "@/lib/format";

export type RuleAudience = { roleIds: string[]; departmentIds: string[]; siteIds: string[]; positionIds: string[] };
export type RuleTiming = { dueDays: number; renewMonths: number | null; renewLeadDays: number };
export type RulePerson = { id: string; roleId: string | null; departmentIds: string[]; siteIds: string[]; positionId: string | null };

/** One past or open assignment of the course for one person. */
export type RuleHistory = { status: string; assignedAt: Date; completedAt: Date | null; cancelledAt: Date | null; ruleId: string | null };

export const MAX_RULE_LIST = 50;
export const DEFAULT_TIMING: RuleTiming = { dueDays: 30, renewMonths: null, renewLeadDays: 30 };

/** Whether the rule covers this person. Empty lists mean everyone. A person
 *  with no sites works at every site, so a site rule covers them. */
export function ruleCovers(rule: RuleAudience, person: RulePerson) {
  if (rule.roleIds.length && !(person.roleId && rule.roleIds.includes(person.roleId))) return false;
  if (rule.departmentIds.length && !person.departmentIds.some((d) => rule.departmentIds.includes(d))) return false;
  if (rule.positionIds.length && !(person.positionId && rule.positionIds.includes(person.positionId))) return false;
  if (rule.siteIds.length && person.siteIds.length && !person.siteIds.some((s) => rule.siteIds.includes(s))) return false;
  return true;
}

const DAY = 86_400_000;
const dateOnly = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
export const addDays = (d: Date, days: number) => new Date(dateOnly(d).getTime() + days * DAY);
/** Months later on the same day, or the month's last day when it is shorter (31 Jan + 1 month = 28 or 29 Feb). */
export function addMonths(d: Date, months: number) {
  const base = dateOnly(d);
  const target = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(base.getUTCDate(), last)));
}

export type RuleState =
  | { state: "open" }
  | { state: "excused" }
  | { state: "done"; completedAt: Date; dueAgain: Date | null }
  | { state: "assign"; dueOn: Date; renewal: boolean };

/** What the rule does for one person today, from their history on the course:
 *  nothing while one is open; nothing after someone cancelled the rule's own
 *  assignment (an exemption, until it would be due again); assign it when they
 *  have never finished it, or when it is due again within the lead time. */
export function ruleState(rule: RuleTiming & { id: string }, history: readonly RuleHistory[], on: Date): RuleState {
  if (history.some((h) => h.status === "ASSIGNED" || h.status === "SUBMITTED")) return { state: "open" };
  const lastDone = history.filter((h) => h.status === "COMPLETED" && h.completedAt).sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime())[0];
  const dueAgain = lastDone && rule.renewMonths ? addMonths(lastDone.completedAt!, rule.renewMonths) : null;
  const excused = history.some((h) => h.status === "CANCELLED" && h.ruleId === rule.id && h.cancelledAt
    && (!lastDone || h.cancelledAt > lastDone.completedAt!) && (!dueAgain || h.assignedAt >= addDays(dueAgain, -rule.renewLeadDays)));
  if (excused) return { state: "excused" };
  const today = dateOnly(on);
  if (!lastDone) return { state: "assign", dueOn: addDays(today, rule.dueDays), renewal: false };
  if (!dueAgain || today < addDays(dueAgain, -rule.renewLeadDays)) return { state: "done", completedAt: lastDone.completedAt!, dueAgain };
  // Due again: by the renewal date, or the usual time to finish if that has passed.
  return { state: "assign", dueOn: dueAgain > today ? dueAgain : addDays(today, rule.dueDays), renewal: true };
}

/** A person's standing on one required course, for the matrix. */
export type MatrixCell =
  | { kind: "done"; on: string; dueAgain: string | null; soon: boolean }
  | { kind: "due"; on: string | null; overdue: boolean; submitted: boolean }
  | { kind: "missing" }
  | { kind: "excused" }
  | { kind: "expired"; on: string };

const SOON_DAYS = 60;

/** Where someone stands on a course a rule says they need. */
export function matrixCell(rule: RuleTiming & { id: string }, history: readonly (RuleHistory & { dueOn: Date | null })[], on: Date): MatrixCell {
  const today = dateOnly(on);
  const open = history.find((h) => h.status === "ASSIGNED" || h.status === "SUBMITTED");
  if (open) return { kind: "due", on: open.dueOn ? toDateOnlyString(open.dueOn) : null, overdue: !!open.dueOn && open.dueOn < today, submitted: open.status === "SUBMITTED" };
  const state = ruleState(rule, history, on);
  if (state.state === "excused") return { kind: "excused" };
  const lastDone = history.filter((h) => h.status === "COMPLETED" && h.completedAt).sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime())[0];
  if (!lastDone) return { kind: "missing" };
  const dueAgain = rule.renewMonths ? addMonths(lastDone.completedAt!, rule.renewMonths) : null;
  if (dueAgain && dueAgain < today) return { kind: "expired", on: toDateOnlyString(dueAgain) };
  return { kind: "done", on: toDateOnlyString(lastDone.completedAt!), dueAgain: dueAgain ? toDateOnlyString(dueAgain) : null, soon: !!dueAgain && dueAgain <= addDays(today, SOON_DAYS) };
}

/** Counts towards "compliant": finished and in date, or excused. */
export const isCompliant = (cell: MatrixCell) => cell.kind === "done" || cell.kind === "excused";

/** Who a rule covers, in words: "Lifeguards at Bishopstown in Aquatics". */
export function audienceInWords(rule: RuleAudience, names: { roles: Map<string, string>; departments: Map<string, string>; sites: Map<string, string>; positions: Map<string, string> }) {
  const list = (ids: string[], map: Map<string, string>) => ids.map((id) => map.get(id)).filter(Boolean).join(", ");
  const parts = [
    rule.positionIds.length ? list(rule.positionIds, names.positions) : null,
    rule.roleIds.length ? `with the role ${list(rule.roleIds, names.roles)}` : null,
    rule.departmentIds.length ? `in ${list(rule.departmentIds, names.departments)}` : null,
    rule.siteIds.length ? `at ${list(rule.siteIds, names.sites)}` : null,
  ].filter(Boolean);
  if (!parts.length) return "Everyone";
  return rule.positionIds.length ? parts.join(" ") : `Everyone ${parts.join(" ")}`;
}

/** How often, in words. */
export const timingInWords = (t: RuleTiming) =>
  `${t.dueDays} ${t.dueDays === 1 ? "day" : "days"} to finish${t.renewMonths ? `, again every ${t.renewMonths === 12 ? "year" : t.renewMonths % 12 === 0 ? `${t.renewMonths / 12} years` : `${t.renewMonths} months`}` : ", once"}`;

/** Which tone a matrix cell shows. */
export function cellTone(cell: MatrixCell): "done" | "soon" | "due" | "submitted" | "overdue" | "expired" | "missing" | "excused" {
  if (cell.kind === "done") return cell.soon ? "soon" : "done";
  if (cell.kind === "due") return cell.submitted ? "submitted" : cell.overdue ? "overdue" : "due";
  return cell.kind;
}

/** A cell a spreadsheet opens safely: quoted, and never read as a formula. */
function csvCell(value: unknown): string {
  let s = String(value ?? "");
  if (/^[=+@\-\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
}
export const csvRows = (rows: readonly (readonly unknown[])[]) => rows.map((r) => r.map(csvCell).join(",")).join("\r\n");

/** A matrix cell in words, for the download. */
export function cellInWords(cell: MatrixCell | null) {
  if (!cell) return "Not needed";
  switch (cell.kind) {
    case "done": return cell.dueAgain ? `Done ${cell.on}, due again ${cell.dueAgain}` : `Done ${cell.on}`;
    case "due": return cell.submitted ? "Awaiting sign-off" : `${cell.overdue ? "Overdue" : "To do"}${cell.on ? `, due ${cell.on}` : ""}`;
    case "expired": return `Out of date since ${cell.on}`;
    case "missing": return "Not assigned yet";
    case "excused": return "Excused";
  }
}
