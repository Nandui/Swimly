"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, ChevronDown } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";

type Site = { id: string; name: string };

/** The rota site in the frame's tools, in the same markup as the working-site picker
 *  (ClubSwitcher). It is a filter on these pages, not the working site: choosing one changes
 *  only `?site=`, so the week and the date stay. The first site is the default, as in
 *  rotaWeek. On phones the frame shows only the building (poolside.css, .tf-tools). */
export function RotaSiteSwitcher({ sites }: { sites: Site[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = sites.find((s) => s.id === params.get("site")) ?? sites[0];
  if (!current) return null;
  function choose(id: string) {
    if (id === current.id) return;
    const next = new URLSearchParams(params.toString());
    next.set("site", id);
    // A department belongs to one site.
    next.delete("dept");
    router.push(`${pathname}?${next}`);
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full min-w-0 justify-start" disabled={sites.length < 2} aria-label={`Rota site: ${current.name}. Change site`} title={current.name}>
          <Building2 aria-hidden="true" /><span className="min-w-0 truncate">{current.name}</span><ChevronDown className="ml-auto" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel>Rota site</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={current.id} onValueChange={choose}>
          {sites.map((s) => <DropdownMenuRadioItem key={s.id} value={s.id}>{s.name}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
