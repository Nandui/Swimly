import { addDaysIso } from "@/lib/format";
import type { AuditEventRow, AuditWorkRow } from "@/lib/audit";
import type { DeskMeasure } from "@/modules/contributions";
import type {
  BookingRow, FollowUpRow, JobRow, PlaceReasonRow, ReadyMoveRow, SwimmerDetailRow,
} from "@/modules/activities/features/analytics/server/desk-queries";
import type { ReportPeriod } from "@/modules/activities/features/analytics/server/period";
import { teacherKey, within } from "@/modules/activities/features/analytics/server/swimmers";

/* The reception reports (owner request, 16 October 2026: performance manage the reception area).
 * Everything the desk does in Turnfin is already recorded with who did it, where and when: the shared
 * log counts the work, and each job with a clock on it (a parent waiting for an answer, a cancelled class
 * waiting for billing) says how long it took. Plain functions over lean rows, so the rules are tested
 * without a database. */

/** The modules whose work the desk does, by their log names. */
export const DESK_MODULES = ["Swim school", "Short courses", "Refunds"] as const;

/** The kinds of desk work, in the order they are shown. Teaching (registers, ticks, starts) and set-up
 *  (programmes, levels, classes) are left out: they are not the desk's. */
const WORK_KINDS = [
  { key: "enrol", label: "Enrolments" },
  { key: "waitlist", label: "Waiting list places" },
  { key: "move", label: "Moves" },
  { key: "unenrol", label: "Unenrols" },
  { key: "swimmer", label: "Swimmer records" },
  { key: "assessment", label: "Assessment bookings" },
  { key: "parent", label: "Parent app" },
  { key: "followup", label: "Follow-up calls" },
  { key: "billing", label: "Billing" },
  { key: "cancel", label: "Class cancellations" },
  { key: "academy", label: "Academy" },
  { key: "short", label: "Short courses" },
  { key: "refund", label: "Refunds" },
] as const;
export type WorkKind = (typeof WORK_KINDS)[number]["key"];

/** Which kind of desk work a logged action is, or null when it is not the desk's. */
export function workKind(module: string | null, entity: string, action: string): WorkKind | null {
  if (module === "Refunds") return entity === "RefundRequest" ? "refund" : null;
  if (module === "Short courses") {
    if (entity === "AcademyCandidate" || entity === "AcademyCall") return "academy";
    if (entity === "ShortCourseParticipant") return "short";
    return null;
  }
  if (module !== "Swim school") return null;
  switch (entity) {
    case "Enrolment":
      if (action === "enrol") return "enrol";
      if (action === "waitlist") return "waitlist";
      if (action === "transfer") return "move";
      if (["withdraw", "complete", "schedule-withdrawal", "cancel-withdrawal"].includes(action)) return "unenrol";
      if (action === "legend-agreement") return "billing";
      return null;
    case "Student":
      if (action === "create" || action === "update") return "swimmer";
      if (action === "apply-parent-change" || action === "decline-parent-change") return "parent";
      if (action === "enrolment-follow-up") return "followup";
      return null;
    case "AssessmentBooking":
      return ["book", "create", "cancel-booking", "no-show"].includes(action) ? "assessment" : null;
    case "ParentAccessRequest": case "ParentChildAccess": case "ParentAccount":
      return "parent";
    case "Course":
      if (action === "cancel-session") return "cancel";
      if (action === "billing-notified" || action === "billing-restored") return "billing";
      return null;
    default:
      return null;
  }
}

/** Jobs with a clock on them. `target` is the time the desk should answer within, in minutes. */
const JOB_KINDS: Record<string, { label: string; hint: string; target: number | null; href?: string }> = {
  "parent.details": { label: "Parent detail changes", hint: "A parent asked in the app to change a swimmer's details", target: 24 * 60, href: "/students/parent-changes" },
  "parent.access": { label: "Parent app links", hint: "A parent asked to see a child in the app", target: 24 * 60, href: "/students/parents" },
  "waitlist.place": { label: "Waiting list to a place", hint: "From joining a waiting list to being given a place", target: null },
  "ready.move": { label: "Ready to move", hint: "From the teacher marking a swimmer ready to the desk moving them", target: 14 * 24 * 60, href: "/awaiting-enrolment" },
  "billing.agreement": { label: "Billing agreement checks", hint: "From a new place to its Legend agreement marked done", target: 7 * 24 * 60, href: "/legend-agreements" },
  "billing.cancellation": { label: "Cancelled classes to billing", hint: "From a class being cancelled to billing being told", target: 2 * 24 * 60, href: "/cancellations" },
  // Reported by other modules (registerDeskMeasures); they time themselves.
  "academy.call-back": { label: "Academy call backs", hint: "From a place held online to the first phone call, promised within 72 hours", target: 72 * 60, href: "/short-courses" },
  "refunds.sent": { label: "Refund requests sent", hint: "From starting a refund request to sending it for review", target: null, href: "/refunds" },
};

