"use client";

import { useId, useState, useTransition } from "react";
import Form from "next/form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, ChevronsUpDown, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/shadcn/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";
import type { FilterDimension } from "@/lib/courses/filters";
import { classBrowserHref } from "@/lib/courses/browse";
import { cn } from "@/lib/utils";

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
  const [expanded, setExpanded] = useState(extraCount > 0);
  const href = (changes: Record<string, string | null>) => classBrowserHref(Object.fromEntries(params), { ...changes, page: null });
  function pick(key: string, value: string | null) {
    startNavigation(() => router.push(href({ [key]: value, ...(key === "programme" ? { level: null } : {}) }), { scroll: false }));
  }
  return <div className="space-y-4" aria-busy={pending}>
    <Form action="/courses" role="search" aria-label="Search weekly classes" className="flex items-end gap-2">
      {dimensions.map(d => d.selected ? <input key={d.key} type="hidden" name={d.key} value={d.selected} /> : null)}
      {state === "archived" ? <input type="hidden" name="state" value="archived" /> : null}
      <div className="min-w-0 flex-1 space-y-2"><Label htmlFor="class-query">Find a class</Label><div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ui-muted-foreground" aria-hidden="true" />
        <Input key={q} id="class-query" name="q" type="search" defaultValue={q} placeholder="Class, level, site or instructor…" className="h-11 pl-10" autoComplete="off" />
      </div></div><Button type="submit" className="h-11">Search</Button>
    </Form>
    <nav aria-label="Class availability" className="grid grid-cols-2 gap-1 rounded-ui-lg bg-ui-muted p-1 sm:inline-flex">
      {views.map(view => <Button key={view.key} asChild variant="ghost" size="sm" className={cn("justify-between gap-2 sm:justify-center", selectedView === view.key && "bg-ui-background text-ui-foreground shadow-sm hover:bg-ui-background")}>
        <Link href={href({ state: view.state, places: view.places })} aria-current={selectedView === view.key ? "page" : undefined}>{view.label}<span className="text-xs text-ui-muted-foreground tabular-nums">{view.count}</span></Link>
      </Button>)}
    </nav>
    <Collapsible open={expanded} onOpenChange={setExpanded} className="space-y-3">
      <div className="grid grid-cols-2 items-end gap-3 lg:grid-cols-4">
        {PRIMARY.map(key => dimensions.find(d => d.key === key)).map(d => d ? <FilterPicker key={d.key} dimension={d} disabled={pending} onPick={value => pick(d.key, value)} /> : null)}
        <CollapsibleTrigger asChild><Button variant="outline" className="h-11 justify-between"><SlidersHorizontal aria-hidden="true" /><span>More filters{extraCount ? ` (${extraCount})` : ""}</span><ChevronDown aria-hidden="true" className={expanded ? "rotate-180" : ""} /></Button></CollapsibleTrigger>
      </div>
      <CollapsibleContent className="grid grid-cols-2 gap-3 rounded-ui-lg border border-ui-border bg-ui-muted/30 p-3 lg:grid-cols-4">
        {EXTRA.map(key => dimensions.find(d => d.key === key)).map(d => d ? <FilterPicker key={d.key} dimension={d} disabled={pending} onPick={value => pick(d.key, value)} /> : null)}
      </CollapsibleContent>
    </Collapsible>
    {active ? <div className="flex min-w-0 flex-wrap gap-1">
        {dimensions.filter(d => d.selected && d.key !== "places").map(d => <Button key={d.key} asChild variant="secondary" size="sm" className="h-auto min-h-9 max-w-full whitespace-normal py-2 text-left">
          <Link href={href({ [d.key]: null })} aria-label={`Remove ${d.label.toLowerCase()} filter: ${d.selectedLabel ?? "Unavailable option"}`}><span className="min-w-0 break-words">{d.label}: {d.selectedLabel ?? "Unavailable option"}</span><X className="shrink-0" aria-hidden="true" /></Link>
        </Button>)}
        {active ? <Button asChild variant="ghost" size="sm"><Link href={state === "archived" ? "/courses?state=archived" : "/courses"}>Clear filters</Link></Button> : null}
      </div> : null}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-ui-muted-foreground" aria-live="polite" aria-atomic="true">{showing.total ? <><span className="font-medium text-ui-foreground">{showing.first}–{showing.last}</span> of {showing.total} {active ? "matching classes" : state === "archived" ? "archived classes" : "classes"}</> : "0 classes"}</p>
      <div className="ml-auto flex gap-1">
        {state !== "archived" ? <Button asChild variant="ghost" size="sm"><Link href={href({ day: todayDay })}>Today only</Link></Button> : null}
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => startNavigation(() => router.refresh())}><RefreshCw className={pending ? "animate-spin" : ""} aria-hidden="true" />{pending ? "Updating…" : "Refresh"}</Button>
      </div>
    </div>
  </div>;
}

function FilterPicker({ dimension: d, onPick, disabled }: { dimension: FilterDimension; onPick: (value: string | null) => void; disabled: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const all = ALL_LABELS[d.key];
  const chosen = d.selected ? d.selectedLabel ?? "Unavailable option" : all;
  function select(value: string | null) { setOpen(false); onPick(value); }
  return <div className="min-w-0 space-y-2"><Label htmlFor={id}>{d.label}</Label>
    <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button id={id} variant="outline" role="combobox" aria-expanded={open} aria-controls={`${id}-options`} aria-label={`${d.label}: ${chosen}`} disabled={disabled} className="h-11 w-full min-w-0 justify-between font-normal">
      <span className="truncate">{chosen}</span><ChevronsUpDown className="shrink-0" aria-hidden="true" />
    </Button></PopoverTrigger><PopoverContent align="start" aria-label={`${d.label} filter`} className="w-80 max-w-[calc(100vw-2rem)] p-0"><Command>
      <CommandInput placeholder={`Search ${d.label.toLowerCase()}…`} aria-label={`Search ${d.label.toLowerCase()}`} />
      <CommandList id={`${id}-options`}><CommandEmpty>No options match.</CommandEmpty><CommandGroup>
        <CommandItem value="__all__" keywords={[all]} onSelect={() => select(null)}>{all}{!d.selected ? <Check className="ml-auto" aria-label="Selected" /> : null}</CommandItem>
        {d.options.map(option => <CommandItem key={option.value} value={option.value} keywords={[option.label]} onSelect={() => select(option.value)}>
          <span className="min-w-0 flex-1 break-words">{option.label}</span><span className="text-ui-muted-foreground tabular-nums">{option.count}</span>{d.selected === option.value ? <Check aria-label="Selected" /> : null}
        </CommandItem>)}
      </CommandGroup></CommandList>
    </Command></PopoverContent></Popover>
  </div>;
}
