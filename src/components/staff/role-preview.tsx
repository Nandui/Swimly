"use client";

import { createContext, useContext, useTransition, type ReactNode } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import { previewRole } from "@/lib/staff/actions/preview";
import { toast } from "@/lib/toast";

type RoleOption = { id: string; name: string; description: string | null };
export type RolePreviewState = { roles: RoleOption[]; current: { id: string; name: string } | null; actualRoleName: string };

/** Set once, by the root layout, only on a dev build for someone who may
 *  manage roles. Every frame's tools bar reads it; no module owns it. */
const RolePreviewContext = createContext<RolePreviewState | null>(null);

export function RolePreviewProvider({ value, children }: { value: RolePreviewState | null; children: ReactNode }) {
  return <RolePreviewContext.Provider value={value}>{children}</RolePreviewContext.Provider>;
}

/** "View as": a small button in the frame's tools bar, beside the account
 *  menu. Renders nothing where previewing is not allowed. */
export function RolePreviewToggle({ compact = false }: { compact?: boolean }) {
  const state = useContext(RolePreviewContext);
  const [pending, startTransition] = useTransition();
  if (!state) return null;
  const { roles, current, actualRoleName } = state;
  function choose(id: string | null) {
    if (id === (current?.id ?? null)) return;
    startTransition(async () => {
      const result = await previewRole(id);
      if (result && !result.ok) toast.error(result.error);
    });
  }
  const label = current ? `Viewing as ${current.name}. Change role` : "View as another role";
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="workspace-preview-toggle" data-active={current ? "true" : undefined} disabled={pending} aria-label={label} title={current ? `Viewing as ${current.name}` : "View as another role"}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent side={compact ? "right" : "bottom"} align={compact ? "start" : "end"} className="w-72 max-w-[calc(100vw-2rem)]">
      <DropdownMenuLabel className="text-sm font-normal text-ui-foreground"><span className="block font-semibold">{current ? `Viewing as ${current.name}` : "See the app as"}</span><span className="block text-xs text-ui-muted-foreground">Dev build. You are {actualRoleName}.</span></DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuRadioGroup value={current?.id ?? ""} onValueChange={choose}>{roles.map(role => <DropdownMenuRadioItem className="min-h-11" value={role.id} key={role.id}><span><span className="block">{role.name}</span>{role.description ? <span className="block text-xs text-ui-muted-foreground">{role.description}</span> : null}</span></DropdownMenuRadioItem>)}</DropdownMenuRadioGroup>
      {current ? <><DropdownMenuSeparator /><DropdownMenuItem className="min-h-11" onSelect={() => choose(null)}><EyeOff aria-hidden="true" />Stop, back to being {actualRoleName}</DropdownMenuItem></> : null}
    </DropdownMenuContent>
  </DropdownMenu>;
}