export type Job = {
  kind: string; label: string; module: string; siteId: string | null; at: string;
  by: { key: string; name: string } | null; minutes: number; onTime: boolean | null; open: boolean;
};

/** Postgres timestamp text (UTC, no zone) or ISO, to a Date. */
function utc(text: string) {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(text) ? text : `${text.replace(" ", "T")}Z`);
}
const minutesBetween = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / 60_000));

/** Rows from the swim school's own queries become jobs, timed against their targets. */
export function jobsFromRows(rows: JobRow[], now: Date): Job[] {
  return rows.map(row => {
    const meta = JOB_KINDS[row.kind];
    const arrived = utc(row.arrived);
    const end = row.open || !row.doneAt ? now : utc(row.doneAt);
    const minutes = minutesBetween(arrived, end);
    const late = meta.target !== null && minutes > meta.target;
    return {
      kind: row.kind, label: meta.label, module: "Swim school", siteId: row.siteId,
      at: (row.open || !row.doneAt ? arrived : end).toISOString(),
      by: !row.open && row.doneByName ? { key: teacherKey(row.doneById, row.doneByName), name: row.doneByName } : null,
      minutes, onTime: meta.target === null ? null : row.open ? (late ? false : null) : !late, open: row.open,
    };
  });
}

/** Waiting list places given, from the log: each waitlist entry and the first enrol after it. */
export function waitlistJobs(events: AuditEventRow[], from: string, to: string): Job[] {
  const waiting = new Map<string, Date>();
  const jobs: Job[] = [];
  for (const e of [...events].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    if (e.action === "waitlist") waiting.set(e.entityId, e.at);
    else if (e.action === "enrol" && waiting.has(e.entityId)) {
      const since = waiting.get(e.entityId)!;
      waiting.delete(e.entityId);
      const day = dublinDay(e.at);
      if (day < from || day > to) continue;
      jobs.push({ kind: "waitlist.place", label: JOB_KINDS["waitlist.place"].label, module: "Swim school", siteId: e.clubId, at: e.at.toISOString(),
        by: { key: teacherKey(e.actorId, e.actorName), name: e.actorName }, minutes: minutesBetween(since, e.at), onTime: null, open: false });
    }
  }
  return jobs;
}

/** Moves of swimmers marked ready, with who moved them from the log against the new place. */
export function readyMoveJobs(rows: ReadyMoveRow[], transfers: AuditEventRow[]): Job[] {
  const by = new Map(transfers.map(t => [t.entityId, t]));
  const target = JOB_KINDS["ready.move"].target!;
  return rows.map(row => {
    const moved = utc(row.movedAt), mover = by.get(row.newPlaceId);
    const minutes = minutesBetween(utc(row.readyAt), moved);
    return { kind: "ready.move", label: JOB_KINDS["ready.move"].label, module: "Swim school", siteId: row.siteId, at: moved.toISOString(),
      by: mover ? { key: teacherKey(mover.actorId, mover.actorName), name: mover.actorName } : null, minutes, onTime: minutes <= target, open: false };
  });
}

/** Other modules' timed desk jobs (the Academy's call backs, refunds sent). */
export function jobsFromMeasures(items: DeskMeasure[]): Job[] {
  return items.map(m => ({
    kind: m.kind, label: m.label, module: m.module, siteId: m.siteId, at: m.at,
    by: m.userName ? { key: teacherKey(m.userId, m.userName), name: m.userName } : null,
    minutes: m.minutes, onTime: m.onTime, open: m.open,
  }));
}

const DUBLIN_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin", year: "numeric", month: "2-digit", day: "2-digit" });
export function dublinDay(at: Date) {
  return DUBLIN_DAY.format(at);
}

export function median(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b), mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
const pct = (n: number, d: number) => (d ? (n / d) * 100 : null);

