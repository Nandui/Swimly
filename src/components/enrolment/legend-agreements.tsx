import Form from "next/form";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Search, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Tag } from "@/components/ui-kit/tag";
import { ConfirmLegendAgreement } from "./confirm-legend-agreement";
import { LEGEND_AGREEMENT_META } from "@/lib/enrolment/legend-agreement";
import type { LegendAgreementResult } from "@/lib/enrolment/data/legend-agreements";
import { fullName } from "@/lib/students/constants";
import { courseName, formatSlot } from "@/lib/courses/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const number = (value: number) => value.toLocaleString("en-IE");

export function LegendAgreements({ result, canConfirm, profiles, classes }: {
  result: LegendAgreementResult; canConfirm: boolean; profiles: boolean; classes: boolean;
}) {
  const { items, q, view, total, page, pages, outstandingCount, doneCount, siteName } = result;
  const views = [{ key: "outstanding", label: "Outstanding", count: outstandingCount }, { key: "done", label: "Confirmed", count: doneCount }];
  function href(nextView: string, nextPage = 1) {
    const query = new URLSearchParams();
    if (nextView === "done") query.set("view", "done");
    if (q) query.set("q", q);
    if (nextPage > 1) query.set("page", String(nextPage));
    return `/legend-agreements${query.size ? `?${query}` : ""}`;
  }
  return <section className="flex min-w-0 flex-col gap-4 text-ui-foreground" aria-labelledby="agreements-heading">
    <header className="mb-2 space-y-2">
      <h1 id="agreements-heading" className="text-2xl font-semibold tracking-tight">Legend agreements</h1>
      <p className="text-sm text-ui-muted-foreground">{siteName} · Update the billing agreement in Legend, then confirm it here.</p>
    </header>
    <div className="space-y-4">
      <Form action="/legend-agreements" className="flex items-end gap-2" role="search" aria-label="Legend agreements">
        {view === "done" ? <input type="hidden" name="view" value="done" /> : null}
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="agreement-search">Find a swimmer</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ui-muted-foreground" aria-hidden="true" />
            <Input id="agreement-search" name="q" type="search" placeholder="Name or member number…" defaultValue={q} key={q} maxLength={100} autoComplete="off" className="h-11 pl-10" />
          </div>
        </div>
        <Button type="submit" className="h-11">Search</Button>
      </Form>
      <nav aria-label="Agreement status" className="inline-flex max-w-full items-center gap-1 rounded-ui-lg bg-ui-muted p-1">
        {views.map(item => <Button key={item.key} asChild variant="ghost" size="sm" className={cn("min-h-11 gap-1.5 px-2 text-xs sm:px-3 sm:text-sm", view === item.key && "bg-ui-background text-ui-foreground shadow-sm hover:bg-ui-background")}>
          <Link href={href(item.key)} aria-current={view === item.key ? "page" : undefined}>{item.label}{" "}<span className="text-xs text-ui-muted-foreground tabular-nums">{number(item.count)}</span></Link>
        </Button>)}
      </nav>
    </div>
    <div className="space-y-3">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 text-sm text-ui-muted-foreground">
        <p role="status" aria-live="polite" aria-atomic="true"><span className="font-medium text-ui-foreground">{number(total)}</span> {total === 1 ? "class place" : "class places"}{view === "done" ? " confirmed" : " outstanding"}{q ? ` matching “${q}”` : ""}</p>
        {q ? <Button asChild variant="ghost" size="sm" className="min-h-11"><Link href={`/legend-agreements${view === "done" ? "?view=done" : ""}`}><X aria-hidden="true" />Clear</Link></Button> : <span className="text-xs">{view === "done" ? "Recently confirmed first" : "Oldest enrolments first"}</span>}
      </div>
      {!canConfirm ? <p className="text-sm text-ui-muted-foreground">Ask for permission to enrol and move swimmers to confirm agreements.</p> : null}
    {items.length ? <Table containerClassName="rounded-ui-md border border-ui-border" className="table-fixed [&_td]:whitespace-normal [&_th]:whitespace-normal">
      <caption className="sr-only">{view === "done" ? "Confirmed" : "Outstanding"} Legend agreements at {siteName}</caption>
      <TableHeader className="bg-ui-muted"><TableRow className="hover:bg-ui-muted">
        <TableHead scope="col" className="px-4 py-3 font-normal text-ui-muted-foreground sm:px-5"><span className="xl:hidden">Swimmer &amp; class</span><span className="hidden xl:inline">Swimmer</span></TableHead>
        <TableHead scope="col" className="hidden w-[28%] px-4 py-3 font-normal text-ui-muted-foreground xl:table-cell">Class</TableHead>
        <TableHead scope="col" className="hidden w-44 px-4 py-3 font-normal text-ui-muted-foreground lg:table-cell xl:w-48">Agreement</TableHead>
        {view !== "done" && canConfirm ? <TableHead scope="col" className="hidden w-48 px-4 py-3 md:table-cell"><span className="sr-only">Actions</span></TableHead> : null}
      </TableRow></TableHeader>
      <TableBody>{items.map(row => {
        const name = fullName(row.student), label = `${courseName(row.course)} · ${formatSlot(row.course)}`;
        const meta = LEGEND_AGREEMENT_META[row.legendAgreementStatus];
        const identity = <><span className="block text-base font-semibold">{name}</span><span className="block text-sm text-ui-muted-foreground">{row.student.memberNumber ? `#${row.student.memberNumber}` : "No member number"}</span></>;
        const classDetails = <><span className="block font-medium">{courseName(row.course)}</span><span className="block text-sm text-ui-muted-foreground">{formatSlot(row.course)}</span></>;
        const classInfo = <div className="min-w-0 space-y-1 break-words">
          {classes ? <Link href={`/courses/${row.course.id}`} className="block min-h-11 content-center hover:underline">{classDetails}</Link> : <div>{classDetails}</div>}
          <p className="text-xs text-ui-muted-foreground">Enrolled {formatDate(row.startedOn)}{row.course.archivedAt ? " · Class archived" : ""}</p>
        </div>;
        const status = <div className="min-w-0 space-y-1.5 break-words"><Tag color={meta.color}>{meta.label}</Tag>
          {row.legendAgreementUpdatedAt ? <p className="text-xs text-ui-muted-foreground"><span className="block">{row.legendAgreementUpdatedByName ?? "Staff"}</span>{formatDateTime(row.legendAgreementUpdatedAt)}</p> : null}
        </div>;
        const action = view !== "done" && canConfirm ? <ConfirmLegendAgreement id={row.id} swimmerName={name} classLabel={`${label} · ${siteName}`} /> : null;
        return <TableRow key={row.id} className="hover:bg-ui-muted/50">
          <TableCell className="px-4 py-4 sm:px-5">
            {profiles ? <Link href={`/students/${row.student.id}`} className="block min-h-11 content-center break-words hover:underline">{identity}</Link> : <div className="break-words">{identity}</div>}
            <div className="mt-2 xl:hidden">{classInfo}</div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 lg:hidden">{status}{action ? <div className="ml-auto md:hidden">{action}</div> : null}</div>
          </TableCell>
          <TableCell className="hidden px-4 py-4 xl:table-cell">{classInfo}</TableCell>
          <TableCell className="hidden px-4 py-4 lg:table-cell">{status}</TableCell>
          {action ? <TableCell className="hidden px-4 py-4 text-right md:table-cell">{action}</TableCell> : null}
        </TableRow>;
      })}</TableBody>
    </Table> : <div className="rounded-ui-md border border-ui-border bg-ui-muted/30 py-8"><EmptyState icon="clipboardCheck" title={q ? "No matching agreements" : view === "done" ? "No agreements confirmed yet" : "No outstanding agreements"}
      hint={q ? "Try another name or member number." : view === "done" ? "Confirm an agreement after updating it in Legend." : "All recorded active class places at this site have been confirmed."} /></div>}
    <p className="text-xs leading-relaxed text-ui-muted-foreground">Active enrolments only, one check per class place. “Needs checking” means no confirmation has been recorded yet.</p>
    {pages > 1 ? <nav aria-label="Agreement pages" className="flex items-center justify-between gap-2 pt-2">
      {page > 1 ? <Button asChild variant="outline" className="min-h-11"><Link href={href(view, page - 1)}><ArrowLeft aria-hidden="true" />Previous</Link></Button> : <Button variant="outline" className="min-h-11" disabled><ArrowLeft aria-hidden="true" />Previous</Button>}
      <span className="text-sm text-ui-muted-foreground tabular-nums">{page} / {pages}<span className="sr-only"> pages</span></span>
      {page < pages ? <Button asChild variant="outline" className="min-h-11"><Link href={href(view, page + 1)}>Next<ArrowRight aria-hidden="true" /></Link></Button> : <Button variant="outline" className="min-h-11" disabled>Next<ArrowRight aria-hidden="true" /></Button>}
    </nav> : null}
    </div>
  </section>;
}
