"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { AuthorizationError, requireSession } from "@/lib/authz";
import { hrDatabase, type HrSql } from "@/lib/hr/database";
import { prisma } from "@/lib/prisma";
import { NOTE_VISIBILITIES, REVIEW_OVERALL_LABELS, type NoteVisibility } from "@/lib/hr/constants";
import { recentlyConfirmed } from "@/lib/policy/engine";
import { actorForSession, requireCapFor } from "@/lib/policy/session";
import type { PermissionKey } from "@/lib/staff/permissions";
import type { Actor } from "@/lib/policy/types";

/** HR writes. Each needs the restricted capability for that person (which also
 *  needs a recent password), and nobody writes their own record. Every change
 *  writes an HR audit event in the same transaction. The person acknowledges
 *  their own shared review; nobody else can. */

type Allowed = { ok: true; actor: Actor } | { ok: false; error: string };
async function allowedFor(cap: PermissionKey, subjectUserId: string): Promise<Allowed> {
  const subject = await prisma.user.findUnique({ where: { id: subjectUserId }, select: { orgId: true } });
  if (!subject) return { ok: false, error: "That person no longer exists." };
  try {
    // The subject's organisation, so an everywhere grant never reaches another org.
    const actor = await requireCapFor(cap, { subjectUserId, orgId: subject.orgId });
    if (actor.id === subjectUserId) return { ok: false, error: "Nobody writes their own HR record." };
    return { ok: true, actor };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message };
    throw error;
  }
}

async function audit(tx: HrSql, actor: Pick<Actor, "id" | "name" | "orgId">, action: string, entity: string, entityId: string, subjectUserId: string, summary: string) {
  await tx.query(`INSERT INTO audit_events (org_id, actor_id, actor_name, action, entity, entity_id, subject_user_id, summary) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [actor.orgId ?? "", actor.id, actor.name, action, entity, entityId, subjectUserId, summary]);
}
const refresh = (subjectUserId: string, reviewId?: string) => {
  revalidatePath(`/hr/people/${subjectUserId}`);
  if (reviewId) revalidatePath(`/hr/reviews/${reviewId}`);
  revalidatePath("/me/hr");
  revalidatePath("/me");
};

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export async function addNote(subjectUserId: string, body: string, visibility: string): Promise<ActionResult> {
  const text = String(body ?? "").trim();
  if (text.length < 3 || text.length > 5000) return fail("Write the note (up to 5,000 characters).");
  if (!NOTE_VISIBILITIES.includes(visibility as NoteVisibility)) return fail("Choose who can read it.");
  const allowed = await allowedFor("hr.notes.write", subjectUserId);
  if (!allowed.ok) return fail(allowed.error);
  const { actor } = allowed;
  const id = randomUUID();
  await hrDatabase().transaction(async (tx) => {
    await tx.query(`INSERT INTO notes (id, org_id, subject_user_id, author_id, author_name, visibility, body) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, actor.orgId ?? "", subjectUserId, actor.id, actor.name, visibility, text]);
    await audit(tx, actor, "create", "HrNote", id, subjectUserId, `Added a ${visibility} note`);
  });
  refresh(subjectUserId);
  return ok();
}

