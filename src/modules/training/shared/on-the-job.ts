/** Skills on the job (docs/training.md, e-learning phase 5): what a trainer
 *  watches for at a practical sign-off, in-service hours against a target, and
 *  where someone is on a learning path. Pure, so pages, actions and tests agree. */

// ---------------------------------------------------------------------------
// Practical checklists
// ---------------------------------------------------------------------------

export type ObservationStep = { id: string; text: string; critical: boolean };
export type ObservationResult = "met" | "not-yet" | "na";
export type ObservedStep = ObservationStep & { result: ObservationResult; note: string };
export type ObservationRecord = { steps: ObservedStep[]; observedById: string | null; observedByName: string; observedAt: string };

export const MAX_OBSERVATION_STEPS = 40;
const OBSERVATION_RESULTS: readonly ObservationResult[] = ["met", "not-yet", "na"];

/** The checklist as saved: trimmed steps with unique ids, empty ones dropped.
 *  Null when nothing is left, so the course has no checklist. */
export function cleanObservation(raw: unknown, newId: () => string): ObservationStep[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const steps: ObservationStep[] = [];
  for (const item of raw.slice(0, MAX_OBSERVATION_STEPS)) {
    if (!item || typeof item !== "object") continue;
    const step = item as Record<string, unknown>;
    const text = String(step.text ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
    if (!text) continue;
    let id = typeof step.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(step.id) ? step.id : "";
    if (!id || seen.has(id)) id = newId();
    seen.add(id);
    steps.push({ id, text, critical: step.critical === true });
  }
  return steps.length ? steps : null;
}

/** Reads a stored checklist (course JSON) without trusting it. */
export function readObservation(raw: unknown): ObservationStep[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((s) => s && typeof s === "object" && typeof (s as ObservationStep).id === "string" && typeof (s as ObservationStep).text === "string"
    ? [{ id: (s as ObservationStep).id, text: (s as ObservationStep).text, critical: (s as ObservationStep).critical === true }] : []);
}

/** Reads a stored observation record (assignment JSON) without trusting it. */
export function readObservationRecord(raw: unknown): ObservationRecord | null {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as ObservationRecord).steps)) return null;
  const r = raw as ObservationRecord;
  const steps = r.steps.flatMap((s) => s && typeof s.id === "string" && typeof s.text === "string" && OBSERVATION_RESULTS.includes(s.result)
    ? [{ id: s.id, text: s.text, critical: s.critical === true, result: s.result, note: typeof s.note === "string" ? s.note : "" }] : []);
  return { steps, observedById: typeof r.observedById === "string" ? r.observedById : null, observedByName: String(r.observedByName ?? ""), observedAt: String(r.observedAt ?? "") };
}

/** Joins what the trainer marked to the course's checklist. Every step must be
 *  marked; a critical step can't be "not needed". Unknown ids are ignored. */
export function observeSteps(steps: readonly ObservationStep[], marks: Record<string, { result?: unknown; note?: unknown }>): { steps: ObservedStep[]; problem: string | null } {
  const observed: ObservedStep[] = [];
  for (const step of steps) {
    const mark = marks[step.id];
    const result = OBSERVATION_RESULTS.includes(mark?.result as ObservationResult) ? mark!.result as ObservationResult : null;
    if (!result) return { steps: [], problem: `Mark every step. "${step.text}" has no answer yet.` };
    if (result === "na" && step.critical) return { steps: [], problem: `"${step.text}" must be seen: it can't be marked as not needed.` };
    observed.push({ ...step, result, note: String(mark?.note ?? "").trim().slice(0, 500) });
  }
  return { steps: observed, problem: null };
}

/** Whether the observed steps allow a sign-off: every critical step met and no step "not yet". */
export const observationPasses = (steps: readonly ObservedStep[]) => steps.every((s) => s.result !== "not-yet");

/** What to practise, for sending someone back: each step not met yet, with the trainer's note. */
export const practiseList = (steps: readonly ObservedStep[]) =>
  steps.filter((s) => s.result === "not-yet").map((s) => `${s.text}${s.note ? ` (${s.note})` : ""}`).join("; ");

// ---------------------------------------------------------------------------
// In-service hours
// ---------------------------------------------------------------------------

