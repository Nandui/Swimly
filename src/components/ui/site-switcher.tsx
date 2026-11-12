"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";

type Site = { id: string; name: string };

/** A module's site in the frame's tools (Rota, Tasks), in the same markup as the working-site
 *  picker (ClubSwitcher). It is a filter on the module's one-site pages, not the working site:
 *  choosing one changes only `?site=`, so the week or the date stays; `clear` names the other
 *  parameters that belong to one site. `remember` keeps the choice for the app (a cookie its
 *  pages read when they open without `?site=`), so it holds across pages and visits. With no
 *  `?site=` it shows `fallback` (the page's own default: the remembered site, else such as the
 *  working site), else the first site. On phones the frame shows only the building (kit.css,
 *  .tf-tools). */
export function SiteSwitcher({ sites, label, clear = [], fallback, remember }: { sites: Site[]; label: string; clear?: string[]; fallback?: string | null; remember?: (siteId: string) => Promise<unknown> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const current = sites.find((s) => s.id === params.get("site")) ?? sites.find((s) => s.id === fallback) ?? sites[0];
  if (!current) return null;
  function choose(id: string) {
    if (id === current.id) return;
    const next = new URLSearchParams(params.toString());
    next.set("site", id);
    for (const key of clear) next.delete(key);
    // Remembered first, so the pages it opens next (and this one's links) are drawn for it. The
    // site still changes when remembering fails: it is only a preference.
    startTransition(async () => {
      try { await remember?.(id); } catch { /* the choice still shows, from `?site=` */ }
      router.push(`${pathname}?${next}`);
    });
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full min-w-0 justify-start" disabled={sites.length < 2 || pending} aria-label={`${label}: ${current.name}. Change site`} title={current.name}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Building2 aria-hidden="true" />}<span className="min-w-0 truncate">{current.name}</span><ChevronDown className="ml-auto" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-w-(--overlay-max-width)">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={current.id} onValueChange={choose}>
          {sites.map((s) => <DropdownMenuRadioItem key={s.id} value={s.id}>{s.name}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
