import Link from "next/link";
import { PencilLine, Printer } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordFacts, RecordHistory, RecordNext, RecordSection, RecordSteps, type RecordStepState } from "@/components/ui-kit/record";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate, formatDateTime, parseDateOnly } from "@/lib/format";
import { MoveActions } from "@/modules/risk/features/assessments/components/move-actions";
import type { RiskAssessmentData } from "@/modules/risk/shared/load";
import { reviewLine, riskBand } from "@/modules/risk/shared/rules";
import { reviewEvery, RISK_ACTIONS, RISK_BAND_META, RISK_REVIEW_META, RISK_STATUS_META, SUBJECT_LABEL, type Move, type RiskAction, type RiskAssessmentView } from "@/modules/risk/shared/types";

const day = (iso: string) => formatDate(parseDateOnly(iso));
const scored = (score: number) => `${score}, ${RISK_BAND_META[riskBand(score)].label.toLowerCase()}`;

/** Where it has got to: draft, waiting for sign-off, in force. An archived one stops where it was. */
function steps(a: RiskAssessmentView): { label: string; hint: string; state: RecordStepState }[] {
  const archived = a.status === "archived";
  const signed = !!a.ownerApprovedAt;
  return [
    { label: "Draft", hint: `Started by ${a.createdByName}, ${formatDate(new Date(a.createdAt))}`, state: a.status === "draft" ? "current" : "done" },
    { label: "Waiting for sign-off", hint: a.status === "draft" ? "Once it is sent" : signed ? "Done" : a.ownerName ? `With ${a.ownerName}` : "No owner chosen", state: a.status === "review" ? "waiting" : signed ? "done" : "todo" },
    archived
      ? { label: "Archived", hint: "Kept, out of use", state: "stopped" }
      : { label: "In force", hint: signed && a.ownerApprovedByName ? `Signed off by ${a.ownerApprovedByName}, ${formatDate(new Date(a.ownerApprovedAt!))}` : "Once its owner signs it off", state: a.status === "approved" ? "done" : "todo" },
  ];
}
const historyTone = (action: RiskAction) => (action === "owner_approve" || action === "exec_approve" ? "done" as const : action === "signoff_reset" || action === "owner_withdraw" || action === "exec_withdraw" || action === "request" ? "warn" as const : action === "archive" ? "stop" as const : undefined);

function nextStep(data: RiskAssessmentData) {
  const { assessment: a, can, review, hazards } = data;
  if (a.status === "draft") return hazards.length ? (a.ownerId ? "When its hazards are complete, send it for sign-off." : "Choose its owner under Change details, then send it for sign-off.") : "Add its hazards below, then send it for sign-off.";
  if (a.status === "review") return can.ownerApprove ? "You own this assessment. Read it through, then sign it off to put it in force." : `Waiting for ${a.ownerName || "its owner"} to sign it off.${a.ownerId ? "" : " Choose an owner under Change details."}`;
  if (a.status === "archived") return "Archived. Everything in it is kept.";
  if (review.state === "overdue") return "Its review is overdue. Check the hazards and controls still hold, then log the review below.";
  if (review.state === "due") return `Its review is due on ${day(a.nextReviewOn)}. Log it below once it is done.`;
  return `In force. Its next review is due on ${day(a.nextReviewOn)}.`;
}

/** One risk assessment as a record page (ui-kit/record.tsx): what happens next and where it has
 *  got to beside it, tinted blue while the move is this person's; its details, its hazards and
 *  reviews (their own features, passed in by the route, with the review to log now when one is
 *  due) and the history. */
