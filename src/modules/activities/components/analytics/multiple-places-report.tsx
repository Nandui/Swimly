"use client";

import { EmptyState } from "@/components/ui-kit/empty-state";
import Link from "next/link";
import { useState } from "react";
import { Download, Users } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { SearchField } from "@/components/ui-kit/search-field";
import { PageHeader } from "@/components/ui-kit/page-header";
import { formatCount, plural } from "@/lib/format";
import type { MultiplePlacesAnalyticsData } from "@/modules/activities/lib/analytics/report-data";
import { multiplePlacesCsv } from "@/modules/activities/lib/analytics/multiple-places";
import { AnalyticsNav } from "./navigation";
import { AnalyticsRefresh } from "./refresh";
import { ReportUpdated } from "./period";
import { StatTile } from "./stat-tile";

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function MultiplePlacesReport({ data }: { data: MultiplePlacesAnalyticsData }) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const swimmers = data.swimmers.filter(swimmer => !query || `${swimmer.firstName} ${swimmer.lastName}`.toLowerCase().includes(query) || swimmer.memberNumber?.toLowerCase().includes(query));
  const slug = data.siteName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return <div className="flex min-w-0 flex-col gap-6">
    <PageHeader title="Multiple enrolments" description={`${data.siteName} · Swimmers enrolled more than once`} actions={<AnalyticsRefresh />} />
    <AnalyticsNav active="multiple" />
    <ul className="pc-stats" aria-label="Swimmers with more than one enrolment">
      <StatTile icon={Users} value={formatCount(data.swimmers.length)} label="More than one enrolment" caption="Swimmers at this site" />
    </ul>
    <section className="pc-panel" aria-labelledby="multiple-enrolments-list">
      <div className="pc-panel-head">
        <h2 id="multiple-enrolments-list">Swimmers</h2>
        <Button variant="outline" disabled={swimmers.length === 0} onClick={() => download(`multiple-enrolments-${slug}-${data.date}.csv`, multiplePlacesCsv(data.siteName, swimmers))}>
          <Download aria-hidden="true" />Export CSV<span className="sr-only">: {plural(swimmers.length, "swimmer")}</span>
        </Button>
      </div>
      <SearchField label="Find a swimmer" placeholder="Name or member ID" value={search} onValueChange={setSearch} className="sm:max-w-md" />
      <p role="status" className="text-xs text-ui-muted-foreground">{plural(swimmers.length, "swimmer")}. Export saves this list.</p>
      <div className="min-w-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead scope="col">Swimmer</TableHead>
            <TableHead scope="col">Enrolments</TableHead>
          </TableRow></TableHeader>
          <TableBody>{swimmers.map(swimmer => {
            const name = `${swimmer.firstName} ${swimmer.lastName}`;
            return <TableRow key={swimmer.id}>
              <TableHead scope="row" className="whitespace-normal align-top">
                {data.canOpenSwimmers ? <Button asChild variant="link" className="min-h-11 max-w-full justify-start whitespace-normal px-0 text-left font-semibold"><Link href={`/students/${swimmer.id}`}>{name}</Link></Button> : <p className="my-2 font-semibold">{name}</p>}
                <p className="text-xs text-ui-muted-foreground">{swimmer.memberNumber ? `Member ID ${swimmer.memberNumber}` : "No member ID"}</p>
              </TableHead>
              <TableCell className="whitespace-normal align-top py-4">
                <ul className="space-y-1 text-sm">{swimmer.classes.map((label, index) => <li key={index}>{label}</li>)}</ul>
              </TableCell>
            </TableRow>;
          })}</TableBody>
        </Table>
        {swimmers.length === 0 ? <EmptyState role="status" compact title={query ? "No swimmers match your search." : "No swimmers at this site have more than one enrolment."} /> : null}
      </div>
    </section>
    <footer className="max-w-prose space-y-2 text-xs text-ui-muted-foreground">
      <p>Counts current enrolments in this site’s live weekly classes, the same places as Overview: active swimmers only, excluding waitlists, future starts, scheduled endings that have passed and archived classes. Two enrolments in the same class count as two. Enrolments at other sites are not included; switch site to see them.</p>
      <ReportUpdated at={data.updatedAt} />
    </footer>
  </div>;
}
