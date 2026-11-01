import { ChevronDown } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordFacts as Facts, RecordHistory, RecordNext, RecordSection as Section, RecordSteps, type RecordStepState } from "@/components/ui-kit/record";
import { Tag } from "@/components/ui-kit/tag";
import { Notice } from "@/components/ui-kit/notice";
import { CoinageAccountsActions } from "@/modules/coinage/features/request/components/accounts-actions";
import { CoinageRequestForm } from "@/modules/coinage/features/request/components/request-form";
import { coinageActions, coinageLines, coinageNextActions, coinageNextStep, coinageNumber, coinageStatuses, editableCoinage, euros, type CoinageActor, type CoinageDetail as Detail, type CoinageLines, type CoinageView } from "@/modules/coinage/shared/types";
import { formatDate, formatDateTime, parseDateOnly, plural } from "@/lib/format";

const day = (iso: string | null) => iso ? formatDate(parseDateOnly(iso)) : "Not entered";

/** The coins asked for, with how many of each and the total. */
function Lines({ lines, total }: { lines: CoinageLines; total: number | null }) {
  const rows = coinageLines(lines);
  if (!rows.length) return <p className="rec-muted">No coins added yet.</p>;
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

/** Who has it and how far accounts have got, in plain words. */
function progress(row: CoinageView): [string, string][] {
  return [
    ["Accounts handler", row.handlerName || "Not taken on yet"],
    ["Approved by", row.approvedByName || (row.status === "DECLINED" ? "Declined" : "Not approved yet")],
    ["Order", row.status === "ORDERED" ? `Ordered ${day(row.orderedOn)}, delivery ${day(row.deliveryOn)}` : row.status === "APPROVED" ? "Not ordered yet" : "Not ordered"],
  ];
}

/** Where the request is on its way from the desk to an order: a closed one stops at the decision;
 *  a query sends it back to the desk, shown on the accounts step. */
function steps(row: CoinageView): { label: string; hint: string; state: RecordStepState }[] {
  const s = row.status, closed = s === "DECLINED" || s === "WITHDRAWN";
  const decided = s === "APPROVED" || s === "ORDERED" || closed;
  return [
    { label: "Requested", hint: `By ${row.creatorName}`, state: s === "DRAFT" ? "current" : "done" },
    { label: "With accounts", hint: s === "NEEDS_INFORMATION" ? "Back with the desk" : row.submittedAt ? formatDate(new Date(row.submittedAt)) : "Not yet", state: s === "DRAFT" ? "todo" : s === "NEEDS_INFORMATION" ? "waiting" : decided ? "done" : "current" },
    { label: closed ? coinageStatuses[s].label : "Approved", hint: s === "APPROVED" || s === "ORDERED" ? row.approvedByName ? `By ${row.approvedByName}` : "Approved" : closed ? "No order" : "Not yet", state: closed ? "stopped" : decided ? "done" : "todo" },
    { label: "Ordered", hint: s === "ORDERED" ? `Delivery ${day(row.deliveryOn)}` : closed ? "Not needed" : "Not yet", state: s === "ORDERED" ? "done" : s === "APPROVED" ? "current" : "todo" },
  ];
}
/** The history dot's tone, by what happened: approved or ordered, sent back, closed. */
const historyTone = (action: string) => action === "approve" || action === "order" ? "done" as const : action === "information" ? "warn" as const : ["decline", "withdraw", "cancel"].includes(action) ? "stop" as const : undefined;

/** One coinage request as a record page (ui-kit/record.tsx), as Refunds is: what happens next and
 *  where the request has got to beside it, tinted blue while the move is this person's; the coins
 *  with their total, the request and how far accounts have got as label and value rows, the order
 *  once placed; and the history. While the desk can still edit it, the form takes the main column. */
export function CoinageDetail({ data, who, sites }: { data: Detail; who: CoinageActor; sites: { id: string; name: string }[] }) {
  const row = data.request, editable = editableCoinage(row, who);
  const query = row.status === "NEEDS_INFORMATION" ? [...data.events].reverse().find(event => event.action === "information") : undefined;
  const accounts = <CoinageAccountsActions row={row} who={who} deliveryCount={data.delivery.length} />;
  const history = <Section id="history-heading" title="History">
    <RecordHistory items={data.events.map(event => ({
      key: event.id, tone: historyTone(event.action), note: event.note,
      title: coinageActions[event.action as keyof typeof coinageActions] || event.action,
      meta: `${event.actorName} · ${formatDateTime(new Date(event.createdAt))}${typeof event.snapshot.totalCents === "number" ? ` · ${euros(event.snapshot.totalCents)}` : ""}`,
      extra: ["submit", "save"].includes(event.action) && event.snapshot.lines ? <Collapsible><CollapsibleTrigger asChild><Button variant="ghost" className="group -ml-3"><ChevronDown aria-hidden="true" className="transition-transform group-data-[state=open]:rotate-180" />What was asked for</Button></CollapsibleTrigger>
        <CollapsibleContent><Lines lines={event.snapshot.lines as CoinageLines} total={typeof event.snapshot.totalCents === "number" ? event.snapshot.totalCents : null} /></CollapsibleContent></Collapsible> : null,
    }))} />
  </Section>;
  const open = coinageNextActions(row, who).length > 0;
  return <PageShell spacing="roomy" header={<PageHeader back={{ href: "/coinage", label: "Coinage requests" }}
      eyebrow={<p className="rec-head"><Tag meta={coinageStatuses[row.status]} /><span className="tabular-nums">{coinageNumber(row.number)}</span></p>}
      title={row.forWhom || "Coinage request"}
      description={`${euros(row.totalCents)} of coins · ${row.clubName} · requested by ${row.creatorName}`} />}>
    {query && <Notice tone="warning" title="Accounts needs more information" description={query.note} />}
    {editable ? <CoinageRequestForm id={row.id} row={row} sites={sites} actions={accounts}>{history}</CoinageRequestForm>
      : <div className="rec-layout">
        <RecordNext act={open} label={open ? "Your move" : "Where it stands"} body={coinageNextStep(row.status)}>
          {accounts}
          <RecordSteps steps={steps(row)} label="Where the request has got to" />
        </RecordNext>
        <div className="rec-main">
          <Section id="coinage-lines-heading" title="Coins" aside={<p>{euros(row.totalCents)}</p>}>
            <div className="rec-card"><Lines lines={row.lines} total={row.totalCents} /></div>
          </Section>
          <Section id="coinage-details-heading" title="The request">
            <div className="rec-card"><Facts items={[["Site", row.clubName], ["Who it is for", row.forWhom || "Not entered"], ["Needed by", day(row.neededBy)], ["Requested by", `${row.creatorName}${row.submittedAt ? `, sent ${formatDate(new Date(row.submittedAt))}` : ", not sent yet"}`], ["Notes for accounts", row.notes || "None", true]]} /></div>
          </Section>
          <Section id="coinage-progress-heading" title="Accounts">
            <div className="rec-card"><Facts items={progress(row)} /></div>
          </Section>
          {row.status === "ORDERED" && <Section id="coinage-order-heading" title="The order">
            <div className="rec-card">
              <Facts items={[["Ordered on", day(row.orderedOn)], ["Delivery expected", day(row.deliveryOn)], ["Order reference", row.orderReference || "Not entered"], ["Recorded by", row.orderedByName || "Not recorded"]]} />
              <p className="rec-muted rec-small">The order was placed outside Turnfin. Check the delivery against the coins above.</p>
            </div>
          </Section>}
        </div>
        <div className="rec-side">{history}</div>
      </div>}
  </PageShell>;
}
