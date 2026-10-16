import "server-only";
import { logAudit } from "@/lib/audit";
import type { Tx } from "@/modules/training/shared/grant";
import { hoursInWords } from "@/modules/training/shared/on-the-job";

/** Records in-service hours for one person (phase 5), from the hours page or a
 *  session's register. Audited in the caller's transaction. */
export async function creditHours(tx: Tx, entry: { orgId: string; userId: string; personName: string; typeId: string | null; typeName: string | null; on: Date; minutes: number; topic: string; sessionId?: string | null }, actor: { id: string; name: string }) {
  const row = await tx.trainingHours.create({ data: {
    orgId: entry.orgId, userId: entry.userId, typeId: entry.typeId, on: entry.on, minutes: entry.minutes, topic: entry.topic, sessionId: entry.sessionId ?? null,
    recordedById: actor.id, recordedByName: actor.name,
  }, select: { id: true } });
  await logAudit({ actorId: actor.id, actorName: actor.name, action: "create", entity: "TrainingHours", entityId: row.id,
    summary: `Logged ${hoursInWords(entry.minutes)} of ${entry.typeName ? `${entry.typeName} ` : ""}in-service training for ${entry.personName}: ${entry.topic}` }, tx);
  return row.id;
}
