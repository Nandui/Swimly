import Link from "next/link";
import { ChevronRight, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { LinkPagination } from "@/components/ui-kit/link-pagination";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { Tag } from "@/components/ui-kit/tag";
import type { highRiskHazards } from "@/modules/risk/features/hazards/server/data";
import { riskBand } from "@/modules/risk/shared/rules";
import { RISK_BAND_META } from "@/modules/risk/shared/types";

type Data = Awaited<ReturnType<typeof highRiskHazards>>;

/** The hazards still High or Very high with their controls in place, worst first. Each opens its
 *  assessment, where the controls and what is still to do are written. */
export function HighRiskList({ data }: { data: Data }) {
  const href = (site: string) => `/risk-assessments/high-risk${site ? `?${new URLSearchParams({ site })}` : ""}`;
  return (
    <PageShell spacing="roomy" header={<PageHeader title="High risk"
        description="Hazards still rated High or Very high with their controls in place, in assessments in force or waiting for sign-off." />}>
      {data.sites.length > 1 ? (
        <SegmentedLinks label="Site" items={[{ href: href(""), label: "All sites", current: !data.site }, ...data.sites.map((s) => ({ href: href(s.id), label: s.name, current: s.id === data.site }))]} />
      ) : null}
      <section aria-labelledby="risk-high-h" className="flex min-w-0 flex-col">
        <div className="pc-section-head"><h2 id="risk-high-h">Worst first</h2>{data.total ? <p>{data.total}</p> : null}</div>
        {data.rows.length === 0 ? (
          <div className="pc-list"><EmptyState compact icon="clipboardCheck" title="No hazard is rated High with its controls in place" /></div>
        ) : (
          <ul className="pc-list">
            {data.rows.map((h) => {
              const band = RISK_BAND_META[riskBand(h.score)];
              return (
                <li key={h.id}>
                  <Link href={`/risk-assessments/${h.assessmentId}`} className="pc-row">
                    <span className="pc-tile-icon" data-tone={band.color === "red" ? "red" : "orange"}><TriangleAlert aria-hidden="true" /></span>
                    <span className="pc-row-body">
                      <span className="pc-row-title break-words">{h.hazard}</span>
                      <span className="pc-row-hint tabular-nums">{[h.reference, `${h.subject} at ${h.siteName}`, h.furtherAction ? "Has further action written" : "No further action written"].join(" · ")}</span>
                      <span className="mt-2 flex flex-wrap gap-1.5"><Tag meta={band} label={`${h.score}, ${band.label.toLowerCase()}`} /></span>
                    </span>
                    <ChevronRight aria-hidden="true" className="pc-row-chevron" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <LinkPagination label="High risk pages" page={data.page} pageCount={data.pages} pathname="/risk-assessments/high-risk" query={data.site ? { site: data.site } : {}} />
    </PageShell>
  );
}
