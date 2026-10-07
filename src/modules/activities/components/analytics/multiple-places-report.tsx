"use client";

import { EmptyState } from "@/components/ui-kit/empty-state";
import Link from "next/link";
import { useState } from "react";
import { CalendarDays, Download, Layers, Shapes } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn/tabs";
import { SearchField } from "@/components/ui-kit/search-field";
import { PageHeader } from "@/components/ui-kit/page-header";
import { formatCount, plural } from "@/lib/format";
import type { MultiplePlacesAnalyticsData } from "@/modules/activities/lib/analytics/report-data";
import { matchesKind, MULTIPLE_PLACE_KINDS, multiplePlacesCsv, type MultiplePlaceKind } from "@/modules/activities/lib/analytics/multiple-places";
import { AnalyticsNav } from "./navigation";
import { AnalyticsRefresh } from "./refresh";
import { ReportUpdated } from "./period";
import { StatTile } from "./stat-tile";

const kinds = Object.keys(MULTIPLE_PLACE_KINDS) as MultiplePlaceKind[];
const icons = { classes: CalendarDays, levels: Layers, programmes: Shapes } as const;

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function MultiplePlacesReport({ data }: { data: MultiplePlacesAnalyticsData }) {
  const [kind, setKind] = useState<MultiplePlaceKind>("classes");
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const inKind = data.swimmers.filter(swimmer => matchesKind(swimmer, kind));
  const swimmers = inKind.filter(swimmer => !query || `${swimmer.firstName} ${swimmer.lastName}`.toLowerCase().includes(query) || swimmer.memberNumber?.toLowerCase().includes(query));
  const meta = MULTIPLE_PLACE_KINDS[kind];
  const slug = `${data.siteName}-${meta.nouns}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return <div className="flex min-w-0 flex-col gap-6">
    <PageHeader title="Multiple places" description={`${data.siteName} · Swimmers with more than one current place`} actions={<AnalyticsRefresh />} />
    <AnalyticsNav active="multiple" />
    <ul className="pc-stats" aria-label="Swimmers with more than one place">
      {kinds.map(id => <StatTile key={id} icon={icons[id]} value={formatCount(data.totals[id])} label={MULTIPLE_PLACE_KINDS[id].label} caption="Swimmers at this site" />)}
    </ul>
    <section className="pc-panel" aria-labelledby="multiple-places-list">
      <div className="pc-panel-head">
        <h2 id="multiple-places-list">Swimmers</h2>
        <Button variant="outline" disabled={swimmers.length === 0} onClick={() => download(`multiple-places-${slug}-${data.date}.csv`, multiplePlacesCsv(data.siteName, swimmers))}>
          <Download aria-hidden="true" />Export CSV<span className="sr-only">: {plural(swimmers.length, "swimmer")}, {meta.label.toLowerCase()}</span>
        </Button>
      </div>
      <Tabs value={kind} onValueChange={value => setKind(value as MultiplePlaceKind)} className="gap-3">
        <TabsList aria-label="Show swimmers in">
          {kinds.map(id => <TabsTrigger key={id} value={id}>{MULTIPLE_PLACE_KINDS[id].label} <span className="pc-seg-count tabular-nums">{data.totals[id]}</span></TabsTrigger>)}
        </TabsList>
        <TabsContent value={kind} className="m-0 flex min-w-0 flex-col gap-3">
          <SearchField label="Find a swimmer" placeholder="Name or member ID" value={search} onValueChange={setSearch} className="sm:max-w-md" />
          <p role="status" className="text-xs text-ui-muted-foreground">{plural(swimmers.length, "swimmer")} in {meta.label.toLowerCase()}. Export saves this list.</p>
          <div className="min-w-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead scope="col">Swimmer</TableHead>
                <TableHead scope="col">Classes</TableHead>
                <TableHead scope="col">Placed in</TableHead>
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
                  <TableCell className="whitespace-normal align-top py-4 text-sm">
                    <p><span className="sr-only">Levels: </span>{swimmer.levels.join(", ")}</p>
                    <p className="mt-1 text-xs text-ui-muted-foreground"><span className="sr-only">Programmes: </span>{swimmer.programmes.join(", ")}</p>
                  </TableCell>
                </TableRow>;
              })}</TableBody>
            </Table>
            {swimmers.length === 0 ? <EmptyState role="status" compact title={query ? "No swimmers match your search." : `No swimmers at this site are in ${meta.label.toLowerCase()}.`} /> : null}
          </div>
        </TabsContent>
      </Tabs>
    </section>
    <footer className="max-w-prose space-y-2 text-xs text-ui-muted-foreground">
      <p>Counts current places in this site’s live weekly classes, the same places as Overview: active swimmers only, excluding waitlists, future starts, scheduled endings that have passed and archived classes. Levels and programmes are where each swimmer was placed. Two places in the same class count as two classes. Places at other sites are not included; switch site to see them.</p>
      <ReportUpdated at={data.updatedAt} />
    </footer>
  </div>;
}
