import "server-only";
import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { currentClubIdIfAny } from "@/lib/clubs/current";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { sitesFor } from "@/lib/policy/session";
import { requireTasksActor, type TasksActor } from "@/lib/tasks/access";
import {
  NEEDS_DOING, addDays, score, taskState, tasksOn,
  type TaskDefinition, type TaskField, type TaskRecord, type TaskSchedule,
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

type TemplateRow = { title: string; description: string; priority: boolean; tags: string[]; roleIds: string[]; checklist: string[]; fields: Prisma.JsonValue; minimumRecords: number; requiresComment: boolean; requiresApproval: boolean };
/** What a template asks for, as a task keeps it. */
export function definitionOf(t: TemplateRow): TaskDefinition {
  return {
    title: t.title, description: t.description, priority: t.priority, tags: t.tags, roleIds: t.roleIds, checklist: t.checklist,
    fields: asFields(t.fields), minimumRecords: t.minimumRecords, requiresComment: t.requiresComment, requiresApproval: t.requiresApproval,
  };
}

/** Make each day's scheduled tasks at these sites from the published templates, up to today.
 *  A template makes tasks only from the day it was first published. Returns how many were made. */
export async function ensureTasks(orgId: string, siteIds: readonly string[], days: readonly string[]) {
  const now = today();
  const wanted = days.filter((d) => d <= now);
  if (!wanted.length || !siteIds.length) return 0;
  const templates = await prisma.taskTemplate.findMany({ where: { orgId, status: "published" } });
  const rows: Prisma.TaskCreateManyInput[] = [];
  for (const t of templates) {
    const since = t.publishedAt ? today(t.publishedAt) : now;
    const sites = t.siteIds.length ? siteIds.filter((s) => t.siteIds.includes(s)) : siteIds;
    const definition = definitionOf(t) as unknown as Prisma.InputJsonValue;
    for (const day of wanted) {
      if (day < since) continue;
      for (const slot of tasksOn(asSchedules(t.schedules), day)) {
        for (const siteId of sites) {
          rows.push({ orgId, templateId: t.id, siteId, date: parseDateOnly(day), scheduleKey: slot.scheduleKey, startsAt: slot.startsAt, dueAt: slot.dueAt,
            definition, checks: t.checklist.map(() => false) });
        }
      }
    }
  }
  if (!rows.length) return 0;
  return (await prisma.task.createMany({ data: rows, skipDuplicates: true })).count;
}

/** Every live site of the organisation: what the nightly cron makes tasks for. */
export async function ensureTasksEverywhere(days: readonly string[]) {
  const sites = await prisma.club.findMany({ where: { archivedAt: null, orgId: { not: null } }, select: { id: true, orgId: true } });
  const byOrg = new Map<string, string[]>();
  for (const s of sites) byOrg.set(s.orgId!, [...(byOrg.get(s.orgId!) ?? []), s.id]);
  let made = 0;
  for (const [orgId, ids] of byOrg) made += await ensureTasks(orgId, ids, days);
  return made;
}

/** The person's role, for tasks aimed at roles. */
async function roleOf(who: TasksActor) {
  return (await prisma.user.findUnique({ where: { id: who.id }, select: { staffRoleId: true } }))?.staffRoleId ?? null;
}
/** Whether a task is this person's to do: aimed at their role, or at nobody in particular.
 *  Reviewers at the site may always step in. */
export const isMine = (def: Pick<TaskDefinition, "roleIds">, roleId: string | null, reviewer: boolean) =>
  reviewer || !def.roleIds.length || (!!roleId && def.roleIds.includes(roleId));

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
  completedAt: true, completedByName: true, approvedAt: true, approvedByName: true,
  _count: { select: { comments: true, actions: { where: { status: "open" } } } },
} as const satisfies Prisma.TaskSelect;
type RawTask = Prisma.TaskGetPayload<{ select: typeof TASK_ROW }>;

function shape(t: RawTask, now: Date, day: string, roleId: string | null, reviewer: boolean) {
  const def = asDefinition(t.definition);
  const state = taskState({ ...t, date: iso(t.date), requiresApproval: def.requiresApproval }, now, day);
  return {
    id: t.id, date: iso(t.date), startsAt: t.startsAt, dueAt: t.dueAt, title: def.title, tags: def.tags, priority: def.priority, state,
    mine: isMine(def, roleId, reviewer), exceptions: t.exceptions.length, comments: t._count.comments, openActions: t._count.actions,
    completedByName: t.completedByName, approvedByName: t.approvedByName, reason: t.reason,
  };
}
export type TaskRow = ReturnType<typeof shape>;

/** One site's day: its tasks (made first, up to today), the ones still planned for a later
 *  day, what can be added by hand, and the day's figures. */
