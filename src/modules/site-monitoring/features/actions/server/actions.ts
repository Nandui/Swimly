"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { siteName } from "@/lib/directory";
import { mayFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { requireMonitoringActor } from "@/modules/site-monitoring/shared/access";
import { readingLine } from "@/modules/site-monitoring/shared/rules";

/** Close an action by saying what was done, or open it again. Needs Site Monitoring: Act at its
 *  site; audited in the same transaction. */
export async function setMonitoringActionClosed(id: string, closed: boolean, note: string): Promise<ActionResult> {
  const who = await requireMonitoringActor();
  const text = note.trim();
  if (closed && (text.length < 3 || text.length > 1000)) return fail("Say what was done, so the record shows how it was put right.");
  const action = await prisma.monitoringAction.findFirst({ where: { id, orgId: who.orgId ?? undefined }, select: { siteId: true, title: true, reading: true, value: true, unit: true } });
  if (!action || !(await mayFor("site-monitoring.read", { siteId: action.siteId, orgId: who.orgId }))) return fail("That action no longer exists.");
  if (!(await mayFor("site-monitoring.act", { siteId: action.siteId, orgId: who.orgId }))) return fail("Closing actions needs Site Monitoring: Act at this site.");
  const site = await siteName(action.siteId);
  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.monitoringAction.updateMany({
      where: { id, status: closed ? "open" : "closed" },
      data: closed
        ? { status: "closed", closedAt: new Date(), closedById: who.id, closedByName: who.name, resolution: text }
        : { status: "open", closedAt: null, closedById: null, closedByName: null, resolution: "" },
    });
    if (moved.count !== 1) return fail(closed ? "It is already closed." : "It is already open.");
    await logAudit({ actorId: who.id, actorName: who.name, action: closed ? "resolve" : "reopen", entity: "MonitoringAction", entityId: id, clubId: action.siteId,
      summary: `${closed ? "Closed" : "Opened again"} at ${site}: ${action.title}, ${readingLine(action)}${closed ? `. ${text}` : ""}` }, tx);
    return ok();
  });
  if (result.ok) revalidatePath("/site-monitoring");
  return result;
}
