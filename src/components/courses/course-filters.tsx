"use client";

import * as React from "react";
import Form from "next/form";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { FilterDimension } from "@/lib/courses/filters";
import { cn } from "@/lib/utils";

/** The timetable's filter bar. Six dimensions, and they combine: a class has to
 *  satisfy every one that is set.
 *
 *  The Collapse-Not-Scroll rule applied to a filter bar. Day has seven values
 *  and could be tabs; time has fifteen and level has nine, and both grow every
 *  time the club adds a slot. Rather than one dimension in tabs and the rest
 *  hidden somewhere else, every dimension is the same searchable picker — so
 *  the bar's width is fixed no matter how the timetable grows, and the place to
 *  compare options is the list, where the counts line up in a column.
 *
 *  Counts on the options exclude that option's own dimension, so they read as
 *  "how many if I picked this instead" rather than "how many are already
 *  showing". Picking a value never lands you on an empty page.
 *
 *  The state lives in the URL, which is what makes a filtered timetable
 *  something you can send to somebody. */
export function CourseFilters({
  dimensions,
  q,
  active,
  showing,
  total,
}: {
  dimensions: FilterDimension[];
  q: string;
  active: number;
  showing: number;
  total: number;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const href = React.useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      // A key whose value is empty filters nothing, so it has no business in a
      // link somebody might send on.
      for (const [key, value] of [...next.entries()]) if (!value) next.delete(key);
      const query = next.toString();
      return query ? `/courses?${query}` : "/courses";
    },
    [params]
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Form action="/courses" className="relative">
          {dimensions
            .filter((d) => d.selected)
            .map((d) => (
              <input key={d.key} type="hidden" name={d.key} value={d.selected} />
            ))}
          <Search
            className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search classes…"
            aria-label="Search classes"
            className="h-8 w-52 pl-7"
          />
          {/* A form with one text field and no button submits on Enter by
              implicit submission, which is a rule with enough edge cases that
              a search box should not be the thing betting on it. This costs
              nothing and gives keyboard users something to tab to. */}
          <button type="submit" className="sr-only">
            Search
          </button>
        </Form>

        {dimensions.map((d) => (
          <FilterPicker
            key={d.key}
            dimension={d}
            onPick={(value) => router.push(href({ [d.key]: value }))}
          />
        ))}

        {active > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground"
            onClick={() => router.push("/courses")}
          >
            Clear {active === 1 ? "filter" : `all ${active}`}
          </Button>
        ) : null}
      </div>

      {active > 0 ? (
        <p className="text-xs text-muted-foreground" role="status">
          <span className="font-medium text-foreground tabular-nums">{showing}</span> of{" "}
          <span className="tabular-nums">{total}</span> classes match.
        </p>
      ) : null}
    </div>
  );
}

function FilterPicker({
  dimension,
  onPick,
}: {
  dimension: FilterDimension;
  onPick: (value: string | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const chosen = Boolean(dimension.selected);
  const label = dimension.selectedLabel ?? dimension.selected;

  // A set filter reads as filled rather than blue: blue is for the one thing
  // you click next, and six chips all claiming that would say nothing. The
  // label carries the state instead — "Day" becomes "Day: Monday".
  //
  // The clear × is a sibling of the trigger, not a child of it. Nested inside,
  // it has to fight the trigger for the same pointer event and loses: the
  // filter clears and the popover opens anyway. A border joins the two so they
  // still read as one chip.
  return (
    <div
      className={cn(
        "inline-flex h-8 items-center rounded-md border text-[13px] transition-colors",
        chosen ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/40"
      )}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            // No explicit role: PopoverTrigger supplies aria-expanded,
            // aria-controls and aria-haspopup itself, and a hand-written
            // role="combobox" here would claim them without providing them.
            aria-label={chosen ? `${dimension.label}: ${label}` : `Filter by ${dimension.label}`}
            title={chosen ? `${dimension.label}: ${label}` : undefined}
            className={cn(
              "inline-flex h-full max-w-56 items-center gap-1.5 rounded-md px-2.5",
              "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              chosen && "rounded-r-none pr-1.5"
            )}
          >
            <span className="truncate">
              {chosen ? (
                <>
                  <span className="text-muted-foreground">{dimension.label}: </span>
                  <span className="font-medium">{label}</span>
                </>
              ) : (
                dimension.label
              )}
            </span>
            {chosen ? null : <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />}
          </button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-64 p-0">
          <Command>
            <CommandInput placeholder={`Search ${dimension.label.toLowerCase()}…`} />
            <CommandList>
              <CommandEmpty>Nothing matches.</CommandEmpty>
              <CommandGroup>
                {dimension.options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    // CommandItem appends its own tick with ml-auto; without
                    // this the two auto margins split the free space and the
                    // counts stagger.
                    className="[&>svg]:ml-0"
                    onSelect={() => {
                      onPick(option.value === dimension.selected ? null : option.value);
                      setOpen(false);
                    }}
                  >
                    {option.value === dimension.selected ? (
                      <Check className="size-3.5 shrink-0" aria-hidden />
                    ) : (
                      <span className="size-3.5 shrink-0" aria-hidden />
                    )}
                    <span className="truncate">{option.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                      {option.count}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {chosen ? (
        <button
          type="button"
          aria-label={`Clear ${dimension.label} filter`}
          onClick={() => onPick(null)}
          className={cn(
            "inline-flex h-full items-center rounded-r-md border-l px-1.5 opacity-60",
            "transition-opacity hover:opacity-100",
            "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          )}
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
