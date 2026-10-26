"use client";

import * as React from "react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { SearchField } from "@/components/ui-kit/search-field";
import { SegmentedChoice } from "@/components/ui-kit/segmented-links";
import { Tag } from "@/components/ui-kit/tag";
import { toast } from "@/components/ui/toast";
import { DiscardCount, SubmitCount } from "@/modules/stock/features/counts/components/count-dialogs";
import { saveCountLine } from "@/modules/stock/features/counts/server/actions";
import { CategoryTag } from "@/modules/stock/shared/components/form-kit";
import { groupByCategory, parseCount, STOCK_CHANGE_META, type CompareProduct } from "@/modules/stock/shared/rules";

/** The count sheet, used walking the stockroom with a phone or tablet. It saves as
 *  the person types, a moment after they stop or when they leave the box, and keeps its search and
 *  filter in the page rather than the address, so a weak signal never costs a round trip.
 *
 *  An empty box is not counted; None is counted, none on the shelf. */

type Product = CompareProduct & { archived: boolean };
type Filter = "all" | "todo" | "done";

export function CountSheet({ takeId, products, lines, canCount }: {
  takeId: string;
  products: Product[];
  lines: { productId: string; quantity: number }[];
  canCount: boolean;
}) {
  const [counts, setCounts] = React.useState<Record<string, number>>(() => Object.fromEntries(lines.map((l) => [l.productId, l.quantity])));
  const [drafts, setDrafts] = React.useState<Record<string, string>>(() => Object.fromEntries(lines.map((l) => [l.productId, String(l.quantity)])));
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const timers = React.useRef<Record<string, number>>({});
  // What the server last heard for each product, so leaving a box after its save has gone sends nothing twice.
  const sent = React.useRef<Record<string, number | null>>(Object.fromEntries(lines.map((l) => [l.productId, l.quantity])));

  React.useEffect(() => () => { for (const t of Object.values(timers.current)) window.clearTimeout(t); }, []);

  const counted = products.filter((p) => p.id in counts).length;
  const total = products.length;

  async function persist(productId: string, quantity: number | null) {
    window.clearTimeout(timers.current[productId]);
    const before = sent.current[productId] ?? null;
    if (before === quantity) return;
    sent.current[productId] = quantity;
    const result = await saveCountLine(takeId, productId, quantity);
    if (!result.ok) {
      sent.current[productId] = before;
      toast.error(result.error);
    }
  }

  function set(productId: string, quantity: number | null) {
    setCounts((c) => {
      const next = { ...c };
      if (quantity === null) delete next[productId];
      else next[productId] = quantity;
      return next;
    });
  }

  function type(productId: string, value: string) {
    setDrafts((d) => ({ ...d, [productId]: value }));
    const n = parseCount(value);
    if (n === undefined) return;
    set(productId, n);
    window.clearTimeout(timers.current[productId]);
    timers.current[productId] = window.setTimeout(() => void persist(productId, n), 400);
  }

  function leave(productId: string) {
    const n = parseCount(drafts[productId] ?? "");
    if (n === undefined) {
      toast.error("Enter a whole number, or clear the box to leave it not counted.");
      return;
    }
    void persist(productId, n);
  }

  function none(productId: string) {
    setDrafts((d) => ({ ...d, [productId]: "0" }));
    set(productId, 0);
    void persist(productId, 0);
  }

  const q = query.trim().toLowerCase();
  const shown = products.filter((p) => (!q || p.name.toLowerCase().includes(q)) && (filter === "all" || (filter === "done") === p.id in counts));
  const groups = groupByCategory(shown);

  return (
    <>
      <section className="flex min-w-0 flex-col" aria-labelledby="stk-progress">
        <div className="pc-section-head">
          <h2 id="stk-progress" className="tabular-nums">{counted} of {total} counted</h2>
          {canCount ? (
            <div className="flex flex-wrap gap-2 self-center">
              {counted === 0 ? <DiscardCount id={takeId} /> : null}
              <SubmitCount id={takeId} counted={counted} total={total} />
            </div>
          ) : null}
        </div>
        <p className="pc-section-note">{canCount ? "An empty box is not counted. None means counted, none on the shelf. Numbers save as you type." : "An empty line was not counted."}</p>
        <div className="flex flex-wrap items-end gap-4">
          <SearchField label="Find a product" value={query} onValueChange={setQuery} placeholder="Goggles" className="grow basis-(--field-min)" />
          <SegmentedChoice aria-label="Show" value={filter} onValueChange={(v) => setFilter(v as Filter)} fill="phone"
            options={[{ value: "all", label: "All", count: total }, { value: "todo", label: "Not counted", count: total - counted }, { value: "done", label: "Counted", count: counted }]} />
        </div>
      </section>

      {groups.length === 0 ? (
        <EmptyState icon="searchX" title={total === 0 ? "No products to count" : "Nothing here"}
          hint={total === 0 ? "Whoever manages Stock adds the products first." : q ? "Nothing matches that search." : filter === "todo" ? "Everything has been counted." : "Nothing has been counted yet."} />
      ) : groups.map((g) => (
        <section key={g.id} className="flex min-w-0 flex-col" aria-labelledby={`stk-cat-${g.id}`}>
          <div className="pc-section-head">
            <h2 id={`stk-cat-${g.id}`} className="sr-only">{g.name}</h2>
            <CategoryTag name={g.name} tone={g.tone} />
            <p>{g.products.filter((p) => p.id in counts).length} of {g.products.length}</p>
          </div>
          <ul className="pc-list">
            {g.products.map((p) => {
              const has = p.id in counts;
              const isNone = has && counts[p.id] === 0;
              return (
                <li key={p.id} className="pc-row">
                  <span className="pc-row-body">
                    <span className="pc-row-title">{p.name}</span>
                    <span className="pc-row-hint">{p.unitLabel}{p.archived ? " · archived" : ""}</span>
                  </span>
                  <span className="pc-row-trail">
                    {canCount ? <>
                      <Button type="button" variant={isNone ? "default" : "outline"} className="min-h-11" aria-pressed={isNone} onClick={() => none(p.id)}>None</Button>
                      <Input type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" enterKeyHint="next" aria-label={`Count of ${p.name}, in ${p.unitLabel}`}
                        placeholder="—" value={drafts[p.id] ?? ""} onChange={(e) => type(p.id, e.target.value)} onBlur={() => leave(p.id)}
                        className="min-h-11 w-28 text-center tabular-nums" />
                    </> : has ? <span className="text-base font-semibold tabular-nums">{isNone ? "None" : counts[p.id]}</span> : <Tag meta={STOCK_CHANGE_META.uncounted} />}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
