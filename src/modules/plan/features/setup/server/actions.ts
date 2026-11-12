"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { areaById, departmentById } from "@/lib/directory";
import { today } from "@/lib/format";
import { holdsAnywhere } from "@/lib/policy/engine";
import { currentActor } from "@/lib/policy/session";
import { liveQualificationTypeById } from "@/lib/qualifications";
import { prisma } from "@/lib/prisma";
import { requirePlanActor } from "@/modules/plan/shared/access";
import { shiftIso } from "@/modules/plan/shared/model";
import { dutySchema, firstIssue, sessionSchema, type DutyInput, type SessionInput } from "@/modules/plan/shared/rules";
import { mayManage, viewableSite } from "@/modules/plan/shared/scope";

/** Setup's writes, Manage only: duties (the organisation's) and sessions (a site's). Areas are
 *  Admin's (Admin › Areas). Nothing is deleted: duties are archived and sessions called off, so past
 *  days still read the same. */

const refresh = () => revalidatePath("/plan", "layout");

/** Duties belong to the organisation, so Manage at any site keeps them. */
async function requireDutyManager() {
  const who = await requirePlanActor();
  if (!who.orgId || !holdsAnywhere(await currentActor(), "plan.manage")) return null;
  return who as typeof who & { orgId: string };
}

export async function saveDuty(input: DutyInput, id?: string): Promise<ActionResult> {
  const who = await requireDutyManager();
  if (!who) return fail("Only someone who manages the plan can change the duties.");
  const parsed = dutySchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const v = parsed.data;
  if (v.departmentId && !(await departmentById(v.departmentId, who.orgId))) return fail("That department is no longer open.");
  if (v.qualificationTypeId && !(await liveQualificationTypeById(v.qualificationTypeId, who.orgId))) return fail("That qualification is no longer on the list.");
  const result = await prisma.$transaction(async (tx) => {
    const existing = id ? await tx.planDuty.findFirst({ where: { id, orgId: who.orgId, archivedAt: null } }) : null;
    if (id && !existing) return fail("That duty is no longer on the list.");
    const twin = await tx.planDuty.findFirst({ where: { orgId: who.orgId, archivedAt: null, name: { equals: v.name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) } });
    if (twin) return fail(`There is already a duty called ${twin.name}.`);
    // One duty is the one classes need: marking this one moves the mark here.
    if (v.forClasses) await tx.planDuty.updateMany({ where: { orgId: who.orgId, forClasses: true, ...(id ? { id: { not: id } } : {}) }, data: { forClasses: false } });
    const data = { name: v.name, departmentId: v.departmentId, qualificationTypeId: v.qualificationTypeId, color: v.color, defaultMinutes: v.defaultMinutes, isBreak: v.isBreak, forClasses: v.forClasses };
    // A task already on the duty keeps its row, so the days it was chosen on (`PlanBlock.taskIds`)
    // keep it; one left out is taken off, and those days stop showing it.
    // A task is its name only: its time is set on the Day. `when` is retired and written as "start".
    const tasks = v.tasks.map((t, i) => ({ id: t.id, name: t.name, sortOrder: i }));
    const had = new Set(existing ? (await tx.planDutyTask.findMany({ where: { dutyId: existing.id }, select: { id: true } })).map((t) => t.id) : []);
    const kept = tasks.filter((t) => t.id && had.has(t.id));
    const added = tasks.filter((t) => !t.id || !had.has(t.id)).map((t) => ({ name: t.name, when: "start", sortOrder: t.sortOrder }));
    const row = existing
      ? await tx.planDuty.update({ where: { id: existing.id }, data: { ...data, tasks: {
        deleteMany: { id: { notIn: kept.map((t) => t.id!) } },
        update: kept.map((t) => ({ where: { id: t.id! }, data: { name: t.name, sortOrder: t.sortOrder } })),
        create: added,
      } } })
      : await tx.planDuty.create({ data: { ...data, orgId: who.orgId, tasks: { create: added } } });
    await logAudit({ actorId: who.id, actorName: who.name, action: existing ? "update" : "create", entity: "PlanDuty", entityId: row.id, clubId: null,
      summary: `${existing ? "Changed" : "Added"} the duty ${row.name}` }, tx);
    return ok();
  });
  if (result.ok) refresh();
  return result;
}

