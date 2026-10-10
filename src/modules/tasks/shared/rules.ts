import { Ban, CircleCheck, CircleDashed, Clock3, Hourglass, MinusCircle, ShieldCheck, Archive, Send, TriangleAlert, CircleAlert, Circle, Flag } from "lucide-react";
import { SCHOOL_TIMEZONE, formatTime, minutesNow } from "@/lib/format";
import type { StatusMeta } from "@/lib/status";

/** Tasks' rules, pure so they are tested on their own (docs/tasks.md): what a
 *  task asks for, when it is due, whether it can be completed, what is out of
 *  range, and the site's score. No database, no session. */

// ---------------------------------------------------------------------------
// What a task asks for
// ---------------------------------------------------------------------------

export const FIELD_TYPES = ["text", "number", "choice", "date", "file", "heading"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];
export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text", number: "Number", choice: "Choose one", date: "Date", file: "Photo or file", heading: "Heading",
};

/** One question on a task's record. A number may carry an acceptable range:
 *  a reading outside it is an exception, and `needsAction` makes completing
 *  the task wait for a follow-up action. */
export type TaskField = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  min?: number | null;
  max?: number | null;
  /** Shown after a number, e.g. "mg/L". */
  unit?: string;
  /** What to do when a reading is out of range. */
  warning?: string;
  needsAction?: boolean;
};

/** How a template's tasks are made (from the prototype): on its schedules (repeat, or once),
 *  added by someone when needed (adhoc), raised as a follow-up from another task (action), or
 *  made by another module when something happens (automated; no module sends these yet). */
export const TEMPLATE_KINDS = ["repeat", "once", "adhoc", "action", "automated"] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];
export const TEMPLATE_KIND_LABELS: Record<TemplateKind, string> = {
  repeat: "Repeat on a schedule", once: "One-off", adhoc: "Ad hoc: added when needed", action: "Follow-up action", automated: "Automated by another module",
};
export const TEMPLATE_KIND_SHORT: Record<TemplateKind, string> = { repeat: "Repeats", once: "One-off", adhoc: "Ad hoc", action: "Follow-up action", automated: "Automated" };
/** Kinds whose tasks the schedules make. */
export const SCHEDULED_KINDS: readonly TemplateKind[] = ["repeat", "once"];

/** form: one set of answers; table: several records, a log. */
export const LOG_MODES = ["form", "table"] as const;
export type LogMode = (typeof LOG_MODES)[number];
export const LOG_MODE_LABELS: Record<LogMode, string> = { form: "One form per task", table: "Multiple records" };

export const SITE_STATUSES = ["live", "setup", "inactive"] as const;
export type SiteStatus = (typeof SITE_STATUSES)[number];
export const SITE_STATUS_META = {
  live: { label: "Live", color: "green", icon: CircleCheck },
  setup: { label: "Setting up", color: "orange", icon: Clock3 },
  inactive: { label: "Inactive", color: "gray", icon: Ban },
} as const satisfies Record<SiteStatus, StatusMeta>;
/** A site's business hours and clock, from its Tasks settings (`TaskSite`). */
export type SiteClock = { timezone: string; opening: string; closing: string };
export const DEFAULT_SITE: SiteClock & { status: SiteStatus; area: string; closedDates: string[] } = {
  timezone: SCHOOL_TIMEZONE, opening: "06:00", closing: "22:00", status: "live", area: "", closedDates: [],
};
/** Time zones a site can keep (the centres Turnfin serves, and their neighbours). */
export const TIMEZONES = ["Europe/Dublin", "Europe/London", "Europe/Lisbon", "Europe/Madrid", "Europe/Paris", "Europe/Berlin", "Atlantic/Canary"] as const;

/** When a task is due. Times are the site's wall clock ("HH:MM"), or "open" and "close" for
 *  its business hours; a due time at or before the start time is the next morning. */
export const REPEATS = ["once", "daily", "weekly", "monthly"] as const;
export type Repeat = (typeof REPEATS)[number];
export type TaskSchedule = {
  id: string;
  repeat: Repeat;
  /** Every how many days, weeks or months. */
  every: number;
  /** Weekly only: 0 Sunday to 6 Saturday. */
  weekdays: number[];
  /** The first day it is due (the only day, for "once"); monthly repeats on its day of the month. */
  from: string;
  start: string;
  due: string;
};

/** What a task asked for when it was made: kept on each task, so changing the
 *  template never rewrites what someone already did. */
export type TaskDefinition = {
  title: string;
  description: string;
  priority: boolean;
  tags: string[];
  roleIds: string[];
  checklist: string[];
  fields: TaskField[];
  minimumRecords: number;
  requiresComment: boolean;
  requiresApproval: boolean;
  /** Only the roles it is aimed at complete it. Tasks made before this was a choice restrict. */
  restricted?: boolean;
  logMode?: LogMode;
};

