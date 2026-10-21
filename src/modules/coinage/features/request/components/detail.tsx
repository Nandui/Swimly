import Link from "next/link";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { Tag } from "@/components/ui-kit/tag";
import { Notice } from "@/components/ui-kit/notice";
import { CoinageAccountsActions } from "@/modules/coinage/features/request/components/accounts-actions";
import { CoinageRequestForm } from "@/modules/coinage/features/request/components/request-form";
import { coinageActions, coinageLines, coinageNextStep, coinageNumber, coinageStatuses, editableCoinage, euros, type CoinageActor, type CoinageDetail as Detail, type CoinageLines, type CoinageView } from "@/modules/coinage/shared/types";
import { formatDate, formatDateTime, parseDateOnly, plural } from "@/lib/format";

const day = (iso: string | null) => iso ? formatDate(parseDateOnly(iso)) : "Not entered";

/** One fact: a caption over its value. */
function Facts({ items, stacked }: { items: [string, string][]; stacked?: boolean }) {
  return <dl className={stacked ? "grid gap-4" : "grid gap-x-6 gap-y-4 sm:grid-cols-2"}>{items.map(([label, value]) => <div key={label} className="min-w-0">
    <dt className="text-sm text-ui-muted-foreground">{label}</dt>
    <dd className="mt-1 whitespace-pre-line break-words">{value}</dd>
  </div>)}</dl>;
}

/** The coins asked for, with how many of each and the total. */
function Lines({ lines, total }: { lines: CoinageLines; total: number | null }) {
  const rows = coinageLines(lines);
  if (!rows.length) return <p className="text-sm text-ui-muted-foreground">No coins added yet.</p>;
  return <Table>
    <TableHeader><TableRow><TableHead>Coin</TableHead><TableHead className="text-right">How many</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
    <TableBody>{rows.map(line => <TableRow key={line.cents}>
      <TableCell className="font-medium">{line.label}</TableCell>
      <TableCell className="text-right tabular-nums">{plural(line.pieces, "coin")}</TableCell>
      <TableCell className="text-right tabular-nums">{euros(line.amountCents)}</TableCell>
    </TableRow>)}</TableBody>
    <TableFooter><TableRow><TableCell colSpan={2} className="font-semibold">Total</TableCell><TableCell className="text-right font-semibold tabular-nums">{euros(total)}</TableCell></TableRow></TableFooter>
  </Table>;
}

/** Where the request is, in plain words: who asked, accounts, and the order. */
function progress(row: CoinageView): [string, string][] {
  return [
    ["Requested by", `${row.creatorName}${row.submittedAt ? `, sent ${formatDate(new Date(row.submittedAt))}` : ", not sent yet"}`],
    ["Accounts handler", row.handlerName || "Not taken on yet"],
    ["Approved by", row.approvedByName || (row.status === "DECLINED" ? "Declined" : "Not approved yet")],
    ["Order", row.status === "ORDERED" ? `Ordered ${day(row.orderedOn)}, delivery ${day(row.deliveryOn)}` : row.status === "APPROVED" ? "Not ordered yet" : "Not ordered"],
  ];
}

export function CoinageDetail({ data, who, sites }: { data: Detail; who: CoinageActor; sites: { id: string; name: string }[] }) {
  const row = data.request, editable = editableCoinage(row, who);
  const query = row.status === "NEEDS_INFORMATION" ? [...data.events].reverse().find(event => event.action === "information") : undefined;
  const accounts = <CoinageAccountsActions row={row} who={who} deliveryCount={data.delivery.length} />;
  const history = <section className="pc-panel" aria-labelledby="history-heading"><h2 id="history-heading" className="text-lg font-semibold">Request history</h2>
    <ul className="pc-rows">{data.events.map(event => <li key={event.id} className="pc-row">
      <span className="pc-row-body">
        <span className="pc-row-title">{coinageActions[event.action as keyof typeof coinageActions] || event.action}</span>
        <span className="pc-row-hint">{event.actorName} · {formatDateTime(new Date(event.createdAt))}{typeof event.snapshot.totalCents === "number" ? ` · ${euros(event.snapshot.totalCents)}` : ""}</span>
        {event.note && <span className="whitespace-pre-line break-words">{event.note}</span>}
        {["submit", "save"].includes(event.action) && event.snapshot.lines ? <Collapsible><CollapsibleTrigger asChild><Button variant="ghost" className="group -ml-3"><ChevronDown aria-hidden="true" className="transition-transform group-data-[state=open]:rotate-180" />What was asked for</Button></CollapsibleTrigger>
          <CollapsibleContent><Lines lines={event.snapshot.lines as CoinageLines} total={typeof event.snapshot.totalCents === "number" ? event.snapshot.totalCents : null} /></CollapsibleContent></Collapsible> : null}
      </span>
    </li>)}</ul>
  </section>;
  return <PageShell header={<PageHeader title={coinageNumber(row.number)} description={`${euros(row.totalCents)} for ${row.forWhom || "a till not yet named"} · ${row.clubName}`} status={<Tag meta={coinageStatuses[row.status]} />}
    actions={<Button asChild variant="outline"><Link href="/coinage"><ChevronLeft aria-hidden="true" />Back to requests</Link></Button>} />}>
    {query && <Notice tone="warning" title="Accounts needs more information" description={query.note} />}
    {editable ? <CoinageRequestForm id={row.id} row={row} sites={sites} actions={accounts}>{history}</CoinageRequestForm>
      : <div className="grid min-w-0 items-start gap-4 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
          <section className="pc-panel" aria-labelledby="coinage-lines-heading">
            <h2 id="coinage-lines-heading" className="text-lg font-semibold">Coins</h2>
            <Lines lines={row.lines} total={row.totalCents} />
          </section>
          <section className="pc-panel" aria-labelledby="coinage-details-heading">
            <h2 id="coinage-details-heading" className="text-lg font-semibold">Request details</h2>
            <Facts items={[["Site", row.clubName], ["Who it is for", row.forWhom || "Not entered"], ["Needed by", day(row.neededBy)], ["Notes for accounts", row.notes || "None"]]} />
          </section>
          {row.status === "ORDERED" && <section className="pc-panel" aria-labelledby="coinage-order-heading">
            <h2 id="coinage-order-heading" className="text-lg font-semibold">The order</h2>
            <Facts items={[["Ordered on", day(row.orderedOn)], ["Delivery expected", day(row.deliveryOn)], ["Order reference", row.orderReference || "Not entered"], ["Recorded by", row.orderedByName || "Not recorded"]]} />
            <p className="text-sm text-ui-muted-foreground">The order was placed outside Turnfin. Check the delivery against the coins above.</p>
          </section>}
          {history}
        </div>
        <aside className="pc-panel" aria-labelledby="next-action">
          <h2 id="next-action" className="text-lg font-semibold">Next action</h2>
          <p className="text-sm text-ui-muted-foreground">{coinageNextStep(row.status)}</p>
          {accounts}
          <Facts items={progress(row)} stacked />
        </aside>
      </div>}
  </PageShell>;
}
