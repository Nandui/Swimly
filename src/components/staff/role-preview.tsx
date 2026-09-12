"use client";

import { useTransition } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn/alert";
import { Button } from "@/components/shadcn/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import { previewRole } from "@/lib/staff/actions/preview";
import { toast } from "@/lib/toast";

type RoleOption = { id: string; name: string; description: string | null };
export function RolePreviewBar({ roles, current, actualRoleName }: { roles: RoleOption[]; current: { id: string; name: string } | null; actualRoleName: string }) {
  const [pending, startTransition] = useTransition();
  function choose(id: string | null) {
    if (id === (current?.id ?? null)) return;
    startTransition(async () => {
      const result = await previewRole(id);
      if (result && !result.ok) toast.error(result.error);
    });
  }
  return <Alert className="shrink-0 rounded-none border-x-0 border-t-0 bg-ui-muted px-4 py-2">
    <Eye aria-hidden="true" /><div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
      <div><AlertTitle>Dev build</AlertTitle><AlertDescription>{current ? `Seeing the app as ${current.name}. You are ${actualRoleName}.` : `You are ${actualRoleName}. Pick a role to see the app as they would.`}</AlertDescription></div>
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={pending} aria-label={current ? `Viewing as ${current.name}. Change role` : "View as a role"}>{pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Eye aria-hidden="true" />}{pending ? "Switching…" : current?.name ?? "View as"}</Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-2rem)]"><DropdownMenuLabel>See the app as</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={current?.id ?? ""} onValueChange={choose}>{roles.map(role => <DropdownMenuRadioItem value={role.id} key={role.id}><span><span className="block">{role.name}</span>{role.description ? <span className="block text-xs text-ui-muted-foreground">{role.description}</span> : null}</span></DropdownMenuRadioItem>)}</DropdownMenuRadioGroup>
          {current ? <><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => choose(null)}><EyeOff aria-hidden="true" />Stop, back to being {actualRoleName}</DropdownMenuItem></> : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </Alert>;
}
