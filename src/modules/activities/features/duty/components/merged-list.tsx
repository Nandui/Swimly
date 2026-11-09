import Link from "next/link";
import { ChevronDown, ClipboardList } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { LinkPagination } from "@/components/ui-kit/link-pagination";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { formatDate, formatTime, parseDateOnly, plural } from "@/lib/format";

export type MergedRow = {
  id: string; date: string; levelName: string; programmeName: string; fromClassName: string; fromStartMinutes: number;
  intoClassName: string; intoStartMinutes: number; intoLocation: string | null; instructorName: string | null;
  reason: string; mergedByName: string; mergedAt: string; swimmers: { studentId: string; swimmerName: string }[];
};

export function MergedList({ rows, clubName, page, total, pageSize }: { rows: MergedRow[]; clubName: string; page: number; total: number; pageSize: number }) {
  return <PageShell spacing="roomy" header={<PageHeader back={{ href: "/duty", label: "Duty manager" }} title="Merged classes"
      description={`${clubName} · Classes joined into another at the same level for one day, newest first.`}
      actions={<Button asChild variant="outline"><Link href="/duty"><ClipboardList aria-hidden="true" />Today&rsquo;s classes</Link></Button>} />}>
    <section className="flex min-w-0 flex-col" aria-labelledby="merged-h">
      <div className="pc-section-head"><h2 id="merged-h">All merges</h2><p role="status">{plural(total, "merge")}</p></div>
      {rows.length ? <ul className="pc-list">{rows.map(row => <li key={row.id} className="pc-row">
        <span className="w-24 shrink-0 font-semibold tabular-nums">{formatDate(parseDateOnly(row.date))}</span>
        <div className="pc-row-body">
          <h3 className="font-semibold break-words">{row.fromClassName} {formatTime(row.fromStartMinutes)} → {row.intoClassName} {formatTime(row.intoStartMinutes)}</h3>
          <p className="pc-row-hint break-words">{[row.programmeName, row.levelName, row.instructorName ? `Taught by ${row.instructorName}` : "No instructor recorded", row.intoLocation].filter(Boolean).join(" · ")}</p>
          <p className="pc-row-hint break-words">{row.reason} · Merged by {row.mergedByName}</p>
          <Collapsible className="group/swimmers text-sm">
            <CollapsibleTrigger asChild><Button variant="link" className="px-0">{plural(row.swimmers.length, "swimmer")} moved<ChevronDown className="transition-transform group-data-[state=open]/swimmers:rotate-180" aria-hidden="true" /></Button></CollapsibleTrigger>
            <CollapsibleContent>{row.swimmers.length ? <ul className="list-disc ps-5">{row.swimmers.map(s => <li key={s.studentId}>{s.swimmerName}</li>)}</ul> : <p className="text-ui-muted-foreground">Nobody was enrolled in the class that day.</p>}</CollapsibleContent>
          </Collapsible>
        </div>
      </li>)}</ul> : <EmptyState title="No merged classes yet" hint="When a class joins another for the day from Duty manager, it is listed here." />}
      {total > pageSize ? <LinkPagination label="Merged class pages" page={page} totalItems={total} pageSize={pageSize} pathname="/duty/merged" query={{}} /> : null}
    </section>
  </PageShell>;
}
