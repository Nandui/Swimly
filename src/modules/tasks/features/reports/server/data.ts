import "server-only";
import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { sitesFor } from "@/lib/policy/session";
import { requireTasksActor } from "@/modules/tasks/shared/access";
import { addDays, dayIn, score, type TaskState } from "@/modules/tasks/shared/rules";
import { TASK_ROW, ensureTasks, iso, shape, siteSettings, templateSites, textMatch } from "@/modules/tasks/shared/data";

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
