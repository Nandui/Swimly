import "server-only";
import { notFound } from "next/navigation";
import { hrDatabase } from "@/modules/hr/shared/database";
import { NOTE_COLUMNS, REVIEW_COLUMNS, type HrNote, type HrReview } from "@/modules/hr/shared/columns";

/** What HR has shared with the signed-in person, and nothing else: notes
 *  marked "shared with them" and reviews once shared. Drafts, private notes
 *  and notes kept on the record never appear. No capability is needed. */
export async function mySharedHr(userId: string, orgId: string) {
  const db = hrDatabase();
  const [notes, reviews] = await Promise.all([
    db.query<HrNote>(`SELECT ${NOTE_COLUMNS} FROM notes WHERE org_id=$1 AND subject_user_id=$2 AND visibility='subject' AND withdrawn_at IS NULL ORDER BY created_at DESC`, [orgId, userId]),
    db.query<HrReview>(`SELECT ${REVIEW_COLUMNS} FROM reviews WHERE org_id=$1 AND subject_user_id=$2 AND status <> 'draft' ORDER BY shared_at DESC`, [orgId, userId]),
  ]);
  return { notes, reviews };
}

export async function mySharedReview(id: string, userId: string, orgId: string) {
  const [review] = await hrDatabase().query<HrReview>(
    `SELECT ${REVIEW_COLUMNS} FROM reviews WHERE id=$1 AND org_id=$2 AND subject_user_id=$3 AND status <> 'draft'`, [id, orgId, userId]);
  if (!review) notFound();
  return review;
}

/** The person reading their own record is logged like every HR read. */
export async function logOwnHrRead(me: { id: string; name: string; orgId: string }) {
  await hrDatabase().query(
    `INSERT INTO access_events (org_id, actor_id, actor_name, subject_user_ids, entity, entity_id, purpose) VALUES ($1,$2,$3,$4,'HrRecord',$2,'own HR record (Turnfin Me)')`,
    [me.orgId, me.id, me.name, [me.id]],
  );
}
