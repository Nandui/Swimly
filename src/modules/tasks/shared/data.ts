import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { currentClubIdIfAny } from "@/lib/clubs/current";
import { liveSitesWithin } from "@/lib/directory";
import { parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { sitesFor } from "@/lib/policy/session";
import { requireTasksActor, type TasksActor } from "@/modules/tasks/shared/access";
import {
  DEFAULT_SITE, SCHEDULED_KINDS, dayIn, taskState, tasksOn, type LogMode, type SiteStatus, type TaskDefinition, type TaskField, type TaskRecord, type TaskSchedule,
} from "@/modules/tasks/shared/rules";

/** Tasks' reads (docs/tasks.md). Everything is limited to the sites the
 *  capability covers; a task outside them is a 404. A day's tasks are made from
 *  the published templates the first time anyone needs them (opening the day,
 *  the home page, a report, or the nightly cron), so making them twice is harmless. */

export type Sites = Awaited<ReturnType<typeof sitesFor>>;
export const covers = (sites: Sites, siteId: string) => sites.kind === "all" || sites.siteIds.has(siteId);
export const iso = (d: Date) => d.toISOString().slice(0, 10);

export const asFields = (v: Prisma.JsonValue) => (Array.isArray(v) ? v : []) as unknown as TaskField[];
export const asSchedules = (v: Prisma.JsonValue) => (Array.isArray(v) ? v : []) as unknown as TaskSchedule[];
export const asRecords = (v: Prisma.JsonValue) => (Array.isArray(v) && v.length ? v : [{}]) as unknown as TaskRecord[];
export const asDefinition = (v: Prisma.JsonValue) => v as unknown as TaskDefinition;

export type TemplateRow = {
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
/** Whether this person may complete a task: it is not restricted, or it is aimed at their
 *  role, or at nobody in particular. Reviewers at the site may always step in. */
export const isMine = (def: Pick<TaskDefinition, "roleIds" | "restricted">, roleId: string | null, reviewer: boolean) =>
  reviewer || def.restricted === false || !def.roleIds.length || (!!roleId && def.roleIds.includes(roleId));

/** The sites this person's Tasks covers, in the organisation's order, and which they review. */
export async function tasksSites() {
  const who = await requireTasksActor();
  const [complete, review] = await Promise.all([sitesFor("tasks.complete"), who.review ? sitesFor("tasks.review") : null]);
  const sites = await liveSitesWithin(who.orgId ?? null, complete);
  const working = await currentClubIdIfAny();
  return {
    who, sites: sites.map((s) => ({ ...s, review: !!review && covers(review, s.id) })),
    /** The default site: the one they are working at, if Tasks covers it. */
    home: sites.some((s) => s.id === working) ? working : sites[0]?.id ?? null,
  };
}

export const TASK_ROW = {
  id: true, siteId: true, date: true, scheduleKey: true, startsAt: true, dueAt: true, definition: true, status: true, exceptions: true, reason: true,
  completedAt: true, completedByName: true, approvedAt: true, approvedByName: true, templateId: true,
  _count: { select: { comments: true, actions: { where: { status: "open" } } } },
} as const satisfies Prisma.TaskSelect;
export type RawTask = Prisma.TaskGetPayload<{ select: typeof TASK_ROW }>;

export const stateOf = (t: RawTask, now: Date, day: string) => taskState({ ...t, date: iso(t.date), requiresApproval: asDefinition(t.definition).requiresApproval }, now, day);
export function shape(t: RawTask, now: Date, day: string, roleId: string | null, reviewer: boolean) {
  const def = asDefinition(t.definition);
  return {
    id: t.id, date: iso(t.date), startsAt: t.startsAt, dueAt: t.dueAt, title: def.title, tags: def.tags, priority: def.priority, state: stateOf(t, now, day),
    mine: isMine(def, roleId, reviewer), exceptions: t.exceptions.length, comments: t._count.comments, openActions: t._count.actions,
    completedByName: t.completedByName, completedAt: t.completedAt, approvedByName: t.approvedByName, reason: t.reason, templateId: t.templateId,
  };
}
export type TaskRow = ReturnType<typeof shape>;
export const textMatch = (q: string, t: { title: string; tags: string[] }) => !q || `${t.title} ${t.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase());

/** Follow-up action templates published for a site: offered when raising an action. */
export function followUpTemplates(who: TasksActor, siteId: string) {
  return prisma.taskTemplate.findMany({
    where: { orgId: who.orgId ?? undefined, status: "published", kind: "action", OR: [{ siteIds: { isEmpty: true } }, { siteIds: { has: siteId } }] },
    orderBy: { title: "asc" }, select: { id: true, title: true, description: true },
  });
}

export const templateSites = (who: TasksActor) =>
  liveSitesWithin(who.orgId ?? null, { kind: "all" });
