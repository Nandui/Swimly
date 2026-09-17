"use client";

import { useState } from "react";
import { Input } from "@/components/shadcn/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { PageHeader } from "@/components/ui-kit/page-header";
import { AnalyticsNav } from "./navigation";
import { AnalyticsRefresh } from "./refresh";
import { ReportUpdated, weekLabel } from "./period";
import type { ReceptionAnalyticsData } from "@/lib/analytics/report-data";
import { formatDate, parseDateOnly } from "@/lib/format";

const number = new Intl.NumberFormat("en-IE");
const weekday = new Intl.DateTimeFormat("en-IE", { weekday: "short", timeZone: "UTC" });

export function ReceptionReport({ data }: { data: ReceptionAnalyticsData }) {
  const [search, setSearch] = useState("");
  const people = data.people.filter(person => person.name.toLowerCase().includes(search.trim().toLowerCase()));
  const enrolled = data.people.reduce((sum, person) => sum + person.enrolled, 0);
  const withdrawn = data.people.reduce((sum, person) => sum + person.withdrawn, 0);
  return <div className="flex min-w-0 flex-col gap-6">
    <PageHeader title="Reception activity" description={`${data.siteName} · This week, Monday–Sunday · ${weekLabel(data.period)}`} actions={<AnalyticsRefresh />} />
    <AnalyticsNav active="reception" />
    <dl className="grid grid-cols-2 gap-6 border-b border-ui-border pb-6">
      <div className="space-y-2"><dt className="text-sm text-ui-muted-foreground">Enrolments this week</dt><dd className="text-4xl font-semibold tabular-nums">{number.format(enrolled)}</dd></div>
      <div className="space-y-2"><dt className="text-sm text-ui-muted-foreground">Unenrolments this week</dt><dd className="text-4xl font-semibold tabular-nums">{number.format(withdrawn)}</dd></div>
    </dl>
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Activity by person</h2>
      <p className="text-sm text-ui-muted-foreground">Staff who recorded enrolments or unenrolments at this site. Open a person’s daily breakdown to see their week.</p>
      <Input aria-label="Find a staff member" placeholder="Find a staff member…" className="min-h-11" value={search} onChange={event => setSearch(event.target.value)} />
      <div className="overflow-hidden rounded-ui-lg border border-ui-border">
        <Table className="table-fixed">
          <TableHeader className="bg-ui-muted"><TableRow><TableHead scope="col" className="w-1/2">Person</TableHead><TableHead scope="col" className="text-right">Enrolled</TableHead><TableHead scope="col" className="text-right">Unenrolled</TableHead></TableRow></TableHeader>
          <TableBody>{people.map(person => <TableRow key={person.id}>
            <TableHead scope="row" className="max-w-0 whitespace-normal py-4 font-normal">
              <p className="break-words font-semibold">{person.name}</p>
              {person.retainedName ? <p className="mt-1 text-xs text-ui-muted-foreground">{person.name === "Scheduled unenrolment" ? "Automatic scheduled withdrawals" : "Recorded name · account unavailable"}</p> : null}
              <details className="mt-1">
                <summary className="flex min-h-11 cursor-pointer items-center rounded-ui-md text-sm text-ui-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ui-ring">Daily breakdown<span className="sr-only"> for {person.name}</span></summary>
                <dl className="space-y-3 pb-2">{person.daily.map(day => <div key={day.day}>
                  <dt className="text-xs text-ui-muted-foreground">{weekday.format(parseDateOnly(day.day))} · {formatDate(parseDateOnly(day.day))}</dt>
                  <dd className="mt-1 text-sm">{day.day > data.period.date ? "Upcoming" : `${number.format(day.enrolled)} enrolled · ${number.format(day.withdrawn)} unenrolled`}</dd>
                </div>)}</dl>
              </details>
            </TableHead>
            <TableCell className="align-top py-4 text-right font-semibold tabular-nums">{number.format(person.enrolled)}</TableCell>
            <TableCell className="align-top py-4 text-right tabular-nums">{number.format(person.withdrawn)}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
        {people.length === 0 ? <p role="status" className="p-6 text-sm text-ui-muted-foreground">{search ? "No staff match your search." : "No enrolments or unenrolments have been recorded at this site this week."}</p> : null}
      </div>
    </div>
    <footer className="space-y-2 text-xs leading-relaxed text-ui-muted-foreground">
      <p>Counts include today so far and reconcile with Overview. They use the person recorded on each action, across all staff roles. Moves, imports and waitlist removals are excluded. Automatic scheduled unenrolments are shown separately when applied; they are not attributed to the staff member who scheduled them.</p>
      <ReportUpdated at={data.updatedAt} />
    </footer>
  </div>;
}
