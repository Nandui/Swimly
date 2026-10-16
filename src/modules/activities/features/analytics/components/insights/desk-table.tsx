"use client";

import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { SearchField } from "@/components/ui-kit/search-field";
import { SegmentedChoice } from "@/components/ui-kit/segmented-links";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import type { DeskInsights } from "@/modules/activities/features/analytics/server/desk-data";
import { Meter } from "@/modules/activities/features/analytics/components/insights/meter";
import { duration } from "@/modules/activities/features/analytics/components/insights/desk-kit";

type Person = DeskInsights["desk"]["people"][number];

const sorts = [
  { value: "actions", label: "Work done", by: (p: Person) => -p.actions },
  { value: "perDay", label: "Per day", by: (p: Person) => -(p.perDay ?? -1) },
  { value: "onTime", label: "On time", by: (p: Person) => p.onTime ?? 999 },
  { value: "quality", label: "Records", by: (p: Person) => -(p.missingDetails ?? -1) },
] as const;

const one = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

export function DeskTable({ people, teamOnTime, query }: { people: Person[]; teamOnTime: number | null; query: string }) {
  const [sort, setSort] = useState("actions");
  const [search, setSearch] = useState("");
  const by = sorts.find(s => s.value === sort)!.by;
  const shown = people.filter(p => p.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => by(a) - by(b) || a.name.localeCompare(b.name));
  return <div className="flex min-w-0 flex-col gap-3">
    <div className="flex flex-wrap items-end gap-3">
      <SearchField label="Find a person" placeholder="Name" value={search} onValueChange={setSearch} className="grow basis-(--pc-field-min)" />
      <SegmentedChoice aria-label="Sort people by" value={sort} onValueChange={setSort} options={sorts.map(s => ({ value: s.value, label: s.label }))} />
    </div>
    <div className="ins-table-wrap"><Table>
      <TableHeader><TableRow>
        <TableHead scope="col">Person</TableHead>
        <TableHead scope="col" className="text-right">Work done</TableHead>
        <TableHead scope="col" className="text-right">Timed jobs</TableHead>
        <TableHead scope="col" className="text-right">On time</TableHead>
        <TableHead scope="col" className="text-right">New swimmers</TableHead>
        <TableHead scope="col" className="text-right">Unenrols</TableHead>
        <TableHead scope="col" className="text-right">Follow-ups</TableHead>
        <TableHead scope="col" className="text-right">Undone in a day</TableHead>
      </TableRow></TableHeader>
      <TableBody>{shown.map(p => <TableRow key={p.key}>
        <TableHead scope="row" className="min-w-44 whitespace-normal">
          <Link href={`/analytics/reception/${encodeURIComponent(p.key)}${query}`} className="inline-flex min-h-11 items-center font-semibold text-ui-primary hover:underline focus-visible:outline-2 focus-visible:outline-ui-ring">{p.name}</Link>
          <span className="ins-muted block">{p.kinds.slice(0, 3).map(k => `${k.count} ${k.label.toLowerCase()}`).join(" · ") || "Timed jobs only"}</span>
        </TableHead>
        <TableCell className="ins-num">{p.actions}<span className="ins-muted block">{p.perDay !== null ? `${one.format(p.perDay)} a day · ${p.days} ${p.days === 1 ? "day" : "days"}` : "—"}</span><span className="ins-muted block">{p.share !== null ? `${whole.format(p.share)}% of the desk` : ""}</span></TableCell>
        <TableCell className="ins-num">{p.jobsDone}<span className="ins-muted block">{p.median !== null ? `typically ${duration(p.median)}` : "—"}</span></TableCell>
        <TableCell className="ins-num"><Meter value={p.onTime} tone={p.onTime !== null && teamOnTime !== null && p.onTime < teamOnTime - 10 ? "warn" : undefined} /></TableCell>
        <TableCell className="ins-num">{p.added}<span className="ins-muted block">{p.missingDetails !== null ? `${whole.format(p.missingDetails)}% missing details` : "—"}</span></TableCell>
        <TableCell className="ins-num">{p.unenrols}<span className="ins-muted block">{p.noReason !== null ? `${whole.format(p.noReason)}% no reason` : "—"}</span></TableCell>
        <TableCell className="ins-num">{p.followUps}<span className="ins-muted block">{p.booked ? `${p.booked} assessments booked` : "—"}</span></TableCell>
        <TableCell className="ins-num"><span className={p.corrections ? "font-semibold text-ui-destructive" : undefined}>{p.corrections}</span></TableCell>
      </TableRow>)}</TableBody>
    </Table></div>
    {shown.length === 0 ? <EmptyState compact title={search ? "Nobody matches your search" : "No desk work recorded in this period"} /> : null}
  </div>;
}