export async function taskDay(siteParam: string | undefined, dateParam: string | undefined) {
  const { who, sites, home } = await tasksSites();
  const site = sites.find((s) => s.id === (siteParam ?? home));
  if (siteParam && !site) notFound();
  const now = new Date(), day = today(now);
  const date = isDateOnly(dateParam) ? dateParam : day;
  if (!site) return { who, sites, site: null, date, day } as const;
  await ensureTasks(who.orgId ?? "", [site.id], [date]);
  const [rows, roleId, planned, addable, openActions] = await Promise.all([
    prisma.task.findMany({ where: { siteId: site.id, date: parseDateOnly(date) }, orderBy: [{ dueAt: "asc" }, { startsAt: "asc" }], select: TASK_ROW }),
    roleOf(who),
    // A later day: what the schedules will make, read only.
    date > day ? plannedOn(who.orgId ?? "", site.id, date) : Promise.resolve([]),
    // Templates without a schedule are added by hand.
    prisma.taskTemplate.findMany({
      where: { orgId: who.orgId ?? undefined, status: "published", OR: [{ siteIds: { isEmpty: true } }, { siteIds: { has: site.id } }] },
      orderBy: { title: "asc" }, select: { id: true, title: true, description: true, schedules: true },
    }).then((rows) => rows.filter((t) => !asSchedules(t.schedules).length).map(({ id, title, description }) => ({ id, title, description }))),
    prisma.taskAction.count({ where: { siteId: site.id, status: "open" } }),
  ]);
  const tasks = rows.map((t) => shape(t, now, day, roleId, site.review));
  const states = tasks.map((t) => t.state);
  return {
    who, sites, site, date, day, tasks, planned, addable, openActions,
    figures: {
      done: states.filter((s) => !NEEDS_DOING.includes(s)).length,
      total: states.length,
      overdue: states.filter((s) => s === "overdue" || s === "missed").length,
      approval: states.filter((s) => s === "approval").length,
      score: score(states),
    },
  } as const;
}

/** What a site's published schedules will make on a later day. */
async function plannedOn(orgId: string, siteId: string, date: string) {
  const templates = await prisma.taskTemplate.findMany({
    where: { orgId, status: "published", OR: [{ siteIds: { isEmpty: true } }, { siteIds: { has: siteId } }] },
    select: { id: true, title: true, tags: true, priority: true, schedules: true },
  });
  return templates.flatMap((t) => tasksOn(asSchedules(t.schedules), date).map((slot) => ({ key: `${t.id}:${slot.scheduleKey}`, title: t.title, tags: t.tags, priority: t.priority, ...slot })))
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
      actions: { orderBy: { createdAt: "asc" }, select: { id: true, title: true, status: true, dueOn: true, raisedByName: true, resolution: true, resolvedByName: true } },
    },
  });
  if (!task) notFound();
  const [complete, review] = await Promise.all([sitesFor("tasks.complete"), sitesFor("tasks.review")]);
  if (!covers(complete, task.siteId)) notFound();
  const reviewer = covers(review, task.siteId);
  const roleId = await roleOf(who);
  const def = asDefinition(task.definition);
  const now = new Date();
  const row = shape(task, now, today(now), roleId, reviewer);
  const roles = def.roleIds.length ? await prisma.staffRole.findMany({ where: { id: { in: def.roleIds } }, select: { name: true }, orderBy: { name: "asc" } }) : [];
  return {
    who, task: { ...row, siteId: task.siteId, siteName: task.site.name, version: task.version, status: task.status, checks: task.checks, records: asRecords(task.records),
      definition: def, addedByName: task.addedByName, comments: task.comments, files: task.files, actions: task.actions, exceptionList: task.exceptions },
    roles: roles.map((r) => r.name),
    can: {
      work: task.status === "open" && row.mine,
      comment: true,
      review: reviewer,
      approve: reviewer && row.state === "approval" && task.completedById !== who.id,
    },
  };
}

/** Follow-up actions at one site: the open ones first, then the latest resolved. */
export async function taskActions(siteParam: string | undefined) {
  const { who, sites, home } = await tasksSites();
  const site = sites.find((s) => s.id === (siteParam ?? home));
  if (siteParam && !site) notFound();
  if (!site) return { who, sites, site: null, open: [], resolved: [] } as const;
  const select = { id: true, title: true, dueOn: true, status: true, raisedByName: true, createdAt: true, resolvedAt: true, resolvedByName: true, resolution: true,
    task: { select: { id: true, date: true, definition: true } } } as const;
  const [open, resolved] = await Promise.all([
    prisma.taskAction.findMany({ where: { siteId: site.id, status: "open" }, orderBy: [{ dueOn: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }], select }),
    prisma.taskAction.findMany({ where: { siteId: site.id, status: "resolved" }, orderBy: { resolvedAt: "desc" }, take: 30, select }),
  ]);
  const name = (a: (typeof open)[number]) => ({ ...a, from: a.task ? { id: a.task.id, title: asDefinition(a.task.definition).title, date: iso(a.task.date) } : null });
  return { who, sites, site, open: open.map(name), resolved: resolved.map(name) } as const;
}

