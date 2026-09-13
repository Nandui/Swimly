"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, UserRound } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { useSidebar } from "@/components/shadcn/sidebar";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/shadcn/command";
import { searchStudents, type StudentHit } from "@/lib/students/actions/search";
import { ageLabel, fullName } from "@/lib/students/constants";

/** Debounced server search; only the latest query may publish its results. */
export function WorkspaceSearch({ onSelect }: { onSelect: (hit: StudentHit) => void }) {
  const { setOpenMobile } = useSidebar();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<StudentHit[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  function changeQuery(next: string) {
    generation.current++;
    setQuery(next); setHits([]); setError(null); setPending(Boolean(next.trim()));
  }
  function changeOpen(next: boolean) { setOpen(next); if (!next) changeQuery(""); }
  useEffect(() => {
    if (!open || !query.trim()) return;
    const request = generation.current;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const results = await searchStudents(query.trim(), [], true);
        if (!cancelled && request === generation.current) setHits(results);
      } catch {
        if (!cancelled && request === generation.current) setError("Could not search swimmers. Check your connection and try again.");
      } finally { if (!cancelled && request === generation.current) setPending(false); }
    }, 200);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [open, query]);
  return <CommandDialog open={open} onOpenChange={changeOpen} title="Find swimmer" description="Search by name or member number, including inactive swimmers." shouldFilter={false}
    trigger={<Button variant="outline" className="h-11 w-full justify-start font-normal text-ui-muted-foreground group-data-[collapsible=icon]:size-11 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0" aria-label="Find swimmer" title="Find swimmer"><Search aria-hidden="true" /><span className="group-data-[collapsible=icon]:hidden">Find swimmer</span></Button>}>
      <CommandInput value={query} onValueChange={changeQuery} aria-label="Search swimmers" placeholder="Name or member number…" />
      <CommandList aria-busy={pending}>
        {!query.trim() ? <CommandEmpty>Start typing a name or member number.</CommandEmpty> : pending ? <div role="status" className="flex items-center justify-center gap-2 p-6 text-sm text-ui-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Searching…</div> : error ? <div role="alert" className="p-6 text-sm text-ui-destructive">{error}</div> : hits.length === 0 ? <CommandEmpty>No swimmers found.</CommandEmpty> : null}
        {hits.length ? <CommandGroup heading="Swimmers">{hits.map(hit => <CommandItem key={hit.id} value={hit.id} onSelect={() => { changeOpen(false); setOpenMobile(false); onSelect(hit); }}>
          <UserRound aria-hidden="true" /><span><span className="block font-medium">{fullName(hit)}</span><span className="block text-xs text-ui-muted-foreground">{ageLabel(hit.dateOfBirth)}{hit.memberNumber ? ` · ${hit.memberNumber}` : ""}{hit.status === "INACTIVE" ? " · Inactive" : ""}</span></span>
        </CommandItem>)}</CommandGroup> : null}
      </CommandList>
    </CommandDialog>;
}
