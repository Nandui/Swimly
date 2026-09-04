"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Eye, EyeOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { previewRole } from "@/lib/staff/actions/preview";
import { cn } from "@/lib/utils";

type RoleOption = { id: string; name: string; description: string | null };

/** The dev build's "view as" bar. Always visible while it applies, in the
 *  same yellow the sign-in page uses for its dev notice, so nobody forgets
 *  they are looking through somebody else's eyes. The list is every role in
 *  the database, read fresh on each page, so a role made a minute ago is in
 *  it. */
export function RolePreviewBar({
  roles,
  current,
  actualRoleName,
}: {
  roles: RoleOption[];
  /** The role being previewed, or null when seeing the app as yourself. */
  current: { id: string; name: string } | null;
  actualRoleName: string;
}) {
  const [pending, startTransition] = React.useTransition();

  function choose(id: string | null) {
    if ((current?.id ?? null) === id) return;
    startTransition(async () => {
      const result = await previewRole(id);
      // A successful switch redirects, so only a refusal ever comes back.
      if (result && !result.ok) toast.error(result.error);
    });
  }

  return (
    <div
      role="region"
      aria-label="Role preview"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b bg-(--tag-yellow-bg) px-4 py-2 text-[13px] text-(--tag-yellow-fg) md:px-8"
    >
      <p className="min-w-0">
        <span className="font-semibold">Dev build.</span>{" "}
        {current ? (
          <>
            Seeing the app as <span className="font-semibold">{current.name}</span>. You are{" "}
            {actualRoleName}.
          </>
        ) : (
          <>You are {actualRoleName}. Pick a role to see the app as they would.</>
        )}
      </p>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={pending}
            aria-label={current ? `Viewing as ${current.name}. Change role` : "View as a role"}
            className={cn(
              "flex h-9 items-center gap-2 rounded-md border border-input bg-background px-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60",
              "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              "max-md:h-10"
            )}
          >
            <Eye className="size-4 shrink-0 text-primary" />
            <span className="truncate">{pending ? "Switching…" : (current?.name ?? "View as")}</span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              See the app as
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {roles.map((role) => {
              const active = role.id === current?.id;
              return (
                <DropdownMenuItem
                  key={role.id}
                  onSelect={() => choose(role.id)}
                  className={cn("flex-col items-start gap-0", active && "font-medium")}
                >
                  <span className="flex w-full items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">{role.name}</span>
                    {active ? <Check className="size-4 text-primary" aria-label="Current" /> : null}
                  </span>
                  {role.description ? (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {role.description}
                    </span>
                  ) : null}
                </DropdownMenuItem>
              );
            })}
            {current ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => choose(null)}>
                  <EyeOff className="size-4" />
                  Stop, back to being {actualRoleName}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