export type JobSummary = {
  kind: string; label: string; hint: string | null; module: string; target: number | null; href: string | null;
  done: number; median: number | null; onTime: number | null; open: number; overdue: number; oldest: number | null;
};

/** Each kind of job: how many were done in the period, the typical time, the share on time, and what is
 *  still waiting (and how long the longest has waited). */
export function summariseJobs(jobs: Job[], from: string, to: string): JobSummary[] {
  const kinds = new Map<string, Job[]>();
  for (const j of jobs) kinds.set(j.kind, [...(kinds.get(j.kind) ?? []), j]);
  const order = [...Object.keys(JOB_KINDS), ...[...kinds.keys()].filter(k => !(k in JOB_KINDS)).sort()];
  return order.filter(k => kinds.has(k)).map(kind => {
    const list = kinds.get(kind)!, meta = JOB_KINDS[kind];
    const done = list.filter(j => !j.open && within(dublinDay(new Date(j.at)), from, to));
    const timed = done.filter(j => j.onTime !== null);
    const open = list.filter(j => j.open);
    return {
      kind, label: list[0].label, hint: meta?.hint ?? null, module: list[0].module, target: meta?.target ?? null, href: meta?.href ?? null,
      done: done.length, median: median(done.map(j => j.minutes)),
      onTime: pct(timed.filter(j => j.onTime).length, timed.length),
      open: open.length, overdue: open.filter(j => j.onTime === false).length,
      oldest: open.length ? Math.max(...open.map(j => j.minutes)) : null,
    };
  });
}

