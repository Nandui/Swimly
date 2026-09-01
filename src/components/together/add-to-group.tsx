"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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

/** Adds one more swimmer to the group.
 *
 *  Adds rather than selects: the group is built by hand, because the app has no
 *  way of knowing that two children are friends and no business guessing. Over
 *  a thousand swimmers, so a search rather than a select — Collapse-Not-Scroll,
 *  the same picker the enrolment dialogs use.
 *
 *  Anyone already in the group is left out of the list, so the only thing it
 *  offers is a thing that would change something. */
export function AddToGroup({
  options,
  chosen,
  full,
}: {
  options: StudentOption[];
  chosen: string[];
  full: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  const already = new Set(chosen);
  const available = options.filter((option) => !already.has(option.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={full}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed px-2.5 text-[13px]",
            "text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground",
            "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            "disabled:pointer-events-none disabled:opacity-50"
          )}
        >
          <Plus className="size-3.5" aria-hidden />
          {chosen.length === 0 ? "Add a child" : "Add another"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder="Search swimmers…" />
          <CommandList>
            <CommandEmpty>Nobody matches.</CommandEmpty>
            <CommandGroup>
              {available.map((option) => (
                <CommandItem
                  key={option.id}
                  value={`${fullName(option)} ${option.id}`}
                  onSelect={() => {
                    setOpen(false);
                    router.push(`/together?students=${[...chosen, option.id].join(",")}`);
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