export async function withdrawNote(id: string, reason: string): Promise<ActionResult> {
  const why = String(reason ?? "").trim().slice(0, 300);
  if (why.length < 3) return fail("Say briefly why it is withdrawn.");
  const session = await requireSession();
  const orgId = session.user.orgId ?? "";
  const [note] = await hrDatabase().query<{ subjectUserId: string; authorId: string }>(
    `SELECT subject_user_id AS "subjectUserId", author_id AS "authorId" FROM notes WHERE id=$1 AND org_id=$2 AND withdrawn_at IS NULL`, [id, orgId]);
  if (!note) return fail("That note no longer exists.");
  const allowed = await allowedFor("hr.notes.write", note.subjectUserId);
  if (!allowed.ok) return fail(allowed.error);
  const { actor } = allowed;
  if (note.authorId !== actor.id && !actor.superadmin) return fail("Only the author can withdraw a note.");
  await hrDatabase().transaction(async (tx) => {
    await tx.query(`UPDATE notes SET withdrawn_at=now(), withdrawn_reason=$2 WHERE id=$1 AND withdrawn_at IS NULL`, [id, why]);
    await audit(tx, actor, "withdraw", "HrNote", id, note.subjectUserId, `Withdrew a note: ${why}`);
  });
  refresh(note.subjectUserId);
  return ok();
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

const reviewSchema = z.object({
  period: z.string().trim().min(2, "Name the review period, for example 2026 annual review.").max(80),
  summary: z.string().trim().max(5000),
  strengths: z.string().trim().max(5000),
  goals: z.string().trim().max(5000),
  overall: z.union([z.enum(Object.keys(REVIEW_OVERALL_LABELS) as [keyof typeof REVIEW_OVERALL_LABELS]), z.literal("")]).transform((v) => v || null),
});
export type ReviewInput = z.input<typeof reviewSchema>;

async function draftReview(id: string, orgId: string) {
  const [row] = await hrDatabase().query<{ subjectUserId: string; reviewerId: string; status: string; summary: string; period: string }>(
    `SELECT subject_user_id AS "subjectUserId", reviewer_id AS "reviewerId", status, summary, period FROM reviews WHERE id=$1 AND org_id=$2`, [id, orgId]);
  return row;
}

/** Creates a draft, or edits your own draft. Returns the review id. */
export async function saveReview(id: string | null, subjectUserId: string, input: ReviewInput): Promise<ActionResult & { id?: string }> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const allowed = await allowedFor("hr.reviews.write", subjectUserId);
  if (!allowed.ok) return fail(allowed.error);
  const { actor } = allowed;
  const data = parsed.data, orgId = actor.orgId ?? "";
  if (id) {
    const row = await draftReview(id, orgId);
    if (!row || row.subjectUserId !== subjectUserId) return fail("That review no longer exists.");
    if (row.status !== "draft") return fail("A shared review can no longer be changed.");
    if (row.reviewerId !== actor.id && !actor.superadmin) return fail("Only the reviewer can change a draft.");
  }
  const reviewId = id ?? randomUUID();
  await hrDatabase().transaction(async (tx) => {
    if (id) {
      await tx.query(`UPDATE reviews SET period=$2, summary=$3, strengths=$4, goals=$5, overall=$6, updated_at=now() WHERE id=$1 AND status='draft'`,
        [id, data.period, data.summary, data.strengths, data.goals, data.overall]);
      await audit(tx, actor, "update", "HrReview", id, subjectUserId, `Edited the draft review ${data.period}`);
    } else {
      await tx.query(`INSERT INTO reviews (id, org_id, subject_user_id, reviewer_id, reviewer_name, period, summary, strengths, goals, overall) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [reviewId, orgId, subjectUserId, actor.id, actor.name, data.period, data.summary, data.strengths, data.goals, data.overall]);
      await audit(tx, actor, "create", "HrReview", reviewId, subjectUserId, `Started the review ${data.period}`);
    }
  });
  refresh(subjectUserId, reviewId);
  return { ...ok(), id: reviewId };
}

export async function shareReview(id: string): Promise<ActionResult> {
  const session = await requireSession();
  const row = await draftReview(id, session.user.orgId ?? "");
  if (!row) return fail("That review no longer exists.");
  const allowed = await allowedFor("hr.reviews.write", row.subjectUserId);
  if (!allowed.ok) return fail(allowed.error);
  const { actor } = allowed;
  if (row.reviewerId !== actor.id && !actor.superadmin) return fail("Only the reviewer can share it.");
  if (row.summary.trim().length < 3) return fail("Write a summary before sharing.");
  const moved = await hrDatabase().transaction(async (tx) => {
    const updated = await tx.query(`UPDATE reviews SET status='shared', shared_at=now(), updated_at=now() WHERE id=$1 AND status='draft' RETURNING id`, [id]);
    if (updated.length !== 1) return false;
    await audit(tx, actor, "share", "HrReview", id, row.subjectUserId, `Shared the review ${row.period} with them`);
    return true;
  });
  if (!moved) return fail("That review has already been shared.");
  refresh(row.subjectUserId, id);
  return ok();
}

/** The person acknowledges their own shared review, with an optional comment.
 *  Needs a recent password: it is their HR record. */
export async function acknowledgeReview(id: string, comment: string): Promise<ActionResult> {
  const session = await requireSession();
  const me = actorForSession(session);
  if (!recentlyConfirmed(me)) return fail("Confirm your password to open this.");
  const text = String(comment ?? "").trim().slice(0, 2000);
  const moved = await hrDatabase().transaction(async (tx) => {
    const updated = await tx.query<{ period: string }>(`UPDATE reviews SET status='acknowledged', acknowledged_at=now(), subject_comment=$3, updated_at=now()
      WHERE id=$1 AND subject_user_id=$2 AND status='shared' RETURNING period`, [id, me.id, text]);
    if (updated.length !== 1) return false;
    await audit(tx, me, "acknowledge", "HrReview", id, me.id, `Acknowledged the review ${updated[0].period}`);
    return true;
  });
  if (!moved) return fail("That review is not waiting for your acknowledgement.");
  refresh(me.id, id);
  return ok();
}
