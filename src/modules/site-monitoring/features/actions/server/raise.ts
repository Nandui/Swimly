import "server-only";
import { logAudit } from "@/lib/audit";
import { siteName } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import type { PlatformEvents } from "@/platform/events";
import { readingLine, taskSourceKey } from "@/modules/site-monitoring/shared/rules";

/** Raise an action for the site's managers from each reading out of range on a completed task
 *  (`tasks.reading.out_of_range`, registered in module.ts). The same reading announced again
 *  raises nothing new, so a retry is harmless. Audited as raised for whoever recorded it. */
export async function raiseFromTaskReadings(event: PlatformEvents["tasks.reading.out_of_range"]): Promise<number> {
  const site = await siteName(event.siteId);
  const recordedAt = new Date(event.recordedAt);
  let raised = 0;
  for (const r of event.readings) {
    const sourceKey = taskSourceKey(event.taskId, r.key, r.value);
    await prisma.$transaction(async (tx) => {
      if (await tx.monitoringAction.findUnique({ where: { sourceKey }, select: { id: true } })) return;
      const a = await tx.monitoringAction.create({
        data: {
          orgId: event.orgId, siteId: event.siteId, source: "tasks", sourceKey, sourceHref: `/tasks/${event.taskId}`, title: event.task,
          reading: r.reading, value: r.value, unit: r.unit, allowed: r.allowed, guidance: r.guidance,
          recordedById: event.recordedById, recordedByName: event.recordedByName, recordedAt,
        },
        select: { id: true },
      });
      await logAudit({ actorId: event.recordedById, actorName: event.recordedByName, action: "create", entity: "MonitoringAction", entityId: a.id, clubId: event.siteId,
        summary: `Raised automatically at ${site}: ${event.task}, ${readingLine(r)} (allowed ${r.allowed})` }, tx);
      raised++;
    });
  }
  return raised;
}
