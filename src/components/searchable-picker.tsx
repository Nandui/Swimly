"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type PickerOption = {
  value: string;
  label: string;
  /** Second line — an age, a level, a time. What tells two Ava Byrnes apart. */
  hint?: string;
  /** Right-aligned and tabular: a count, or places left. */
  meta?: string;
  disabled?: boolean;
};

/** The Collapse-Not-Scroll rule applied to a field: anything that grows without
 *  limit — every student, every class — goes behind a search rather than into a
 *  select that gets longer every term.
 *
 *  It posts through a hidden input, so it works inside the same plain `<form>`
 *  as every other field. */
export function SearchablePicker({
  name,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  defaultValue = "",
  id,
}: {
  name: string;
  options: PickerOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  defaultValue?: string;
  id?: string;
}) {
  const [value, setValue] = React.useState(defaultValue);
  const [open, setOpen] = React.useState(false);

  const selected = options.find((option) => option.value === value);

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selected ? selected.label : placeholder}
            </span>
            <ChevronDown className="size-3.5 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-64 p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    // `value` is what the search matches on, so it carries the
                    // hint too — typing an age or a day finds the row.
                    key={option.value}
                    value={`${option.label} ${option.hint ?? ""}`}
                    disabled={option.disabled}
                    onSelect={() => {
                      setValue(option.value);
                      setOpen(false);
                    }}
                    // CommandItem appends a tick that also claims ml-auto; with
                    // two auto margins the metas stagger down the column.
                    className="[&>svg]:ml-0"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{option.label}</span>
                      {option.hint ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {option.hint}
                        </span>
                      ) : null}
                    </span>
                    {option.meta ? (
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {option.meta}
                      </span>
                    ) : null}
                    {option.value === value ? <Check className="size-3.5 shrink-0" /> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
