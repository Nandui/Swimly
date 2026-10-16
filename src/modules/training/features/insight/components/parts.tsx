import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/shadcn/button";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Progress } from "@/components/shadcn/progress";
import { PERIODS, type InsightFilters } from "@/modules/training/features/insight/server/data";

/** Pieces the insight pages share: a figure, a list of bars and the filter form. */

export function Figure({ value, label, hint }: { value: ReactNode; label: string; hint?: ReactNode }) {
  return (
    <div className="pc-stat">
      <span className="pc-stat-figure tabular-nums">{value}</span>
      <span className="font-semibold">{label}</span>
      {hint ? <span className="text-sm text-ui-muted-foreground">{hint}</span> : null}
    </div>
  );
}

/** A number as a percentage, or a dash when there is nothing to divide. */
export const pct = (value: number | null) => (value === null ? "–" : `${value}%`);
export const days = (value: number | null) => (value === null ? "–" : `${value} ${value === 1 ? "day" : "days"}`);

/** Steps or groups as bars against a whole, with the number in words beside each so the bar is
 *  never the only signal. */
export function Bars({ items, of }: { items: { key: string; label: ReactNode; text: string; count: number; note?: ReactNode }[]; of: number }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.key} className="flex flex-col gap-1">
          <span className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 break-words">{item.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{item.count}{of ? <span className="font-normal text-ui-muted-foreground"> · {Math.round((item.count / of) * 100)}%</span> : null}</span>
          </span>
          <Progress value={of ? (item.count / of) * 100 : 0} aria-label={`${item.text}: ${item.count} of ${of}`} />
          {item.note ? <span className="text-sm text-ui-muted-foreground">{item.note}</span> : null}
        </li>
      ))}
    </ul>
  );
}

type Option = { id: string; name: string };

/** Filters as a plain form, so the page, its download and its audit pack share one address. */
export function InsightFilterForm({ action, label, filters, sites, departments, period }: {
  action: string; label: string; filters: InsightFilters; sites: Option[]; departments?: Option[]; period?: boolean;
}) {
  const filtered = !!(filters.site || filters.department || (filters.period && filters.period !== "all"));
  const field = "min-w-0 grow basis-40 space-y-2 sm:grow-0 sm:basis-auto sm:min-w-52";
  return (
    <form method="get" action={action} className="pc-panel print:hidden" role="search" aria-label={label}>
      <div className="flex flex-wrap items-end gap-4">
        {sites.length > 1 ? (
          <div className={field}><Label htmlFor="insight-site" className="block">Site</Label>
            <NativeSelect id="insight-site" name="site" defaultValue={filters.site ?? ""} className="min-h-11 w-full">
              <NativeSelectOption value="">Every site</NativeSelectOption>
              {sites.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
            </NativeSelect>
          </div>
        ) : null}
        {departments?.length ? (
          <div className={field}><Label htmlFor="insight-department" className="block">Department</Label>
            <NativeSelect id="insight-department" name="department" defaultValue={filters.department ?? ""} className="min-h-11 w-full">
              <NativeSelectOption value="">Every department</NativeSelectOption>
              {departments.map((d) => <NativeSelectOption key={d.id} value={d.id}>{d.name}</NativeSelectOption>)}
            </NativeSelect>
          </div>
        ) : null}
        {period ? (
          <div className={field}><Label htmlFor="insight-period" className="block">Given in</Label>
            <NativeSelect id="insight-period" name="period" defaultValue={filters.period ?? "all"} className="min-h-11 w-full">
              {PERIODS.map((p) => <NativeSelectOption key={p.id} value={p.id}>{p.label}</NativeSelectOption>)}
            </NativeSelect>
          </div>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit" className="min-h-11">Apply filters</Button>
          {filtered ? <Button asChild variant="ghost" className="min-h-11"><Link href={action}>Reset</Link></Button> : null}
        </div>
      </div>
    </form>
  );
}

/** The filters as a query string, for links to the download and the audit pack. */
export function filterQuery(filters: InsightFilters) {
  const q = new URLSearchParams(Object.entries(filters).filter((e): e is [string, string] => !!e[1] && !(e[0] === "period" && e[1] === "all"))).toString();
  return q ? `?${q}` : "";
}

/** Reads the filters from a page's search params. */
export function readFilters(input: { site?: string; department?: string; period?: string }): InsightFilters {
  return { site: input.site || undefined, department: input.department || undefined, period: PERIODS.some((p) => p.id === input.period) ? input.period : undefined };
}
