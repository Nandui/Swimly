import "server-only";
import { notFound } from "next/navigation";
import { staffByIds } from "@/lib/directory";
import { hrDatabase } from "@/modules/hr/shared/database";
import { requireHrActor } from "@/modules/hr/shared/access";

/** Entries per page in each activity list. */
export const HR_ACTIVITY_PAGE_SIZE = 20;

/** Superadmins only: who has read HR records, and every HR change, a page at a time. */
export async function hrActivity(page = 1) {
  const who = await requireHrActor();
  if (!who.superadmin) notFound();
  const db = hrDatabase();
  const offset = (Math.max(1, Math.floor(page)) - 1) * HR_ACTIVITY_PAGE_SIZE;
  const [reads, changes, [readCount], [changeCount]] = await Promise.all([
    db.query<{ id: string; actorId: string; actorName: string; subjectUserIds: string[]; entity: string; purpose: string; at: Date }>(
      `SELECT id::text, actor_id AS "actorId", actor_name AS "actorName", subject_user_ids AS "subjectUserIds", entity, purpose, at FROM access_events WHERE org_id=$1 ORDER BY at DESC LIMIT $2 OFFSET $3`,
      [who.orgId, HR_ACTIVITY_PAGE_SIZE, offset]),
    db.query<{ id: string; actorName: string; summary: string; at: Date }>(
      `SELECT id::text, actor_name AS "actorName", summary, at FROM audit_events WHERE org_id=$1 ORDER BY at DESC LIMIT $2 OFFSET $3`,
      [who.orgId, HR_ACTIVITY_PAGE_SIZE, offset]),
    db.query<{ n: number }>(`SELECT count(*)::int AS n FROM access_events WHERE org_id=$1`, [who.orgId]),
    db.query<{ n: number }>(`SELECT count(*)::int AS n FROM audit_events WHERE org_id=$1`, [who.orgId]),
  ]);
  const ids = [...new Set(reads.flatMap((r) => r.subjectUserIds))];
  const names = new Map([...(await staffByIds(ids)).values()].map((u) => [u.id, u.name]));
  return {
    reads: reads.map((r) => ({ ...r, subjects: r.subjectUserIds.map((id) => names.get(id) ?? "Former staff") })),
    changes,
    readsTotal: Number(readCount?.n ?? 0),
    changesTotal: Number(changeCount?.n ?? 0),
  };
}
