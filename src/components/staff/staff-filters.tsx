"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/shadcn/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn/popover";
import { SearchField } from "@/components/ui-kit/search-field";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { plural } from "@/lib/format";
import { STAFF_SHOW, filtersChosen, staffListHref, type StaffFilters, type StaffShow } from "@/lib/staff/filters";

export type StaffFilterOption = { value: string; label: string; count: number };
export type StaffFilterPicker = { key: "role" | "site" | "department"; label: string; all: string; options: StaffFilterOption[] };

/** The Staff list's one bar under the title: a search that narrows the list as you type, who to
 *  show (everyone, who can sign in, who cannot), then a pill for each thing the list knows (role,
 *  site, department) with how many people each choice has. Every choice lives in the address,
 *  so opening a person and coming back, or the browser's Back, keeps it. */
export function StaffFilterBar({ filters, showCounts, pickers, shown, total }: {
  filters: StaffFilters;
  showCounts: Record<StaffShow, number>;
  pickers: StaffFilterPicker[];
  shown: number;
  total: number;
}) {
  const router = useRouter();
  const [pending, startNavigation] = useTransition();
  const [q, setQ] = useState(filters.q);
  // The last search this bar sent, so a reply from the server does not undo newer typing,
  // while "Clear all" or Back (a new value from outside) still resets the box.
  const sent = useRef(filters.q);
  useEffect(() => {
    if (filters.q !== sent.current) { sent.current = filters.q; setQ(filters.q); }
  }, [filters.q]);
  useEffect(() => {
    if (q.trim() === sent.current) return;
    const timer = setTimeout(() => {
      sent.current = q.trim();
      startNavigation(() => router.replace(staffListHref({ ...filters, q: q.trim() }), { scroll: false }));
    }, 250);
    return () => clearTimeout(timer);
  }, [q, filters, router]);

  const href = (changes: Partial<StaffFilters>) => staffListHref({ ...filters, q: q.trim(), ...changes });
  const pick = (key: StaffFilterPicker["key"], value: string | null) =>
    startNavigation(() => router.push(href({ [key]: value }), { scroll: false }));
  const chosen = filtersChosen({ ...filters, q: q.trim() });

  return (
    <section className="pc-panel" aria-label="Find people" aria-busy={pending}>
      <div className="min-w-0 flex flex-wrap items-end gap-3">
        <form role="search" aria-label="Search staff" className="min-w-0 grow basis-field md:max-w-md" onSubmit={(event) => event.preventDefault()}>
          <SearchField id="staff-query" label="Find a person" placeholder="Name or email" maxLength={100} value={q} onValueChange={setQ} />
        </form>
        <SegmentedLinks
          label="Who to show"
          items={(Object.keys(STAFF_SHOW) as StaffShow[]).map((show) => ({
            href: href({ show }), label: STAFF_SHOW[show], count: showCounts[show], current: filters.show === show,
          }))}
        />
      </div>
      {pickers.length || chosen ? (
        <div className="min-w-0 flex flex-wrap items-center gap-2">
          {pickers.map((picker) => (
            <FilterPicker key={picker.key} picker={picker} selected={filters[picker.key]} disabled={pending} onPick={(value) => pick(picker.key, value)} />
          ))}
          {chosen ? <Button asChild variant="ghost"><Link href="/staff" scroll={false}>Clear all</Link></Button> : null}
        </div>
      ) : null}
      {/* Always rendered, so a screen reader hears the count change as the list narrows. */}
      <p className="text-sm text-ui-muted-foreground tabular-nums empty:hidden" aria-live="polite" aria-atomic="true">
        {chosen ? `${shown} of ${plural(total, "person", "people")} match.` : null}
      </p>
    </section>
  );
}

function FilterPicker({ picker, selected, onPick, disabled }: {
  picker: StaffFilterPicker;
  selected: string | null;
  onPick: (value: string | null) => void;
  disabled: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const current = selected ? picker.options.find((option) => option.value === selected)?.label ?? "Not available" : picker.all;
  function select(value: string | null) { setOpen(false); onPick(value); }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} variant="outline" role="combobox" aria-expanded={open} aria-controls={`${id}-options`} aria-label={`${picker.label}: ${current}`} disabled={disabled} className="min-w-0 max-w-full">
          <span className="font-normal text-ui-muted-foreground">{picker.label}</span>
          <span className="min-w-0 truncate">{current}</span>
          <ChevronDown className="shrink-0" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" aria-label={`${picker.label} filter`} className="w-80 max-w-(--pc-overlay-max-width) p-0">
        <Command>
          <CommandInput placeholder={`Search ${picker.label.toLowerCase()}`} aria-label={`Search ${picker.label.toLowerCase()}`} />
          <CommandList id={`${id}-options`}>
            <CommandEmpty>Nothing matches.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__all__" keywords={[picker.all]} onSelect={() => select(null)}>
                {picker.all}{!selected ? <Check className="ml-auto" aria-label="Selected" /> : null}
              </CommandItem>
              {picker.options.map((option) => (
                <CommandItem key={option.value} value={option.value} keywords={[option.label]} onSelect={() => select(option.value)}>
                  <span className="min-w-0 flex-1 break-words">{option.label}</span>
                  <span className="text-ui-muted-foreground tabular-nums">{option.count}</span>
                  {selected === option.value ? <Check aria-label="Selected" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
