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
  reset: string | null;
};

/** Which report, then everything it is narrowed by, in one toolbar under the page title that stays in view:
 *  the period (one menu holding the usual lengths, quick picks and any two days), the sites and the
 *  programme, and a way back to the defaults at the end. What the choices add up to is said once,
 *  under the title. Each choice is a link or a navigation, so the address always says what the page
 *  shows and can be shared or bookmarked. */
export function FilterBar({ path, presets, custom, sites, programme, reset, picker }: FilterBarProps & { picker: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(custom.start);
  const [to, setTo] = useState(custom.end);
  const id = useId();
  const valid = Boolean(from && to && from <= to && to <= custom.today);
  const go = (href: string) => startTransition(() => router.push(href, { scroll: false }));
  const preset = presets.find(p => p.current);
  const current = preset ? `Last ${preset.label}` : custom.label;

  return <section className="ins-filters" aria-label="Report and filters" data-pending={pending ? "" : undefined}>
    <div className="ins-filters-row">
      {picker}
      <span className="ins-filters-divider" aria-hidden="true" />
      <div className="ins-filter">
        <Popover open={open} onOpenChange={value => { setOpen(value); if (value) { setFrom(custom.start); setTo(custom.end); } }}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="ins-filter-button">
              <CalendarRange aria-hidden="true" strokeWidth={1.75} /><span className="sr-only">Period: </span>{current}<ChevronDown aria-hidden="true" strokeWidth={1.75} />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="ins-range-pop">
            <p className="ins-range-title" id={`${id}-period`}>Period</p>
            <ul className="ins-range-quick" aria-labelledby={`${id}-period`}>
              {presets.map(p => <li key={p.href}>
                <Link href={p.href} scroll={false} className="ins-range-chip" aria-current={p.current ? "true" : undefined} onClick={() => setOpen(false)}>Last {p.label}</Link>
              </li>)}
            </ul>
            <p className="ins-range-title" id={`${id}-quick`}>Quick picks</p>
            <ul className="ins-range-quick" aria-labelledby={`${id}-quick`}>
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
      </div>
      {sites ? <div className="ins-filter">
        <span className="sr-only" id={`${id}-sites`}>Sites</span>
        <nav aria-labelledby={`${id}-sites`} className="pc-seg">
          {sites.map(s => <Link key={s.href} href={s.href} scroll={false} className="pc-seg-item" aria-current={s.current ? "true" : undefined}>{s.label}</Link>)}
        </nav>
      </div> : null}
      {programme ? <div className="ins-filter ins-filter-grow">
        <Label htmlFor={`${id}-programme`} className="sr-only">Programme</Label>
        <NativeSelect id={`${id}-programme`} value={programme.value} onChange={e => {
          const option = programme.options.find(o => o.value === e.target.value);
          if (option) go(option.href);
        }} className="ins-filter-select">
          {programme.options.map(o => <NativeSelectOption key={o.value} value={o.value}>{o.label}</NativeSelectOption>)}
        </NativeSelect>
      </div> : null}
      {reset ? <Link href={reset} scroll={false} className="ins-filters-reset"><RotateCcw aria-hidden="true" strokeWidth={1.75} />Reset</Link> : null}
    </div>
  </section>;
}
