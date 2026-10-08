import "server-only";
import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { currentClubIdIfAny } from "@/lib/clubs/current";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { sitesFor } from "@/lib/policy/session";
import { requireTasksActor, type TasksActor } from "@/lib/tasks/access";
import {
  DEFAULT_SITE, NEEDS_DOING, SCHEDULED_KINDS, addDays, dayIn, score, taskState, tasksOn,
  type LogMode, type SiteStatus, type TaskDefinition, type TaskField, type TaskRecord, type TaskSchedule, type TaskState, type TemplateKind,
} from "@/lib/tasks/rules";

/** Tasks' reads (docs/tasks.md). Everything is limited to the sites the
 *  capability covers; a task outside them is a 404. A day's tasks are made from
 *  the published templates the first time anyone needs them (opening the day,
 *  the home page, a report, or the nightly cron), so making them twice is harmless. */

type Sites = Awaited<ReturnType<typeof sitesFor>>;
const covers = (sites: Sites, siteId: string) => sites.kind === "all" || sites.siteIds.has(siteId);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export const asFields = (v: Prisma.JsonValue) => (Array.isArray(v) ? v : []) as unknown as TaskField[];
export const asSchedules = (v: Prisma.JsonValue) => (Array.isArray(v) ? v : []) as unknown as TaskSchedule[];
export const asRecords = (v: Prisma.JsonValue) => (Array.isArray(v) && v.length ? v : [{}]) as unknown as TaskRecord[];
export const asDefinition = (v: Prisma.JsonValue) => v as unknown as TaskDefinition;

type TemplateRow = {
  title: string; description: string; priority: boolean; tags: string[]; roleIds: string[]; restricted: boolean; checklist: string[];
  fields: Prisma.JsonValue; minimumRecords: number; logMode: string; requiresComment: boolean; requiresApproval: boolean;
};
/** What a template asks for, as a task keeps it. */
export function definitionOf(t: TemplateRow): TaskDefinition {
  return {
    title: t.title, description: t.description, priority: t.priority, tags: t.tags, roleIds: t.roleIds, restricted: t.restricted, checklist: t.checklist,
    fields: asFields(t.fields), minimumRecords: t.minimumRecords, logMode: t.logMode as LogMode, requiresComment: t.requiresComment, requiresApproval: t.requiresApproval,
  };
}

// ---------------------------------------------------------------------------
// Sites: their Tasks settings (hours, closed dates, status, time zone)
// ---------------------------------------------------------------------------

export type SiteSettings = typeof DEFAULT_SITE & { siteId: string };
/** Each site's Tasks settings, the defaults for a site without any. */
export async function siteSettings(siteIds: readonly string[]): Promise<Map<string, SiteSettings>> {
  const rows = siteIds.length ? await prisma.taskSite.findMany({ where: { siteId: { in: [...siteIds] } } }) : [];
  const byId = new Map(rows.map((r) => [r.siteId, r]));
  return new Map(siteIds.map((id) => {
    const r = byId.get(id);
    return [id, r ? { siteId: id, status: r.status as SiteStatus, area: r.area, timezone: r.timezone, opening: r.opening, closing: r.closing, closedDates: r.closedDates.map(iso).sort() }
      : { siteId: id, ...DEFAULT_SITE }];
  }));
}

/** Make each day's scheduled tasks at these sites from the published templates, up to each
 *  site's today. Only live sites, never on a closed date; a template makes tasks only from the
 *  day it was first published. Returns how many were made. */
