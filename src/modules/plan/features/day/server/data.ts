import "server-only";
import { notFound } from "next/navigation";
import { isDateOnly, minutesNow, today } from "@/lib/format";
import { requirePlanActor } from "@/modules/plan/shared/access";
import { areasOf, classesAt, dutiesOf, heldOn, offsBetween, peopleFor, qualificationNames, sessionsOf, shiftsAt, shiftsElsewhere } from "@/modules/plan/shared/data";
import { candidatesFor, fillsOf, gapsOf, laneClashes, needsOf, occurrencesOn, tasksOf, warningsOf } from "@/modules/plan/shared/model";
import { mayManage, planSites, plannableDepartments, viewableSite } from "@/modules/plan/shared/scope";

/** The Day: what's on with its gaps, then each person's shift with their duties, breaks, tasks and
 *  warnings, for the whole site (every department), the Manage level's "run today" view too. */
export async function planDay(params: { site?: string; date?: string }) {
  const who = await requirePlanActor();
  const sites = await planSites(who);
  const siteId = sites.find((s) => s.id === params.site)?.id ?? sites[0]?.id;
  if (!siteId) return { who, sites, site: null } as const;
  const site = await viewableSite(siteId);
  if (!site) notFound();
  const date = params.date && isDateOnly(params.date) ? params.date : today();
  const [sessions, areas, duties, shifts, departments, manage, qNames] = await Promise.all([
    sessionsOf(site.orgId, site.id, date, date), areasOf(site.orgId, site.id), dutiesOf(site.orgId), shiftsAt(site.orgId, site.id, date, date),
    plannableDepartments(who, site.id, site.orgId), mayManage(site.id, site.orgId), qualificationNames(site.orgId),
  ]);
  const userIds = [...new Set(shifts.map((s) => s.userId))];
  const [people, offs, elsewhere, classes, held] = await Promise.all([
    peopleFor(site.orgId, site.id, userIds), offsBetween(site.orgId, date, date), shiftsElsewhere(site.orgId, site.id, userIds, date, date),
    classesAt(site.id, userIds, date, date), heldOn(userIds),
  ]);
  const dutyMap = new Map(duties.map((d) => [d.id, d]));
  const classDuty = duties.find((d) => d.forClasses) ?? null;
  const occurrences = occurrencesOn(sessions, date);
  const blocks = shifts.flatMap((s) => s.blocks);
  const needs = needsOf(occurrences, classes.atSite, classDuty?.id ?? null, areas).map((need) => {
    const fills = fillsOf(need, blocks, classes.atSite);
    return { ...need, fills, gaps: gapsOf(need, fills) };
  });
  const heldToday = (userId: string, typeId: string) => held(userId, typeId, date);
  const departmentOf = (userId: string) => people.find((p) => p.id === userId)?.departmentIds ?? [];
  const warnings = warningsOf({
    shifts, duties: dutyMap, qualificationNames: qNames, held: heldToday, off: new Set(offs.map((o) => o.userId)),
    classes: classes.all, elsewhere, classDutyId: classDuty?.id ?? null,
  });
  const mine = new Set(departments.mine.map((d) => d.id));
  // For "free then", a class someone teaches counts as busy like a duty.
  const busyShifts = shifts.map((s) => ({ ...s, blocks: [...s.blocks, ...classes.all.filter((c) => c.userId === s.userId)
    .map((c) => ({ id: `class:${c.ref}`, shiftId: s.id, dutyId: classDuty?.id ?? "", sessionId: null, start: c.start, end: c.end }))] }));
  return {
    who, sites, site, date, today: today(), now: minutesNow(), manage, departments, duties, areas, people, offs,
    occurrences, needs, classDutyId: classDuty?.id ?? null,
    clashes: laneClashes(occurrences, new Map(areas.map((a) => [a.id, a.lanes]))),
    shifts: shifts.map((s) => ({
      ...s, canPlan: mine.has(s.departmentId),
      tasks: s.blocks.flatMap((b) => tasksOf(b, dutyMap.get(b.dutyId)?.tasks ?? [])),
      classes: classes.all.filter((c) => c.userId === s.userId && c.siteId === site.id),
      warnings: warnings.filter((w) => w.shiftId === s.id).map((w) => w.text),
    })),
    /** Who could fill each gap, best first, for the fill sheet. */
    candidates: Object.fromEntries(needs.flatMap((n) => n.gaps.map((g, i) => [`${n.key}#${i}`,
      candidatesFor(g, n.dutyId, { shifts: busyShifts, duties: dutyMap, held: heldToday, departmentOf })]))),
  } as const;
}
export type PlanDayData = Extract<Awaited<ReturnType<typeof planDay>>, { date: string }>;
