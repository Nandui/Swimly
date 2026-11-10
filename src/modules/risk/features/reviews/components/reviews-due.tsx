import Link from "next/link";
import { CalendarClock, CalendarX, ChevronRight, MessageCircleQuestion } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate, parseDateOnly } from "@/lib/format";
import type { reviewsDue } from "@/modules/risk/features/reviews/server/data";
import { reviewLine } from "@/modules/risk/shared/rules";
import { RISK_REQUEST_META, RISK_REVIEW_META, SUBJECT_LABEL } from "@/modules/risk/shared/types";

type Data = Awaited<ReturnType<typeof reviewsDue>>;
type Row = Data["overdue"][number];

function Assessments({ id, title, count, shown, rows, empty, overdue }: { id: string; title: string; count: number; shown: number; rows: Row[]; empty: string; overdue: boolean }) {
  const Icon = overdue ? CalendarX : CalendarClock;
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col">
      <div className="pc-section-head"><h2 id={id}>{title}</h2>{count ? <p>{count > shown ? `${shown} of ${count}` : count}</p> : null}</div>
      {rows.length === 0 ? (
        <div className="pc-list"><EmptyState compact icon="clipboardCheck" title={empty} /></div>
      ) : (
        <ul className="pc-list">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/risk-assessments/${r.id}`} className="pc-row">
                <span className="pc-tile-icon" data-tone={overdue ? "red" : "orange"}><Icon aria-hidden="true" /></span>
                <span className="pc-row-body">
                  <span className="pc-row-title break-words">{r.subject}</span>
                  <span className="pc-row-hint tabular-nums">{[r.reference, `${SUBJECT_LABEL[r.subjectType]} at ${r.siteName}`, r.ownerName ? `Owner ${r.ownerName}` : "No owner", `Due ${formatDate(parseDateOnly(r.nextReviewOn))}`].join(" · ")}</span>
                  <span className="mt-2 flex flex-wrap gap-1.5"><Tag meta={RISK_REVIEW_META[r.review.state]} label={reviewLine(r.review)} /></span>
                </span>
                <ChevronRight aria-hidden="true" className="pc-row-chevron" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** What keeps the assessments current: the requests for another look, the reviews that are
 *  overdue and those coming up. Each row opens its assessment, where it is answered or logged. */
export function ReviewsDue({ data }: { data: Data }) {
  const href = (site: string) => `/risk-assessments/reviews${site ? `?${new URLSearchParams({ site })}` : ""}`;
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Reviews" description="Review requests to answer, and the assessments in force whose review is overdue or due in the next 30 days." />}>
      {data.sites.length > 1 ? (
        <SegmentedLinks label="Site" items={[{ href: href(""), label: "All sites", current: !data.site }, ...data.sites.map((s) => ({ href: href(s.id), label: s.name, current: s.id === data.site }))]} />
      ) : null}
      <section aria-labelledby="risk-req-h" className="flex min-w-0 flex-col">
        <div className="pc-section-head"><h2 id="risk-req-h">Review requests to answer</h2>{data.requestCount ? <p>{data.requestCount > data.shown ? `${data.shown} of ${data.requestCount}` : data.requestCount}</p> : null}</div>
        {data.requests.length === 0 ? (
          <div className="pc-list"><EmptyState compact icon="clipboardCheck" title="No review requests are waiting" /></div>
        ) : (
          <ul className="pc-list">
            {data.requests.map((r) => (
              <li key={r.id}>
                <Link href={`/risk-assessments/${r.assessmentId}`} className="pc-row">
                  <span className="pc-tile-icon" data-tone="orange"><MessageCircleQuestion aria-hidden="true" /></span>
                  <span className="pc-row-body">
                    <span className="pc-row-title break-words">{r.subject}</span>
                    <span className="pc-row-hint tabular-nums">{[r.reference, r.siteName, `Asked by ${r.requestedByName}, ${formatDate(new Date(r.createdAt))}`, r.sourceIncidentRef ? `From incident ${r.sourceIncidentRef}` : null].filter(Boolean).join(" · ")}</span>
                    <span className="pc-row-hint line-clamp-2 break-words">{r.notes}</span>
                    <span className="mt-2 flex flex-wrap gap-1.5"><Tag meta={RISK_REQUEST_META.open} /></span>
                  </span>
                  <ChevronRight aria-hidden="true" className="pc-row-chevron" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Assessments id="risk-overdue-h" title="Review overdue" count={data.overdueCount} shown={data.shown} rows={data.overdue} empty="No review is overdue" overdue />
      <Assessments id="risk-due-h" title="Due in the next 30 days" count={data.dueCount} shown={data.shown} rows={data.due} empty="No review is due in the next 30 days" overdue={false} />
    </PageShell>
  );
}