export async function ensureTasks(orgId: string, siteIds: readonly string[], days: readonly string[]) {
  if (!siteIds.length || !days.length) return 0;
  const [templates, settings] = await Promise.all([
    prisma.taskTemplate.findMany({ where: { orgId, status: "published", kind: { in: [...SCHEDULED_KINDS] } } }),
    siteSettings(siteIds),
  ]);
  const rows: Prisma.TaskCreateManyInput[] = [];
  for (const t of templates) {
    const schedules = asSchedules(t.schedules);
    if (!schedules.length) continue;
    const definition = definitionOf(t) as unknown as Prisma.InputJsonValue;
    for (const siteId of t.siteIds.length ? siteIds.filter((s) => t.siteIds.includes(s)) : siteIds) {
      const site = settings.get(siteId)!;
      if (site.status !== "live") continue;
      const siteToday = dayIn(site.timezone);
      const since = t.publishedAt ? dayIn(site.timezone, t.publishedAt) : siteToday;
      for (const day of days) {
        if (day > siteToday || day < since || site.closedDates.includes(day)) continue;
        for (const slot of tasksOn(schedules, day, site)) {
          rows.push({ orgId, templateId: t.id, siteId, date: parseDateOnly(day), scheduleKey: slot.scheduleKey, startsAt: slot.startsAt, dueAt: slot.dueAt,
            definition, checks: t.checklist.map(() => false) });
        }
      }
    }
  }
  if (!rows.length) return 0;
  return (await prisma.task.createMany({ data: rows, skipDuplicates: true })).count;
}

/** Every site of every organisation: what the nightly cron makes tasks for. */
export async function ensureTasksEverywhere(days: readonly string[]) {
  let made = 0;
  for (const [orgId, ids] of await sitesByOrg()) made += await ensureTasks(orgId, ids, days);
  return made;
}
async function sitesByOrg() {
  const sites = await prisma.club.findMany({ where: { archivedAt: null, orgId: { not: null } }, select: { id: true, orgId: true } });
  const byOrg = new Map<string, string[]>();
  for (const s of sites) byOrg.set(s.orgId!, [...(byOrg.get(s.orgId!) ?? []), s.id]);
  return byOrg;
}

/** Freeze each site's score for a finished business day (the nightly cron, for yesterday), so
 *  history does not move when a task is reopened later. A day already frozen stays. */
export async function freezeScores(day: string) {
  let frozen = 0;
  for (const [, ids] of await sitesByOrg()) {
    const settings = await siteSettings(ids);
    for (const siteId of ids) {
      const site = settings.get(siteId)!;
      if (site.status !== "live" || site.closedDates.includes(day) || day >= dayIn(site.timezone)) continue;
      const rows = await prisma.task.findMany({ where: { siteId, date: parseDateOnly(day) }, select: { ...TASK_ROW } });
      const states = rows.map((t) => stateOf(t, new Date(), dayIn(site.timezone)));
      const made = await prisma.taskScoreSnapshot.createMany({ data: [{ siteId, date: parseDateOnly(day), score: score(states), count: states.length }], skipDuplicates: true });
      frozen += made.count;
    }
  }
  return frozen;
}

/** The person's role, for tasks aimed at roles. */
async function roleOf(who: TasksActor) {
  return (await prisma.user.findUnique({ where: { id: who.id }, select: { staffRoleId: true } }))?.staffRoleId ?? null;
}
/** Whether this person may complete a task: it is not restricted, or it is aimed at their
 *  role, or at nobody in particular. Reviewers at the site may always step in. */
export const isMine = (def: Pick<TaskDefinition, "roleIds" | "restricted">, roleId: string | null, reviewer: boolean) =>
  reviewer || def.restricted === false || !def.roleIds.length || (!!roleId && def.roleIds.includes(roleId));

/** The sites this person's Tasks covers, in the organisation's order, and which they review. */
export async function tasksSites() {
  const who = await requireTasksActor();
  const [complete, review] = await Promise.all([sitesFor("tasks.complete"), who.review ? sitesFor("tasks.review") : null]);
  const sites = await prisma.club.findMany({
    where: { archivedAt: null, orgId: who.orgId ?? undefined, ...(complete.kind === "all" ? {} : { id: { in: [...complete.siteIds] } }) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true },
  });
  const working = await currentClubIdIfAny();
  return {
    who, sites: sites.map((s) => ({ ...s, review: !!review && covers(review, s.id) })),
    /** The default site: the one they are working at, if Tasks covers it. */
    home: sites.some((s) => s.id === working) ? working : sites[0]?.id ?? null,
  };
}

