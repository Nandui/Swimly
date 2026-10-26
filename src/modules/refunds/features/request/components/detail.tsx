import { Button } from "@/components/shadcn/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { Check, ChevronDown, CircleHelp, X, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { Tag } from "@/components/ui-kit/tag";
import { Notice } from "@/components/ui-kit/notice";
import { RefundFinanceActions } from "@/modules/refunds/features/request/components/finance-actions";
import { RefundRequestForm } from "@/modules/refunds/features/request/components/request-form";
import { RefundReceipts } from "@/modules/refunds/features/request/components/receipts";
import { editableRefund, euros, paymentMethods, refundActions, refundNextActions, refundNextStep, refundNumber, refundServices, refundStatuses, type RefundActor, type RefundDetail as Detail, type RefundView } from "@/modules/refunds/shared/types";
import { formatDate, formatDateTime, parseDateOnly } from "@/lib/format";

/** Label and value rows with hairlines between (DESIGN.md, Content: rows). Long text stacks. */
function Facts({ items }: { items: [string, string, boolean?][] }) {
  return <dl className="refund-facts">{items.map(([label, value, wide]) => <div key={label} className="refund-fact" data-wide={wide ? "" : undefined}>
    <dt>{label}</dt><dd>{value}</dd>
  </div>)}</dl>;
}

/** A section as Turnfin Glass draws it: its title above the card. */
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return <section aria-labelledby={id} className="flex min-w-0 flex-col">
    <div className="pc-section-head"><h2 id={id}>{title}</h2></div>
    {children}
  </section>;
}

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

type StepState = "done" | "current" | "waiting" | "stopped" | "todo";
/** Where the request is on its way from reception to a paid refund. A closed request stops at
 *  the decision; a query sends it back to reception, shown on the finance step. */
function stages(row: RefundView): { label: string; hint: string; state: StepState }[] {
  const s = row.status, closed = s === "DECLINED" || s === "WITHDRAWN";
  const decided = s === "APPROVED" || s === "REFUNDED" || closed;
  return [
    { label: "Logged", hint: `By ${row.creatorName}`, state: s === "DRAFT" ? "current" : "done" },
    { label: "With finance", hint: s === "NEEDS_INFORMATION" ? "Back with reception" : row.submittedAt ? formatDate(new Date(row.submittedAt)) : "Not yet", state: s === "DRAFT" ? "todo" : s === "NEEDS_INFORMATION" ? "waiting" : decided ? "done" : "current" },
    { label: closed ? refundStatuses[s].label : "Approved", hint: s === "APPROVED" || s === "REFUNDED" ? euros(row.approvedCents) : closed ? "No refund" : "Not yet", state: closed ? "stopped" : decided ? "done" : "todo" },
    { label: "Paid", hint: s === "REFUNDED" ? (row.paidOn ? formatDate(parseDateOnly(row.paidOn)) : "Recorded") : closed ? "Not needed" : "Not yet", state: s === "REFUNDED" ? "done" : s === "APPROVED" ? "current" : "todo" },
  ];
}
const stepIcons: Record<StepState, LucideIcon | null> = { done: Check, current: null, waiting: CircleHelp, stopped: X, todo: null };

function Stages({ row }: { row: RefundView }) {
  return <ol className="refund-stages" aria-label="Where the request has got to">{stages(row).map(step => {
    const Icon = stepIcons[step.state];
    return <li key={step.label} data-state={step.state} aria-current={step.state === "current" || step.state === "waiting" ? "step" : undefined}>
      <span className="refund-stage-dot" aria-hidden="true">{Icon && <Icon />}</span>
      <span className="refund-stage-label">{step.label}</span>
      <span className="refund-stage-hint">{step.hint}</span>
    </li>;
  })}</ol>;
}

/** The claim: the amount asked for, large, who for and where. */
function Claim({ row, withStages = false }: { row: RefundView; withStages?: boolean }) {
  return <Section id="claim-heading" title="The claim">
    <div className="refund-card">
      <p className="refund-amount">{euros(row.requestedCents)}</p>
      <p className="refund-muted">Requested for <strong>{row.customerName || "a customer not yet entered"}</strong> at {row.clubName} · {refundServices[row.service]}</p>
      {withStages ? <Stages row={row} /> : null}
    </div>
  </Section>;
}

/** One request, laid out as Turnfin Glass lays out a record (as Incidents does): what happens
 *  next and where the request has got to beside it, tinted blue while the move is this person's;
 *  the claim, what finance decides, the customer, the original payment and the story as cards of
 *  label and value rows; receipts; and the history. One column on phones, the next action first.
 *  While reception can still edit it, the claim sits above the form instead. */
