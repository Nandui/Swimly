import { Button } from "@/components/shadcn/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { RecordFacts as Facts, RecordHistory, RecordNext, RecordSection as Section, RecordSteps, type RecordStepState } from "@/components/ui-kit/record";
import { Tag } from "@/components/ui-kit/tag";
import { Notice } from "@/components/ui-kit/notice";
import { RefundFinanceActions } from "@/modules/refunds/features/request/components/finance-actions";
import { RefundRequestForm } from "@/modules/refunds/features/request/components/request-form";
import { RefundReceipts } from "@/modules/refunds/features/request/components/receipts";
import { editableRefund, euros, paymentMethods, refundActions, refundNextActions, refundNextStep, refundNumber, refundServices, refundStatuses, type RefundActor, type RefundDetail as Detail, type RefundView } from "@/modules/refunds/shared/types";
import { formatDate, formatDateTime, parseDateOnly } from "@/lib/format";

/** What finance decides on: what was approved, payment, and who has it. */
function decision(row: RefundView): [string, string][] {
  const decided = row.approvedCents !== null && (row.status === "APPROVED" || row.status === "REFUNDED");
  const approved = decided ? `${euros(row.approvedCents)}${row.approvedByName ? `, by ${row.approvedByName}` : ""}`
    : row.status === "WITHDRAWN" && row.approvedCents !== null ? "Approval cancelled"
    : row.status === "DECLINED" || row.status === "WITHDRAWN" ? "Not approved, closed without a refund"
    : row.status === "DRAFT" ? "Not submitted" : "Not decided yet";
  return [
    ["Approved", approved],
    ["Payment", row.status === "REFUNDED" ? (row.paidOn ? `Paid ${formatDate(parseDateOnly(row.paidOn))}` : "Recorded") : row.status === "APPROVED" ? "Not paid yet, made outside Turnfin" : "Not recorded"],
    ["Finance handler", row.handlerName || "Unassigned: anyone in finance can pick it up"],
  ];
}

/** Where the request is on its way from reception to a paid refund. A closed request stops at
 *  the decision; a query sends it back to reception, shown on the finance step. */
function stages(row: RefundView): { label: string; hint: string; state: RecordStepState }[] {
  const s = row.status, closed = s === "DECLINED" || s === "WITHDRAWN";
  const decided = s === "APPROVED" || s === "REFUNDED" || closed;
  return [
    { label: "Logged", hint: `By ${row.creatorName}`, state: s === "DRAFT" ? "current" : "done" },
    { label: "With finance", hint: s === "NEEDS_INFORMATION" ? "Back with reception" : row.submittedAt ? formatDate(new Date(row.submittedAt)) : "Not yet", state: s === "DRAFT" ? "todo" : s === "NEEDS_INFORMATION" ? "waiting" : decided ? "done" : "current" },
    { label: closed ? refundStatuses[s].label : "Approved", hint: s === "APPROVED" || s === "REFUNDED" ? euros(row.approvedCents) : closed ? "No refund" : "Not yet", state: closed ? "stopped" : decided ? "done" : "todo" },
    { label: "Paid", hint: s === "REFUNDED" ? (row.paidOn ? formatDate(parseDateOnly(row.paidOn)) : "Recorded") : closed ? "Not needed" : "Not yet", state: s === "REFUNDED" ? "done" : s === "APPROVED" ? "current" : "todo" },
  ];
}
const Stages = ({ row }: { row: RefundView }) => <RecordSteps steps={stages(row)} label="Where the request has got to" />;
/** The history dot's tone, by what happened: approved or paid, sent back, closed. */
const historyTone = (action: string) => action === "approve" || action === "pay" ? "done" as const : action === "information" ? "warn" as const : ["decline", "withdraw", "cancel"].includes(action) ? "stop" as const : undefined;

/** The claim: the amount asked for, large, who for and where. */
function Claim({ row, withStages = false }: { row: RefundView; withStages?: boolean }) {
  return <Section id="claim-heading" title="The claim">
    <div className="rec-card">
      <p className="rec-amount">{euros(row.requestedCents)}</p>
      <p className="rec-muted">Requested for <strong>{row.customerName || "a customer not yet entered"}</strong> at {row.clubName} · {refundServices[row.service]}</p>
      {withStages ? <Stages row={row} /> : null}
    </div>
  </Section>;
}

/** One request, laid out as a record page (ui-kit/record.tsx): what happens next and where the
 *  request has got to beside it, tinted blue while the move is this person's; the claim, what
 *  finance decides, the customer, the original payment and the story as cards of label and value
 *  rows; receipts; and the history. One column on phones, the next action first. While reception
 *  can still edit it, the claim sits above the form instead. */
