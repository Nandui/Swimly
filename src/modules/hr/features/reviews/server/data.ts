import "server-only";
import { notFound } from "next/navigation";
import { hrDatabase } from "@/modules/hr/shared/database";
import { requireHrActor } from "@/modules/hr/shared/access";
import { REVIEW_COLUMNS, type HrReview } from "@/modules/hr/shared/columns";
import { mayFor } from "@/lib/policy/session";
import { coveredPerson, logHrAccess } from "@/modules/hr/shared/records";

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
