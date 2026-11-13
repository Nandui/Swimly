"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { activeStaffAmong, departmentsForSite } from "@/lib/directory";
import { today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { planCommitment } from "@/modules/contributions";
import { requirePlanActor } from "@/modules/plan/shared/access";
import { chatConfig } from "@/modules/plan/shared/chat";
import { coverAskSchema, openRequestFor, shiftCovering, stillToCover, type CoverAskInput } from "@/modules/plan/shared/cover";
import { postCoverCard, refreshCoverCard } from "@/modules/plan/shared/cover-chat";
import { areasOf, classesAt, dutiesOf, sessionsOf } from "@/modules/plan/shared/data";
import { needsOf, occurrencesOn } from "@/modules/plan/shared/model";
import { clock, firstIssue } from "@/modules/plan/shared/rules";
import { mayPlanDepartment, viewableSite } from "@/modules/plan/shared/scope";

/** Asking staff to cover a gap on the Day (D31): ask (which posts a card to the department's
 *  Google Chat space), choose one of the people who said yes, or stop asking; the card follows. Whoever plans the department asked does all three. Choosing puts the person on:
 *  a shift for the stretch (or their shift that day grown to take it in), then the duty or the
 *  class. Warnings never stop it; they show on the Day as for anyone else. */

const CANT_PLAN = "You can't plan that department at this site.";

/** One need on a day, as the Day works it out, with its duty and where it is. */
async function needOn(site: { id: string; orgId: string }, date: string, needKey: string) {
  const [sessions, areas, duties, classes] = await Promise.all([
    sessionsOf(site.orgId, site.id, date, date), areasOf(site.id), dutiesOf(site.orgId), classesAt(site.id, [], date, date),
  ]);
  const classDuty = duties.find((d) => d.forClasses) ?? null;
  const need = needsOf(occurrencesOn(sessions, date), classes.atSite, classDuty?.id ?? null, areas).find((n) => n.key === needKey) ?? null;
  if (!need) return null;
  const place = areas.find((a) => a.id === need.areaId)?.name
    ?? (need.kind === "class" ? classes.atSite.find((c) => `c:${c.source}:${c.ref}` === need.key)?.place.trim() ?? "" : "");
  return { need, duty: duties.find((d) => d.id === need.dutyId) ?? null, place };
}

const describe = (r: { title: string; date: string; startMinutes: number; endMinutes: number }, dutyName: string) =>
  `${dutyName} for ${r.title}, ${r.date} ${clock(r.startMinutes)} to ${clock(r.endMinutes)}`;

/** Ask the department's staff to cover a stretch of a need. One ask at a time for a stretch. */
export async function askForCover(input: CoverAskInput): Promise<ActionResult> {
  const who = await requirePlanActor();
  const parsed = coverAskSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const v = parsed.data;
  const site = await viewableSite(v.siteId);
  if (!site) return fail("That site is not open.");
  if (v.date < today()) return fail("That day has passed.");
  const found = await needOn(site, v.date, v.needKey);
  if (!found) return fail("That isn't on that day any more.");
  const { need, duty, place } = found;
  if (!duty) return fail("That duty is no longer on the list.");
  if (v.start < need.start || v.end > need.end) return fail(`${need.title} runs ${clock(need.start)} to ${clock(need.end)}; ask inside that.`);
  // The duty's own department is asked; a duty any department does needs one chosen.
  const departmentId = duty.departmentId ?? v.departmentId;
  const department = departmentId ? (await departmentsForSite(site.orgId, site.id)).find((d) => d.id === departmentId) : null;
  if (!department) return fail("Choose which department to ask.");
  if (!(await mayPlanDepartment(who, site.id, site.orgId, department.id))) return fail(CANT_PLAN);
  const space = await prisma.planChatSpace.findUnique({ where: { siteId_departmentId: { siteId: site.id, departmentId: department.id } }, select: { id: true } });
  if (!space) return fail(`${department.name} has no Google Chat space linked at ${site.name} yet, so there is nobody to ask.`);
  if (!chatConfig()) return fail("Google Chat isn't set up for Turnfin yet, so there is nobody to ask.");
  const result = await prisma.$transaction(async (tx) => {
    const open = await tx.planCoverRequest.findMany({ where: { orgId: site.orgId, siteId: site.id, date: v.date, needKey: need.key, closedAt: null },
      select: { needKey: true, startMinutes: true, endMinutes: true } });
    if (openRequestFor(open.map((r) => ({ needKey: r.needKey, start: r.startMinutes, end: r.endMinutes })), need.key, v)) return fail("Staff are already being asked for this.");
    const row = await tx.planCoverRequest.create({ data: {
      orgId: site.orgId, siteId: site.id, date: v.date, needKey: need.key, dutyId: duty.id, sessionId: need.sessionId, classSource: need.source, classRef: need.classRef,
      departmentId: department.id, title: need.title, place, startMinutes: v.start, endMinutes: v.end, note: v.note, askedById: who.id, askedByName: who.name,
    } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "create", entity: "PlanCoverRequest", entityId: row.id, clubId: site.id,
      summary: `Asked ${department.name} to cover ${describe(row, duty.name)}` }, tx);
    return { ok: true as const, id: row.id, what: describe(row, duty.name) };
  });
  if (!result.ok) return result;
  // The card goes out once the request is kept. If Chat won't take it nobody was asked, so the
  // request is stopped again rather than left looking as if staff had seen it.
  if (!(await postCoverCard(result.id))) {
    await prisma.$transaction(async (tx) => {
      await tx.planCoverRequest.update({ where: { id: result.id }, data: { closedAt: new Date(), outcome: "stopped", closedById: who.id, closedByName: who.name } });
      await logAudit({ actorId: who.id, actorName: who.name, action: "update", entity: "PlanCoverRequest", entityId: result.id, clubId: site.id,
        summary: `Could not post to Google Chat, so nobody was asked to cover ${result.what}` }, tx);
    });
    revalidatePath("/plan", "layout");
    return fail("Google Chat didn't take the request, so nobody was asked. Try again in a moment.");
  }
  revalidatePath("/plan", "layout");
  return ok();
}

/** The open request, for whoever plans the department it asked. */
async function openRequest(id: string) {
  const who = await requirePlanActor();
  const request = await prisma.planCoverRequest.findFirst({ where: { id, orgId: who.orgId ?? undefined }, include: { offers: true } });
  if (!request) return fail("That request no longer exists.");
  if (request.closedAt) return fail(request.outcome === "filled" ? "Someone was already chosen for this." : "Asking was already stopped for this.");
  const site = await viewableSite(request.siteId);
  if (!site || !(await mayPlanDepartment(who, site.id, site.orgId, request.departmentId))) return fail(CANT_PLAN);
  return { ok: true as const, who, request, site };
}

/** Stop asking: nobody is chosen, and people can no longer answer. */
export async function stopAsking(id: string): Promise<ActionResult> {
  const at = await openRequest(id);
  if (!at.ok) return at;
  const { who, request, site } = at;
  const result = await prisma.$transaction(async (tx) => {
    const closed = await tx.planCoverRequest.updateMany({ where: { id: request.id, closedAt: null }, data: { closedAt: new Date(), outcome: "stopped", closedById: who.id, closedByName: who.name } });
    if (!closed.count) return fail("Asking was already stopped for this.");
    await logAudit({ actorId: who.id, actorName: who.name, action: "update", entity: "PlanCoverRequest", entityId: request.id, clubId: site.id,
      summary: `Stopped asking for cover: ${request.title}, ${request.date} ${clock(request.startMinutes)} to ${clock(request.endMinutes)}` }, tx);
    return ok();
  });
  if (!result.ok) return result;
  await refreshCoverCard(request.id);
  revalidatePath("/plan", "layout");
  return ok();
}

/** Choose one of the people who said yes, and put them on. */
export async function chooseCover(requestId: string, userId: string): Promise<ActionResult> {
  const at = await openRequest(requestId);
  if (!at.ok) return at;
  const { who, request, site } = at;
  if (!request.offers.some((o) => o.userId === userId && o.answer === "yes")) return fail("They haven't offered to cover this.");
  const [person] = await activeStaffAmong(site.orgId, [userId]);
  if (!person) return fail("That person is no longer active.");
  const found = await needOn(site, request.date, request.needKey);
  // A class has one teacher for all of it; anything else is filled for what was asked.
  const span = found?.need.kind === "class" ? { start: found.need.start, end: found.need.end }
    : stillToCover({ start: request.startMinutes, end: request.endMinutes }, found?.need ?? null);
  if (!found || !span) return fail(`${request.title} isn't on then any more. Stop asking instead.`);
  const { need, duty } = found;
  if (!duty) return fail("That duty is no longer on the list. Stop asking instead.");
  const theirs = await prisma.planShift.findFirst({ where: { orgId: site.orgId, siteId: site.id, userId: person.id, date: request.date }, select: { departmentId: true } });
  if (theirs && theirs.departmentId !== request.departmentId && !(await mayPlanDepartment(who, site.id, site.orgId, theirs.departmentId)))
    return fail(`${person.name} already has a shift here that day on another department's plan. Ask whoever plans it to change it first.`);
  // The class's own app keeps who teaches it, with its own checks and audit; it goes first, so a
  // class that can't be planned leaves the request open.
  if (need.kind === "class") {
    const planned = await planCommitment(need.source!, { ref: need.classRef!, siteId: site.id, date: request.date, userId: person.id, by: { id: who.id, name: who.name } });
    if (!planned.ok) return planned;
  }
  const what = describe(request, duty.name);
  const result = await prisma.$transaction(async (tx) => {
    const closed = await tx.planCoverRequest.updateMany({ where: { id: request.id, closedAt: null },
      data: { closedAt: new Date(), outcome: "filled", chosenUserId: person.id, closedById: who.id, closedByName: who.name } });
    if (!closed.count) return fail("Someone was already chosen for this.");
    const shift = await tx.planShift.findFirst({ where: { orgId: site.orgId, siteId: site.id, userId: person.id, date: request.date } });
    const times = shiftCovering(shift ? { start: shift.startMinutes, end: shift.endMinutes } : null, span);
    const row = shift
      ? times.changed ? await tx.planShift.update({ where: { id: shift.id }, data: { startMinutes: times.start, endMinutes: times.end } }) : shift
      : await tx.planShift.create({ data: { orgId: site.orgId, siteId: site.id, departmentId: request.departmentId, userId: person.id, date: request.date,
          startMinutes: times.start, endMinutes: times.end, createdById: who.id, createdByName: who.name } });
    if (times.changed) await logAudit({ actorId: who.id, actorName: who.name, action: shift ? "update" : "create", entity: "PlanShift", entityId: row.id, clubId: site.id,
      summary: `${shift ? "Changed" : "Planned"} ${person.name}'s shift on ${request.date}, ${clock(times.start)} to ${clock(times.end)}, to cover` }, tx);
    if (need.kind === "session") {
      const block = await tx.planBlock.create({ data: { shiftId: row.id, dutyId: duty.id, sessionId: need.sessionId, startMinutes: span.start, endMinutes: span.end } });
      await logAudit({ actorId: who.id, actorName: who.name, action: "create", entity: "PlanBlock", entityId: block.id, clubId: site.id,
        summary: `Put ${person.name} on ${duty.name} for ${need.title}, ${request.date} ${clock(span.start)} to ${clock(span.end)}` }, tx);
    }
    await logAudit({ actorId: who.id, actorName: who.name, action: "update", entity: "PlanCoverRequest", entityId: request.id, clubId: site.id,
      summary: `Chose ${person.name} to cover ${what}` }, tx);
    return ok();
  });
  if (!result.ok) return result;
  await refreshCoverCard(request.id);
  revalidatePath("/plan", "layout");
  return ok();
}
