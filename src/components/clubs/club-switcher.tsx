"use client";

import { useTransition } from "react";
import { Building2, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import { switchClub } from "@/lib/clubs/actions/clubs";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type Club = { id: string; name: string };
export function ClubSwitcher({ club, clubs, touchTargets = false }: { club: Club; clubs: Club[]; touchTargets?: boolean }) {
  const [pending, startTransition] = useTransition();
  function choose(id: string) {
    if (id === club.id) return;
    startTransition(async () => {
      try {
        const result = await switchClub(id, { stay: true });
        if (result && !result.ok) toast.error(result.error);
        else toast.success(`Working at ${clubs.find(option => option.id === id)?.name ?? "the selected site"}`);
      } catch { toast.error("Could not switch sites. Try again."); }
    });
  }
  return <DropdownMenu><DropdownMenuTrigger asChild>
    <Button variant="outline" className={cn("w-full min-w-0 justify-start", touchTargets && "min-h-11")} disabled={pending || clubs.length < 2} aria-label={`Site: ${club.name}. Switch site`} title={club.name}>
      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Building2 aria-hidden="true" />}<span className="min-w-0 truncate">{pending ? "Switching…" : club.name}</span><ChevronsUpDown className="ml-auto" aria-hidden="true" />
    </Button>
  </DropdownMenuTrigger><DropdownMenuContent align="start" className="w-72 max-w-[calc(100vw-2rem)]">
    <DropdownMenuLabel>Site</DropdownMenuLabel><DropdownMenuRadioGroup value={club.id} onValueChange={choose}>
      {clubs.map(option => <DropdownMenuRadioItem key={option.id} value={option.id} className={touchTargets ? "min-h-11" : undefined}>{option.name}</DropdownMenuRadioItem>)}
    </DropdownMenuRadioGroup>
  </DropdownMenuContent></DropdownMenu>;
}