const TASK_ROW = {
  id: true, siteId: true, date: true, scheduleKey: true, startsAt: true, dueAt: true, definition: true, status: true, exceptions: true, reason: true,
  completedAt: true, completedByName: true, approvedAt: true, approvedByName: true, templateId: true,
  _count: { select: { comments: true, actions: { where: { status: "open" } } } },
} as const satisfies Prisma.TaskSelect;
type RawTask = Prisma.TaskGetPayload<{ select: typeof TASK_ROW }>;

const stateOf = (t: RawTask, now: Date, day: string) => taskState({ ...t, date: iso(t.date), requiresApproval: asDefinition(t.definition).requiresApproval }, now, day);
function shape(t: RawTask, now: Date, day: string, roleId: string | null, reviewer: boolean) {
  const def = asDefinition(t.definition);
  return {
    id: t.id, date: iso(t.date), startsAt: t.startsAt, dueAt: t.dueAt, title: def.title, tags: def.tags, priority: def.priority, state: stateOf(t, now, day),
    mine: isMine(def, roleId, reviewer), exceptions: t.exceptions.length, comments: t._count.comments, openActions: t._count.actions,
    completedByName: t.completedByName, completedAt: t.completedAt, approvedByName: t.approvedByName, reason: t.reason, templateId: t.templateId,
  };
}
export type TaskRow = ReturnType<typeof shape>;

/** Today's filters (from the prototype): what to show, and a tag. */
export const DAY_FILTERS = { all: "All tasks", open: "To do", overdue: "Overdue", approval: "Awaiting approval", completed: "Completed" } as const;
export type DayFilter = keyof typeof DAY_FILTERS;
const DONE_STATES: readonly TaskState[] = ["done", "early", "late", "approval", "approved"];
const dayFilter = (f: DayFilter, s: TaskState) =>
  f === "all" || (f === "open" ? s === "open" || s === "upcoming" : f === "overdue" ? s === "overdue" || s === "missed" : f === "approval" ? s === "approval" : DONE_STATES.includes(s));
