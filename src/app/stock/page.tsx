import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ClipboardList } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordSection } from "@/components/ui-kit/record";
import { Tag } from "@/components/ui-kit/tag";
import { formatDateTime, formatShortDay, plural } from "@/lib/format";
import { StartCountDialog, STOCK_TAKE_META, stockCounts, type StockCountRow } from "@/modules/stock/features/counts";

export const metadata: Metadata = { title: "Stock counts" };

/** The counts page: counts at the sites this person covers, open ones first. */
export default async function StockCountsPage() {
  const { who, live, takes, startSites, today } = await stockCounts();
  const open = takes.filter((t) => t.state === "open");
  const done = takes.filter((t) => t.state === "submitted");
  const canStart = startSites.some((s) => !s.open) && live > 0;
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Stock counts" description="Walk the stockroom with a phone or tablet and count what is on the shelf. Submitted counts can be compared."
        actions={canStart ? <StartCountDialog sites={startSites} today={today} /> : who.manage && live === 0 ? <Button asChild><Link href="/stock/products">Add products to count</Link></Button> : undefined} />}>
      <Panel id="stk-open" title="Open" takes={open} live={live}
        empty={{ title: "No count open", hint: who.count ? (live ? "Start a count at the site you are in." : "Products are added first, then they can be counted.") : "Whoever counts stock starts a count here." }} />
      {done.length ? <Panel id="stk-done" title="Submitted" takes={done} live={live} /> : null}
    </PageShell>
  );
}

/** Open or submitted counts: the title and how many above a grouped list. An open count's tile is
 *  orange (it is still being counted), a submitted one green. */
function Panel({ id, title, takes, live, empty }: { id: string; title: string; takes: StockCountRow[]; live: number; empty?: { title: string; hint: string } }) {
  return (
    <RecordSection id={`${id}-h`} title={title} aside={takes.length ? <p>{takes.length}</p> : null}>
      {takes.length === 0 ? <div className="pc-list"><EmptyState compact icon="clipboardList" title={empty?.title ?? "None"} hint={empty?.hint} /></div> : (
        <ul className="pc-list">
          {takes.map((t) => (
            <li key={t.id}>
              <Link href={`/stock/${t.id}`} className="pc-row">
                <span className="pc-tile-icon" data-tone={t.state === "open" ? "orange" : "green"} aria-hidden="true"><ClipboardList /></span>
                <span className="pc-row-body">
                  <span className="pc-row-title">{t.site}, {formatShortDay(t.stockDate)}</span>
                  <span className="pc-row-hint">{[`started by ${t.startedByName}, ${formatDateTime(t.startedAt)}`,
                    t.submittedAt ? `submitted by ${t.submittedByName ?? "someone"}, ${formatDateTime(t.submittedAt)}` : null].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="pc-row-trail">
                  <span className="text-sm tabular-nums">{t.state === "open" ? `${t.counted} of ${live} counted` : plural(t.counted, "product")}</span>
                  <Tag meta={STOCK_TAKE_META[t.state]} />
                  <ChevronRight aria-hidden="true" className="pc-row-chevron" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </RecordSection>
  );
}