export function RefundDetail({ data, who, sites }: { data: Detail; who: RefundActor; sites: { id: string; name: string }[] }) {
  const row = data.request, editable = editableRefund(row, who);
  const query = row.status === "NEEDS_INFORMATION" ? [...data.events].reverse().find(event => event.action === "information") : undefined;
  const finance = <RefundFinanceActions row={row} who={who} deliveryCount={data.delivery.length} />;
  const receipts = <RefundReceipts id={row.id} version={row.version} attachments={data.attachments} editable={editable} />;
  const history = <Section id="history-heading" title="History">
    <ol className="refund-card refund-history">{data.events.map(event => {
      const recorded = Object.entries({ Customer: event.snapshot.customerName, Site: event.snapshot.clubName, "Service description": event.snapshot.description, Reason: event.snapshot.reason, "Payment reference": event.snapshot.paymentReference, "Refund reference": event.snapshot.paidReference }).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== "");
      const amounts = typeof event.snapshot.requestedCents === "number" && ["submit", "approve", "pay"].includes(event.action);
      return <li key={event.id} data-action={event.action}><span className="refund-history-dot" aria-hidden="true" /><div className="min-w-0 flex-1">
        <p className="refund-history-title">{refundActions[event.action as keyof typeof refundActions] || event.action}</p>
        <p className="refund-muted refund-small">{event.actorName} · {formatDateTime(new Date(event.createdAt))}{amounts ? ` · Requested ${euros(event.snapshot.requestedCents as number)}${typeof event.snapshot.approvedCents === "number" ? ` · Approved ${euros(event.snapshot.approvedCents)}` : ""}` : ""}</p>
        {event.note && <p className="refund-history-note">{event.note}</p>}
        {recorded.length > 0 && <Collapsible><CollapsibleTrigger asChild><Button variant="ghost" className="group -ml-3"><ChevronDown aria-hidden="true" className="transition-transform group-data-[state=open]:rotate-180" />What was recorded</Button></CollapsibleTrigger>
          <CollapsibleContent><Facts items={recorded.map(([label, value]) => [label, value, label === "Service description" || label === "Reason"])} /></CollapsibleContent></Collapsible>}
      </div></li>;
    })}</ol>
  </Section>;
  const open = refundNextActions(row, who).length > 0;
  return <PageShell spacing="roomy" header={<PageHeader back={{ href: "/refunds", label: "Refund requests" }}
      eyebrow={<p className="refund-head"><Tag meta={refundStatuses[row.status]} /><span className="tabular-nums">{refundNumber(row.number)} · {refundServices[row.service]}</span></p>}
      title={row.customerName || "New customer refund"}
      description={`${euros(row.requestedCents)} requested · ${row.clubName} · logged by ${row.creatorName}`} />}>
    {query && <Notice tone="warning" title="Finance needs more information" description={query.note} />}
    {editable ? <><Claim row={row} withStages /><RefundRequestForm id={row.id} row={row} sites={sites} actions={finance}>{receipts}{history}</RefundRequestForm></>
      : <div className="refund-layout">
        <aside className="refund-card refund-next" data-tone={open ? "act" : undefined} aria-labelledby="next-action">
          <p className="refund-next-label">{open ? "Your move" : "Where it stands"}</p>
          <h2 id="next-action" className="refund-next-title">Next action</h2>
          <p className="refund-muted">{refundNextStep(row.status)}</p>
          {finance}
          <Stages row={row} />
        </aside>
        <div className="refund-main">
          <Claim row={row} />
          <Section id="decision-heading" title="The decision"><div className="refund-card"><Facts items={decision(row)} /></div></Section>
          <Section id="customer-heading" title="Customer"><div className="refund-card"><Facts items={[["Name", row.customerName || "Not entered"], ["Member number", row.memberNumber || "Not provided"], ["Contact phone", row.contactPhone || "Not provided"], ["Contact email", row.contactEmail || "Not provided"]]} /></div></Section>
          <Section id="payment-heading" title="Original payment"><div className="refund-card"><Facts items={[["Service", refundServices[row.service]], ["Site", row.clubName], ["Payment date", row.paymentDate ? formatDate(parseDateOnly(row.paymentDate)) : "Not entered"], ["Payment reference", row.paymentReference || "Not entered"]]} /></div></Section>
          <Section id="story-heading" title="What was bought and why">
            <div className="refund-card">
              <div className="refund-well"><h3>What was bought</h3><p>{row.description || "Not entered"}</p></div>
              <div className="refund-well"><h3>Why they want a refund</h3><p>{row.reason || "Not entered"}</p></div>
            </div>
          </Section>
          {row.status === "REFUNDED" && <Section id="payment-record" title="Refund paid">
            <div className="refund-card">
              <Facts items={[["Amount", euros(row.approvedCents)], ["Method", paymentMethods[row.paidMethod as keyof typeof paymentMethods] || row.paidMethod || "Not entered"], ["Reference", row.paidReference || "Not entered"], ["Recorded by", row.paidByName || "Not recorded"]]} />
              <p className="refund-muted refund-small">The payment was made outside Turnfin.</p>
            </div>
          </Section>}
          {receipts}
        </div>
        <div className="refund-side">{history}</div>
      </div>}
  </PageShell>;
}