/** One filled-in record: answers keyed by field id. A file answer is the id of its upload. */
export type TaskRecord = Record<string, string>;

// ---------------------------------------------------------------------------
// Status: stored, then what people see
// ---------------------------------------------------------------------------

/** What is stored. Late, early, overdue and missed are worked out from the times. */
export const TASK_STATUSES = ["open", "done", "not_applicable", "cant_complete"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** What a task shows. Tones come from here, never a call site. */
export const TASK_STATE_META = {
  upcoming: { label: "Later", color: "gray", icon: Circle },
  open: { label: "To do", color: "blue", icon: CircleDashed },
  overdue: { label: "Overdue", color: "red", icon: TriangleAlert },
  missed: { label: "Missed", color: "red", icon: CircleAlert },
  done: { label: "Done", color: "green", icon: CircleCheck },
  early: { label: "Done early", color: "green", icon: CircleCheck },
  late: { label: "Done late", color: "orange", icon: Clock3 },
  approval: { label: "Awaiting approval", color: "purple", icon: Hourglass },
  approved: { label: "Approved", color: "green", icon: ShieldCheck },
  not_applicable: { label: "Not applicable", color: "gray", icon: MinusCircle },
  cant_complete: { label: "Can’t complete", color: "red", icon: Flag },
} as const satisfies Record<string, StatusMeta>;
export type TaskState = keyof typeof TASK_STATE_META;

export const TEMPLATE_STATUS_META = {
  draft: { label: "Draft", color: "gray", icon: CircleDashed },
  published: { label: "Published", color: "green", icon: Send },
  archived: { label: "Archived", color: "gray", icon: Archive },
} as const satisfies Record<string, StatusMeta>;
export type TemplateStatus = keyof typeof TEMPLATE_STATUS_META;

export const ACTION_STATUS_META = {
  open: { label: "Open", color: "orange", icon: Flag },
  resolved: { label: "Resolved", color: "green", icon: CircleCheck },
  overdue: { label: "Overdue", color: "red", icon: TriangleAlert },
} as const satisfies Record<string, StatusMeta>;

/** A score's band (prototype: 9.6 and above good, 7.6 and above fair, else low), always shown with its number. */
export const SCORE_BAND_META = {
  good: { label: "Good", color: "green", icon: CircleCheck },
  fair: { label: "Fair", color: "orange", icon: TriangleAlert },
  low: { label: "Low", color: "red", icon: CircleAlert },
} as const satisfies Record<string, StatusMeta>;
export const scoreBand = (n: number): keyof typeof SCORE_BAND_META => (n >= 96 ? "good" : n >= 76 ? "fair" : "low");

export const PRIORITY_META = { label: "High priority", color: "red", icon: Flag } as const satisfies StatusMeta;

type Timed = { status: string; date: string; startsAt: Date; dueAt: Date; completedAt: Date | null; approvedAt: Date | null; requiresApproval: boolean };

/** What a task shows at `now` on `day` (the centre's today). */
export function taskState(t: Timed, now: Date, day: string): TaskState {
  if (t.status === "not_applicable" || t.status === "cant_complete") return t.status;
  if (t.status === "done" && t.completedAt) {
    if (t.requiresApproval) return t.approvedAt ? "approved" : "approval";
    if (t.completedAt > t.dueAt) return "late";
    if (t.completedAt < t.startsAt) return "early";
    return "done";
  }
  if (now <= t.dueAt) return now < t.startsAt ? "upcoming" : "open";
  return t.date < day ? "missed" : "overdue";
}

/** States that still need someone. */
export const NEEDS_DOING: readonly TaskState[] = ["upcoming", "open", "overdue", "missed"];

/** The site's score for a set of tasks, 0 to 100: done on time (or early) counts in full,
 *  late half, missed, overdue and can't complete nothing. Not applicable and anything not
 *  yet due are left out. Null when nothing counts yet. */
export function score(states: readonly TaskState[]): number | null {
  const counted = states.filter((s) => s !== "not_applicable" && s !== "upcoming" && s !== "open");
  if (!counted.length) return null;
  const points = counted.reduce((sum, s) => sum + (s === "late" ? 0.5 : ["done", "early", "approval", "approved"].includes(s) ? 1 : 0), 0);
  return Math.round((points / counted.length) * 100);
}

// ---------------------------------------------------------------------------
// When tasks are due
// ---------------------------------------------------------------------------

/** An instant as a site's clock reads it: "09:00". */
export function clockOf(d: Date, zone: string = SCHOOL_TIMEZONE) {
  if (zone === SCHOOL_TIMEZONE) return formatTime(minutesNow(d));
  return new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
}
/** A site's today, as `YYYY-MM-DD`. */
export const dayIn = (zone: string, now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

/** A schedule time: a clock time, or the site's opening or closing. */
export const isScheduleTime = (v: string) => v === "open" || v === "close" || isClock(v);
const resolveTime = (v: string, site: SiteClock) => (v === "open" ? site.opening : v === "close" ? site.closing : v);
const timeWords = (v: string) => (v === "open" ? "opening" : v === "close" ? "closing" : v);

export const isClock = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const dayNumber = (iso: string) => Math.round(Date.parse(`${iso}T12:00:00Z`) / 86_400_000);
export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Whether a schedule makes a task on this day. A monthly task on the 31st skips shorter months. */
export function dueOn(s: TaskSchedule, day: string): boolean {
  if (day < s.from) return false;
  if (s.repeat === "once") return day === s.from;
  if (!Number.isInteger(s.every) || s.every < 1) return false;
  const days = dayNumber(day) - dayNumber(s.from);
  if (s.repeat === "daily") return days % s.every === 0;
  const d = new Date(`${day}T12:00:00Z`), a = new Date(`${s.from}T12:00:00Z`);
  if (s.repeat === "weekly") {
    // Weeks run Monday to Sunday, counted from the week of the first day.
    const mondayOffset = (a.getUTCDay() + 6) % 7;
    return Math.floor((days + mondayOffset) / 7) % s.every === 0 && s.weekdays.includes(d.getUTCDay());
  }
  const months = (d.getUTCFullYear() - a.getUTCFullYear()) * 12 + d.getUTCMonth() - a.getUTCMonth();
  return months % s.every === 0 && d.getUTCDate() === a.getUTCDate();
}

/** A wall-clock time on a day at the centre, as the instant it happens. Refuses a time the
 *  clocks skip in spring. */
export function zonedInstant(day: string, time: string, zone = SCHOOL_TIMEZONE): Date {
  const [year, month, date] = day.split("-").map(Number), [hour, minute] = time.split(":").map(Number);
  const wanted = Date.UTC(year, month - 1, date, hour, minute);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  let guess = wanted;
  for (let i = 0; i < 4; i++) {
    const p = Object.fromEntries(parts.formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
    const delta = wanted - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
    if (!delta) return new Date(guess);
    guess += delta;
  }
  throw new Error(`${time} does not happen on ${day}: the clocks go forward. Choose another time.`);
}

/** When a schedule's task opens and is due on a day at a site. */
export function windowOn(s: Pick<TaskSchedule, "start" | "due">, day: string, site: SiteClock = DEFAULT_SITE) {
  const start = resolveTime(s.start, site), due = resolveTime(s.due, site);
  return { startsAt: zonedInstant(day, start, site.timezone), dueAt: zonedInstant(due <= start ? addDays(day, 1) : day, due, site.timezone) };
}

/** Each task a template's schedules make on a day at a site, keyed by schedule so making them twice is harmless. */
export function tasksOn(schedules: readonly TaskSchedule[], day: string, site: SiteClock = DEFAULT_SITE) {
  return schedules.filter((s) => dueOn(s, day)).flatMap((s) => {
    try { return [{ scheduleKey: s.id, ...windowOn(s, day, site) }]; } catch { return []; }
  });
}

/** A schedule in words: "Every day, 08:00 to 09:00". */
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function scheduleLabel(s: TaskSchedule) {
  const every = (unit: string) => (s.every === 1 ? `Every ${unit}` : `Every ${s.every} ${unit}s`);
  const when = s.repeat === "once" ? `Once on ${s.from}`
    : s.repeat === "daily" ? every("day")
    : s.repeat === "weekly" ? `${every("week")} on ${[1, 2, 3, 4, 5, 6, 0].filter((d) => s.weekdays.includes(d)).map((d) => WEEKDAYS[d]).join(", ")}`
    : `${every("month")} on day ${Number(s.from.slice(8))}`;
  return `${when}, ${timeWords(s.start)} to ${timeWords(s.due)}`;
}

// ---------------------------------------------------------------------------
// Checking a template, a record and a completion
// ---------------------------------------------------------------------------

/** What is wrong with a template before it can be published, in plain words. */
export function templateProblems(t: { title: string; kind?: TemplateKind; checklist: string[]; fields: TaskField[]; schedules: TaskSchedule[]; minimumRecords: number; roleIds?: string[]; restricted?: boolean }): string[] {
  const out: string[] = [];
  if (!t.title.trim()) out.push("Give the task a title.");
  if (t.checklist.some((x) => !x.trim())) out.push("Every checklist item needs words.");
  if (!t.checklist.length && !t.fields.some((f) => f.type !== "heading")) out.push("Add a checklist item or a question, so there is something to do.");
  if (!Number.isInteger(t.minimumRecords) || t.minimumRecords < 1 || t.minimumRecords > 50) out.push("Ask for between 1 and 50 records.");
  if (t.kind && SCHEDULED_KINDS.includes(t.kind) && !t.schedules.length) out.push("Add a schedule, or choose a kind that is not scheduled.");
  if (t.restricted && t.roleIds && !t.roleIds.length) out.push("Choose the roles it is restricted to, or let everyone complete it.");
  for (const f of t.fields) {
    if (!f.label.trim()) out.push("Every question needs a label.");
    if (f.type === "choice" && !(f.options ?? []).some((o) => o.trim())) out.push(`${f.label || "A choice question"}: add the answers to choose from.`);
    if (f.type === "number" && f.min != null && f.max != null && f.max <= f.min) out.push(`${f.label}: the highest acceptable reading must be above the lowest.`);
    if (f.needsAction && f.type === "number" && f.min == null && f.max == null) out.push(`${f.label}: set a range before asking for an action when it is out of range.`);
  }
  for (const s of t.schedules) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.from)) out.push("Each schedule needs a first day.");
    if (s.repeat !== "once" && (!Number.isInteger(s.every) || s.every < 1 || s.every > 52)) out.push("Repeat every 1 to 52 days, weeks or months.");
    if (s.repeat === "weekly" && !s.weekdays.length) out.push("Choose the days of the week it is due.");
    if (!isScheduleTime(s.start) || !isScheduleTime(s.due)) out.push("Give each schedule a start and due time, like 08:00, or the site's opening or closing.");
    else if (/^\d{4}-\d{2}-\d{2}$/.test(s.from) && isClock(s.start) && isClock(s.due)) {
      try { windowOn(s, s.from); } catch (e) { out.push((e as Error).message); }
    }
  }
  return [...new Set(out)];
}

