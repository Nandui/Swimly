import Link from "next/link";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { PageHeader } from "@/components/ui-kit/page-header";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Tag } from "@/components/ui-kit/tag";
import { ConfirmLegendAgreement } from "./confirm-legend-agreement";
import { LEGEND_AGREEMENT_META } from "@/lib/enrolment/legend-agreement";
import type { LegendAgreementResult } from "@/lib/enrolment/data/legend-agreements";
import { fullName } from "@/lib/students/constants";
import { courseName, formatSlot } from "@/lib/courses/constants";
import { formatDate, formatDateTime } from "@/lib/format";

export function LegendAgreements({ result, canConfirm, profiles, classes }: {
  result: LegendAgreementResult; canConfirm: boolean; profiles: boolean; classes: boolean;
}) {
  const { items, q, view, total, page, pages, outstandingCount, doneCount, siteName } = result;
  function href(nextView: string, nextPage = 1) {
    const query = new URLSearchParams();
    if (nextView === "done") query.set("view", "done");
    if (q) query.set("q", q);
    if (nextPage > 1) query.set("page", String(nextPage));
    return `/legend-agreements${query.size ? `?${query}` : ""}`;
  }
  return <div className="min-w-0 space-y-6">
    <PageHeader title="Legend agreements" description={`${siteName} · Update the billing agreement in Legend, then confirm it here.`} />
    <nav aria-label="Agreement status" className="flex flex-wrap gap-2">
      <Button asChild variant={view === "outstanding" ? "secondary" : "ghost"} className="min-h-11"><Link href={href("outstanding")} aria-current={view === "outstanding" ? "page" : undefined}>Outstanding {outstandingCount}</Link></Button>
      <Button asChild variant={view === "done" ? "secondary" : "ghost"} className="min-h-11"><Link href={href("done")} aria-current={view === "done" ? "page" : undefined}>Confirmed {doneCount}</Link></Button>
    </nav>
    <form action="/legend-agreements" className="flex flex-wrap items-end gap-3" role="search">
      {view === "done" ? <input type="hidden" name="view" value="done" /> : null}
      <div className="min-w-0 flex-1 space-y-2 sm:max-w-md">
        <label htmlFor="agreement-search" className="text-sm font-medium">Find a swimmer</label>
        <Input id="agreement-search" name="q" type="search" placeholder="Name or member number" defaultValue={q} key={q} maxLength={100} className="min-h-11" />
      </div>
      <Button type="submit" className="min-h-11">Search</Button>
      {q ? <Button asChild variant="ghost" className="min-h-11"><Link href={`/legend-agreements${view === "done" ? "?view=done" : ""}`}>Clear</Link></Button> : null}
    </form>
    <div className="space-y-1 text-sm">
      <p role="status" className="font-medium">{total} {total === 1 ? "class place" : "class places"}{view === "done" ? " confirmed" : " outstanding"}{q ? ` matching “${q}”` : ""}</p>
      <p className="text-ui-muted-foreground">Active enrolments only, one check per class place. “Needs checking” means no confirmation has been recorded yet.</p>
      {!canConfirm ? <p className="text-ui-muted-foreground">Ask for permission to enrol and move swimmers to confirm agreements.</p> : null}
    </div>
    {items.length ? <Table className="table-fixed [&_td]:whitespace-normal [&_th]:whitespace-normal">
      <TableHeader><TableRow>
        <TableHead scope="col">Swimmer & class</TableHead>
        <TableHead scope="col" className="hidden w-64 lg:table-cell">Agreement</TableHead>
        {view !== "done" && canConfirm ? <TableHead scope="col" className="hidden w-44 md:table-cell"><span className="sr-only">Actions</span></TableHead> : null}
      </TableRow></TableHeader>
      <TableBody>{items.map(row => {
        const name = fullName(row.student), label = `${courseName(row.course)} · ${formatSlot(row.course)}`;
        const meta = LEGEND_AGREEMENT_META[row.legendAgreementStatus];
        const status = <div className="space-y-2"><Tag color={meta.color}>{meta.label}</Tag>
          {row.legendAgreementUpdatedAt ? <p className="text-xs text-ui-muted-foreground">{row.legendAgreementUpdatedByName ?? "Staff"} · {formatDateTime(row.legendAgreementUpdatedAt)}</p> : null}
        </div>;
        const action = view !== "done" && canConfirm ? <ConfirmLegendAgreement id={row.id} swimmerName={name} classLabel={`${label} · ${siteName}`} /> : null;
        return <TableRow key={row.id}>
          <TableCell className="py-4 align-top">
            {profiles ? <Link href={`/students/${row.student.id}`} className="inline-flex min-h-11 items-center font-semibold text-ui-primary hover:underline">{name}</Link> : <p className="font-semibold">{name}</p>}
            {row.student.memberNumber ? <p className="text-xs text-ui-muted-foreground">{row.student.memberNumber}</p> : null}
            {classes ? <Link href={`/courses/${row.course.id}`} className="inline-flex min-h-11 items-center text-ui-primary hover:underline">{label}</Link> : <p className="mt-2">{label}</p>}
            <p className="text-xs text-ui-muted-foreground">Enrolled {formatDate(row.startedOn)}{row.course.archivedAt ? " · Class archived" : ""}</p>
            <div className="mt-3 lg:hidden">{status}</div>
            {action ? <div className="mt-3 md:hidden">{action}</div> : null}
          </TableCell>
          <TableCell className="hidden py-6 align-top lg:table-cell">{status}</TableCell>
          {action ? <TableCell className="hidden py-6 align-top md:table-cell">{action}</TableCell> : null}
        </TableRow>;
      })}</TableBody>
    </Table> : <EmptyState icon="clipboardCheck" title={q ? "No matching agreements" : view === "done" ? "No agreements confirmed yet" : "No outstanding agreements"}
      hint={q ? "Try another name or member number." : view === "done" ? "Confirm an agreement after updating it in Legend." : "All recorded active class places at this site have been confirmed."} />}
    {pages > 1 ? <nav aria-label="Agreement pages" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-ui-muted-foreground">Page {page} of {pages}</p>
      <div className="flex gap-2">
        {page > 1 ? <Button asChild variant="outline" className="min-h-11"><Link href={href(view, page - 1)}>Previous</Link></Button> : null}
        {page < pages ? <Button asChild variant="outline" className="min-h-11"><Link href={href(view, page + 1)}>Next</Link></Button> : null}
      </div>
    </nav> : null}
  </div>;
}
