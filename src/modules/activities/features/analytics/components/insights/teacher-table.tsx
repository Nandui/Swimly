"use client";

import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { SearchField } from "@/components/ui-kit/search-field";
import { SegmentedChoice } from "@/components/ui-kit/segmented-links";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import type { PoolDeckInsights } from "@/modules/activities/features/analytics/server/insights-data";
import { Meter } from "@/modules/activities/features/analytics/components/insights/meter";

type Teacher = PoolDeckInsights["teachers"]["teachers"][number];
type School = PoolDeckInsights["teachers"]["school"];

const sorts = [
  { value: "lessons", label: "Lessons", by: (t: Teacher) => -t.lessons },
  { value: "attendance", label: "Attendance", by: (t: Teacher) => t.attendance ?? 999 },
  { value: "onTime", label: "On time", by: (t: Teacher) => t.onTime ?? 999 },
  { value: "leavers", label: "Leavers", by: (t: Teacher) => -(t.leaverRate ?? -1) },
  { value: "passes", label: "Passes", by: (t: Teacher) => -(t.passRate ?? -1) },
] as const;

const one = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

/** Below the school by this many points reads as a warning. */
const GAP = 10;
const below = (value: number | null, school: number | null) => value !== null && school !== null && value < school - GAP;
const above = (value: number | null, school: number | null) => value !== null && school !== null && value > school + GAP;

export function TeacherTable({ teachers, school, query }: { teachers: Teacher[]; school: School; query: string }) {
  const [sort, setSort] = useState("lessons");
  const [search, setSearch] = useState("");
  const by = sorts.find(s => s.value === sort)!.by;
  const shown = teachers.filter(t => t.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => by(a) - by(b) || a.name.localeCompare(b.name));
  return <div className="flex min-w-0 flex-col gap-3">
    <div className="flex flex-wrap items-end gap-3">
      <SearchField label="Find a teacher" placeholder="Name" value={search} onValueChange={setSearch} className="grow basis-(--pc-field-min)" />
      <SegmentedChoice aria-label="Sort teachers by" value={sort} onValueChange={setSort} options={sorts.map(s => ({ value: s.value, label: s.label }))} />
    </div>
    <div className="ins-table-wrap"><Table>
      <TableHeader><TableRow>
        <TableHead scope="col">Teacher</TableHead>
        <TableHead scope="col" className="text-right">Lessons</TableHead>
        <TableHead scope="col" className="text-right">Swimmers</TableHead>
        <TableHead scope="col" className="text-right">Attendance</TableHead>
        <TableHead scope="col" className="text-right">On time</TableHead>
        <TableHead scope="col" className="text-right">Registers</TableHead>
        <TableHead scope="col" className="text-right">Skills ticked</TableHead>
        <TableHead scope="col" className="text-right">Passes</TableHead>
        <TableHead scope="col" className="text-right">Left after</TableHead>
      </TableRow></TableHeader>
      <TableBody>{shown.map(t => <TableRow key={t.key}>
        <TableHead scope="row" className="min-w-44 whitespace-normal">
          <Link href={`/analytics/teachers/${encodeURIComponent(t.key)}${query}`} className="inline-flex min-h-11 items-center font-semibold text-ui-primary hover:underline focus-visible:outline-2 focus-visible:outline-ui-ring">{t.name}</Link>
          <span className="ins-muted block">{[`${one.format(t.hours)} h on deck`, t.cover ? `${t.cover} cover` : null, t.missedStarts ? `${t.missedStarts} not started` : null].filter(Boolean).join(" · ")}</span>
        </TableHead>
        <TableCell className="ins-num">{t.lessons}<span className="ins-muted block">{t.classes} classes</span></TableCell>
        <TableCell className="ins-num">{t.swimmers}</TableCell>
        <TableCell className="ins-num"><Meter value={t.attendance} tone={below(t.attendance, school.attendance) ? "warn" : undefined} /></TableCell>
        <TableCell className="ins-num"><Meter value={t.onTime} tone={below(t.onTime, school.onTime) ? "warn" : undefined} />{t.averageLate !== null ? <span className="ins-muted block">late by {whole.format(t.averageLate)} min</span> : null}</TableCell>
        <TableCell className="ins-num"><Meter value={t.registers} tone={below(t.registers, school.registers) ? "warn" : undefined} /></TableCell>
        <TableCell className="ins-num">{t.ticks}<span className="ins-muted block">{t.ticksPerLesson !== null ? `${one.format(t.ticksPerLesson)} a lesson` : "—"}</span></TableCell>
        <TableCell className="ins-num">{t.passes}<span className="ins-muted block">{t.passRate !== null ? `${whole.format(t.passRate)}% of swimmers` : "—"}</span></TableCell>
        <TableCell className="ins-num"><span className={above(t.leaverRate, school.leaverRate) ? "font-semibold text-ui-destructive" : undefined}>{t.leavers}</span><span className="ins-muted block">{t.leaverRate !== null ? `${whole.format(t.leaverRate)}% of swimmers` : "—"}</span></TableCell>
      </TableRow>)}</TableBody>
    </Table></div>
    {shown.length === 0 ? <EmptyState compact title={search ? "No teachers match your search" : "Nobody taught in this period"} /> : null}
  </div>;
}
