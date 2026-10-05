import Form from "next/form";
import Link from "next/link";
import { LinkPagination } from "@/components/ui-kit/link-pagination";
import { PageHeader } from "@/components/ui-kit/page-header";
import { SearchField } from "@/components/ui-kit/search-field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Tag } from "@/components/ui-kit/tag";
import { ConfirmLegendAgreement } from "./confirm-legend-agreement";
import { LegendListMatch } from "./legend-list-match";
import { LEGEND_AGREEMENT_META } from "@/modules/activities/lib/enrolment/legend-agreement";
import type { LegendAgreementResult } from "@/modules/activities/lib/enrolment/data/legend-agreements";
import { fullName } from "@/modules/activities/lib/students/constants";
import { courseName, formatSlot } from "@/modules/activities/lib/courses/constants";
import { formatCount, formatDate, formatDateTime, plural } from "@/lib/format";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";


export function LegendAgreements({ result, canConfirm, profiles, classes }: {
  result: LegendAgreementResult; canConfirm: boolean; profiles: boolean; classes: boolean;
}) {
  const matchList = canConfirm ? <LegendListMatch /> : null;
  const { items, q, view, total, page, pageSize, outstandingCount, doneCount, siteName } = result;
  const views = [{ key: "outstanding", label: "Outstanding", count: outstandingCount }, { key: "done", label: "Confirmed", count: doneCount }];
  function href(nextView: string, nextPage = 1) {
    const query = new URLSearchParams();
    if (nextView === "done") query.set("view", "done");
    if (q) query.set("q", q);
    if (nextPage > 1) query.set("page", String(nextPage));
    return `/legend-agreements${query.size ? `?${query}` : ""}`;
  }
  const rows = items.map(row => {
    const name = fullName(row.student), label = `${courseName(row.course)} · ${formatSlot(row.course)}`;
    const meta = LEGEND_AGREEMENT_META[row.legendAgreementStatus];
    const identity = <><span className="block font-semibold">{name}</span>{row.student.memberNumber ? <span className="block text-xs text-ui-muted-foreground">#{row.student.memberNumber}</span> : null}</>;
    const classDetails = <><span className="block">{courseName(row.course)}</span><span className="block text-xs text-ui-muted-foreground">{formatSlot(row.course)}</span></>;
    return {
      row,
      who: profiles ? <Link href={`/students/${row.student.id}`} className="block min-h-11 content-center break-words hover:underline">{identity}</Link> : <div className="break-words">{identity}</div>,
      classInfo: <div className="min-w-0 break-words">
        {classes ? <Link href={`/courses/${row.course.id}`} className="block min-h-11 content-center hover:underline">{classDetails}</Link> : <div>{classDetails}</div>}
        <p className="text-xs text-ui-muted-foreground">Enrolled {formatDate(row.startedOn)}{row.course.archivedAt ? " · Class archived" : ""}</p>
      </div>,
      status: <div className="min-w-0 flex flex-col items-start gap-1 break-words"><Tag meta={meta} />
        {row.legendAgreementUpdatedAt ? <p className="text-xs text-ui-muted-foreground">{row.legendAgreementUpdatedByName ?? "Staff"} · {formatDateTime(row.legendAgreementUpdatedAt)}</p> : null}
      </div>,
      action: view !== "done" && canConfirm ? <ConfirmLegendAgreement id={row.id} swimmerName={name} classLabel={`${label} · ${siteName}`} /> : null,
    };
  });
  return <div className="min-w-0 flex flex-col gap-6">
    <PageHeader title="Legend agreements" description={`${siteName} · Update the billing agreement in Legend, then confirm it here.`} actions={matchList} />
    <section className="pc-panel" aria-label="Agreements">
      <div className="min-w-0 flex flex-wrap items-end gap-3">
        <Form action="/legend-agreements" className="min-w-0 flex-[1_1_18rem] md:max-w-md" role="search" aria-label="Legend agreements">
          {view === "done" ? <input type="hidden" name="view" value="done" /> : null}
          <SearchField id="agreement-search" label="Find a swimmer" placeholder="Name or member number" defaultValue={q} maxLength={100} clearHref={`/legend-agreements${view === "done" ? "?view=done" : ""}`} />
        </Form>
        <SegmentedLinks label="Agreement status" items={views.map(item => ({ href: href(item.key), label: item.label, count: formatCount(item.count), current: view === item.key }))} />
      </div>
      <div className="min-w-0 flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold" role="status" aria-live="polite" aria-atomic="true">{plural(total, "class place")}{view === "done" ? " confirmed" : " outstanding"}{q ? ` matching “${q}”` : ""}</p>
        <span className="text-xs text-ui-muted-foreground">{view === "done" ? "Recently confirmed first" : "Oldest enrolments first"}</span>
      </div>
      {!canConfirm ? <p className="text-sm text-ui-muted-foreground">Ask for permission to enrol and move swimmers to confirm agreements.</p> : null}
      {rows.length ? <>
        <Table containerClassName="pc-only-wide" className="[&_td]:whitespace-normal [&_th]:whitespace-normal">
          <caption className="sr-only">{view === "done" ? "Confirmed" : "Outstanding"} Legend agreements at {siteName}</caption>
          <TableHeader><TableRow>
            <TableHead scope="col">Swimmer</TableHead>
            <TableHead scope="col">Class</TableHead>
            <TableHead scope="col">Agreement</TableHead>
            {view !== "done" && canConfirm ? <TableHead scope="col"><span className="sr-only">Actions</span></TableHead> : null}
          </TableRow></TableHeader>
          <TableBody>{rows.map(({ row, who, classInfo, status, action }) => <TableRow key={row.id}>
            <TableCell>{who}</TableCell>
            <TableCell>{classInfo}</TableCell>
            <TableCell>{status}</TableCell>
            {action ? <TableCell className="text-right">{action}</TableCell> : null}
          </TableRow>)}</TableBody>
        </Table>
        {/* Phones: closed rows with the action at the end. */}
        <ul className="pc-rows pc-only-narrow" aria-label={`${view === "done" ? "Confirmed" : "Outstanding"} Legend agreements at ${siteName}`}>
          {rows.map(({ row, who, classInfo, status, action }) => <li key={row.id} className="pc-row">
            <div className="pc-row-body">{who}{classInfo}<div className="mt-2">{status}</div></div>
            {action ? <div className="pc-row-trail">{action}</div> : null}
          </li>)}
        </ul>
      </> : <EmptyState icon="clipboardCheck" title={q ? "No matching agreements" : view === "done" ? "No agreements confirmed yet" : "No outstanding agreements"}
        hint={q ? "Try another name or member number." : view === "done" ? "Confirm an agreement after updating it in Legend." : "All recorded active class places at this site have been confirmed."} />}
      <p className="text-xs text-ui-muted-foreground">Active enrolments only, one check per class place. “Needs checking” means no confirmation has been recorded yet.</p>
      <LinkPagination label="Agreement pages" page={page} totalItems={total} pageSize={pageSize} pathname="/legend-agreements" query={{ ...(view === "done" ? { view: "done" } : {}), ...(q ? { q } : {}) }} />
    </section>
  </div>;
}
