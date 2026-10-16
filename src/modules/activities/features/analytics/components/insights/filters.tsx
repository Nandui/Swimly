"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";

type Choice = { label: string; href: string; current: boolean };

export type FilterBarProps = {
  path: string;
  presets: Choice[];
  custom: { current: boolean; start: string; end: string; today: string; label: string; quick: Choice[]; keep: Record<string, string> };
  sites: Choice[] | null;
  programme: { value: string; options: { value: string; label: string; href: string }[] } | null;
  summary: { range: string; compare: string; asOf: string | null };
  reset: string | null;
};

/** Everything a report is narrowed by, in one tray: the period (a preset, a quick pick or any two
 *  days), the sites and the programme. Each choice is a link or a navigation, so the address always
 *  says what the page shows and can be shared or bookmarked. */
export function FilterBar({ path, presets, custom, sites, programme, summary, reset }: FilterBarProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(custom.start);
  const [to, setTo] = useState(custom.end);
  const id = useId();
  const valid = Boolean(from && to && from <= to && to <= custom.today);
  const go = (href: string) => startTransition(() => router.push(href, { scroll: false }));

  return <section className="ins-filters" aria-label="Filters" data-pending={pending ? "" : undefined}>
    <div className="ins-filters-row">
      <div className="ins-filter">
        <span className="ins-filter-label" id={`${id}-period`}>Period</span>
        <nav aria-labelledby={`${id}-period`} className="pc-seg">
          {presets.map(p => <Link key={p.href} href={p.href} scroll={false} className="pc-seg-item" aria-current={p.current ? "true" : undefined}>{p.label}</Link>)}
          <Popover open={open} onOpenChange={value => { setOpen(value); if (value) { setFrom(custom.start); setTo(custom.end); } }}>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="pc-seg-item" aria-pressed={custom.current}>
                <CalendarRange aria-hidden="true" strokeWidth={1.6} />{custom.current ? custom.label : "Custom"}<ChevronDown aria-hidden="true" strokeWidth={1.6} />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="ins-range-pop">
              <p className="ins-range-title">Quick picks</p>
              <ul className="ins-range-quick">
                {custom.quick.map(q => <li key={q.href}>
                  <Link href={q.href} scroll={false} className="ins-range-chip" aria-current={q.current ? "true" : undefined} onClick={() => setOpen(false)}>{q.label}</Link>
                </li>)}
              </ul>
              <form className="ins-range-form" onSubmit={event => {
                event.preventDefault();
                if (!valid) return;
                setOpen(false);
                go(`${path}?${new URLSearchParams({ ...custom.keep, from, to }).toString()}`);
              }}>
                <p className="ins-range-title">Any two days</p>
                <div className="ins-range-fields">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <Label htmlFor={`${id}-from`}>From</Label>
                    <Input id={`${id}-from`} type="date" value={from} max={to || custom.today} onChange={e => setFrom(e.target.value)} className="h-(--pc-control-height)" required />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <Label htmlFor={`${id}-to`}>To</Label>
                    <Input id={`${id}-to`} type="date" value={to} min={from || undefined} max={custom.today} onChange={e => setTo(e.target.value)} className="h-(--pc-control-height)" required />
                  </div>
                </div>
                <p className="ins-range-hint">Compared with the same number of days just before. Up to three years.</p>
                <Button type="submit" disabled={!valid} className="h-(--pc-control-height) rounded-full">Show these dates</Button>
              </form>
            </PopoverContent>
          </Popover>
        </nav>
      </div>
      {sites ? <div className="ins-filter">
        <span className="ins-filter-label" id={`${id}-sites`}>Sites</span>
        <nav aria-labelledby={`${id}-sites`} className="pc-seg">
          {sites.map(s => <Link key={s.href} href={s.href} scroll={false} className="pc-seg-item" aria-current={s.current ? "true" : undefined}>{s.label}</Link>)}
        </nav>
      </div> : null}
      {programme ? <div className="ins-filter ins-filter-grow">
        <Label htmlFor={`${id}-programme`} className="ins-filter-label">Programme</Label>
        <NativeSelect id={`${id}-programme`} value={programme.value} onChange={e => {
          const option = programme.options.find(o => o.value === e.target.value);
          if (option) go(option.href);
        }} className="ins-filter-select">
          {programme.options.map(o => <NativeSelectOption key={o.value} value={o.value}>{o.label}</NativeSelectOption>)}
        </NativeSelect>
      </div> : null}
    </div>
    <div className="ins-filters-summary">
      <p aria-live="polite"><strong>{summary.range}</strong><span>{summary.compare}</span>{summary.asOf ? <span>{summary.asOf}</span> : null}</p>
      {reset ? <Link href={reset} scroll={false} className="ins-filters-reset"><RotateCcw aria-hidden="true" strokeWidth={1.6} />Reset filters</Link> : null}
    </div>
  </section>;
}
