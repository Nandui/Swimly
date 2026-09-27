import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";
import { Notice } from "@/components/ui-kit/notice";
import { PortalFrame } from "@/components/portal/portal-frame";
import { AcknowledgeReview } from "@/components/hr/actions";
import { ReviewStatusTag } from "@/components/hr/status";
import { formatDate } from "@/lib/format";
import { hrConfigured } from "@/lib/hr/database";
import { REVIEW_OVERALL_LABELS } from "@/lib/hr/constants";
import { mySharedHr } from "@/lib/hr/mine";
import { pageSession } from "@/lib/page-guards";
import { requireRecentPassword } from "@/lib/policy/session";

export const metadata: Metadata = { title: { absolute: "Shared with me · Turnfin" } };

/** What HR has shared with the signed-in person: shared reviews (to read and
 *  acknowledge) and notes marked "shared with them". Nothing else from their
 *  record appears. Needs a recent password, as any HR record does. */
export default async function MyHrPage() {
  const session = await pageSession();
  await requireRecentPassword("/me/hr");
  const frame = (children: React.ReactNode) => (
    <PortalFrame userName={session.user.name ?? "Staff member"} moduleName="Shared with me">
      <div className="space-y-2">
        <Button asChild variant="ghost" className="-ml-3 min-h-11"><Link href="/me?view=me"><ArrowLeft aria-hidden="true" />My hub</Link></Button>
        <h1 className="text-2xl font-semibold tracking-tight">Shared with you by HR</h1>
        <p className="text-sm text-ui-muted-foreground">Reviews and notes your manager or HR chose to share with you. Private notes are not shown.</p>
      </div>
      {children}
    </PortalFrame>
  );
  if (!hrConfigured()) return frame(<Notice tone="info" title="HR records are not set up yet" />);
  const { notes, reviews } = await mySharedHr(session.user.id, session.user.orgId ?? "");
  return frame(<>
    {reviews.length === 0 && notes.length === 0 ? <Notice tone="info" title="Nothing has been shared with you" /> : null}
    {reviews.map((r) => (
      <Card key={r.id} className="gap-3 p-5 shadow-none" aria-labelledby={`review-${r.id}`}>
        <div className="flex flex-wrap items-center gap-3"><h2 id={`review-${r.id}`} className="text-lg font-semibold">{r.period}</h2><ReviewStatusTag status={r.status} /></div>
        <p className="text-sm text-ui-muted-foreground">From {r.reviewerName}{r.sharedAt ? ` · shared ${formatDate(new Date(r.sharedAt))}` : ""}</p>
        {([["Summary", r.summary], ["Strengths", r.strengths], ["Goals for the next period", r.goals]] as const).map(([label, text]) => text ? (
          <div key={label} className="space-y-1"><h3 className="font-semibold">{label}</h3><p className="whitespace-pre-wrap break-words">{text}</p></div>
        ) : null)}
        {r.overall ? <p><span className="font-semibold">Overall: </span>{REVIEW_OVERALL_LABELS[r.overall]}</p> : null}
        {r.status === "acknowledged" ? (
          <p className="text-sm"><span className="font-semibold">Your comment: </span>{r.subjectComment || "None"} · acknowledged {r.acknowledgedAt ? formatDate(new Date(r.acknowledgedAt)) : ""}</p>
        ) : <div><AcknowledgeReview id={r.id} period={r.period} /></div>}
      </Card>
    ))}
    {notes.length > 0 ? (
      <Card className="gap-3 p-5 shadow-none" aria-labelledby="shared-notes">
        <h2 id="shared-notes" className="text-lg font-semibold">Notes</h2>
        <ul className="divide-y divide-ui-border">{notes.map((n) => (
          <li key={n.id} className="space-y-1 py-3"><p className="text-sm text-ui-muted-foreground">{n.authorName} · {formatDate(new Date(n.createdAt))}</p><p className="whitespace-pre-wrap break-words">{n.body}</p></li>
        ))}</ul>
      </Card>
    ) : null}
  </>);
}