export type HourTarget = { hours: number; windowMonths: number };
export type HoursEntry = { on: Date; minutes: number };

const dayOnly = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
/** The first day counted: the same day `months` ago (or that month's last day). */
export function windowStart(on: Date, months: number) {
  const base = dayOnly(on);
  const target = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(base.getUTCDate(), last)));
}

/** Hours counted over the target's window up to `on`, against what it needs. */
export function hoursProgress(entries: readonly HoursEntry[], target: HourTarget, on: Date) {
  const since = windowStart(on, target.windowMonths);
  const until = dayOnly(on);
  const minutes = entries.filter((e) => e.on >= since && e.on <= until).reduce((sum, e) => sum + e.minutes, 0);
  const needed = target.hours * 60;
  return { minutes, needed, since, met: minutes >= needed, percent: Math.min(100, Math.floor((minutes / needed) * 100)) };
}

/** "1 h 30 min", "45 min", "20 h". */
export function hoursInWords(minutes: number) {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return [h ? `${h} h` : null, m || !h ? `${m} min` : null].filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Learning paths
// ---------------------------------------------------------------------------

export const MAX_PATH_STEPS = 30;
export type PathStep = { courseId: string; dueDays: number };
export type PathHistory = { courseId: string; status: string; dueOn: Date | null; completedAt: Date | null };
type PathStepState =
  | { state: "done"; on: Date }
  | { state: "open"; dueOn: Date | null; overdue: boolean; submitted: boolean }
  | { state: "missing" };

/** Where someone is on each step: done when they have ever finished that
 *  course, open while an assignment is, otherwise missing (cancelled). */
export function pathProgress(steps: readonly PathStep[], history: readonly PathHistory[], on: Date) {
  const today = dayOnly(on);
  const states: PathStepState[] = steps.map((step) => {
    const mine = history.filter((h) => h.courseId === step.courseId);
    const done = mine.filter((h) => h.status === "COMPLETED" && h.completedAt).sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime())[0];
    if (done) return { state: "done", on: done.completedAt! };
    const open = mine.find((h) => h.status === "ASSIGNED" || h.status === "SUBMITTED");
    if (open) return { state: "open", dueOn: open.dueOn, overdue: !!open.dueOn && open.dueOn < today && open.status === "ASSIGNED", submitted: open.status === "SUBMITTED" };
    return { state: "missing" };
  });
  const done = states.filter((s) => s.state === "done").length;
  const finishedOn = done === steps.length && steps.length
    ? new Date(Math.max(...states.map((s) => (s as { on: Date }).on.getTime()))) : null;
  return { states, done, total: steps.length, finishedOn, overdue: states.some((s) => s.state === "open" && s.overdue) };
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export const SESSION_ZONE = "Europe/Dublin";
export const MAX_SESSION_PLACES = 500;

/** The instant a wall-clock time in Ireland happens ("2026-11-03", 18:30 →
 *  18:30 UTC in winter, 17:30 UTC in summer). Null for a time that doesn't
 *  exist when the clocks go forward. */
export function wallClockInstant(date: string, minutes: number): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(minutes) || minutes < 0 || minutes >= 1440) return null;
  const desired = new Date(`${date}T00:00:00Z`).getTime() + minutes * 60_000;
  const format = new Intl.DateTimeFormat("en-GB", { timeZone: SESSION_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  for (const offset of [60, 0]) {
    const instant = new Date(desired - offset * 60_000);
    const parts = Object.fromEntries(format.formatToParts(instant).map((p) => [p.type, p.value]));
    if (`${parts.year}-${parts.month}-${parts.day}` === date && Number(parts.hour) * 60 + Number(parts.minute) === minutes) return instant;
  }
  return null;
}

/** "18:30" → 1110; null when it isn't a time. */
export function readClock(value: string) {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** A session's date and time as people in Ireland read them. */
export function sessionWhen(startsAt: Date, minutes: number) {
  const day = new Intl.DateTimeFormat("en-IE", { timeZone: SESSION_ZONE, weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(startsAt);
  const time = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: SESSION_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return `${day}, ${time(startsAt)} to ${time(new Date(startsAt.getTime() + minutes * 60_000))}`;
}
