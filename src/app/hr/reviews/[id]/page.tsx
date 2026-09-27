import type { Metadata } from "next";
import { Card } from "@/components/shadcn/card";
import { BackLink } from "@/components/ui-kit/back-link";
import { PageHeader } from "@/components/ui-kit/page-header";
import { ReviewEditor } from "@/components/hr/actions";
import { ReviewStatusTag } from "@/components/hr/status";
import { formatDate } from "@/lib/format";
import { REVIEW_OVERALL_LABELS } from "@/lib/hr/constants";
import { hrReview } from "@/lib/hr/records";
import { requireFreshSession } from "@/lib/policy/session";

export const metadata: Metadata = { title: "Review" };

export default async function HrReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireFreshSession("hr.records.read", `/hr/reviews/${id}`);
  const { person, review, editable } = await hrReview(id);
  const sections = [["Summary", review.summary], ["Strengths", review.strengths], ["Goals for the next period", review.goals]] as const;
  return (
    <div className="min-w-0 flex flex-col gap-6">
      <BackLink href={`/hr/people/${person.id}`} current={review.period}>{person.name}</BackLink>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{review.period}<ReviewStatusTag status={review.status} /></span>}
        description={`For ${person.name} · by ${review.reviewerName}${review.sharedAt ? ` · shared ${formatDate(new Date(review.sharedAt))}` : ""}`}
      />
      {editable ? (
        <ReviewEditor review={review} name={person.name} />
      ) : (
        <Card className="gap-4 p-5 shadow-none" aria-labelledby="review-body">
          <h2 id="review-body" className="text-lg font-semibold">Review</h2>
          {sections.map(([label, text]) => (
            <div key={label} className="space-y-1"><h3 className="font-medium">{label}</h3><p className="whitespace-pre-wrap break-words">{text || "Not written."}</p></div>
          ))}
          {review.overall ? <div className="space-y-1"><h3 className="font-medium">Overall</h3><p>{REVIEW_OVERALL_LABELS[review.overall]}</p></div> : null}
          {review.status === "acknowledged" ? (
            <div className="space-y-1"><h3 className="font-medium">{person.name.split(" ")[0]}&apos;s comment</h3><p className="whitespace-pre-wrap break-words">{review.subjectComment || "No comment."}</p>
              <p className="text-xs text-ui-muted-foreground">Acknowledged {review.acknowledgedAt ? formatDate(new Date(review.acknowledgedAt)) : ""}</p></div>
          ) : null}
        </Card>
      )}
    </div>
  );
}
