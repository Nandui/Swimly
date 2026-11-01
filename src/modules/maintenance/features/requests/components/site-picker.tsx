"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";

const ALL = "all";

/** Narrow the list to one site, for people who cover more than one. Applies on change. */
export function SitePicker({ sites, value, show }: { sites: { id: string; name: string }[]; value: string; show: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const chosen = sites.find((s) => s.id === value)?.name ?? "All sites";
  const pick = (site: string) => start(() => router.push(`/maintenance?${new URLSearchParams({ show, ...(site === ALL ? {} : { site }) })}`, { scroll: false }));
  return (
    <Select value={value || ALL} onValueChange={pick} disabled={pending}>
      <SelectTrigger aria-label={`Site: ${chosen}`} className="max-w-full min-w-0 gap-1.5">
        <span className="text-ui-muted-foreground">Site</span><SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All sites</SelectItem>
        {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
