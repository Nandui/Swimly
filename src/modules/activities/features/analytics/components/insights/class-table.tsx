"use client";

import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { SearchField } from "@/components/ui-kit/search-field";
import { SegmentedChoice } from "@/components/ui-kit/segmented-links";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { formatCount, plural } from "@/lib/format";
import { formatSlotShort } from "@/modules/activities/shared/courses/constants";
import type { ClassRow } from "@/modules/activities/features/analytics/server/insights";
import { Meter } from "@/modules/activities/features/analytics/components/insights/meter";

const views = [
  { value: "all", label: "All" },
  { value: "waiting", label: "Waiting list" },
  { value: "full", label: "Full" },
  { value: "quiet", label: "Under half full" },
  { value: "attendance", label: "Low attendance" },
] as const;

function matches(row: ClassRow, view: string) {
  if (view === "waiting") return row.waiting > 0;
  if (view === "full") return row.fill !== null && row.fill >= 100;
  if (view === "quiet") return row.fill !== null && row.fill < 50;
  if (view === "attendance") return row.attendance !== null && row.attendance < 75;
  return true;
}

/** Every class with its fill, waiting list, attendance and movement; each
 *  opens its own page. Filtered live, here in the browser. */
export function ClassTable({ rows, showSite, query }: { rows: ClassRow[]; showSite: boolean; query: string }) {
  const [view, setView] = useState("all");
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const shown = rows.filter(r => matches(r, view) && (!term || `${r.name} ${r.levelName} ${r.programmeName} ${r.teachers.map(t => t.key).join(" ")}`.toLowerCase().includes(term)));
  return <div className="flex min-w-0 flex-col gap-3">
    <div className="flex flex-wrap items-end gap-3">
      <SearchField label="Find a class" placeholder="Level, class or teacher" value={search} onValueChange={setSearch} className="grow basis-(--field-min)" />
      <SegmentedChoice aria-label="Show classes" value={view} onValueChange={setView} options={views.map(v => ({ value: v.value, label: v.label, count: rows.filter(r => matches(r, v.value)).length }))} />
    </div>
    <p role="status" className="ins-muted">{plural(shown.length, "class", "classes")}</p>
    <div className="ins-table-wrap">
      <Table>
        <TableHeader><TableRow>
          <TableHead scope="col">Class</TableHead>
          <TableHead scope="col" className="text-right">Places</TableHead>
          <TableHead scope="col" className="text-right">Waiting</TableHead>
          <TableHead scope="col" className="text-right">Attendance</TableHead>
          <TableHead scope="col" className="text-right">Joined · left</TableHead>
          <TableHead scope="col">Taught by</TableHead>
        </TableRow></TableHeader>
        <TableBody>{shown.map(r => <TableRow key={r.id}>
          <TableHead scope="row" className="whitespace-normal">
            <Link href={`/analytics/classes/${r.id}${query}`} className="inline-flex min-h-11 items-center font-semibold text-ui-primary hover:underline focus-visible:outline-2 focus-visible:outline-ui-ring">{r.name} · {formatSlotShort(r)}</Link>
            <p className="ins-muted">{[r.programmeName, showSite ? r.siteName : null, r.location].filter(Boolean).join(" · ")}</p>
          </TableHead>
          <TableCell className="ins-num">
            <span className="block font-semibold">{formatCount(r.enrolled)}{r.capacity !== null ? ` of ${formatCount(r.capacity)}` : ""}</span>
            {r.capacity !== null ? <Meter value={r.fill} /> : <span className="ins-muted">No limit</span>}
          </TableCell>
          <TableCell className="ins-num">{r.waiting ? <span className="font-semibold">{r.waiting}</span> : <span className="ins-muted">0</span>}</TableCell>
          <TableCell className="ins-num"><Meter value={r.attendance} tone={r.attendance !== null && r.attendance < 75 ? "warn" : undefined} /><span className="ins-muted block">{plural(r.lessons, "lesson")}{r.cancelled ? ` · ${r.cancelled} cancelled` : ""}</span></TableCell>
          <TableCell className="ins-num">+{r.joined} · −{r.left}{r.movedOut ? <span className="ins-muted block">{r.movedOut} moved on</span> : null}</TableCell>
          <TableCell className="whitespace-normal">{r.teachers.length ? r.teachers.slice(0, 2).map(t => <span key={t.key} className="block">{t.key} <span className="ins-muted">· {t.count}</span></span>) : <span className="ins-muted">No lessons yet</span>}</TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </div>
    {shown.length === 0 ? <EmptyState compact title="No classes match" hint="Choose All or clear the search." /> : null}
  </div>;
}