export function RefundDetail({ data, who, sites }: { data: Detail; who: RefundActor; sites: { id: string; name: string }[] }) {
  const row = data.request, editable = editableRefund(row, who);
  const query = row.status === "NEEDS_INFORMATION" ? [...data.events].reverse().find(event => event.action === "information") : undefined;
  const finance = <RefundFinanceActions row={row} who={who} deliveryCount={data.delivery.length} />;
  const receipts = <RefundReceipts id={row.id} version={row.version} attachments={data.attachments} editable={editable} />;
  const history = <Section id="history-heading" title="History">
    <RecordHistory items={data.events.map(event => {
      const recorded = Object.entries({ Customer: event.snapshot.customerName, Site: event.snapshot.clubName, "Service description": event.snapshot.description, Reason: event.snapshot.reason, "Payment reference": event.snapshot.paymentReference, "Refund reference": event.snapshot.paidReference }).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== "");
      const amounts = typeof event.snapshot.requestedCents === "number" && ["submit", "approve", "pay"].includes(event.action);
      return {
        key: event.id, tone: historyTone(event.action), note: event.note,
        title: refundActions[event.action as keyof typeof refundActions] || event.action,
        meta: `${event.actorName} · ${formatDateTime(new Date(event.createdAt))}${amounts ? ` · Requested ${euros(event.snapshot.requestedCents as number)}${typeof event.snapshot.approvedCents === "number" ? ` · Approved ${euros(event.snapshot.approvedCents)}` : ""}` : ""}`,
        extra: recorded.length > 0 ? <Collapsible><CollapsibleTrigger asChild><Button variant="ghost" className="group -ml-3"><ChevronDown aria-hidden="true" className="transition-transform group-data-[state=open]:rotate-180" />What was recorded</Button></CollapsibleTrigger>
          <CollapsibleContent><Facts items={recorded.map(([label, value]) => [label, value, label === "Service description" || label === "Reason"])} /></CollapsibleContent></Collapsible> : null,
      };
    })} />
  </Section>;
  const open = refundNextActions(row, who).length > 0;
  return <PageShell spacing="roomy" header={<PageHeader back={{ href: "/refunds", label: "Refund requests" }}
      eyebrow={<p className="rec-head"><Tag meta={refundStatuses[row.status]} /><span className="tabular-nums">{refundNumber(row.number)} · {refundServices[row.service]}</span></p>}
      title={row.customerName || "New customer refund"}
      description={`${euros(row.requestedCents)} requested · ${row.clubName} · logged by ${row.creatorName}`} />}>
    {query && <Notice tone="warning" title="Finance needs more information" description={query.note} />}
    {editable ? <><Claim row={row} withStages /><RefundRequestForm id={row.id} row={row} sites={sites} actions={finance}>{receipts}{history}</RefundRequestForm></>
      : <div className="rec-layout">
        <RecordNext act={open} label={open ? "Your move" : "Where it stands"} body={refundNextStep(row.status)}>
          {finance}
          <Stages row={row} />
        </RecordNext>
        <div className="rec-main">
          <Claim row={row} />
          <Section id="decision-heading" title="The decision"><div className="rec-card"><Facts items={decision(row)} /></div></Section>
          <Section id="customer-heading" title="Customer"><div className="rec-card"><Facts items={[["Name", row.customerName || "Not entered"], ["Member number", row.memberNumber || "Not provided"], ["Contact phone", row.contactPhone || "Not provided"], ["Contact email", row.contactEmail || "Not provided"]]} /></div></Section>
          <Section id="payment-heading" title="Original payment"><div className="rec-card"><Facts items={[["Service", refundServices[row.service]], ["Site", row.clubName], ["Payment date", row.paymentDate ? formatDate(parseDateOnly(row.paymentDate)) : "Not entered"], ["Payment reference", row.paymentReference || "Not entered"]]} /></div></Section>
          <Section id="story-heading" title="What was bought and why">
            <div className="rec-card">
              <div className="rec-well"><h3>What was bought</h3><p>{row.description || "Not entered"}</p></div>
              <div className="rec-well"><h3>Why they want a refund</h3><p>{row.reason || "Not entered"}</p></div>
            </div>
          </Section>
          {row.status === "REFUNDED" && <Section id="payment-record" title="Refund paid">
            <div className="rec-card">
              <Facts items={[["Amount", euros(row.approvedCents)], ["Method", paymentMethods[row.paidMethod as keyof typeof paymentMethods] || row.paidMethod || "Not entered"], ["Reference", row.paidReference || "Not entered"], ["Recorded by", row.paidByName || "Not recorded"]]} />
              <p className="rec-muted rec-small">The payment was made outside Turnfin.</p>
            </div>
          </Section>}
          {receipts}
        </div>
        <div className="rec-side">{history}</div>
      </div>}
  </PageShell>;
}
