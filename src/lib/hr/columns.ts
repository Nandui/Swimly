import type { NoteVisibility, ReviewOverall, ReviewStatus } from "@/lib/hr/constants";

/** HR row shapes and the SELECT lists that produce them (snake_case columns
 *  aliased to camelCase), shared by the workspace and self-service reads. */
export type HrNote = { id: string; subjectUserId: string; authorId: string; authorName: string; visibility: NoteVisibility; body: string; createdAt: Date };
export type HrReview = {
  id: string; subjectUserId: string; reviewerId: string; reviewerName: string; period: string; status: ReviewStatus;
  summary: string; strengths: string; goals: string; overall: ReviewOverall | null; subjectComment: string;
  sharedAt: Date | null; acknowledgedAt: Date | null; createdAt: Date; updatedAt: Date;
};

export const NOTE_COLUMNS = `id, subject_user_id AS "subjectUserId", author_id AS "authorId", author_name AS "authorName", visibility, body, created_at AS "createdAt"`;
export const REVIEW_COLUMNS = `id, subject_user_id AS "subjectUserId", reviewer_id AS "reviewerId", reviewer_name AS "reviewerName", period, status,
  summary, strengths, goals, overall, subject_comment AS "subjectComment", shared_at AS "sharedAt", acknowledged_at AS "acknowledgedAt",
  created_at AS "createdAt", updated_at AS "updatedAt"`;
