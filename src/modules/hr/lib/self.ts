import "server-only";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { hrDatabase } from "@/modules/hr/lib/database";

/** A person's own HR writes, for the staff API (Turnfin Me) only. The caller
 *  has already proved who `me` is and that they confirmed recently. */
export async function acknowledgeReviewFor(me: { id: string; name: string; orgId: string }, id: string, comment: string): Promise<ActionResult> {
  const text = String(comment ?? "").trim().slice(0, 2000);
  const moved = await hrDatabase().transaction(async (tx) => {
    const updated = await tx.query<{ period: string }>(`UPDATE reviews SET status='acknowledged', acknowledged_at=now(), subject_comment=$3, updated_at=now()
      WHERE id=$1 AND subject_user_id=$2 AND org_id=$4 AND status='shared' RETURNING period`, [id, me.id, text, me.orgId]);
    if (updated.length !== 1) return false;
    await tx.query(`INSERT INTO audit_events (org_id, actor_id, actor_name, action, entity, entity_id, subject_user_id, summary) VALUES ($1,$2,$3,'acknowledge','HrReview',$4,$2,$5)`,
      [me.orgId, me.id, me.name, id, `Acknowledged the review ${updated[0].period}`]);
    return true;
  });
  return moved ? ok() : fail("That review is not waiting for your acknowledgement.");
}
