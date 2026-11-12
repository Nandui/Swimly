import { ArrowDown, ArrowUp, CheckCircle2, CircleDashed, ClipboardList, Equal, Tag as TagIcon } from "lucide-react";
import type { StatusMeta } from "@/lib/status";

/** Stock's rules, pure and client-safe: the status maps, the category tones and
 *  how two counts compare.
 *
 *  Counted none is not uncounted. No line for a product means nobody counted it; a line with
 *  quantity 0 means counted, none on the shelf. Mixing them turns a skipped shelf into a phantom
 *  loss, so lines are never pre-created, the count sheet gives zero its own None button, and a
 *  comparison keeps uncounted products in their own list, out of the totals. */

export type StockTakeState = "open" | "submitted";

export const STOCK_TAKE_META = {
  open: { label: "Open", color: "blue", icon: ClipboardList },
  submitted: { label: "Submitted", color: "green", icon: CheckCircle2 },
} satisfies Record<StockTakeState, StatusMeta>;

export const stockTakeState = (submittedAt: Date | string | null): StockTakeState => (submittedAt ? "submitted" : "open");

/** A category's tag. Red is kept for what needs attention, so it is not offered. */
export const STOCK_CATEGORY_TONES = ["blue", "green", "orange", "purple", "gray"] as const;
export type StockCategoryTone = (typeof STOCK_CATEGORY_TONES)[number];

export const STOCK_CATEGORY_TONE_META = {
  blue: { label: "Blue", color: "blue", icon: TagIcon },
  green: { label: "Green", color: "green", icon: TagIcon },
  orange: { label: "Orange", color: "orange", icon: TagIcon },
  purple: { label: "Purple", color: "purple", icon: TagIcon },
  gray: { label: "Grey", color: "gray", icon: TagIcon },
} satisfies Record<StockCategoryTone, StatusMeta>;

export const categoryTone = (tone: string): StatusMeta =>
  STOCK_CATEGORY_TONE_META[(STOCK_CATEGORY_TONES as readonly string[]).includes(tone) ? (tone as StockCategoryTone) : "gray"];

/** What happened to a product between two counts. Going down is the normal case (selling), so it
 *  is quiet; more than last time means a delivery nobody recorded or a miscount, so it is red. */
export type StockChange = "up" | "down" | "same" | "uncounted";

export const STOCK_CHANGE_META = {
  up: { label: "More than before", color: "red", icon: ArrowUp },
  down: { label: "Down", color: "gray", icon: ArrowDown },
  same: { label: "No change", color: "gray", icon: Equal },
  uncounted: { label: "Not counted", color: "orange", icon: CircleDashed },
} satisfies Record<StockChange, StatusMeta>;

/** The units every product is counted in are free text; these are offered as suggestions. */
export const COMMON_UNITS = ["each", "can", "bottle", "packet", "box", "pair"];

export type CompareProduct = { id: string; name: string; unitLabel: string; category: { id: string; name: string; tone: string; sortOrder: number } };
export type CompareRow = CompareProduct & { before: number | null; after: number | null; change: StockChange; delta: number };

/** Every product on either count, product by product. A product missing from either count is
 *  `uncounted` and its delta is 0, so it never reaches a total. */
export function compareCounts(products: readonly CompareProduct[], before: ReadonlyMap<string, number>, after: ReadonlyMap<string, number>): CompareRow[] {
  return products
    .filter((p) => before.has(p.id) || after.has(p.id))
    .map((p) => {
      const b = before.get(p.id) ?? null, a = after.get(p.id) ?? null;
      if (b === null || a === null) return { ...p, before: b, after: a, change: "uncounted" as const, delta: 0 };
      const delta = a - b;
      return { ...p, before: b, after: a, delta, change: delta > 0 ? ("up" as const) : delta < 0 ? ("down" as const) : ("same" as const) };
    })
    .sort(byCategoryThenName);
}

export function compareTotals(rows: readonly CompareRow[]) {
  const counted = rows.filter((r) => r.change !== "uncounted");
  return {
    counted: counted.length,
    changed: counted.filter((r) => r.change !== "same").length,
    up: counted.filter((r) => r.change === "up").length,
    uncounted: rows.length - counted.length,
    /** Units gone from the shelf, over products counted both times. */
    out: counted.reduce((n, r) => n + (r.delta < 0 ? -r.delta : 0), 0),
  };
}

/** Category order, then name: how the count sheet and the comparison read. */
function byCategoryThenName(a: CompareProduct, b: CompareProduct) {
  return a.category.sortOrder - b.category.sortOrder || a.category.name.localeCompare(b.category.name) || a.name.localeCompare(b.name);
}

/** Products under their category headings, in category order. */
export function groupByCategory<P extends CompareProduct>(products: readonly P[]) {
  const groups = new Map<string, { id: string; name: string; tone: string; products: P[] }>();
  for (const p of [...products].sort(byCategoryThenName)) {
    const g = groups.get(p.category.id) ?? { id: p.category.id, name: p.category.name, tone: p.category.tone, products: [] };
    g.products.push(p);
    groups.set(p.category.id, g);
  }
  return [...groups.values()];
}

/** A count typed on the sheet: a whole number, or empty for uncounted. Anything else is refused. */
export function parseCount(value: string): number | null | undefined {
  const t = value.trim();
  if (t === "") return null;
  return /^\d{1,6}$/.test(t) ? Number(t) : undefined;
}
