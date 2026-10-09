import "server-only";
import { notFound } from "next/navigation";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { sitesFor } from "@/lib/policy/session";
import { requireTasksActor, type TasksActor } from "@/modules/tasks/shared/access";
import { NEEDS_DOING, SCHEDULED_KINDS, dayIn, score, tasksOn, type TaskState } from "@/modules/tasks/shared/rules";
import { type SiteSettings, TASK_ROW, asDefinition, asRecords, asSchedules, covers, ensureTasks, followUpTemplates, iso, shape, siteSettings, tasksSites, textMatch } from "@/modules/tasks/shared/data";

/** The person's role, for tasks aimed at roles. */
async function roleOf(who: TasksActor) {
  return (await prisma.user.findUnique({ where: { id: who.id }, select: { staffRoleId: true } }))?.staffRoleId ?? null;
}

/** Today's filters (from the prototype): what to show, and a tag. */
export const DAY_FILTERS = { all: "All tasks", open: "To do", overdue: "Overdue", approval: "Awaiting approval", completed: "Completed" } as const;
export type DayFilter = keyof typeof DAY_FILTERS;
const DONE_STATES: readonly TaskState[] = ["done", "early", "late", "approval", "approved"];
const dayFilter = (f: DayFilter, s: TaskState) =>
  f === "all" || (f === "open" ? s === "open" || s === "upcoming" : f === "overdue" ? s === "overdue" || s === "missed" : f === "approval" ? s === "approval" : DONE_STATES.includes(s));

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
