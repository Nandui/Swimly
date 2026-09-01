"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ageLabel, fullName } from "@/lib/students/constants";
import type { StudentOption } from "@/lib/students/data/students";
import { cn } from "@/lib/utils";

/** Picking the child to search around. Over a thousand swimmers, so a search
 *  rather than a select — Collapse-Not-Scroll, the same picker the enrolment
 *  dialogs use.
 *
 *  Choosing navigates rather than posting: the answer is a page somebody will
 *  want to send to a parent, or keep open at the desk while they ring back. */
export function FamilyPicker({
  options,
  selected,
}: {
  options: StudentOption[];
  selected: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const current = options.find((option) => option.id === selected);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={current ? `Chosen: ${fullName(current)}` : "Choose a child"}
          className={cn(
            "inline-flex h-9 w-full max-w-sm items-center gap-2 rounded-md border px-3 text-sm",
            "transition-colors hover:bg-accent/40",
            "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            current ? "text-foreground" : "text-muted-foreground"
          )}
        >
          <Search className="size-4 shrink-0 opacity-60" aria-hidden />
          <span className="truncate">{current ? fullName(current) : "Choose a child…"}</span>
          <ChevronDown className="ml-auto size-4 shrink-0 opacity-60" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
        <Command>
          <CommandInput placeholder="Search swimmers…" />
          <CommandList>
            <CommandEmpty>Nobody matches.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={`${fullName(option)} ${option.id}`}
                  onSelect={() => {
                    setOpen(false);
                    router.push(`/together?student=${option.id}`);
                  }}
                >
                  <span className="truncate">{fullName(option)}</span>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                    {ageLabel(option.dateOfBirth)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
