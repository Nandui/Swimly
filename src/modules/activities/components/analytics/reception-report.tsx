"use client";

import { EmptyState } from "@/components/ui-kit/empty-state";
import { useState } from "react";
import { Button } from "@/components/shadcn/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { UserPlus, UserX } from "lucide-react";
import { SearchField } from "@/components/ui-kit/search-field";
import { StatTile } from "./stat-tile";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { PageHeader } from "@/components/ui-kit/page-header";
import { AnalyticsNav } from "./navigation";
import { AnalyticsRefresh } from "./refresh";
import { ReportUpdated, weekLabel } from "./period";
import type { ReceptionAnalyticsData } from "@/modules/activities/lib/analytics/report-data";
import { formatCount, formatShortDay } from "@/lib/format";

const number = { format: formatCount };

export function ReceptionReport({ data }: { data: ReceptionAnalyticsData }) {
  const [search, setSearch] = useState("");
  const people = data.people.filter(person => person.name.toLowerCase().includes(search.trim().toLowerCase()));
  const enrolled = data.people.reduce((sum, person) => sum + person.enrolled, 0);
  const withdrawn = data.people.reduce((sum, person) => sum + person.withdrawn, 0);
  return <div className="flex min-w-0 flex-col gap-6">
    <PageHeader title="Reception activity" description={`${data.siteName} · This week, Monday to Sunday · ${weekLabel(data.period)}`} actions={<AnalyticsRefresh />} />
    <AnalyticsNav active="reception" />
    <ul className="pc-stats" aria-label="This week at a glance">
      <StatTile icon={UserPlus} value={number.format(enrolled)} label="Enrolments" caption="This week" />
      <StatTile icon={UserX} value={number.format(withdrawn)} label="Unenrolments" caption="This week" />
    </ul>
    <section className="pc-panel" aria-labelledby="activity-by-person">
      <div className="pc-panel-head"><h2 id="activity-by-person">Activity by person</h2></div>
      <p className="text-xs text-ui-muted-foreground">Staff who recorded enrolments or unenrolments at this site. Open a person’s daily breakdown to see their week.</p>
      <SearchField label="Find a staff member" placeholder="Name" value={search} onValueChange={setSearch} className="sm:max-w-md" />
      <div className="min-w-0">
        <Table>
          <TableHeader><TableRow><TableHead scope="col">Person</TableHead><TableHead scope="col" className="text-right">Enrolled</TableHead><TableHead scope="col" className="text-right">Unenrolled</TableHead></TableRow></TableHeader>
          <TableBody>{people.map(person => <TableRow key={person.id}>
            <TableHead scope="row" className="whitespace-normal align-top">
              <p className="break-words font-semibold">{person.name}</p>
              {person.retainedName ? <p className="mt-1 text-xs text-ui-muted-foreground">{person.name === "Scheduled unenrolment" ? "Automatic scheduled withdrawals" : "Recorded name · account unavailable"}</p> : null}
              <Collapsible className="mt-1">
                <CollapsibleTrigger asChild><Button variant="link" className="h-auto min-h-11 justify-start px-0 text-left whitespace-normal underline">Daily breakdown<span className="sr-only"> for {person.name}</span></Button></CollapsibleTrigger>
                <CollapsibleContent><dl className="space-y-3 pb-2">{person.daily.map(day => <div key={day.day}>
                  <dt className="text-xs text-ui-muted-foreground">{formatShortDay(day.day)}</dt>
                  <dd className="mt-1 text-sm">{day.day > data.period.date ? "Upcoming" : `${number.format(day.enrolled)} enrolled · ${number.format(day.withdrawn)} unenrolled`}</dd>
                </div>)}</dl></CollapsibleContent>
              </Collapsible>
            </TableHead>
            <TableCell className="align-top py-4 text-right font-semibold tabular-nums">{number.format(person.enrolled)}</TableCell>
            <TableCell className="align-top py-4 text-right tabular-nums">{number.format(person.withdrawn)}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
        {people.length === 0 ? <EmptyState role="status" compact title={search ? "No staff match your search." : "No enrolments or unenrolments have been recorded at this site this week."} /> : null}
      </div>
    </section>
    <footer className="max-w-prose space-y-2 text-xs text-ui-muted-foreground">
      <p>Counts include today so far and reconcile with Overview. They use the person recorded on each action, across all staff roles. Moves, imports and waitlist removals are excluded. Automatic scheduled unenrolments are shown separately when applied; they are not attributed to the staff member who scheduled them.</p>
      <ReportUpdated at={data.updatedAt} />
    </footer>
  </div>;
}
