import Link from "next/link";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { RecordSection } from "@/components/ui-kit/record";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate, formatDateTime, parseDateOnly, today } from "@/lib/format";
import { AnswerRequest, AskForReview, LogReview } from "@/modules/risk/features/reviews/components/review-tools";
import type { RiskAssessmentData } from "@/modules/risk/shared/load";
import { OUTCOME_LABEL, RISK_REQUEST_META } from "@/modules/risk/shared/types";

const day = (iso: string) => formatDate(parseDateOnly(iso));

/** Log a review, as the assessment's next action, while its review is overdue or due soon and
 *  this person may log it; nothing otherwise. */
export function ReviewNow({ data }: { data: RiskAssessmentData }) {
  const due = data.review.state === "overdue" || data.review.state === "due";
  return data.can.review && due ? <LogReview id={data.assessment.id} version={data.assessment.version} today={today()} prominent /> : null;
}

/** An assessment's reviews: the requests for another look, with their answers, and the log of
 *  reviews carried out. Readers ask; writers answer and log. */
export function ReviewsSection({ data }: { data: RiskAssessmentData }) {
  const { assessment: a, requests, reviews, can } = data;
  const open = requests.filter((r) => r.status === "open");
  return (
    <>
      {requests.length || can.request ? (
        <RecordSection id="risk-requests-h" title="Review requests" aside={<>{open.length ? <p>{`${open.length} to answer`}</p> : null}{can.request ? <AskForReview id={a.id} hazards={data.hazards.map((h) => ({ id: h.id, label: `${h.reference} · ${h.hazard}` }))} /> : null}</>}>
          {requests.length === 0 ? (
            <div className="pc-list"><EmptyState compact icon="clipboardCheck" title="Nobody has asked for a review" hint="Seen something that has changed? Ask for another look." /></div>
          ) : (
            <ul className="flex min-w-0 flex-col gap-3">
              {requests.map((r) => (
                <li key={r.id} className="rec-card break-inside-avoid">
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                    <p className="rec-muted rec-small">{`${r.requestedByName} · ${formatDateTime(new Date(r.createdAt))}${r.hazardLabel ? ` · about ${r.hazardLabel}` : ""}`}</p>
                    <Tag meta={RISK_REQUEST_META[r.status]} />
                  </div>
                  <p className="break-words whitespace-pre-line">{r.notes}</p>
                  {r.sourceIncidentId ? <p className="rec-muted rec-small">Raised from incident <Link href={`/incidents/${r.sourceIncidentId}`} className="underline-offset-4 hover:underline">{r.sourceIncidentRef || "report"}</Link></p> : null}
                  {r.status !== "open" ? <p className="rec-muted rec-small">{`${RISK_REQUEST_META[r.status].label} by ${r.resolvedByName ?? "someone"}${r.resolvedAt ? `, ${formatDateTime(new Date(r.resolvedAt))}` : ""}${r.resolutionNote ? `: ${r.resolutionNote}` : ""}`}</p> : null}
                  {r.status === "open" && can.answer ? <AnswerRequest requestId={r.id} /> : null}
                </li>
              ))}
            </ul>
          )}
        </RecordSection>
      ) : null}
      <RecordSection id="risk-reviews-h" title="Reviews carried out" aside={<>{reviews.length ? <p>{reviews.length}</p> : null}{can.review ? <LogReview id={a.id} version={a.version} today={today()} prominent={false} /> : null}</>}>
        {reviews.length === 0 ? (
          <div className="pc-list"><EmptyState compact icon="clipboardCheck" title="No review logged yet" hint={a.status === "approved" ? `The first is due on ${day(a.nextReviewOn)}.` : "Reviews start once the assessment is in force."} /></div>
        ) : (
          <ul className="pc-list">
            {reviews.map((r) => (
              <li key={r.id} className="pc-row">
                <span className="pc-row-body">
                  <span className="pc-row-title">{`${day(r.reviewedOn)} · ${OUTCOME_LABEL[r.outcome] ?? r.outcome}`}</span>
                  <span className="pc-row-hint">{`${r.reviewerName} · next review set for ${day(r.nextReviewOn)}`}</span>
                  {r.notes ? <span className="pc-row-hint break-words whitespace-pre-line">{r.notes}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </RecordSection>
    </>
  );
}
