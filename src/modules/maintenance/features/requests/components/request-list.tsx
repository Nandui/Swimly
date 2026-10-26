import Link from "next/link";
import { ChevronRight, CircleCheck, FilePlus2, Wrench } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { LinkPagination } from "@/components/ui-kit/link-pagination";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate } from "@/lib/format";
import { SitePicker } from "@/modules/maintenance/features/requests/components/site-picker";
import type { maintenanceLists, View } from "@/modules/maintenance/features/requests/server/data";
import { MAINTENANCE_STATUS_META, MAINTENANCE_URGENCY_META, maintenanceNumber, RISK_FACT, type MaintenanceView } from "@/modules/maintenance/shared/types";

type Data = Awaited<ReturnType<typeof maintenanceLists>>;
const LABEL: Record<View, string> = { trackplan: "To put in Trackplan", open: "Open", mine: "Yours", closed: "Closed" };
const TITLE: Record<View, string> = { trackplan: "Reported, not in Trackplan yet", open: "Open requests", mine: "Your requests", closed: "Recently closed" };
const EMPTY: Record<View, { title: string; hint?: string }> = {
  trackplan: { title: "Everything reported is in Trackplan" },
  open: { title: "Nothing is waiting to be fixed" },
  mine: { title: "You have not reported anything yet", hint: "Something broken? Report it in a minute." },
  closed: { title: "Nothing closed yet" },
};

/** A row's tile: red while an urgent request is open, orange while it waits to go in Trackplan,
 *  green once fixed. The tags say it in words. */
const tone = (r: MaintenanceView) => (r.status === "fixed" ? "green" : r.urgency === "urgent" && (r.status === "reported" || r.status === "in_trackplan") ? "red" : r.status === "reported" ? "orange" : undefined);

/** The requests at the person's sites, one view at a time: for managers, what still has to go in
 *  Trackplan first; then everything open, urgent first; their own; and the closed ones. */
export function RequestList({ data }: { data: Data }) {
  const href = (changes: { show?: View; site?: string }) => {
    const params = new URLSearchParams({ show: changes.show ?? data.show, ...((changes.site ?? data.site) ? { site: changes.site ?? data.site } : {}) });
    return `/maintenance?${params}`;
  };
  const query = { show: data.show, ...(data.site ? { site: data.site } : {}) };
  const site = data.sites.find((s) => s.id === data.site)?.name;
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Maintenance"
        description={data.who.manage ? "What is broken at the sites you cover, until it is fixed." : "What is broken at your sites, and what has been reported already."}
        actions={<Button asChild><Link href="/maintenance/new"><FilePlus2 aria-hidden="true" />Report a problem</Link></Button>} />}>
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <SegmentedLinks label="Show requests" items={data.views.map((v) => ({ href: href({ show: v }), label: LABEL[v], count: data.counts[v] ?? 0, current: v === data.show }))} />
        {data.sites.length > 1 ? <SitePicker sites={data.sites} value={data.site} show={data.show} /> : null}
      </div>
      <section aria-labelledby="mnt-list-h" className="flex min-w-0 flex-col">
        <div className="pc-section-head"><h2 id="mnt-list-h">{TITLE[data.show]}{site ? ` · ${site}` : ""}</h2>{data.counts[data.show] ? <p>{data.counts[data.show]}</p> : null}</div>
        {data.rows.length === 0 ? (
          <div className="pc-list"><EmptyState compact icon="clipboardCheck" title={EMPTY[data.show].title} hint={EMPTY[data.show].hint} /></div>
        ) : (
          <ul className="pc-list">
            {data.rows.map((r) => (
              <li key={r.id}>
                <Link href={`/maintenance/${r.id}`} className="pc-row">
                  <span className="pc-tile-icon" data-tone={tone(r)}>{r.status === "fixed" ? <CircleCheck aria-hidden="true" /> : <Wrench aria-hidden="true" />}</span>
                  <span className="pc-row-body">
                    <span className="pc-row-title break-words">{r.title}</span>
                    <span className="pc-row-hint tabular-nums">
                      {[maintenanceNumber(r.number), [r.siteName, r.area].filter(Boolean).join(", "), r.risk === "none" ? null : RISK_FACT[r.risk], formatDate(new Date(r.closedAt ?? r.createdAt))].filter(Boolean).join(" · ")}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      <Tag meta={MAINTENANCE_STATUS_META[r.status]} />
                      {r.urgency === "urgent" ? <Tag meta={MAINTENANCE_URGENCY_META.urgent} /> : null}
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" className="pc-row-chevron" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <LinkPagination label="Request pages" page={data.page} pageCount={data.pages} pathname="/maintenance" query={query} />
    </PageShell>
  );
}