export const REPORT_INTERVALS = ["day", "week", "month"] as const;
export type ReportInterval = (typeof REPORT_INTERVALS)[number];
const periodOf = (day: string, interval: ReportInterval) => {
  if (interval === "day") return day;
  if (interval === "month") return day.slice(0, 7);
  const d = new Date(`${day}T12:00:00Z`);
  return addDays(day, -((d.getUTCDay() + 6) % 7));
};

/** Scores and figures for the sites this person reviews, over a range of at most 92 days,
 *  by day, week (from Monday) or month; and every task in the range, for the export. */
export async function taskReport(input: { from?: string; to?: string; interval?: string; site?: string }) {
  const who = await requireTasksActor();
  if (!who.review) notFound();
  const review = await sitesFor("tasks.review");
  const day = today();
  const to = isDateOnly(input.to) && input.to <= day ? input.to : day;
  const from = isDateOnly(input.from) && input.from <= to ? (input.from < addDays(to, -91) ? addDays(to, -91) : input.from) : addDays(to, -6);
  const interval: ReportInterval = (REPORT_INTERVALS as readonly string[]).includes(input.interval ?? "") ? (input.interval as ReportInterval) : "day";
  const sites = await prisma.club.findMany({
    where: { archivedAt: null, orgId: who.orgId ?? undefined, ...(review.kind === "all" ? {} : { id: { in: [...review.siteIds] } }) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true },
  });
  const chosen = input.site ? sites.filter((s) => s.id === input.site) : sites;
  if (input.site && !chosen.length) notFound();
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  await ensureTasks(who.orgId ?? "", chosen.map((s) => s.id), days);
  const rows = await prisma.task.findMany({
    where: { siteId: { in: chosen.map((s) => s.id) }, date: { gte: parseDateOnly(from), lte: parseDateOnly(to) } },
    orderBy: [{ date: "asc" }, { dueAt: "asc" }], select: { ...TASK_ROW, site: { select: { name: true } } },
  });
  const now = new Date();
  const tasks = rows.map((t) => ({ ...shape(t, now, day, null, true), siteId: t.siteId, siteName: t.site.name, exceptionList: t.exceptions }));
  const periods = [...new Set(days.map((d) => periodOf(d, interval)))];
  const bySite = chosen.map((s) => {
    const mine = tasks.filter((t) => t.siteId === s.id);
    const states = mine.map((t) => t.state);
    return {
      ...s, score: score(states), total: states.length,
      missed: states.filter((x) => x === "missed" || x === "overdue" || x === "cant_complete").length,
      late: states.filter((x) => x === "late").length,
      exceptions: mine.reduce((n, t) => n + t.exceptions, 0),
      periods: periods.map((p) => ({ period: p, score: score(mine.filter((t) => periodOf(t.date, interval) === p).map((t) => t.state)) })),
    };
  });
  return { who, sites, site: input.site ?? null, from, to, interval, periods, bySite, tasks };
}

/** The organisation's templates, for the people who write them. */
export async function taskTemplates() {
  const who = await requireTasksActor();
  if (!who.manage) notFound();
  const [templates, sites, roles] = await Promise.all([
    prisma.taskTemplate.findMany({ where: { orgId: who.orgId ?? undefined }, orderBy: [{ status: "asc" }, { title: "asc" }],
      select: { id: true, title: true, status: true, siteIds: true, roleIds: true, tags: true, priority: true, schedules: true, updatedAt: true } }),
    templateSites(who),
    templateRoles(),
  ]);
  return { who, templates: templates.map((t) => ({ ...t, schedules: asSchedules(t.schedules) })), sites, roles };
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
      siteIds: template.siteIds, roleIds: template.roleIds, tags: template.tags, priority: template.priority, checklist: template.checklist, fields: asFields(template.fields),
      minimumRecords: template.minimumRecords, schedules: asSchedules(template.schedules), requiresComment: template.requiresComment, requiresApproval: template.requiresApproval,
      used: await prisma.task.count({ where: { templateId: template.id } }),
    } : null,
  };
}

/** The home page's figures for one person: today at their sites. Counts only. */
export async function tasksHome() {
  const { who, sites } = await tasksSites();
  const day = today(), now = new Date();
  const ids = sites.map((s) => s.id);
  await ensureTasks(who.orgId ?? "", ids, [day]);
  const reviewIds = sites.filter((s) => s.review).map((s) => s.id);
  const [rows, roleId, openActions] = await Promise.all([
    prisma.task.findMany({ where: { siteId: { in: ids }, date: parseDateOnly(day) }, select: TASK_ROW }),
    roleOf(who),
    prisma.taskAction.count({ where: { siteId: { in: ids }, status: "open" } }),
  ]);
  const tasks = rows.map((t) => ({ ...shape(t, now, day, roleId, reviewIds.includes(t.siteId)), siteId: t.siteId }));
  const mine = tasks.filter((t) => t.mine);
  return {
    todo: mine.filter((t) => t.state === "open").length,
    overdue: mine.filter((t) => t.state === "overdue").length,
    approval: tasks.filter((t) => t.state === "approval" && reviewIds.includes(t.siteId)).length,
    openActions,
  };
}

