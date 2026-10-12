"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import { requireIncidentsActor } from "@/modules/incidents/shared/access";
import { closeDecision, closeSchema, IncidentError, triageDecision, triageSchema, type CloseInput, type TriageInput } from "@/modules/incidents/shared/rules";
import { lockReport, recordEvent, reportRights } from "@/modules/incidents/shared/service";

/** Triage and closing (docs/incidents.md). Triage needs
 *  `incidents.reports.review` at the report's site; closing a serious or
 *  moderate report needs `incidents.reports.signoff` there. Nobody does either
 *  to their own report. Every write is audited. */

const CHANGED = "This report changed while you were working. Refresh the page; your entries are kept.";

async function load(id: string) {
  const who = await requireIncidentsActor();
  const row = await prisma.incidentReport.findFirst({ where: { id, orgId: who.orgId ?? undefined }, include: { people: { select: { ageGroup: true } } } });
  const rights = row ? await reportRights(row, who) : null;
  return { who, row, rights };
}

export async function triageReport(id: string, version: number, input: TriageInput): Promise<ActionResult> {
  const { who, row, rights } = await load(id);
  if (!row || !rights?.review) return fail("Only someone who triages reports at this site can triage it.");
  const parsed = triageSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  try {
    const change = triageDecision({ ...row, hasChild: row.people.some((p) => p.ageGroup === "child") }, who, parsed.data);
    const result = await prisma.$transaction(async (tx) => {
      await lockReport(tx, id);
      const changed = await tx.incidentReport.updateMany({
        where: { id, version },
        data: {
          ...change, triagedById: who.id, triagedByName: who.name, triagedAt: new Date(),
          ...(change.status === "closed" ? { closedById: who.id, closedByName: who.name, closedAt: new Date(), closeNote: parsed.data.note } : {}),
          version: { increment: 1 },
        },
      });
      if (!changed.count) return fail(CHANGED);
      const now = await tx.incidentReport.findUniqueOrThrow({ where: { id } });
      await recordEvent(tx, now, who, "triage", parsed.data.note);
      if (change.status === "closed") await recordEvent(tx, now, who, "close", "Closed at triage: low risk.");
      return ok();
    });
    if (result.ok) revalidatePath("/incidents", "layout");
    return result;
  } catch (error) {
    if (error instanceof IncidentError) return fail(error.message);
    throw error;
  }
}

export async function closeReport(id: string, version: number, input: CloseInput): Promise<ActionResult> {
  const { who, row, rights } = await load(id);
  if (!row || !rights?.review) return fail("Only someone who triages reports at this site can close it.");
  const parsed = closeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  try {
    // The sign-off that counts is at this report's site, not anywhere.
    const change = closeDecision(row, { ...who, signoff: rights.signoff }, parsed.data);
    const result = await prisma.$transaction(async (tx) => {
      await lockReport(tx, id);
      const changed = await tx.incidentReport.updateMany({
        where: { id, version },
        data: { ...change, closedById: who.id, closedByName: who.name, closedAt: new Date(), version: { increment: 1 } },
      });
      if (!changed.count) return fail(CHANGED);
      const now = await tx.incidentReport.findUniqueOrThrow({ where: { id } });
      await recordEvent(tx, now, who, "close", parsed.data.note);
      return ok();
    });
    if (result.ok) revalidatePath("/incidents", "layout");
    return result;
  } catch (error) {
    if (error instanceof IncidentError) return fail(error.message);
    throw error;
  }
}
