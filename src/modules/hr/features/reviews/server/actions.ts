"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireSession } from "@/lib/authz";
import { hrDatabase } from "@/modules/hr/shared/database";
import { REVIEW_OVERALL_LABELS } from "@/modules/hr/shared/constants";
import { allowedFor, audit, refresh } from "@/modules/hr/shared/writes";

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
