"use client";

import * as React from "react";
import { toast } from "sonner";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { switchClub } from "@/lib/clubs/actions/clubs";
import { cn } from "@/lib/utils";

type Club = { id: string; name: string };

/** Which club the app is showing, and the way to change it.
 *
 *  It is on screen the whole time — above the nav on desktop, in the bar on a
 *  phone — because the mistake it exists to prevent is a quiet one: enrolling
 *  a child into the other site's class, or adding a class to the wrong
 *  timetable, and not finding out until the family turns up at the wrong
 *  pool. So the name is always readable, and switching lands on the overview
 *  rather than leaving somebody on a page that belonged to the old club. */
export function ClubSwitcher({
  club,
  clubs,
  collapsed = false,
  compact = false,
}: {
  club: Club;
  clubs: Club[];
  collapsed?: boolean;
  compact?: boolean;
}) {
  const [pending, startTransition] = React.useTransition();
  const several = clubs.length > 1;

  function choose(id: string) {
    if (id === club.id) return;
    startTransition(async () => {
      const result = await switchClub(id);
      // A successful switch redirects, so only a refusal ever comes back.
      if (result && !result.ok) toast.error(result.error);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        aria-label={`Club: ${club.name}. ${several ? "Switch club" : "The only club"}`}
        title={collapsed ? club.name : undefined}
        className={cn(
          "flex items-center gap-2 rounded-md border border-sidebar-border bg-background text-left transition-colors hover:bg-sidebar-accent disabled:opacity-60",
          "outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50",
          collapsed
            ? "size-9 justify-center"
            : compact
              ? "h-10 min-w-0 max-w-[11rem] px-2"
              : "w-full px-2.5 py-2"
        )}
      >
        <Building2 className="size-4 shrink-0 text-primary" strokeWidth={2} />
        {collapsed ? null : compact ? (
          <>
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">
              {pending ? "Switching…" : club.name}
            </span>
            {several ? (
              <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
            ) : null}
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                Working in
              </span>
              <span className="block truncate text-[13px] font-semibold text-foreground">
                {pending ? "Switching…" : club.name}
              </span>
            </span>
            {several ? (
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
            ) : null}
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {several ? "Switch club" : "The only club"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {clubs.map((option) => {
          const current = option.id === club.id;
          return (
            <DropdownMenuItem
              key={option.id}
              onSelect={() => choose(option.id)}
              className={cn(current && "font-medium")}
            >
              <span className="min-w-0 flex-1 truncate">{option.name}</span>
              {current ? <Check className="size-4 text-primary" aria-label="Current" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
