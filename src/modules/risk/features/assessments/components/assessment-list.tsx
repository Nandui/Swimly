import Link from "next/link";
import { ChevronRight, FilePlus2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { LinkPagination } from "@/components/ui-kit/link-pagination";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate, parseDateOnly, plural } from "@/lib/format";
import { SitePicker } from "@/modules/risk/features/assessments/components/site-picker";
import type { riskLists, RiskListRow, View } from "@/modules/risk/features/assessments/server/data";
import { isHighRisk, reviewLine, riskBand } from "@/modules/risk/shared/rules";
import { RISK_BAND_META, RISK_REVIEW_META, RISK_STATUS_META, SUBJECT_LABEL } from "@/modules/risk/shared/types";

type Data = Awaited<ReturnType<typeof riskLists>>;
const LABEL: Record<View, string> = { approved: "In force", review: "Waiting for sign-off", draft: "Drafts", archived: "Archived" };
const TITLE: Record<View, string> = { approved: "In force, soonest review first", review: "Waiting for sign-off", draft: "Drafts", archived: "Archived" };
const EMPTY: Record<View, { title: string; hint?: string }> = {
  approved: { title: "No assessment is in force yet", hint: "An assessment is in force once its owner has signed it off." },
  review: { title: "Nothing is waiting for sign-off" },
  draft: { title: "No drafts", hint: "Start an assessment for an area, a job or an activity." },
  archived: { title: "Nothing archived" },
};

/** A row's tile: red when its review is overdue, orange while it waits for sign-off or its
 *  review is due soon, green when it is in force with nothing due. The tags say it in words. */
function tone(r: RiskListRow) {
  if (r.review.state === "overdue") return "red";
  if (r.status === "review" || r.review.state === "due") return "orange";
  return r.status === "approved" ? "green" : undefined;
}

/** The assessments at the person's sites, one view at a time: those in force first, soonest
 *  review at the top; then those waiting for sign-off, the drafts (for writers) and the archived. */
export function AssessmentList({ data }: { data: Data }) {
  const href = (show: View) => `/risk-assessments?${new URLSearchParams({ show, ...(data.site ? { site: data.site } : {}) })}`;
  const query = { show: data.show, ...(data.site ? { site: data.site } : {}) };
  const site = data.sites.find((s) => s.id === data.site)?.name;
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Risk assessments"
        description="The hazards of each area, job and activity at your sites, and what controls them."
        actions={data.who.write ? <Button asChild><Link href="/risk-assessments/new"><FilePlus2 aria-hidden="true" />Start an assessment</Link></Button> : undefined} />}>
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <SegmentedLinks label="Show assessments" items={data.views.map((v) => ({ href: href(v), label: LABEL[v], count: data.counts[v] ?? 0, current: v === data.show }))} />
        {data.sites.length > 1 ? <SitePicker sites={data.sites} value={data.site} show={data.show} /> : null}
      </div>
      <section aria-labelledby="risk-list-h" className="flex min-w-0 flex-col">
        <div className="pc-section-head"><h2 id="risk-list-h">{TITLE[data.show]}{site ? ` · ${site}` : ""}</h2>{data.counts[data.show] ? <p>{data.counts[data.show]}</p> : null}</div>
        {data.rows.length === 0 ? (
          <div className="pc-list"><EmptyState compact icon="clipboardCheck" title={EMPTY[data.show].title} hint={EMPTY[data.show].hint} /></div>
        ) : (
          <ul className="pc-list">
            {data.rows.map((r) => (
              <li key={r.id}>
                <Link href={`/risk-assessments/${r.id}`} className="pc-row">
                  <span className="pc-tile-icon" data-tone={tone(r)}><ShieldCheck aria-hidden="true" /></span>
                  <span className="pc-row-body">
                    <span className="pc-row-title break-words">{r.subject}</span>
                    <span className="pc-row-hint tabular-nums">
                      {[r.reference, `${SUBJECT_LABEL[r.subjectType]} at ${r.siteName}`, plural(r.hazards, "hazard"), r.status === "approved" ? `Next review ${formatDate(parseDateOnly(r.nextReviewOn))}` : null].filter(Boolean).join(" · ")}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      <Tag meta={RISK_STATUS_META[r.status]} />
                      {r.review.state === "overdue" || r.review.state === "due" ? <Tag meta={RISK_REVIEW_META[r.review.state]} label={reviewLine(r.review)} /> : null}
                      {r.highest !== null && isHighRisk(r.highest) ? <Tag meta={RISK_BAND_META[riskBand(r.highest)]} label={`Highest risk: ${RISK_BAND_META[riskBand(r.highest)].label.toLowerCase()}`} /> : null}
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" className="pc-row-chevron" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <LinkPagination label="Assessment pages" page={data.page} pageCount={data.pages} pathname="/risk-assessments" query={query} />
    </PageShell>
  );
}
