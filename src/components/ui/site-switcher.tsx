"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, ChevronDown } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";

type Site = { id: string; name: string };

/** A module's site in the frame's tools (Rota, Tasks), in the same markup as the working-site
 *  picker (ClubSwitcher). It is a filter on the module's one-site pages, not the working site:
 *  choosing one changes only `?site=`, so the week or the date stays; `clear` names the other
 *  parameters that belong to one site. With no `?site=` it shows `fallback` (the page's own
 *  default, such as the working site), else the first site. On phones the frame
 *  shows only the building (poolside.css, .tf-tools). */
export function SiteSwitcher({ sites, label, clear = [], fallback }: { sites: Site[]; label: string; clear?: string[]; fallback?: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = sites.find((s) => s.id === params.get("site")) ?? sites.find((s) => s.id === fallback) ?? sites[0];
  if (!current) return null;
  function choose(id: string) {
    if (id === current.id) return;
    const next = new URLSearchParams(params.toString());
    next.set("site", id);
    for (const key of clear) next.delete(key);
    router.push(`${pathname}?${next}`);
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full min-w-0 justify-start" disabled={sites.length < 2} aria-label={`${label}: ${current.name}. Change site`} title={current.name}>
          <Building2 aria-hidden="true" /><span className="min-w-0 truncate">{current.name}</span><ChevronDown className="ml-auto" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-w-(--pc-overlay-max-width)">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={current.id} onValueChange={choose}>
          {sites.map((s) => <DropdownMenuRadioItem key={s.id} value={s.id}>{s.name}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
