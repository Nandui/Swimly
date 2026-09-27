import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/shadcn/button";
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
    <div className="space-y-6">
      <Button asChild variant="ghost" className="-ml-3 min-h-11"><Link href={`/hr/people/${person.id}`}><ArrowLeft aria-hidden="true" />{person.name}</Link></Button>
      <div className="module-heading">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3"><h1>{review.period}</h1><ReviewStatusTag status={review.status} /></div>
          <p className="text-sm">For {person.name} · by {review.reviewerName}{review.sharedAt ? ` · shared ${formatDate(new Date(review.sharedAt))}` : ""}</p>
        </div>
      </div>
      {editable ? (
        <ReviewEditor review={review} name={person.name} />
      ) : (
        <section className="module-panel space-y-4" aria-labelledby="review-body">
          <h2 id="review-body">Review</h2>
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
    </div>
  );
}
