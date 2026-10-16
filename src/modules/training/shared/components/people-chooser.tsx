"use client";

import { useState } from "react";
import { ChevronDown, UsersRound } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import { ChoiceRow } from "@/components/ui/choice-row";
import { SearchField } from "@/components/ui-kit/search-field";

export type ChoosablePerson = { id: string; name: string; jobTitle: string | null; staffRole?: { id: string; name: string } | null };

/** Choosing several people inside a dialog (paths, sessions, hours; phase 5):
 *  a live filter, everyone on a role at once, and a checkbox row each. */
export function PeopleChooser({ idPrefix, people, chosen, onChange, legend = "People" }: {
  idPrefix: string; people: ChoosablePerson[]; chosen: Set<string>; onChange: (next: Set<string>) => void; legend?: string;
}) {
  const [filter, setFilter] = useState("");
  const roles = [...new Map(people.flatMap((p) => (p.staffRole ? [[p.staffRole.id, p.staffRole.name] as const] : []))).entries()]
    .map(([id, name]) => ({ id, name, ids: people.filter((p) => p.staffRole?.id === id).map((p) => p.id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const shown = people.filter((p) => !filter || `${p.name} ${p.jobTitle ?? ""}`.toLowerCase().includes(filter.toLowerCase()));
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-sm font-semibold">{legend} ({chosen.size} chosen)</legend>
      {roles.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className="min-h-11"><UsersRound aria-hidden="true" />Add everyone on a role<ChevronDown aria-hidden="true" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {roles.map((role) => (
              <DropdownMenuItem key={role.id} onSelect={() => onChange(new Set([...chosen, ...role.ids]))}>{role.name} ({role.ids.length})</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {/* A live filter: Enter must not submit the dialog. */}
      <div onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}>
        <SearchField label="Filter people" labelHidden placeholder="Name or job title" value={filter} onValueChange={setFilter} />
      </div>
      <ul className="pc-rows">
        {shown.map((p) => (
          <li key={p.id}>
            <ChoiceRow type="checkbox" id={`${idPrefix}-${p.id}`} title={p.name} hint={p.jobTitle ?? undefined} checked={chosen.has(p.id)}
              onCheckedChange={(on) => { const next = new Set(chosen); if (on) next.add(p.id); else next.delete(p.id); onChange(next); }} />
          </li>
        ))}
        {shown.length === 0 ? <li className="text-sm text-ui-muted-foreground">Nobody matches.</li> : null}
      </ul>
    </fieldset>
  );
}
