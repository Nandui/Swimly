"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { activeStaffAtSite } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import { requireIncidentsActor } from "@/modules/incidents/shared/access";
import { requestOrigin } from "@/modules/incidents/shared/origin";
import {
  actionOutcomeSchema, actionProblem, actionSchema, cleanWhys, IncidentError, investigable, investigationSchema, reopenDecision, reopenSchema,
  statementProblem, statementSchema, type ActionInput, type ActionOutcomeInput, type InvestigationInput, type StatementInput,
} from "@/modules/incidents/shared/rules";
import { lockReport, recordEvent, reportRights, touchReport } from "@/modules/incidents/shared/service";
import { sendActionEmail } from "@/modules/incidents/features/investigation/server/emails";

/** The investigation (docs/incidents.md, phase 2): statements, the five whys
 *  and root cause, corrective actions, and reopening a closed report. Working
 *  on a report needs `incidents.reports.review` at its site and is never done
 *  on your own report; reopening needs `incidents.reports.signoff` there. An
 *  action's owner may also mark it done. Every write is audited and bumps the
 *  report's version, so closing never misses a change made meanwhile. */

const CHANGED = "This report changed while you were working. Refresh the page; your entries are kept.";

async function load(id: string) {
  const who = await requireIncidentsActor();
  const row = await prisma.incidentReport.findFirst({ where: { id, orgId: who.orgId ?? undefined } });
  const rights = row ? await reportRights(row, who) : null;
  return { who, row, rights };
}

async function guarded(run: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    const result = await run();
    if (result.ok) revalidatePath("/incidents", "layout");
    return result;
  } catch (error) {
    if (error instanceof IncidentError) return fail(error.message);
    throw error;
  }
}

export async function addStatement(id: string, input: StatementInput): Promise<ActionResult> {
  return guarded(async () => {
    const { who, row, rights } = await load(id);
    if (!row || !rights?.review) return fail("Only someone who triages reports at this site can take a statement.");
    const parsed = statementSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const problem = statementProblem(parsed.data, row.occurredOn);
    if (problem) return fail(problem);
    return prisma.$transaction(async (tx) => {
      await lockReport(tx, id);
      const now = await tx.incidentReport.findUniqueOrThrow({ where: { id } });
      investigable(now, who);
      await tx.incidentStatement.create({ data: { reportId: id, ...parsed.data, recordedById: who.id, recordedByName: who.name } });
      await touchReport(tx, id);
      await recordEvent(tx, now, who, "statement", parsed.data.givenBy);
      return ok();
    });
  });
}

export async function saveInvestigation(id: string, version: number, input: InvestigationInput): Promise<ActionResult> {
  return guarded(async () => {
    const { who, row, rights } = await load(id);
    if (!row || !rights?.review) return fail("Only someone who triages reports at this site can investigate it.");
    const parsed = investigationSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    investigable(row, who);
    return prisma.$transaction(async (tx) => {
      await lockReport(tx, id);
      const changed = await tx.incidentReport.updateMany({
        where: { id, version, status: "investigating" },
        data: { whys: cleanWhys(parsed.data.whys), rootCause: parsed.data.rootCause, version: { increment: 1 } },
      });
      if (!changed.count) return fail(CHANGED);
      await recordEvent(tx, row, who, "investigation");
      return ok();
    });
  });
}

export async function raiseAction(id: string, input: ActionInput): Promise<ActionResult> {
  let raised: string | null = null;
  const result = await guarded(async () => {
    const { who, row, rights } = await load(id);
    if (!row || !rights?.review) return fail("Only someone who triages reports at this site can raise an action.");
    const parsed = actionSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const problem = actionProblem(parsed.data);
    if (problem) return fail(problem);
    const owner = (await activeStaffAtSite(who.orgId, row.siteId)).find((p) => p.id === parsed.data.ownerId);
    if (!owner) return fail("Choose someone who works at this site.");
    return prisma.$transaction(async (tx) => {
      await lockReport(tx, id);
      const now = await tx.incidentReport.findUniqueOrThrow({ where: { id } });
      investigable(now, who);
      const action = await tx.incidentAction.create({
        data: { reportId: id, title: parsed.data.title, dueOn: parsed.data.dueOn, ownerId: owner.id, ownerName: owner.name, createdById: who.id, createdByName: who.name },
      });
      raised = action.id;
      await touchReport(tx, id);
      await recordEvent(tx, now, who, "action_add", `${parsed.data.title} (${owner.name})`);
      return ok();
    });
  });
  if (raised) await sendActionEmail(raised, "assigned", await requestOrigin());
  return result;
}

/** Done or cancelled, with what was done or why it was dropped. The owner may
 *  mark their own action done; cancelling is for the investigators. */
export async function finishAction(actionId: string, input: ActionOutcomeInput): Promise<ActionResult> {
  return guarded(async () => {
    const who = await requireIncidentsActor();
    const action = await prisma.incidentAction.findUnique({ where: { id: actionId }, include: { report: true } });
    if (!action || action.report.orgId !== (who.orgId ?? action.report.orgId)) return fail("This action is no longer available. Refresh the page.");
    const parsed = actionOutcomeSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const rights = await reportRights(action.report, who);
    const investigator = rights.review && !rights.own;
    const owner = action.ownerId === who.id && parsed.data.outcome === "done";
    if (!investigator && !owner) return fail(parsed.data.outcome === "done" ? "Only its owner or someone who triages reports at this site can mark it done." : "Only someone who triages reports at this site can cancel an action.");
    return prisma.$transaction(async (tx) => {
      await lockReport(tx, action.reportId);
      const changed = await tx.incidentAction.updateMany({
        where: { id: actionId, status: "open" },
        data: { status: parsed.data.outcome, note: parsed.data.note, doneById: who.id, doneByName: who.name, doneAt: new Date() },
      });
      if (!changed.count) return fail("This action has already been finished. Refresh the page.");
      const now = await touchReport(tx, action.reportId);
      await recordEvent(tx, now, who, parsed.data.outcome === "done" ? "action_done" : "action_cancel", `${action.title}: ${parsed.data.note}`);
      return ok();
    });
  });
}

export async function reopenReport(id: string, version: number, reason: string): Promise<ActionResult> {
  return guarded(async () => {
    const { who, row, rights } = await load(id);
    if (!row || !rights?.read) return fail("This report is no longer available. Refresh the page.");
    const parsed = reopenSchema.safeParse({ reason });
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const change = reopenDecision(row, { id: who.id, signoff: rights.signoff });
    return prisma.$transaction(async (tx) => {
      await lockReport(tx, id);
      const changed = await tx.incidentReport.updateMany({ where: { id, version }, data: { ...change, version: { increment: 1 } } });
      if (!changed.count) return fail(CHANGED);
      await recordEvent(tx, row, who, "reopen", parsed.data.reason);
      return ok();
    });
  });
}
