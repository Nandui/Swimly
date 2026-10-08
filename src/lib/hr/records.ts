import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hrDatabase, type HrSql } from "@/lib/hr/database";
import { requireHrActor, type HrActor } from "@/lib/hr/access";
import type { ReviewStatus } from "@/lib/hr/constants";
import { NOTE_COLUMNS, REVIEW_COLUMNS, type HrNote, type HrReview } from "@/lib/hr/columns";
export type { HrNote, HrReview } from "@/lib/hr/columns";
import { mayFor, requireCapFor, subjectsFor } from "@/lib/policy/session";
import { personFile } from "@/modules/server";

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

/** Their details as HR keeps them (owner decision, 8 October 2026: staff
 *  details are HR's, not Admin's): position, manager, departments, employment
 *  and contact. Callers have checked `hr.records.read` over the person. */
async function personDetails(userId: string) {
  const row = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      jobTitle: true, positionId: true, startedOn: true, dateOfBirth: true, primaryClubId: true, managerId: true,
      contractType: true, contractMinutes: true, endedOn: true, payrollNumber: true,
      phone: true, homeAddress: true, emergencyName: true, emergencyPhone: true, emergencyRelationship: true,
      position: { select: { name: true, archivedAt: true } },
      manager: { select: { id: true, name: true } },
      departments: { select: { departmentId: true, isPrimary: true, department: { select: { name: true } } } },
      reports: { where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } },
    },
  });
  const site = row.primaryClubId ? await prisma.club.findUnique({ where: { id: row.primaryClubId }, select: { name: true } }) : null;
  return {
    ...row,
    primaryClub: row.primaryClubId ? site?.name ?? "Removed site" : null,
    startedOn: row.startedOn?.toISOString().slice(0, 10) ?? "",
    dateOfBirth: row.dateOfBirth?.toISOString().slice(0, 10) ?? "",
    endedOn: row.endedOn?.toISOString().slice(0, 10) ?? "",
  };
}

/** What the details editor chooses from: open sites, departments and positions, and the people who can manage. */
async function detailOptions(orgId: string, positionId: string | null) {
  const [sites, departments, positions, people] = await Promise.all([
    prisma.club.findMany({ where: { orgId, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.department.findMany({ where: { orgId, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    // An archived position stays only for whoever already holds it.
    prisma.position.findMany({ where: { orgId, OR: [{ archivedAt: null }, { id: positionId ?? "" }] }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.user.findMany({ where: { orgId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, jobTitle: true } }),
  ]);
  return { sites, departments, positions, people };
}

/** One person's HR record: their details, visible notes and reviews, what
 *  other modules keep on their personal file (rota, training, absences), and
 *  what the reader may add or change. The one logged read covers all of it. */
export async function hrPerson(userId: string) {
  const who = await requireHrActor();
  const person = await coveredPerson(who, userId);
  const db = hrDatabase();
  const self = userId === who.id;
  // Nobody keeps their own details: they send changes from Turnfin Me.
  const canWriteDetails = !self && await mayFor("hr.details.write", { subjectUserId: userId, orgId: who.orgId });
  const details = await personDetails(userId);
  const [notes, reviews, file, options] = await Promise.all([
    db.query<HrNote>(`SELECT ${NOTE_COLUMNS} FROM notes WHERE org_id=$1 AND subject_user_id=$2 AND withdrawn_at IS NULL
      AND (visibility <> 'private' OR author_id=$3 OR $4) ORDER BY created_at DESC`, [who.orgId, userId, who.id, who.superadmin]),
    db.query<HrReview>(`SELECT ${REVIEW_COLUMNS} FROM reviews WHERE org_id=$1 AND subject_user_id=$2
      AND (status <> 'draft' OR reviewer_id=$3 OR $4) ORDER BY created_at DESC`, [who.orgId, userId, who.id, who.superadmin]),
    personFile(userId, who.orgId),
    canWriteDetails ? detailOptions(who.orgId, details.positionId) : null,
  ]);
  await logHrAccess(db, who, [userId], "HrRecord", userId, "HR record");
  return {
    who, person, details, notes, reviews, file, options, canWriteDetails,
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
  const names = new Map((await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  return {
    reads: reads.map((r) => ({ ...r, subjects: r.subjectUserIds.map((id) => names.get(id) ?? "Former staff") })),
    changes,
    readsTotal: Number(readCount?.n ?? 0),
    changesTotal: Number(changeCount?.n ?? 0),
  };
}
