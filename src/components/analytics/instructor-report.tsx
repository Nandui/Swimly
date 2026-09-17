"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { ATTENDANCE_REPORT_META } from "@/lib/analytics/reports";
import type { InstructorAnalyticsData } from "@/lib/analytics/report-data";
import { formatTimeRange } from "@/lib/courses/constants";
import { formatDate, formatDateTime, parseDateOnly } from "@/lib/format";
import { AnalyticsNav } from "./navigation";
import { AnalyticsRefresh } from "./refresh";
import { ReportUpdated, weekLabel } from "./period";

const filters = [{ id: "all", label: "All classes" }, { id: "outstanding", label: "Needs attendance" }, { id: "saved", label: "Saved" }, { id: "upcoming", label: "Upcoming" }] as const;

export function InstructorReport({ data }: { data: InstructorAnalyticsData }) {
  const [search, setSearch] = useState("");
  const [instructor, setInstructor] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const groups = data.instructors.filter(person => person.name.toLowerCase().includes(search.trim().toLowerCase()));
  const selected = data.instructors.find(person => person.id === instructor);
  const classes = data.classes.filter(row => (!instructor || row.instructorKey === instructor)
    && (filter === "all" || (filter === "outstanding" ? row.status === "missing" || row.status === "partial" : row.status === filter)));
  return <div className="flex min-w-0 flex-col gap-6">
    <PageHeader title="Instructor attendance" description={`${data.siteName} · This week, Monday–Sunday · ${weekLabel(data.period)}`} actions={<AnalyticsRefresh />} />
    <AnalyticsNav active="instructors" />
    <dl className="grid grid-cols-2 gap-6 border-b border-ui-border pb-6 lg:grid-cols-4">
      {[{ label: "Classes finished", value: data.totals.due }, { label: "Attendance saved", value: data.totals.saved }, { label: "Partly recorded", value: data.totals.partial }, { label: "Not taken", value: data.totals.missing }].map(item => <div key={item.label} className="space-y-2"><dt className="text-sm text-ui-muted-foreground">{item.label}</dt><dd className="text-4xl font-semibold tabular-nums">{item.value}</dd></div>)}
    </dl>
    <section className="min-w-0 space-y-3" aria-labelledby="instructor-summary">
      <h2 id="instructor-summary" className="text-xl font-semibold">This week by instructor</h2>
      <p className="text-sm text-ui-muted-foreground">Finished classes with swimmers only. Cover belongs to the instructor who started the class. Attendance can be saved by a colleague.</p>
      <Input aria-label="Find an instructor" placeholder="Find an instructor…" className="min-h-11" value={search} onChange={event => setSearch(event.target.value)} />
      <div className="min-w-0 overflow-hidden rounded-ui-lg border border-ui-border">
        <Table className="table-fixed">
          <TableHeader className="bg-ui-muted"><TableRow><TableHead scope="col" className="w-1/2">Instructor</TableHead><TableHead scope="col" className="whitespace-normal text-right">Saved / due</TableHead><TableHead scope="col" className="whitespace-normal text-right">Needs attendance</TableHead></TableRow></TableHeader>
          <TableBody>{groups.map(person => <TableRow key={person.id} data-state={instructor === person.id ? "selected" : undefined}>
            <TableHead scope="row" className="max-w-0 whitespace-normal py-3 font-normal">
              <Button variant="link" className="min-h-11 max-w-full justify-start whitespace-normal px-0 text-left font-semibold" aria-pressed={instructor === person.id} onClick={() => { setInstructor(instructor === person.id ? null : person.id); requestAnimationFrame(() => document.getElementById("class-detail")?.focus()); }}>{person.name}</Button>
              <p className="text-xs leading-relaxed text-ui-muted-foreground">{[
                person.upcoming ? `${person.upcoming} upcoming` : null,
                person.inProgress ? `${person.inProgress} in progress` : null,
                person.cancelled ? `${person.cancelled} cancelled` : null,
                person.empty ? `${person.empty} empty` : null,
              ].filter(Boolean).join(" · ")}</p>
            </TableHead>
            <TableCell className="text-right tabular-nums">{person.saved} / {person.due}</TableCell>
            <TableCell className="text-right tabular-nums"><span className="font-semibold">{person.missing + person.partial}</span>{person.partial ? <span className="block text-xs text-ui-muted-foreground">{person.partial} partial</span> : null}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
        {groups.length === 0 ? <p role="status" className="p-6 text-sm text-ui-muted-foreground">{search ? "No instructors match your search." : "No weekly classes are scheduled at this site this week."}</p> : null}
      </div>
    </section>
    <section className="min-w-0 space-y-4" aria-labelledby="class-detail">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="class-detail" tabIndex={-1} className="rounded-ui-md text-xl font-semibold focus-visible:outline-2 focus-visible:outline-ui-ring">{selected ? `${selected.name}’s classes` : "Class details"}</h2>{selected ? <Button variant="outline" className="min-h-11" onClick={() => setInstructor(null)}>Show all instructors</Button> : null}</div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter class attendance">
        {filters.map(item => <Button key={item.id} variant={filter === item.id ? "default" : "outline"} className="min-h-11" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</Button>)}
      </div>
      <p role="status" className="text-sm text-ui-muted-foreground">{classes.length} {classes.length === 1 ? "class" : "classes"}{selected ? ` for ${selected.name}` : " this week"}</p>
      <div className="min-w-0 overflow-hidden rounded-ui-lg border border-ui-border">
        <Table className="table-fixed">
          <TableHeader className="bg-ui-muted"><TableRow><TableHead scope="col" className="w-1/2 md:w-2/5">Class & instructor</TableHead><TableHead scope="col">Attendance</TableHead><TableHead scope="col" className="hidden md:table-cell">Saved by</TableHead></TableRow></TableHeader>
          <TableBody>{classes.map(row => {
            const meta = ATTENDANCE_REPORT_META[row.status];
            const saved = row.savedBy.length ? row.savedBy.join(", ") : "No attendance saved";
            return <TableRow key={`${row.courseId}:${row.date}`}>
              <TableHead scope="row" className="max-w-0 whitespace-normal py-4 font-normal">
                <p className="text-xs text-ui-muted-foreground">{formatDate(parseDateOnly(row.date))} · {formatTimeRange(row)}</p>
                {data.canOpenClasses ? <Button asChild variant="link" className="min-h-11 max-w-full justify-start whitespace-normal px-0 text-left font-semibold"><Link href={`/courses/${row.courseId}`}>{row.className}</Link></Button> : <p className="my-2 font-semibold">{row.className}</p>}
                <p className="text-sm">{row.instructorName}</p>
                {row.scheduledName !== row.instructorName ? <p className="mt-1 text-xs text-ui-muted-foreground">Cover for {row.scheduledName}</p> : null}
                {row.location ? <p className="mt-1 text-xs text-ui-muted-foreground">{row.location}</p> : null}
              </TableHead>
              <TableCell className="max-w-0 whitespace-normal py-4 align-top"><Tag color={meta.color}>{meta.label}</Tag>
                <p className="mt-2 text-sm tabular-nums">{row.marked} / {row.expected} marked</p>
                {row.marked > 0 ? <p className="mt-1 text-xs leading-relaxed text-ui-muted-foreground">{row.present} present · {row.late} late · {row.absent} absent</p> : null}
                <p className="mt-2 break-words text-xs text-ui-muted-foreground md:hidden">{saved}{row.lastSavedAt ? ` · ${formatDateTime(new Date(row.lastSavedAt))}` : ""}</p>
              </TableCell>
              <TableCell className="hidden max-w-0 whitespace-normal py-4 align-top md:table-cell"><p className="break-words text-sm">{saved}</p>{row.lastSavedAt ? <p className="mt-1 text-xs text-ui-muted-foreground">Last updated {formatDateTime(new Date(row.lastSavedAt))}</p> : null}</TableCell>
            </TableRow>;
          })}</TableBody>
        </Table>
        {classes.length === 0 ? <p className="p-6 text-sm text-ui-muted-foreground">No classes match this selection.</p> : null}
      </div>
    </section>
    <footer className="space-y-2 text-xs leading-relaxed text-ui-muted-foreground">
      <p>Attendance is due after the class finishes in Europe/Dublin. Cancelled classes and classes with no swimmers are excluded from completion totals. Saved means every swimmer on the dated roster has a recorded mark, including absent marks. Starting a class alone does not save attendance.</p>
      <p>Schedules and unstarted instructor assignments use the current timetable. Saved by shows the staff named on the latest attendance records, which can include corrections by colleagues.</p>
      <ReportUpdated at={data.updatedAt} />
    </footer>
  </div>;
}
