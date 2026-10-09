import "server-only";
import { notFound } from "next/navigation";
import { staffMember } from "@/lib/people/records";
import { type HrSql } from "@/modules/hr/shared/database";
import { type HrActor } from "@/modules/hr/shared/access";
import { requireCapFor } from "@/lib/policy/session";

export type { HrNote, HrReview } from "@/modules/hr/shared/columns";

/** HR reads for the workspace. Each resolves who the reader covers through the
 *  policy engine (restricted, so a stale or PIN session is refused), filters
 *  the HR database by those ids, and records the read in `access_events`.
 *  Private notes reach only their author and superadmins; draft reviews only
 *  their reviewer and superadmins. */

export async function logHrAccess(db: HrSql, who: Pick<HrActor, "id" | "name" | "orgId">, subjectUserIds: readonly string[], entity: string, entityId: string | null, purpose: string) {
  if (subjectUserIds.length === 0) return;
  await db.query(
    `INSERT INTO access_events (org_id, actor_id, actor_name, subject_user_ids, entity, entity_id, purpose) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [who.orgId, who.id, who.name, [...subjectUserIds].slice(0, 500), entity, entityId, purpose],
  );
}

export async function coveredPerson(who: HrActor, userId: string) {
  const person = await staffMember(userId, who.orgId || null);
  if (!person) notFound();
  await requireCapFor("hr.records.read", { subjectUserId: userId, orgId: who.orgId });
  return person;
}
