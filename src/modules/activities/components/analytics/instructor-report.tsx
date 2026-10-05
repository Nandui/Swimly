"use client";

import { EmptyState } from "@/components/ui-kit/empty-state";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/shadcn/button";
import { CheckCheck, CircleCheck, ClipboardList, TriangleAlert } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn/tabs";
import { SearchField } from "@/components/ui-kit/search-field";
import { StatTile } from "./stat-tile";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { ATTENDANCE_REPORT_META } from "@/modules/activities/lib/analytics/reports";
import type { InstructorAnalyticsData } from "@/modules/activities/lib/analytics/report-data";
import { classTimes } from "@/modules/activities/lib/courses/constants";
import { formatCount, formatDateTime, formatShortDay, plural } from "@/lib/format";
import { AnalyticsNav } from "./navigation";
import { AnalyticsRefresh } from "./refresh";
import { ReportUpdated, weekLabel } from "./period";

const filters = [{ id: "all", label: "All classes" }, { id: "outstanding", label: "Needs attendance" }, { id: "saved", label: "Saved" }, { id: "upcoming", label: "Upcoming" }] as const;

function matches(status: string, filter: string) {
  return filter === "all" || (filter === "outstanding" ? status === "missing" || status === "partial" : status === filter);
}

export function InstructorReport({ data }: { data: InstructorAnalyticsData }) {
  const [search, setSearch] = useState("");
  const [instructor, setInstructor] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const groups = data.instructors.filter(person => person.name.toLowerCase().includes(search.trim().toLowerCase()));
  const selected = data.instructors.find(person => person.id === instructor);
  const scoped = data.classes.filter(row => !instructor || row.instructorKey === instructor);
  const classes = scoped.filter(row => matches(row.status, filter));
  return <div className="flex min-w-0 flex-col gap-6">
    <PageHeader title="Instructor attendance" description={`${data.siteName} · This week, Monday to Sunday · ${weekLabel(data.period)}`} actions={<AnalyticsRefresh />} />
    <AnalyticsNav active="instructors" />
    <ul className="pc-stats" aria-label="Attendance at a glance">
      <StatTile icon={CheckCheck} value={formatCount(data.totals.due)} label="Classes finished" caption="This week" />
      <StatTile icon={CircleCheck} value={formatCount(data.totals.saved)} label="Attendance saved" caption={`Of ${formatCount(data.totals.due)} due`} />
      <StatTile icon={ClipboardList} value={formatCount(data.totals.partial)} label="Partly recorded" caption="Some swimmers unmarked" />
      <StatTile icon={TriangleAlert} value={formatCount(data.totals.missing)} label="Not taken" caption={data.totals.missing ? <Tag meta={ATTENDANCE_REPORT_META.missing} label="Needs attendance" /> : "Nothing outstanding"} />
    </ul>
    <section className="pc-panel" aria-labelledby="instructor-summary">
      <div className="pc-panel-head"><h2 id="instructor-summary">This week by instructor</h2></div>
      <p className="text-xs text-ui-muted-foreground">Finished classes with swimmers only. Cover belongs to the instructor who started the class. Attendance can be saved by a colleague.</p>
      <SearchField label="Find an instructor" placeholder="Name" value={search} onValueChange={setSearch} className="sm:max-w-md" />
      <div className="min-w-0">
        <Table>
          <TableHeader><TableRow><TableHead scope="col">Instructor</TableHead><TableHead scope="col" className="whitespace-normal text-right">Saved of due</TableHead><TableHead scope="col" className="whitespace-normal text-right">Needs attendance</TableHead></TableRow></TableHeader>
          <TableBody>{groups.map(person => <TableRow key={person.id} data-state={instructor === person.id ? "selected" : undefined}>
            <TableHead scope="row" className="whitespace-normal">
              <Button variant="link" className="min-h-11 max-w-full justify-start whitespace-normal px-0 text-left font-semibold" aria-pressed={instructor === person.id} onClick={() => { setInstructor(instructor === person.id ? null : person.id); requestAnimationFrame(() => document.getElementById("class-detail")?.focus()); }}>{person.name}</Button>
              <p className="text-xs text-ui-muted-foreground">{[
                person.upcoming ? `${person.upcoming} upcoming` : null,
                person.inProgress ? `${person.inProgress} in progress` : null,
                person.cancelled ? `${person.cancelled} cancelled` : null,
                person.empty ? `${person.empty} empty` : null,
              ].filter(Boolean).join(" · ")}</p>
            </TableHead>
            <TableCell className="text-right tabular-nums">{person.saved} of {person.due}</TableCell>
            <TableCell className="text-right tabular-nums"><span className="font-semibold">{person.missing + person.partial}</span>{person.partial ? <span className="block text-xs text-ui-muted-foreground">{person.partial} partial</span> : null}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
        {groups.length === 0 ? <EmptyState role="status" compact title={search ? "No instructors match your search." : "No weekly classes are scheduled at this site this week."} /> : null}
      </div>
    </section>
    <section className="pc-panel" aria-labelledby="class-detail">
      <div className="pc-panel-head"><h2 id="class-detail" tabIndex={-1} className="rounded-ui-md focus-visible:outline-2 focus-visible:outline-ui-ring">{selected ? `${selected.name}’s classes` : "Class details"}</h2>{selected ? <Button variant="outline" onClick={() => setInstructor(null)}>Show all instructors</Button> : null}</div>
      <Tabs value={filter} onValueChange={setFilter} className="gap-3">
        <TabsList aria-label="Filter class attendance">
          {filters.map(item => <TabsTrigger key={item.id} value={item.id}>{item.label} <span className="pc-seg-count tabular-nums">{scoped.filter(row => matches(row.status, item.id)).length}</span></TabsTrigger>)}
        </TabsList>
        <TabsContent value={filter} className="m-0 flex min-w-0 flex-col gap-3">
          <p role="status" className="text-xs text-ui-muted-foreground">{plural(classes.length, "class", "classes")}{selected ? ` for ${selected.name}` : " this week"}</p>
          <Table>
            <TableHeader><TableRow><TableHead scope="col">Class and instructor</TableHead><TableHead scope="col">Attendance</TableHead></TableRow></TableHeader>
            <TableBody>{classes.map(row => {
              const meta = ATTENDANCE_REPORT_META[row.status];
              const saved = row.savedBy.length ? `Saved by ${row.savedBy.join(", ")}` : "No attendance saved";
              return <TableRow key={`${row.courseId}:${row.date}`}>
                <TableHead scope="row" className="whitespace-normal align-top">
                  <p className="text-xs text-ui-muted-foreground">{formatShortDay(row.date)} · {classTimes(row)}</p>
                  {data.canOpenClasses ? <Button asChild variant="link" className="min-h-11 max-w-full justify-start whitespace-normal px-0 text-left font-semibold"><Link href={`/courses/${row.courseId}`}>{row.className}</Link></Button> : <p className="my-2 font-semibold">{row.className}</p>}
                  <p className="text-xs text-ui-muted-foreground">{[row.instructorName, row.scheduledName !== row.instructorName ? `Cover for ${row.scheduledName}` : null, row.location].filter(Boolean).join(" · ")}</p>
                </TableHead>
                <TableCell className="whitespace-normal align-top"><Tag meta={meta} />
                  <p className="mt-2 text-xs tabular-nums text-ui-muted-foreground">{row.marked} of {row.expected} marked{row.marked > 0 ? ` · ${row.present} present · ${row.late} late · ${row.absent} absent` : ""}</p>
                  <p className="mt-1 break-words text-xs text-ui-muted-foreground">{saved}{row.lastSavedAt ? ` · ${formatDateTime(new Date(row.lastSavedAt))}` : ""}</p>
                </TableCell>
              </TableRow>;
            })}</TableBody>
          </Table>
          {classes.length === 0 ? <EmptyState compact title="No classes match this selection." /> : null}
        </TabsContent>
      </Tabs>
    </section>
    <footer className="max-w-prose space-y-2 text-xs text-ui-muted-foreground">
      <p>Attendance is due after the class finishes in Europe/Dublin. Cancelled classes and classes with no swimmers are excluded from completion totals. Saved means every swimmer on the dated roster has a recorded mark, including absent marks. Starting a class alone does not save attendance.</p>
      <p>Schedules and unstarted instructor assignments use the current timetable. Saved by shows the staff named on the latest attendance records, which can include corrections by colleagues.</p>
      <ReportUpdated at={data.updatedAt} />
    </footer>
  </div>;
}
