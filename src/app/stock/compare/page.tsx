import type { Metadata } from "next";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { Tag } from "@/components/ui-kit/tag";
import { formatDay, formatShortDay, plural } from "@/lib/format";
import { CategoryTag, ComparePicker, groupByCategory, STOCK_CHANGE_META, stockComparison, type CompareRow } from "@/modules/stock/features/compare";

export const metadata: Metadata = { title: "Compare stock counts" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Two submitted counts at a site, side by side (docs/stock.md). Going down is selling, so it stays
 *  quiet; more than before and not counted are what get flagged. Products not counted on either
 *  count are listed apart and left out of the totals. */
export default async function StockComparePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { options, from, to, problem, rows, totals } = await stockComparison({ from: one(sp.from), to: one(sp.to) });
  const counted = rows.filter((r) => r.change !== "uncounted");
  const missed = rows.filter((r) => r.change === "uncounted");
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Compare counts" description="Put two submitted counts at a site side by side and see what left the shelf." />}>
      {options.length < 2 ? (
        <EmptyState icon="clipboardList" title="Nothing to compare yet" hint="Two submitted counts at the same site, and this fills in." />
      ) : <>
        <section className="pc-panel" aria-label="Choose the counts"><ComparePicker options={options} from={from?.id} to={to?.id} /></section>
        {problem ? <Notice tone="warning" title={problem} /> : null}
        {from && to && totals ? <>
          <p className="text-sm text-ui-muted-foreground">
            Between <strong className="text-ui-foreground">{formatDay(from.stockDate)}</strong> and <strong className="text-ui-foreground">{formatDay(to.stockDate)}</strong> at {to.site},{" "}
            <strong className="text-ui-foreground">{totals.changed} of {plural(totals.counted, "product")}</strong> changed and <strong className="text-ui-foreground">{plural(totals.out, "unit")}</strong> left the shelf.
            {totals.up ? <> <strong className="text-ui-foreground">{totals.up}</strong> went up, which means a delivery nobody recorded or a miscount.</> : null}
            {totals.uncounted ? <> <strong className="text-ui-foreground">{totals.uncounted}</strong> {totals.uncounted === 1 ? "was" : "were"} not counted on one of them and {totals.uncounted === 1 ? "is" : "are"} left out.</> : null}
          </p>
          {groupByCategory(counted).map((g) => (
            <section key={g.id} className="pc-panel" aria-labelledby={`stk-cmp-${g.id}`}>
              <div className="pc-panel-head"><h2 id={`stk-cmp-${g.id}`} className="sr-only">{g.name}</h2><CategoryTag name={g.name} tone={g.tone} /></div>
              <ul className="pc-rows">{g.products.map((r) => <Row key={r.id} row={r} from={from.stockDate} to={to.stockDate} />)}</ul>
            </section>
          ))}
          {missed.length ? (
            <section className="pc-panel" aria-labelledby="stk-cmp-missed">
              <div className="pc-panel-head"><div className="flex flex-col gap-1"><h2 id="stk-cmp-missed">Not counted on one of them · {missed.length}</h2>
                <p className="pc-row-hint">A shelf nobody counted is not an empty shelf, so these are left out of the totals.</p></div></div>
              <ul className="pc-rows">{missed.map((r) => <Row key={r.id} row={r} from={from.stockDate} to={to.stockDate} />)}</ul>
            </section>
          ) : null}
        </> : null}
      </>}
    </PageShell>
  );
}

function Row({ row, from, to }: { row: CompareRow; from: string; to: string }) {
  const n = (v: number | null) => (v === null ? "not counted" : v === 0 ? "none" : String(v));
  return (
    <li className="pc-row">
      <span className="pc-row-body">
        <span className="pc-row-title">{row.name}</span>
        <span className="pc-row-hint tabular-nums">{formatShortDay(from)}: {n(row.before)} · {formatShortDay(to)}: {n(row.after)} · {row.unitLabel}</span>
      </span>
      <span className="pc-row-trail">
        {row.change === "up" || row.change === "down" ? <span className="text-sm font-semibold tabular-nums">{row.delta > 0 ? `+${row.delta}` : row.delta}</span> : null}
        <Tag meta={STOCK_CHANGE_META[row.change]} />
      </span>
    </li>
  );
}