export async function archiveDuty(id: string): Promise<ActionResult> {
  const who = await requireDutyManager();
  if (!who) return fail("Only someone who manages the plan can change the duties.");
  const duty = await prisma.planDuty.findFirst({ where: { id, orgId: who.orgId, archivedAt: null } });
  if (!duty) return fail("That duty is no longer on the list.");
  await prisma.$transaction(async (tx) => {
    await tx.planDuty.update({ where: { id }, data: { archivedAt: new Date(), forClasses: false } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "archive", entity: "PlanDuty", entityId: id, clubId: null, summary: `Took ${duty.name} off the duties` }, tx);
  });
  refresh();
  return ok();
}

/** Add or change a session: what's on, where, when it repeats and the duties it needs. */
export async function saveSession(input: SessionInput, id?: string): Promise<ActionResult> {
  const who = await requirePlanActor();
  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const v = parsed.data;
  const site = await viewableSite(v.siteId);
  if (!site || !(await mayManage(site.id, site.orgId))) return fail("Only someone who manages the plan here can change what's on.");
  if (v.areaId) {
    const area = await areaById(v.areaId);
    if (!area || area.siteId !== site.id) return fail("That area is no longer on the list.");
    if (v.lanes.some((l) => l > area.lanes)) return fail(area.lanes ? `${area.name} has ${area.lanes} lanes.` : `${area.name} has no lanes; take the whole area.`);
  } else if (v.lanes.length) return fail("Choose the area before its lanes.");
  const duties = await prisma.planDuty.findMany({ where: { orgId: site.orgId, archivedAt: null, id: { in: v.needs.map((n) => n.dutyId) } } });
  if (duties.length !== v.needs.length || duties.some((d) => d.isBreak)) return fail("Each line needs a duty from the list, and a break can't be one.");
  const skipDays = [...new Set(v.skipDays)].filter((d) => d >= v.firstDay && d <= v.lastDay).sort();
  const result = await prisma.$transaction(async (tx) => {
    const existing = id ? await tx.planSession.findFirst({ where: { id, orgId: site.orgId, siteId: site.id, cancelledAt: null } }) : null;
    if (id && !existing) return fail("That session no longer exists.");
    const data = { title: v.title, siteAreaId: v.areaId, lanes: [...new Set(v.lanes)].sort((a, b) => a - b), startMinutes: v.start, endMinutes: v.end,
      weekdays: [...new Set(v.weekdays)].sort(), firstDay: v.firstDay, lastDay: v.lastDay, skipDays, note: v.note };
    const needs = { create: v.needs.map((n) => ({ dutyId: n.dutyId, count: n.count })) };
    const row = existing
      ? await tx.planSession.update({ where: { id: existing.id }, data: { ...data, needs: { deleteMany: {}, ...needs } } })
      : await tx.planSession.create({ data: { ...data, orgId: site.orgId, siteId: site.id, createdById: who.id, createdByName: who.name, needs } });
    await logAudit({ actorId: who.id, actorName: who.name, action: existing ? "update" : "create", entity: "PlanSession", entityId: row.id, clubId: site.id,
      summary: `${existing ? "Changed" : "Added"} ${row.title}, ${row.firstDay} to ${row.lastDay}` }, tx);
    return ok();
  });
  if (result.ok) refresh();
  return result;
}

/** Call a session off from today on; its past days stay as they were. People already on it keep
 *  their blocks as duties without a session. */
export async function cancelSession(id: string): Promise<ActionResult> {
  const who = await requirePlanActor();
  const from = today();
  const session = await prisma.planSession.findFirst({ where: { id, orgId: who.orgId ?? undefined, cancelledAt: null } });
  if (!session) return fail("That session no longer exists.");
  const site = await viewableSite(session.siteId);
  if (!site || !(await mayManage(site.id, site.orgId))) return fail("Only someone who manages the plan here can change what's on.");
  await prisma.$transaction(async (tx) => {
    if (session.firstDay < from) await tx.planSession.update({ where: { id }, data: { lastDay: [session.lastDay, shiftIso(from, -1)].sort()[0] } });
    else await tx.planSession.update({ where: { id }, data: { cancelledAt: new Date() } });
    await tx.planBlock.updateMany({ where: { sessionId: id, shift: { date: { gte: from } } }, data: { sessionId: null } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "cancel", entity: "PlanSession", entityId: id, clubId: site.id, summary: `Called off ${session.title} from ${from}` }, tx);
  });
  refresh();
  return ok();
}
