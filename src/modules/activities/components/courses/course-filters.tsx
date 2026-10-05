"use client";

import { useId, useState, useTransition } from "react";
import Form from "next/form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { SearchField } from "@/components/ui-kit/search-field";
import { formatCount, plural } from "@/lib/format";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/shadcn/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";
import type { FilterDimension } from "@/modules/activities/lib/courses/filters";
import { classBrowserHref } from "@/modules/activities/lib/courses/browse";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";

const PRIMARY = ["site", "level", "day"];
const EXTRA = ["programme", "time", "instructor", "location"];
const ALL_LABELS: Record<string, string> = { site: "All sites", level: "All levels", day: "Any day", programme: "All programmes", time: "Any start time", instructor: "All instructors", location: "All pool areas" };

export function CourseFilters({ dimensions, q, active, state, todayDay, views, selectedView, showing }: {
  dimensions: FilterDimension[]; q: string; active: number;
  state: "active" | "archived"; todayDay: string;
  views: { key: string; label: string; count: number; state: string | null; places: string | null }[];
  selectedView: string;
  showing: { first: number; last: number; total: number };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startNavigation] = useTransition();
  const extraCount = dimensions.filter(d => EXTRA.includes(d.key) && d.selected).length;
  // The search box clears itself; "Clear filters" resets only the pickers.
  const pickerKeys = [...PRIMARY, ...EXTRA];
  const pickers = dimensions.filter(d => pickerKeys.includes(d.key) && d.selected).length;
  const [expanded, setExpanded] = useState(extraCount > 0);
  const href = (changes: Record<string, string | null>) => classBrowserHref(Object.fromEntries(params), { ...changes, page: null });
  function pick(key: string, value: string | null) {
    startNavigation(() => router.push(href({ [key]: value, ...(key === "programme" ? { level: null } : {}) }), { scroll: false }));
  }
  const picker = (key: string) => {
    const d = dimensions.find(dimension => dimension.key === key);
    return d ? <FilterPicker key={d.key} dimension={d} disabled={pending} onPick={value => pick(d.key, value)} /> : null;
  };
  return <div className="min-w-0 flex flex-col gap-4" aria-busy={pending}>
    <div className="min-w-0 flex flex-wrap items-end gap-3">
      <Form action="/courses" role="search" aria-label="Search weekly classes" className="min-w-0 flex-[1_1_18rem] md:max-w-md">
        {dimensions.map(d => d.selected ? <input key={d.key} type="hidden" name={d.key} value={d.selected} /> : null)}
        {state === "archived" ? <input type="hidden" name="state" value="archived" /> : null}
        <SearchField id="class-query" label="Find a class" defaultValue={q} placeholder="Class, level, site or instructor" clearHref={href({ q: null })} />
      </Form>
      <SegmentedLinks label="Class availability" items={views.map(view => ({ href: href({ state: view.state, places: view.places }), label: view.label, count: view.count, current: selectedView === view.key }))} />
    </div>
    <Collapsible open={expanded} onOpenChange={setExpanded} asChild>
      <div className="min-w-0 flex flex-wrap items-center gap-2">
        {PRIMARY.map(picker)}
        <CollapsibleTrigger asChild><Button variant="outline" className="max-w-full"><SlidersHorizontal aria-hidden="true" />More filters{extraCount ? ` (${extraCount})` : ""}</Button></CollapsibleTrigger>
        <CollapsibleContent className="contents">{EXTRA.map(picker)}</CollapsibleContent>
        {pickers ? <Button asChild variant="ghost"><Link href={href(Object.fromEntries(pickerKeys.map(key => [key, null])))}>Clear filters</Link></Button> : null}
      </div>
    </Collapsible>
    <div className="min-w-0 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-ui-muted-foreground tabular-nums" aria-live="polite" aria-atomic="true">{showing.total ? `${formatCount(showing.first)} to ${formatCount(showing.last)} of ${plural(showing.total, active ? "matching class" : state === "archived" ? "archived class" : "class", active ? "matching classes" : state === "archived" ? "archived classes" : "classes")}` : "0 classes"}</p>
      {state !== "archived" && showing.total ? <Button asChild variant="ghost" className="ml-auto"><Link href={href({ day: todayDay })}>Today only</Link></Button> : null}
    </div>
  </div>;
}

function FilterPicker({ dimension: d, onPick, disabled }: { dimension: FilterDimension; onPick: (value: string | null) => void; disabled: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const all = ALL_LABELS[d.key];
  const chosen = d.selected ? d.selectedLabel ?? "Unavailable option" : all;
  function select(value: string | null) { setOpen(false); onPick(value); }
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button id={id} variant="outline" role="combobox" aria-expanded={open} aria-controls={`${id}-options`} aria-label={`${d.label}: ${chosen}`} disabled={disabled} className="min-w-0 max-w-full">
      <span className="font-normal text-ui-muted-foreground">{d.label}</span><span className="min-w-0 truncate">{chosen}</span><ChevronDown className="shrink-0" aria-hidden="true" />
    </Button></PopoverTrigger><PopoverContent align="start" aria-label={`${d.label} filter`} className="w-80 max-w-[calc(100vw-2rem)] p-0"><Command>
      <CommandInput placeholder={`Search ${d.label.toLowerCase()}`} aria-label={`Search ${d.label.toLowerCase()}`} />
      <CommandList id={`${id}-options`}><CommandEmpty>No options match.</CommandEmpty><CommandGroup>
        <CommandItem value="__all__" keywords={[all]} onSelect={() => select(null)}>{all}{!d.selected ? <Check className="ml-auto" aria-label="Selected" /> : null}</CommandItem>
        {d.options.map(option => <CommandItem key={option.value} value={option.value} keywords={[option.label]} onSelect={() => select(option.value)}>
          <span className="min-w-0 flex-1 break-words">{option.label}</span><span className="text-ui-muted-foreground tabular-nums">{option.count}</span>{d.selected === option.value ? <Check aria-label="Selected" /> : null}
        </CommandItem>)}
      </CommandGroup></CommandList>
    </Command></PopoverContent></Popover>;
}