export function AssessmentView({ data, hazards, reviews, reviewNow }: { data: RiskAssessmentData; hazards: React.ReactNode; reviews: React.ReactNode; reviewNow?: React.ReactNode }) {
  const { assessment: a, can, review } = data;
  const moves: Move[] = [
    ...(can.submit ? ["submit" as const] : []), ...(can.ownerApprove ? ["owner_approve" as const] : []), ...(can.execApprove ? ["exec_approve" as const] : []),
    ...(can.restore ? ["restore" as const] : []), ...(can.ownerWithdraw ? ["owner_withdraw" as const] : []), ...(can.execWithdraw ? ["exec_withdraw" as const] : []), ...(can.archive ? ["archive" as const] : []),
  ];
  const act = can.submit || can.ownerApprove || (can.review && (review.state === "overdue" || review.state === "due"));
  const due = review.state === "overdue" || review.state === "due";
  return (
    <PageShell spacing="roomy" header={<PageHeader back={{ href: "/risk-assessments", label: "Risk assessments" }}
        eyebrow={<p className="rec-head"><Tag meta={RISK_STATUS_META[a.status]} />{due ? <Tag meta={RISK_REVIEW_META[review.state]} label={reviewLine(review)} /> : null}<span className="tabular-nums">{a.reference}</span></p>}
        title={a.subject}
        description={`${SUBJECT_LABEL[a.subjectType]} at ${a.siteName} · assessed ${day(a.assessedOn)}${a.assessorName ? ` by ${a.assessorName}` : ""}`}
        actions={<>
          {can.print ? <Button asChild variant="outline"><Link href={`/risk-assessments/${a.id}/export`}><Printer aria-hidden="true" />Print</Link></Button> : null}
          {can.write ? <Button asChild variant="outline"><Link href={`/risk-assessments/${a.id}/edit`}><PencilLine aria-hidden="true" />Change details</Link></Button> : null}
        </>} />}>
      <div className="rec-layout">
        <RecordNext act={act} label={act ? "Your move" : "Where it stands"} body={nextStep(data)}>
          {reviewNow ? <div className="flex flex-col">{reviewNow}</div> : null}
          <MoveActions id={a.id} version={a.version} moves={moves} />
          <RecordSteps steps={steps(a)} label="Where the assessment has got to" />
        </RecordNext>
        <div className="rec-main">
          <RecordSection id="risk-details-h" title="The assessment">
            <div className="rec-card">
              <RecordFacts items={[
                ["Site", a.siteName],
                [SUBJECT_LABEL[a.subjectType], a.subject],
                ...(a.scope ? [["What it covers", a.scope, true] as [string, string, boolean]] : []),
                ["Owner", a.ownerName || "Not chosen yet"],
                ...(a.departmentName ? [["Department", a.departmentName] as [string, string]] : []),
                ["Reviewed", reviewEvery(a.reviewMonths)],
                ["Last reviewed", a.lastReviewedOn ? day(a.lastReviewedOn) : "Not yet"],
                ["Next review", a.status === "approved" ? `${day(a.nextReviewOn)} (${reviewLine(review).toLowerCase()})` : "Starts once it is in force"],
                ["Target risk", scored(a.targetScore)],
                ["Risk with controls in place", data.overall === null ? "No hazards yet" : `${scored(data.overall)}, across ${data.hazards.length} ${data.hazards.length === 1 ? "hazard" : "hazards"}: ${data.overall <= a.targetScore ? "within target" : "above target"}`],
                ...(a.ownerApprovedAt ? [["Signed off", `${a.ownerApprovedByName}, ${formatDateTime(new Date(a.ownerApprovedAt))}`] as [string, string]] : []),
                ...(a.execApprovedAt ? [["Executive sign-off", `${a.execApprovedByName}, ${formatDateTime(new Date(a.execApprovedAt))}`] as [string, string]] : []),
              ]} />
            </div>
          </RecordSection>
          {hazards}
          {reviews}
        </div>
        <div className="rec-side">
          <RecordSection id="risk-history-h" title="History">
            <RecordHistory items={data.history.map((h) => ({ key: h.id, tone: historyTone(h.action), title: RISK_ACTIONS[h.action] ?? h.action, meta: `${h.actorName} · ${formatDateTime(new Date(h.createdAt))}`, note: h.note }))} />
          </RecordSection>
        </div>
      </div>
    </PageShell>
  );
}