const textMatch = (q: string, t: { title: string; tags: string[] }) => !q || `${t.title} ${t.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase());

/** One site's day: its tasks (made first, up to the site's today), filtered and grouped as in
 *  the prototype, the ones still planned for a later day, what can be added by hand, the
 *  site's settings and the day's figures. */
export async function taskDay(input: { site?: string; date?: string; q?: string; status?: string; tag?: string }) {
  const { who, sites, home } = await tasksSites();
  const site = sites.find((s) => s.id === (input.site ?? home));
  if (input.site && !site) notFound();
  const now = new Date();
  if (!site) { const day = today(now); return { who, sites, site: null, date: day, day } as const; }
  const settings = (await siteSettings([site.id])).get(site.id)!;
  const day = dayIn(settings.timezone, now);
  const date = isDateOnly(input.date) ? input.date : day;
  const status: DayFilter = input.status && input.status in DAY_FILTERS ? (input.status as DayFilter) : "all";
  const q = (input.q ?? "").trim().slice(0, 80), tag = (input.tag ?? "").trim();
  await ensureTasks(who.orgId ?? "", [site.id], [date]);
  const [rows, roleId, planned, addable, openActions] = await Promise.all([
    prisma.task.findMany({ where: { siteId: site.id, date: parseDateOnly(date) }, orderBy: [{ dueAt: "asc" }, { startsAt: "asc" }], select: TASK_ROW }),
    roleOf(who),
    // A later day: what the schedules will make, read only.
    date > day ? plannedOn(who.orgId ?? "", site.id, date, settings) : Promise.resolve([]),
    prisma.taskTemplate.findMany({
      where: { orgId: who.orgId ?? undefined, status: "published", kind: "adhoc", OR: [{ siteIds: { isEmpty: true } }, { siteIds: { has: site.id } }] },
      orderBy: { title: "asc" }, select: { id: true, title: true, description: true },
    }),
    prisma.taskAction.count({ where: { siteId: site.id, status: "open" } }),
  ]);
  const all = rows.map((t) => shape(t, now, day, roleId, site.review));
  const states = all.map((t) => t.state);
  const tasks = all.filter((t) => dayFilter(status, t.state) && textMatch(q, t) && (!tag || t.tags.includes(tag)));
  const done = states.filter((s) => DONE_STATES.includes(s)).length;
  return {
    who, sites, site, settings, date, day, tasks, total: all.length, planned, addable, openActions, filters: { q, status, tag },
    tags: [...new Set(all.flatMap((t) => t.tags))].sort(),
    closed: settings.closedDates.includes(date),
    figures: {
      done, total: states.length,
      remaining: states.filter((s) => NEEDS_DOING.includes(s)).length,
      overdue: states.filter((s) => s === "overdue" || s === "missed").length,
      approval: states.filter((s) => s === "approval").length,
      priorityLeft: all.filter((t) => t.priority && NEEDS_DOING.includes(t.state)).length,
      score: score(states),
    },
  } as const;
}

/** What a site's published schedules will make on a later day. */
async function plannedOn(orgId: string, siteId: string, date: string, site: SiteSettings) {
  if (site.status !== "live" || site.closedDates.includes(date)) return [];
  const templates = await prisma.taskTemplate.findMany({
    where: { orgId, status: "published", kind: { in: [...SCHEDULED_KINDS] }, OR: [{ siteIds: { isEmpty: true } }, { siteIds: { has: siteId } }] },
    select: { id: true, title: true, tags: true, priority: true, schedules: true },
  });
  return templates.flatMap((t) => tasksOn(asSchedules(t.schedules), date, site).map((slot) => ({ key: `${t.id}:${slot.scheduleKey}`, title: t.title, tags: t.tags, priority: t.priority, ...slot })))
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}

/** One task with everything on it, and what this person may do with it. A 404 outside their sites. */
export async function taskDetail(id: string) {
  const who = await requireTasksActor();
  const task = await prisma.task.findFirst({
    where: { id, orgId: who.orgId ?? undefined },
    select: {
      ...TASK_ROW, checks: true, records: true, version: true, addedByName: true, completedById: true,
      site: { select: { name: true } },
      comments: { orderBy: { createdAt: "asc" }, select: { id: true, text: true, byName: true, createdAt: true } },
      files: { orderBy: { createdAt: "asc" }, select: { id: true, fileName: true, size: true } },
      actions: { orderBy: { createdAt: "asc" }, select: { id: true, title: true, status: true, dueOn: true, raisedByName: true, resolution: true, resolvedByName: true, followUpTaskId: true } },
    },
  });
  if (!task) notFound();
  const [complete, review] = await Promise.all([sitesFor("tasks.complete"), sitesFor("tasks.review")]);
  if (!covers(complete, task.siteId)) notFound();
  const reviewer = covers(review, task.siteId);
  const [roleId, settings] = await Promise.all([roleOf(who), siteSettings([task.siteId])]);
  const site = settings.get(task.siteId)!;
  const def = asDefinition(task.definition);
  const now = new Date();
  const row = shape(task, now, dayIn(site.timezone, now), roleId, reviewer);
  const [roles, actionTemplates] = await Promise.all([
    def.roleIds.length ? prisma.staffRole.findMany({ where: { id: { in: def.roleIds } }, select: { name: true }, orderBy: { name: "asc" } }) : [],
    followUpTemplates(who, task.siteId),
  ]);
  return {
    who, task: { ...row, siteId: task.siteId, siteName: task.site.name, timezone: site.timezone, version: task.version, status: task.status, checks: task.checks, records: asRecords(task.records),
      definition: def, addedByName: task.addedByName, comments: task.comments, files: task.files, actions: task.actions, exceptionList: task.exceptions },
    roles: roles.map((r) => r.name), actionTemplates,
    can: {
      work: task.status === "open" && row.mine,
      comment: true,
      review: reviewer,
      approve: reviewer && row.state === "approval" && task.completedById !== who.id,
    },
  };
}

/** Follow-up action templates published for a site: offered when raising an action. */
export function followUpTemplates(who: TasksActor, siteId: string) {
  return prisma.taskTemplate.findMany({
    where: { orgId: who.orgId ?? undefined, status: "published", kind: "action", OR: [{ siteIds: { isEmpty: true } }, { siteIds: { has: siteId } }] },
    orderBy: { title: "asc" }, select: { id: true, title: true, description: true },
  });
}

/** Follow-up actions at one site: the open ones first, then the latest resolved. */
export async function taskActions(siteParam: string | undefined) {
  const { who, sites, home } = await tasksSites();
  const site = sites.find((s) => s.id === (siteParam ?? home));
  if (siteParam && !site) notFound();
  if (!site) return { who, sites, site: null, open: [], resolved: [], actionTemplates: [] } as const;
  const select = { id: true, title: true, dueOn: true, status: true, raisedByName: true, createdAt: true, resolvedAt: true, resolvedByName: true, resolution: true, followUpTaskId: true,
    task: { select: { id: true, date: true, definition: true } } } as const;
  const [open, resolved, actionTemplates] = await Promise.all([
    prisma.taskAction.findMany({ where: { siteId: site.id, status: "open" }, orderBy: [{ dueOn: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }], select }),
    prisma.taskAction.findMany({ where: { siteId: site.id, status: "resolved" }, orderBy: { resolvedAt: "desc" }, take: 30, select }),
    followUpTemplates(who, site.id),
  ]);
  const name = (a: (typeof open)[number]) => ({ ...a, from: a.task ? { id: a.task.id, title: asDefinition(a.task.definition).title, date: iso(a.task.date) } : null });
  return { who, sites, site, open: open.map(name), resolved: resolved.map(name), actionTemplates } as const;
}

/** Open follow-up actions at each site this person does tasks at: the count in the page bar. */
export async function openActionCount() {
  const { sites } = await tasksSites();
  return prisma.taskAction.count({ where: { siteId: { in: sites.map((s) => s.id) }, status: "open" } });
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export const REPORT_INTERVALS = ["day", "week", "month"] as const;
export type ReportInterval = (typeof REPORT_INTERVALS)[number];
const periodOf = (day: string, interval: ReportInterval) => {
  if (interval === "day") return day;
  if (interval === "month") return day.slice(0, 7);
  const d = new Date(`${day}T12:00:00Z`);
  return addDays(day, -((d.getUTCDay() + 6) % 7));
};
/** The task report's status filter (from the prototype). */
export const REPORT_FILTERS = { all: "All statuses", ontime: "On time", late: "Late", missed: "Missed", exceptions: "Out of range", approval: "Awaiting approval" } as const;
export type ReportFilter = keyof typeof REPORT_FILTERS;
const reportFilter = (f: ReportFilter, t: { state: TaskState; exceptions: number }) =>
  f === "all" || (f === "ontime" ? ["done", "early", "approved"].includes(t.state) : f === "late" ? t.state === "late"
    : f === "missed" ? ["missed", "overdue", "cant_complete"].includes(t.state) : f === "exceptions" ? t.exceptions > 0 : t.state === "approval");
const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

/** Site scores and task reports for the sites this person reviews, over at most 92 days. A
 *  finished day uses its frozen score when the nightly cron has frozen it; today is live.
 *  Periods (day, week from Monday, month) average their days' scores. */
export async function taskReport(input: { from?: string; to?: string; interval?: string; site?: string; status?: string; q?: string; tag?: string }) {
  const who = await requireTasksActor();
  if (!who.review) notFound();
  const review = await sitesFor("tasks.review");
  const day = today();
  const to = isDateOnly(input.to) && input.to <= day ? input.to : day;
  const from = isDateOnly(input.from) && input.from <= to ? (input.from < addDays(to, -91) ? addDays(to, -91) : input.from) : addDays(to, -6);
  const interval: ReportInterval = (REPORT_INTERVALS as readonly string[]).includes(input.interval ?? "") ? (input.interval as ReportInterval) : "day";
  const status: ReportFilter = input.status && input.status in REPORT_FILTERS ? (input.status as ReportFilter) : "all";
  const q = (input.q ?? "").trim().slice(0, 80), tag = (input.tag ?? "").trim();
  const sites = await prisma.club.findMany({
    where: { archivedAt: null, orgId: who.orgId ?? undefined, ...(review.kind === "all" ? {} : { id: { in: [...review.siteIds] } }) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true },
  });
  const chosen = input.site ? sites.filter((s) => s.id === input.site) : sites;
  if (input.site && !chosen.length) notFound();
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  const ids = chosen.map((s) => s.id);
  await ensureTasks(who.orgId ?? "", ids, days);
  const [rows, snapshots, settings] = await Promise.all([
    prisma.task.findMany({
      where: { siteId: { in: ids }, date: { gte: parseDateOnly(from), lte: parseDateOnly(to) } },
      orderBy: [{ date: "asc" }, { dueAt: "asc" }], select: { ...TASK_ROW, site: { select: { name: true } } },
    }),
    prisma.taskScoreSnapshot.findMany({ where: { siteId: { in: ids }, date: { gte: parseDateOnly(from), lte: parseDateOnly(to) } } }),
    siteSettings(ids),
  ]);
  const now = new Date();
  const all = rows.map((t) => ({ ...shape(t, now, dayIn(settings.get(t.siteId)!.timezone, now), null, true), siteId: t.siteId, siteName: t.site.name, exceptionList: t.exceptions }));
  const frozen = new Map(snapshots.map((s) => [`${s.siteId}:${iso(s.date)}`, s]));
  /** A site's score for one day: frozen if it has been, else worked out now. */
  const dayScore = (siteId: string, d: string) => {
    const snap = frozen.get(`${siteId}:${d}`);
    if (snap) return snap.score;
    return score(all.filter((t) => t.siteId === siteId && t.date === d).map((t) => t.state));
  };
  const periods = [...new Set(days.map((d) => periodOf(d, interval)))];
  const bySite = chosen.map((s) => {
    const mine = all.filter((t) => t.siteId === s.id);
    const states = mine.map((t) => t.state);
    const daily = days.map((d) => dayScore(s.id, d)).filter((n): n is number => n !== null);
    return {
      ...s, area: settings.get(s.id)!.area, score: mean(daily), total: states.length, scoredDays: daily.length,
      missed: states.filter((x) => x === "missed" || x === "overdue" || x === "cant_complete").length,
      late: states.filter((x) => x === "late").length,
      exceptions: mine.reduce((n, t) => n + t.exceptions, 0),
      periods: periods.map((p) => ({ period: p, score: mean(days.filter((d) => periodOf(d, interval) === p).map((d) => dayScore(s.id, d)).filter((n): n is number => n !== null)) })),
    };
  });
  const tasks = all.filter((t) => reportFilter(status, t) && textMatch(q, t) && (!tag || t.tags.includes(tag)));
  return {
    who, sites, site: input.site ?? null, from, to, interval, periods, bySite, tasks, filters: { status, q, tag },
    tags: [...new Set(all.flatMap((t) => t.tags))].sort(),
    average: mean(bySite.map((s) => s.score).filter((n): n is number => n !== null)),
    /** Each site's score per day, for the scores export. */
    daily: chosen.flatMap((s) => days.map((d) => ({ siteName: s.name, date: d, score: dayScore(s.id, d), count: all.filter((t) => t.siteId === s.id && t.date === d).length, frozen: frozen.has(`${s.id}:${d}`) }))),
  };
}

// ---------------------------------------------------------------------------
// Templates, sites and activity (Manage, Review)
// ---------------------------------------------------------------------------

const TEMPLATE_FILTERS = ["all", "published", "draft", "archived"] as const;
/** The organisation's templates (the task library), for the people who write them, with the
 *  prototype's filters: words, state and tag. */
export async function taskTemplates(input: { q?: string; state?: string; tag?: string } = {}) {
  const who = await requireTasksActor();
  if (!who.manage) notFound();
  const state = (TEMPLATE_FILTERS as readonly string[]).includes(input.state ?? "") ? input.state! : "all";
  const q = (input.q ?? "").trim().slice(0, 80), tag = (input.tag ?? "").trim();
  const [templates, sites, roles] = await Promise.all([
    prisma.taskTemplate.findMany({ where: { orgId: who.orgId ?? undefined }, orderBy: [{ status: "asc" }, { title: "asc" }],
      select: { id: true, title: true, status: true, kind: true, siteIds: true, roleIds: true, restricted: true, tags: true, priority: true, schedules: true, updatedAt: true } }),
    templateSites(who),
    templateRoles(),
  ]);
  const shaped = templates.map((t) => ({ ...t, kind: t.kind as TemplateKind, schedules: asSchedules(t.schedules) }));
  return {
    who, sites, roles, filters: { q, state, tag }, total: shaped.length,
    tags: [...new Set(shaped.flatMap((t) => t.tags))].sort(),
    templates: shaped.filter((t) => (state === "all" || t.status === state) && textMatch(q, t) && (!tag || t.tags.includes(tag))),
  };
}

const templateSites = (who: TasksActor) =>
  prisma.club.findMany({ where: { archivedAt: null, orgId: who.orgId ?? undefined }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } });
const templateRoles = () => prisma.staffRole.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

/** One template to edit, or a new one, with the sites and roles to choose from. */
export async function taskTemplate(id: string | null) {
  const who = await requireTasksActor();
  if (!who.manage) notFound();
  const [template, sites, roles] = await Promise.all([
    id ? prisma.taskTemplate.findFirst({ where: { id, orgId: who.orgId ?? undefined } }) : null,
    templateSites(who),
    templateRoles(),
  ]);
  if (id && !template) notFound();
  return {
    who, sites, roles,
    template: template ? {
      id: template.id, status: template.status as "draft" | "published" | "archived", version: template.version, title: template.title, description: template.description,
      kind: template.kind as TemplateKind, siteIds: template.siteIds, roleIds: template.roleIds, restricted: template.restricted, tags: template.tags, priority: template.priority,
      checklist: template.checklist, fields: asFields(template.fields), minimumRecords: template.minimumRecords, logMode: template.logMode as LogMode,
      schedules: asSchedules(template.schedules), requiresComment: template.requiresComment, requiresApproval: template.requiresApproval,
      notifyCompletion: template.notifyCompletion, notifyException: template.notifyException,
      used: await prisma.task.count({ where: { templateId: template.id } }),
    } : null,
  };
}

/** Every site of the organisation with its Tasks settings and how many templates apply there
 *  (the prototype's Sites page). Reading needs Tasks at any site; changing needs Manage. */
export async function taskSites() {
  const who = await requireTasksActor();
  const sites = await templateSites(who);
  const [settings, templates] = await Promise.all([
    siteSettings(sites.map((s) => s.id)),
    prisma.taskTemplate.findMany({ where: { orgId: who.orgId ?? undefined, status: "published" }, select: { siteIds: true } }),
  ]);
  return {
    who,
    sites: sites.map((s) => ({ ...s, ...settings.get(s.id)!, templates: templates.filter((t) => !t.siteIds.length || t.siteIds.includes(s.id)).length })),
  };
}

/** Tasks' history (the prototype's Activity): every change audited under Tasks, at the sites
 *  this person reviews, and to the templates, newest first, a page at a time. */
export const ACTIVITY_PAGE = 50;
export async function taskActivity(page = 1) {
  const who = await requireTasksActor();
  if (!who.review) notFound();
  const review = await sitesFor("tasks.review");
  const where: Prisma.AuditLogWhereInput = {
    module: "Tasks",
    ...(review.kind === "all" ? {} : { OR: [{ clubId: { in: [...review.siteIds] } }, { clubId: null }] }),
  };
  const skip = (Math.max(1, Math.floor(page)) - 1) * ACTIVITY_PAGE;
  const [rows, total, sites] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: ACTIVITY_PAGE, select: { id: true, actorName: true, action: true, summary: true, createdAt: true, clubId: true } }),
    prisma.auditLog.count({ where }),
    templateSites(who),
  ]);
  const names = new Map(sites.map((s) => [s.id, s.name]));
  return { who, total, page: Math.max(1, Math.floor(page)), rows: rows.map((r) => ({ ...r, siteName: r.clubId ? names.get(r.clubId) ?? null : null })) };
}

/** Everything Tasks keeps for the organisation, as one JSON document (the prototype's
 *  "Export workspace"). Manage only; files are listed by name, not their contents. */
export async function tasksExport() {
  const who = await requireTasksActor();
  if (!who.manage) notFound();
  const orgId = who.orgId ?? undefined;
  const sites = await templateSites(who);
  const [templates, tasks, actions, settings, snapshots] = await Promise.all([
    prisma.taskTemplate.findMany({ where: { orgId } }),
    prisma.task.findMany({ where: { orgId }, include: { comments: true, files: { select: { id: true, fileName: true, mime: true, size: true, byName: true, createdAt: true } } } }),
    prisma.taskAction.findMany({ where: { orgId } }),
    prisma.taskSite.findMany({ where: { siteId: { in: sites.map((s) => s.id) } } }),
    prisma.taskScoreSnapshot.findMany({ where: { siteId: { in: sites.map((s) => s.id) } } }),
  ]);
  return { exportedAt: new Date().toISOString(), exportedBy: who.name, sites, siteSettings: settings, templates, tasks, actions, scoreSnapshots: snapshots };
}

/** The home page's figures for one person: today at their sites. Counts only. Reviewers also
 *  see completions and readings out of range from templates that ask to tell them. */
export async function tasksHome() {
  const { who, sites } = await tasksSites();
  const now = new Date();
  const ids = sites.map((s) => s.id);
  const settings = await siteSettings(ids);
  const days = [...new Set(ids.map((id) => dayIn(settings.get(id)!.timezone, now)))];
  await ensureTasks(who.orgId ?? "", ids, days);
  const reviewIds = sites.filter((s) => s.review).map((s) => s.id);
  const [rows, roleId, openActions, notify] = await Promise.all([
    prisma.task.findMany({ where: { siteId: { in: ids }, date: { in: days.map(parseDateOnly) } }, select: { ...TASK_ROW, exceptions: true } }),
    roleOf(who),
    prisma.taskAction.count({ where: { siteId: { in: ids }, status: "open" } }),
    prisma.taskTemplate.findMany({ where: { orgId: who.orgId ?? undefined, OR: [{ notifyCompletion: true }, { notifyException: true }] }, select: { id: true, notifyCompletion: true, notifyException: true } }),
  ]);
  const tasks = rows
    .filter((t) => iso(t.date) === dayIn(settings.get(t.siteId)!.timezone, now))
    .map((t) => ({ ...shape(t, now, dayIn(settings.get(t.siteId)!.timezone, now), roleId, reviewIds.includes(t.siteId)), siteId: t.siteId }));
  const mine = tasks.filter((t) => t.mine);
  const reviewed = tasks.filter((t) => reviewIds.includes(t.siteId));
  const tells = new Map(notify.map((n) => [n.id, n]));
  return {
    todo: mine.filter((t) => t.state === "open").length,
    overdue: mine.filter((t) => t.state === "overdue").length,
    approval: reviewed.filter((t) => t.state === "approval").length,
    completed: reviewed.filter((t) => tells.get(t.templateId)?.notifyCompletion && DONE_STATES.includes(t.state)).length,
    withExceptions: reviewed.filter((t) => tells.get(t.templateId)?.notifyException && t.exceptions > 0).length,
    openActions,
  };
}