/** The day of the week (0 Monday) of an ISO date. */
function weekday(day: string) {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export type DeskInput = {
  period: ReportPeriod;
  work: AuditWorkRow[];
  jobs: Job[];
  followUps: FollowUpRow[];
  bookings: BookingRow[];
  /** Swimmers added in the period, by whom, and what they were added without. */
  newSwimmers: { event: AuditEventRow; details: SwimmerDetailRow | undefined }[];
  /** Unenrols in the period (since reasons were asked), by whom, with the reason given. */
  unenrols: { event: AuditEventRow; place: PlaceReasonRow | undefined }[];
  /** Enrol, move and unenrol events for spotting places undone within a day. */
  placeEvents: AuditEventRow[];
};

/** Places made and then undone within a day, by whoever made them: a sign of mistakes or rework. */
export function corrections(events: AuditEventRow[], from: string, to: string) {
  const made = new Map<string, AuditEventRow>();
  const found: { key: string; name: string; at: string; hours: number; siteId: string | null }[] = [];
  for (const e of [...events].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    if (e.action === "enrol" || e.action === "transfer") made.set(e.entityId, e);
    else if (e.action === "withdraw") {
      const start = made.get(e.entityId);
      made.delete(e.entityId);
      if (!start) continue;
      const hours = (e.at.getTime() - start.at.getTime()) / 3_600_000;
      const day = dublinDay(start.at);
      if (hours <= 24 && day >= from && day <= to) found.push({ key: teacherKey(start.actorId, start.actorName), name: start.actorName, at: start.at.toISOString(), hours, siteId: start.clubId });
    }
  }
  return found;
}

/** Unenrols are asked for a reason from this day (1.30.0); earlier ones had no reason to give. */
const REASONS_FROM = "2026-10-16";
const NO_REASON = new Set([null, "", "unknown"]);

type Person = {
  key: string; name: string; actions: number; days: Set<string>; sites: Set<string | null>;
  kinds: Map<string, number>; weeks: Map<string, number>; heat: number[][];
};

function emptyHeat() {
  return Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
}

export type DeskPersonRow = {
  key: string; name: string; actions: number; days: number; share: number | null; perDay: number | null;
  kinds: { key: string; label: string; count: number }[];
  jobsDone: number; median: number | null; onTime: number | null;
  added: number; missingDetails: number | null; unenrols: number; noReason: number | null;
  corrections: number; followUps: number; booked: number; startedRate: number | null;
};

/** Weekly totals, ready for a trend line. */
function weekSeries(period: ReportPeriod, counts: Map<string, number>) {
  return period.weeks.map(week => ({ week, count: counts.get(week) ?? 0 }));
}
function weekOf(period: ReportPeriod, day: string) {
  for (let i = period.weeks.length - 1; i >= 0; i--) if (day >= period.weeks[i]) return period.weeks[i];
  return null;
}

/** Busy hours as rows of start hour, each with a count for every day of the week, trimmed to the hours
 *  anything happened in. */
function heatRows(heat: number[][]) {
  const hours = Array.from({ length: 24 }, (_, h) => h).filter(h => heat.some(day => day[h] > 0));
  if (!hours.length) return [];
  const first = Math.min(...hours), last = Math.max(...hours);
  const max = Math.max(1, ...heat.flat());
  return Array.from({ length: last - first + 1 }, (_, i) => first + i).map(hour => ({
    hour, cells: heat.map((day, d) => ({ day: d, count: day[hour], share: day[hour] / max })),
  }));
}

/** Everything the reception page and each person's page need. */
export function buildDesk(input: DeskInput) {
  const { period } = input;
  const inPeriod = (day: string) => within(day, period.start, period.end);
  const people = new Map<string, Person>();
  const person = (key: string, name: string) => {
    let p = people.get(key);
    if (!p) people.set(key, p = { key, name, actions: 0, days: new Set(), sites: new Set(), kinds: new Map(), weeks: new Map(), heat: emptyHeat() });
    return p;
  };

  // The work, from the log.
  const teamKinds = new Map<string, number>(), teamWeeks = new Map<string, number>(), previousKinds = new Map<string, number>();
  const teamHeat = emptyHeat();
  let previousTotal = 0;
  // The period before, laid over this one week by week.
  const shift = Math.round((Date.parse(`${period.start}T00:00:00Z`) - Date.parse(`${period.previousStart}T00:00:00Z`)) / 86_400_000);
  const previousWeeks = new Map<string, number>();
  for (const row of input.work) {
    const kind = workKind(row.module, row.entity, row.action);
    if (!kind) continue;
    if (within(row.day, period.previousStart, period.previousEnd)) {
      previousTotal += row.count;
      const then = weekOf(period, addDaysIso(row.day, shift));
      if (then) previousWeeks.set(then, (previousWeeks.get(then) ?? 0) + row.count);
      previousKinds.set(kind, (previousKinds.get(kind) ?? 0) + row.count);
      continue;
    }
    if (!inPeriod(row.day)) continue;
    const p = person(teacherKey(row.actorId, row.actorName), row.actorName);
    p.actions += row.count;
    p.days.add(row.day);
    p.sites.add(row.clubId);
    p.kinds.set(kind, (p.kinds.get(kind) ?? 0) + row.count);
    const week = weekOf(period, row.day);
    if (week) {
      p.weeks.set(week, (p.weeks.get(week) ?? 0) + row.count);
      teamWeeks.set(week, (teamWeeks.get(week) ?? 0) + row.count);
    }
    p.heat[weekday(row.day)][row.hour] += row.count;
    teamHeat[weekday(row.day)][row.hour] += row.count;
    teamKinds.set(kind, (teamKinds.get(kind) ?? 0) + row.count);
  }
  const total = [...people.values()].reduce((s, p) => s + p.actions, 0);

  // Timed jobs, by who did them.
  const doneJobs = input.jobs.filter(j => !j.open && inPeriod(dublinDay(new Date(j.at))));
  const jobsBy = new Map<string, Job[]>();
  for (const j of doneJobs) if (j.by) {
    person(j.by.key, j.by.name);
    jobsBy.set(j.by.key, [...(jobsBy.get(j.by.key) ?? []), j]);
  }

  // Record quality.
  const added = input.newSwimmers.filter(s => inPeriod(dublinDay(s.event.at)));
  const missing = (s: (typeof added)[number]) => !!s.details && (s.details.noBirthday || s.details.noPhone || s.details.noEmergency);
  const unenrols = input.unenrols.filter(u => inPeriod(dublinDay(u.event.at)) && dublinDay(u.event.at) >= REASONS_FROM);
  const noReason = (u: (typeof unenrols)[number]) => !!u.place && NO_REASON.has(u.place.leaveReason);
  const fixes = corrections(input.placeEvents, period.start, period.end);
  const follow = input.followUps.filter(f => inPeriod(f.occurredOn));
  const booked = input.bookings.filter(b => inPeriod(b.createdAt.slice(0, 10)));
  const started = (b: BookingRow) => b.firstPlace !== null && b.firstPlace <= addDaysIso(b.sessionDate, 60);

  const groupBy = <T,>(rows: T[], key: (row: T) => string) => {
    const map = new Map<string, T[]>();
    for (const row of rows) map.set(key(row), [...(map.get(key(row)) ?? []), row]);
    return map;
  };
  const addedBy = groupBy(added, s => teacherKey(s.event.actorId, s.event.actorName));
  const unenrolsBy = groupBy(unenrols, u => teacherKey(u.event.actorId, u.event.actorName));
  const fixesBy = groupBy(fixes, f => f.key);
  const followBy = groupBy(follow, f => teacherKey(f.actorId, f.actorName));
  const bookedBy = groupBy(booked.filter(b => b.bookedByName && b.bookedById), b => teacherKey(b.bookedById, b.bookedByName));
  for (const [key, list] of [...addedBy, ...unenrolsBy]) person(key, "event" in list[0] ? list[0].event.actorName : key);
  for (const [key, list] of followBy) person(key, list[0].actorName);
  for (const [key, list] of bookedBy) person(key, list[0].bookedByName);

  const rows: DeskPersonRow[] = [...people.values()].map(p => {
    const jobs = jobsBy.get(p.key) ?? [], timed = jobs.filter(j => j.onTime !== null);
    const a = addedBy.get(p.key) ?? [], u = unenrolsBy.get(p.key) ?? [], b = bookedBy.get(p.key) ?? [];
    const bookedAttended = b.filter(x => x.status === "ATTENDED");
    return {
      key: p.key, name: p.name, actions: p.actions, days: p.days.size, share: pct(p.actions, total), perDay: p.days.size ? p.actions / p.days.size : null,
      kinds: WORK_KINDS.map(k => ({ key: k.key, label: k.label, count: p.kinds.get(k.key) ?? 0 })).filter(k => k.count > 0).sort((x, y) => y.count - x.count),
      jobsDone: jobs.length, median: median(jobs.filter(j => j.kind !== "waitlist.place").map(j => j.minutes)), onTime: pct(timed.filter(j => j.onTime).length, timed.length),
      added: a.length, missingDetails: pct(a.filter(missing).length, a.length),
      unenrols: u.length, noReason: pct(u.filter(noReason).length, u.length),
      corrections: (fixesBy.get(p.key) ?? []).length, followUps: (followBy.get(p.key) ?? []).length,
      booked: b.length, startedRate: pct(bookedAttended.filter(started).length, bookedAttended.length),
    };
  }).sort((x, y) => y.actions - x.actions || x.name.localeCompare(y.name));

  const jobs = summariseJobs(input.jobs, period.start, period.end);
  const openJobs = input.jobs.filter(j => j.open).sort((x, y) => y.minutes - x.minutes);
  const timedDone = doneJobs.filter(j => j.onTime !== null);
  const today = period.today;
  const latestFollowUp = new Map<string, FollowUpRow>();
  for (const f of input.followUps) {
    const was = latestFollowUp.get(f.studentId);
    if (!was || f.sequence > was.sequence) latestFollowUp.set(f.studentId, f);
  }
  const overdueFollowUps = [...latestFollowUp.values()].filter(f => f.nextContactOn !== null && f.nextContactOn < today);
  const attended = booked.filter(b => b.status === "ATTENDED");

  return {
    total, previousTotal, people: rows,
    perPerson: rows.length ? total / rows.filter(r => r.actions > 0).length || null : null,
    kinds: WORK_KINDS.map(k => ({ key: k.key, label: k.label, count: teamKinds.get(k.key) ?? 0, previous: previousKinds.get(k.key) ?? 0 })).filter(k => k.count || k.previous),
    weeks: weekSeries(period, teamWeeks),
    /** Week by week for the headline chart: work against the period before, and each quality figure. */
    weekly: period.weeks.map(week => {
      const inWeek = (day: string) => weekOf(period, day) === week;
      const timed = timedDone.filter(j => inWeek(dublinDay(new Date(j.at))));
      const a = added.filter(x => inWeek(dublinDay(x.event.at))), u = unenrols.filter(x => inWeek(dublinDay(x.event.at)));
      return {
        week, work: teamWeeks.get(week) ?? 0, before: previousWeeks.get(week) ?? 0,
        onTime: pct(timed.filter(j => j.onTime).length, timed.length),
        complete: pct(a.filter(x => !missing(x)).length, a.length),
        reasons: pct(u.filter(x => !noReason(x)).length, u.length),
        undone: fixes.filter(f => inWeek(dublinDay(new Date(f.at)))).length,
      };
    }),
    heat: heatRows(teamHeat),
    jobs, onTime: pct(timedDone.filter(j => j.onTime).length, timedDone.length),
    open: { count: openJobs.length, overdue: openJobs.filter(j => j.onTime === false).length, oldest: openJobs.slice(0, 12).map(j => ({ kind: j.kind, label: j.label, siteId: j.siteId, minutes: j.minutes, overdue: j.onTime === false, href: JOB_KINDS[j.kind]?.href ?? null })) },
    quality: {
      added: added.length, missing: added.filter(missing).length,
      noBirthday: added.filter(s => s.details?.noBirthday).length, noPhone: added.filter(s => s.details?.noPhone).length, noEmergency: added.filter(s => s.details?.noEmergency).length,
      unenrols: unenrols.length, noReason: unenrols.filter(noReason).length,
    },
    corrections: fixes.length,
    followUps: {
      logged: follow.length, overdue: overdueFollowUps.length,
      outcomes: countList(follow.map(f => f.outcome)), channels: countList(follow.map(f => f.channel)),
    },
    bookings: {
      booked: booked.length, attended: attended.length, noShow: booked.filter(b => b.status === "NO_SHOW").length,
      cancelled: booked.filter(b => b.status === "CANCELLED").length, started: attended.filter(started).length,
      parentApp: booked.filter(b => !b.bookedById).length,
    },
    /** Per person, kept for their own page. */
    detail: { people, jobsBy, addedBy, unenrolsBy, fixesBy, followBy, bookedBy },
  };
}

function countList(values: string[]) {
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return [...map].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

export type DeskTeam = ReturnType<typeof buildDesk>;

/** One person's page: their work and times against the team's. */
export function buildDeskPerson(desk: DeskTeam, key: string, period: ReportPeriod, jobs: Job[]) {
  const p = desk.detail.people.get(key);
  const row = desk.people.find(r => r.key === key);
  if (!p || !row) return null;
  const mine = desk.detail.jobsBy.get(key) ?? [];
  const team = jobs.filter(j => !j.open && within(dublinDay(new Date(j.at)), period.start, period.end));
  const byKind = [...new Set(mine.map(j => j.kind))].map(kind => {
    const m = mine.filter(j => j.kind === kind), t = team.filter(j => j.kind === kind);
    const mt = m.filter(j => j.onTime !== null), tt = t.filter(j => j.onTime !== null);
    return {
      kind, label: m[0].label, done: m.length, share: pct(m.length, t.length),
      median: median(m.map(j => j.minutes)), teamMedian: median(t.map(j => j.minutes)),
      onTime: pct(mt.filter(j => j.onTime).length, mt.length), teamOnTime: pct(tt.filter(j => j.onTime).length, tt.length),
    };
  }).sort((a, b) => b.done - a.done);
  const others = desk.people.filter(r => r.actions > 0);
  const teamAverage = (pick: (r: DeskPersonRow) => number | null) => {
    const values = others.map(pick).filter((v): v is number => v !== null);
    return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
  };
  const follow = desk.detail.followBy.get(key) ?? [];
  return {
    person: row,
    sites: [...p.sites],
    weeks: weekSeries(period, p.weeks),
    heat: heatRows(p.heat),
    kinds: WORK_KINDS.map(k => ({ key: k.key, label: k.label, count: p.kinds.get(k.key) ?? 0, team: desk.kinds.find(t => t.key === k.key)?.count ?? 0 })).filter(k => k.count > 0),
    jobs: byKind,
    compare: {
      perDay: { mine: row.perDay, team: teamAverage(r => r.perDay) },
      onTime: { mine: row.onTime, team: desk.onTime },
      missingDetails: { mine: row.missingDetails, team: pct(desk.quality.missing, desk.quality.added) },
      noReason: { mine: row.noReason, team: pct(desk.quality.noReason, desk.quality.unenrols) },
      corrections: { mine: pct(row.corrections, p.kinds.get("enrol") ?? 0), team: pct(desk.corrections, desk.kinds.find(k => k.key === "enrol")?.count ?? 0) },
      startedRate: { mine: row.startedRate, team: pct(desk.bookings.started, desk.bookings.attended) },
    },
    followUps: { logged: follow.length, outcomes: countList(follow.map(f => f.outcome)) },
    corrections: (desk.detail.fixesBy.get(key) ?? []).map(f => ({ at: f.at, hours: f.hours, siteId: f.siteId })),
  };
}
