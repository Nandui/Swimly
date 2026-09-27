import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hrDatabase, type HrSql } from "@/lib/hr/database";
import { requireHrActor, type HrActor } from "@/lib/hr/access";
import type { ReviewStatus } from "@/lib/hr/constants";
import { NOTE_COLUMNS, REVIEW_COLUMNS, type HrNote, type HrReview } from "@/lib/hr/columns";
export type { HrNote, HrReview } from "@/lib/hr/columns";
import { mayFor, requireCapFor, subjectsFor } from "@/lib/policy/session";

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

/** Everyone whose HR record the reader covers, with their latest review. */
export async function hrPeople(query = "") {
  const who = await requireHrActor();
  const scope = await subjectsFor("hr.records.read");
  const q = query.trim().slice(0, 80);
  const people = await prisma.user.findMany({
    where: {
      orgId: who.orgId || undefined, isActive: true,
      ...(scope.kind === "all" ? {} : { id: { in: [...scope.userIds] } }),
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { name: "asc" }, take: 200,
    select: { id: true, name: true, jobTitle: true },
  });
  const ids = people.map((p) => p.id);
  const db = hrDatabase();
  const latest = ids.length === 0 ? [] : await db.query<{ subjectUserId: string; status: ReviewStatus; period: string }>(
    `SELECT DISTINCT ON (subject_user_id) subject_user_id AS "subjectUserId", status, period FROM reviews
      WHERE org_id=$1 AND subject_user_id = ANY($2) AND (status <> 'draft' OR reviewer_id=$3 OR $4)
      ORDER BY subject_user_id, created_at DESC`,
    [who.orgId, ids, who.id, who.superadmin],
  );
  await logHrAccess(db, who, ids, "HrPeople", null, "HR people list");
  const byId = new Map(latest.map((r) => [r.subjectUserId, r]));
  return { who, people: people.map((p) => ({ ...p, latestReview: byId.get(p.id) ?? null })) };
}

async function coveredPerson(who: HrActor, userId: string) {
  const person = await prisma.user.findFirst({ where: { id: userId, orgId: who.orgId || undefined }, select: { id: true, name: true, jobTitle: true } });
  if (!person) notFound();
  await requireCapFor("hr.records.read", { subjectUserId: userId, orgId: who.orgId });
  return person;
}

/** One person's HR record: visible notes and reviews, and what the reader may add. */
export async function hrPerson(userId: string) {
  const who = await requireHrActor();
  const person = await coveredPerson(who, userId);
  const db = hrDatabase();
  const [notes, reviews] = await Promise.all([
    db.query<HrNote>(`SELECT ${NOTE_COLUMNS} FROM notes WHERE org_id=$1 AND subject_user_id=$2 AND withdrawn_at IS NULL
      AND (visibility <> 'private' OR author_id=$3 OR $4) ORDER BY created_at DESC`, [who.orgId, userId, who.id, who.superadmin]),
    db.query<HrReview>(`SELECT ${REVIEW_COLUMNS} FROM reviews WHERE org_id=$1 AND subject_user_id=$2
      AND (status <> 'draft' OR reviewer_id=$3 OR $4) ORDER BY created_at DESC`, [who.orgId, userId, who.id, who.superadmin]),
  ]);
  await logHrAccess(db, who, [userId], "HrRecord", userId, "HR record");
  const self = userId === who.id;
  return {
    who, person, notes, reviews,
    // Nobody writes their own HR record.
    canWriteNotes: !self && await mayFor("hr.notes.write", { subjectUserId: userId, orgId: who.orgId }),
    canWriteReviews: !self && await mayFor("hr.reviews.write", { subjectUserId: userId, orgId: who.orgId }),
  };
}

export async function hrReview(id: string) {
  const who = await requireHrActor();
  const db = hrDatabase();
  const [review] = await db.query<HrReview>(`SELECT ${REVIEW_COLUMNS} FROM reviews WHERE id=$1 AND org_id=$2`, [id, who.orgId]);
  if (!review) notFound();
  if (review.status === "draft" && review.reviewerId !== who.id && !who.superadmin) notFound();
  const person = await coveredPerson(who, review.subjectUserId);
  await logHrAccess(db, who, [review.subjectUserId], "HrReview", id, "performance review");
  const editable = review.status === "draft" && (review.reviewerId === who.id || who.superadmin)
    && await mayFor("hr.reviews.write", { subjectUserId: review.subjectUserId, orgId: who.orgId });
  return { who, person, review, editable };
}

/** Superadmins only: who has read HR records, and every HR change. */
export async function hrActivity() {
  const who = await requireHrActor();
  if (!who.superadmin) notFound();
  const db = hrDatabase();
  const [reads, changes] = await Promise.all([
    db.query<{ id: string; actorName: string; subjectUserIds: string[]; purpose: string; at: Date }>(
      `SELECT id::text, actor_name AS "actorName", subject_user_ids AS "subjectUserIds", purpose, at FROM access_events WHERE org_id=$1 ORDER BY at DESC LIMIT 100`, [who.orgId]),
    db.query<{ id: string; actorName: string; summary: string; at: Date }>(
      `SELECT id::text, actor_name AS "actorName", summary, at FROM audit_events WHERE org_id=$1 ORDER BY at DESC LIMIT 100`, [who.orgId]),
  ]);
  const ids = [...new Set(reads.flatMap((r) => r.subjectUserIds))];
  const names = new Map((await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  return {
    reads: reads.map((r) => ({ ...r, subjects: r.subjectUserIds.map((id) => names.get(id) ?? "Former staff") })),
    changes,
  };
}
