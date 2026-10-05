"use client";

import { useTransition } from "react";
import { Building2, ChevronDown, Loader2 } from "lucide-react";
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
        else toast.success(`Now working at ${clubs.find(option => option.id === id)?.name ?? "the selected site"}`);
      } catch { toast.error("Could not switch sites. Check the site and try again."); }
    });
  }
  // The site's name leads the accessible name, so speech users can say what they see. On phones
  // the frame shows only the building icon (poolside.css, .tf-tools). Someone with one site still
  // opens it, to see which site that is.
  return <DropdownMenu><DropdownMenuTrigger asChild>
    <Button variant="outline" className={cn("w-full min-w-0 justify-start", touchTargets && "min-h-11")} disabled={pending} aria-label={`${club.name}, change site`} title={club.name}>
      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Building2 aria-hidden="true" />}<span className="min-w-0 truncate">{pending ? "Switching…" : club.name}</span><ChevronDown className="ml-auto" aria-hidden="true" />
    </Button>
  </DropdownMenuTrigger><DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-2rem)]">
    <DropdownMenuLabel>Working site</DropdownMenuLabel><DropdownMenuRadioGroup value={club.id} onValueChange={choose}>
      {clubs.map(option => <DropdownMenuRadioItem key={option.id} value={option.id} className={touchTargets ? "min-h-11" : undefined}>{option.name}</DropdownMenuRadioItem>)}
    </DropdownMenuRadioGroup>
  </DropdownMenuContent></DropdownMenu>;
}
