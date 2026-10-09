import type { Metadata } from "next";
import { hrReview, REVIEW_OVERALL_LABELS, REVIEW_STATUS_META, ReviewEditor } from "@/modules/hr/features/reviews";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate } from "@/lib/format";
import { requireFreshSession } from "@/lib/policy/session";

export const metadata: Metadata = { title: "Review" };

export default async function HrReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireFreshSession("hr.records.read", `/hr/reviews/${id}`);
  const { who, person, review, editable } = await hrReview(id);
  const sections = [["Summary", review.summary], ["Strengths", review.strengths], ["Goals for the next period", review.goals]] as const;
  return (
    <>
      <PageHeader
        back={{ href: `/hr/people/${person.id}`, label: person.name }}
        title={review.period}
        description={`For ${person.name} · by ${review.reviewerName}${review.sharedAt ? ` · shared ${formatDate(new Date(review.sharedAt))}` : ` · started ${formatDate(new Date(review.createdAt))}`}`}
        status={<Tag meta={REVIEW_STATUS_META[review.status]} />}
      />
      {editable ? (
        <ReviewEditor review={review} name={person.name} isReviewer={review.reviewerId === who.id} />
      ) : (
        <section className="pc-panel" aria-labelledby="review-body">
          <div className="pc-panel-head"><h2 id="review-body">Review</h2></div>
          {sections.map(([label, text]) => (
            <div key={label} className="space-y-1"><h3 className="font-semibold">{label}</h3><p className="whitespace-pre-wrap break-words">{text || "Not written."}</p></div>
          ))}
          {review.overall ? <div className="space-y-1"><h3 className="font-semibold">Overall</h3><p>{REVIEW_OVERALL_LABELS[review.overall]}</p></div> : null}
          {review.status === "acknowledged" ? (
            <div className="space-y-1"><h3 className="font-semibold">{person.name.split(" ")[0]}&apos;s comment</h3><p className="whitespace-pre-wrap break-words">{review.subjectComment || "No comment."}</p>
              <p className="text-xs text-ui-muted-foreground">Acknowledged {review.acknowledgedAt ? formatDate(new Date(review.acknowledgedAt)) : ""}</p></div>
          ) : null}
        </section>
      )}
    </>
  );
}