const outside = (f: TaskField, v: string | undefined) =>
  f.type === "number" && !!v?.trim() && Number.isFinite(Number(v)) && ((f.min != null && Number(v) < f.min) || (f.max != null && Number(v) > f.max));

/** A record's answer problems, one per field. */
function answerProblem(f: TaskField, value: string | undefined): string | null {
  if (f.type === "heading") return null;
  if (!value?.trim()) return f.required ? `${f.label} needs an answer.` : null;
  if (f.type === "number" && !Number.isFinite(Number(value))) return `${f.label} must be a number.`;
  if (f.type === "choice" && !(f.options ?? []).includes(value)) return `Choose one of the answers for ${f.label}.`;
  if (f.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return `Give ${f.label} as a date.`;
  return null;
}

/** Readings outside their range, in words: "Record 1 · pH 8 (7.2 to 7.6). Check dosing." */
export function exceptions(def: Pick<TaskDefinition, "fields">, records: readonly TaskRecord[]): string[] {
  const out: string[] = [];
  records.forEach((row, i) => def.fields.forEach((f) => {
    if (!outside(f, row[f.id])) return;
    const range = f.min != null && f.max != null ? `${f.min} to ${f.max}` : f.min != null ? `at least ${f.min}` : `at most ${f.max}`;
    out.push(`${records.length > 1 ? `Record ${i + 1} · ` : ""}${f.label} ${row[f.id]}${f.unit ? ` ${f.unit}` : ""} (${range}).${f.warning ? ` ${f.warning}` : ""}`);
  }));
  return out;
}

/** Whether a reading that must be followed up is out of range. */
const needsFollowUp = (def: Pick<TaskDefinition, "fields">, records: readonly TaskRecord[]) =>
  records.some((row) => def.fields.some((f) => f.needsAction && outside(f, row[f.id])));

/** Why a task cannot be completed yet; empty when it can. */
export function completionProblems(def: TaskDefinition, checks: readonly boolean[], records: readonly TaskRecord[], hasComment: boolean, hasAction: boolean): string[] {
  const out: string[] = [];
  if (def.checklist.some((_, i) => !checks[i])) out.push("Tick every checklist item.");
  const asks = def.fields.some((f) => f.type !== "heading");
  if (asks && records.length < def.minimumRecords) out.push(`Add at least ${def.minimumRecords} records.`);
  if (asks) records.forEach((row, i) => def.fields.forEach((f) => {
    const p = answerProblem(f, row[f.id]);
    if (p) out.push(records.length > 1 ? `Record ${i + 1}: ${p}` : p);
  }));
  if (def.requiresComment && !hasComment) out.push("Add a comment before completing it.");
  if (needsFollowUp(def, records) && !hasAction) out.push("Raise a follow-up action for the reading out of range.");
  return out;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/** A CSV cell that a spreadsheet will not run as a formula. */
function csvCell(value: unknown): string {
  let s = String(value ?? "");
  if (/^[=+@\-\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
}
export const csvRows = (rows: readonly (readonly unknown[])[]) => rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
