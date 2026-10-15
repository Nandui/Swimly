import Link from "next/link";
import { Button } from "@/components/shadcn/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { BadgeCheck, Check, ChevronDown, ChevronLeft, CircleHelp, CreditCard, FileText, MessageSquareQuote, ReceiptText, UserRound, X, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { Notice } from "@/components/ui-kit/notice";
import { RefundFinanceActions } from "@/modules/refunds/features/request/components/finance-actions";
import { RefundRequestForm } from "@/modules/refunds/features/request/components/request-form";
import { RefundReceipts } from "@/modules/refunds/features/request/components/receipts";
import { editableRefund, euros, paymentMethods, refundActions, refundNextActions, refundNextStep, refundNumber, refundServices, refundStatuses, type RefundActor, type RefundDetail as Detail, type RefundView } from "@/modules/refunds/shared/types";
import { formatDate, formatDateTime, parseDateOnly } from "@/lib/format";
import { cn } from "@/lib/utils";

/** One fact: a caption over its value. Long text takes the whole row. */
function Facts({ items }: { items: [string, string, boolean?][] }) {
  return <dl className="refund-facts">{items.map(([label, value, wide]) => <div key={label} className={cn("min-w-0", wide && "refund-wide")}>
    <dt className="text-xs font-semibold text-ui-muted-foreground">{label}</dt>
    <dd className={cn("mt-1 break-words", wide && "whitespace-pre-wrap")}>{value}</dd>
  </div>)}</dl>;
}

/** The figures under the claimed amount: what was approved, and payment. */
function summary(row: RefundView): { label: string; value: string; hint: string; icon: LucideIcon }[] {
  const decided = row.approvedCents !== null && (row.status === "APPROVED" || row.status === "REFUNDED");
  const approved = decided ? euros(row.approvedCents)
    : row.status === "WITHDRAWN" && row.approvedCents !== null ? "Approval cancelled"
    : row.status === "DECLINED" || row.status === "WITHDRAWN" ? "Not approved"
    : row.status === "DRAFT" ? "Not submitted" : "Pending";
  return [
    { label: "Approved", value: approved, hint: decided && row.approvedByName ? `By ${row.approvedByName}` : row.status === "DECLINED" || row.status === "WITHDRAWN" ? "Closed without a refund" : "Not decided yet", icon: BadgeCheck },
    { label: "Payment", value: row.status === "REFUNDED" ? (row.paidOn ? formatDate(parseDateOnly(row.paidOn)) : "Recorded") : row.status === "APPROVED" ? "Not paid yet" : "Not recorded", hint: "Made outside Turnfin", icon: ReceiptText },
    { label: "Finance handler", value: row.handlerName || "Unassigned", hint: row.handlerName ? "Taking care of it" : "Anyone in finance can pick it up", icon: UserRound },
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

/** The claim at the top of a request: the amount asked for, who for, where it is on its way to
 *  payment, and the figures finance decides on. */
function Claim({ row }: { row: RefundView }) {
  return <section className="refund-shell refund-claim" aria-labelledby="claim-heading"><div className="refund-core">
    <div className="refund-claim-head">
      <div className="min-w-0">
        <span className="refund-eyebrow">Refund claim · {refundServices[row.service]}</span>
        <h2 id="claim-heading" className="sr-only">Claim</h2>
        <p className="refund-amount">{euros(row.requestedCents)}</p>
        <p className="refund-claim-for">Requested for <strong>{row.customerName || "a customer not yet entered"}</strong> at {row.clubName}</p>
      </div>
    </div>
    <ol className="refund-stages" aria-label="Progress">{stages(row).map(step => {
      const Icon = stepIcons[step.state];
      return <li key={step.label} data-state={step.state} aria-current={step.state === "current" || step.state === "waiting" ? "step" : undefined}>
        <span className="refund-stage-dot" aria-hidden="true">{Icon && <Icon />}</span>
        <span className="refund-stage-label">{step.label}</span>
        <span className="refund-stage-hint">{step.hint}</span>
      </li>;
    })}</ol>
    <ul className="refund-figures" aria-label="Summary">{summary(row).map(({ label, value, hint, icon: Icon }) => <li key={label}>
      <span className="refund-figure-label"><Icon aria-hidden="true" />{label}</span>
      <span className="refund-figure-value">{value}</span>
      <span className="refund-figure-hint">{hint}</span>
    </li>)}</ul>
  </div></section>;
}

/** A labelled group of facts in a soft well, so finance can check one thing at a time. */
function Group({ title, icon: Icon, items }: { title: string; icon: LucideIcon; items: [string, string, boolean?][] }) {
  return <div className="refund-well"><h3 className="refund-well-title"><Icon aria-hidden="true" />{title}</h3><Facts items={items} /></div>;
}

export function RefundDetail({ data, who, sites }: { data: Detail; who: RefundActor; sites: { id: string; name: string }[] }) {
  const row = data.request, editable = editableRefund(row, who);
  const query = row.status === 'NEEDS_INFORMATION' ? [...data.events].reverse().find(event => event.action === 'information') : undefined;
  const finance = <RefundFinanceActions row={row} who={who} deliveryCount={data.delivery.length} />;
  // While reception edits a request, its form panels stay plain, so receipts and history do too.
  const shell = (panel: React.ReactNode) => editable ? panel : <div className="refund-shell">{panel}</div>;
  const receipts = shell(<RefundReceipts id={row.id} version={row.version} attachments={data.attachments} editable={editable} />);
  const history = shell(<section className="pc-panel" aria-labelledby="history-heading"><h2 id="history-heading" className="text-lg font-semibold">Request history</h2>
    <ol className="refund-history">{data.events.map(event => {
      const recorded = Object.entries({ Customer: event.snapshot.customerName, Site: event.snapshot.clubName, 'Service description': event.snapshot.description, Reason: event.snapshot.reason, 'Payment reference': event.snapshot.paymentReference, 'Refund reference': event.snapshot.paidReference }).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '');
      const amounts = typeof event.snapshot.requestedCents === 'number' && ['submit', 'approve', 'pay'].includes(event.action);
      return <li key={event.id} data-action={event.action}><span className="refund-history-dot" aria-hidden="true" /><div className="min-w-0 flex-1">
        <p className="break-words"><strong className="font-semibold">{refundActions[event.action as keyof typeof refundActions] || event.action}</strong></p>
        <p className="refund-history-meta">{event.actorName} · {formatDateTime(new Date(event.createdAt))}{amounts ? ` · Requested ${euros(event.snapshot.requestedCents as number)}${typeof event.snapshot.approvedCents === 'number' ? ` · Approved ${euros(event.snapshot.approvedCents)}` : ''}` : ''}</p>
        {event.note && <p className="refund-history-note">{event.note}</p>}
        {recorded.length > 0 && <Collapsible><CollapsibleTrigger asChild><Button variant="ghost" className="group"><ChevronDown aria-hidden="true" className="transition-transform group-data-[state=open]:rotate-180" />View recorded details</Button></CollapsibleTrigger>
          <CollapsibleContent><div className="refund-well mt-2"><Facts items={recorded.map(([label, value]) => [label, value, label === 'Service description' || label === 'Reason'])} /></div></CollapsibleContent></Collapsible>}
      </div></li>;
    })}</ol>
  </section>);
  const open = refundNextActions(row, who).length > 0;
  return <div className="refund-inspect">
    <PageHeader title={refundNumber(row.number)} description={`${row.customerName || 'New customer refund'} · ${row.clubName}`} status={<Tag meta={refundStatuses[row.status]} />}
      actions={<Button asChild variant="outline"><Link href="/refunds"><ChevronLeft aria-hidden="true" />Back to requests</Link></Button>} />
    {query && <Notice tone="warning" title="Finance needs more information" description={query.note} />}
    {editable ? <><Claim row={row} /><RefundRequestForm id={row.id} row={row} sites={sites} actions={finance}>{receipts}{history}</RefundRequestForm></>
      : <div className="refund-bento">
        <Claim row={row} />
        {/* The decision sits beside the claim, and straight after it on phones. Only a request
            this person can move on gets the blue edge; a closed one is a plain card. */}
        <aside className={cn('refund-shell refund-decide', open && 'refund-decide-open')} aria-labelledby="next-action"><div className="refund-core">
          <span className="refund-eyebrow">{open ? 'Your move' : 'Status'}</span>
          <h2 id="next-action" className="text-lg font-semibold">Next action</h2>
          <p className="text-sm text-ui-muted-foreground">{refundNextStep(row.status)}</p>
          {finance}
        </div></aside>
        <div className="refund-main">
          <section className="refund-shell" aria-labelledby="request-details"><div className="refund-core">
            <div><span className="refund-eyebrow">Check the claim</span><h2 id="request-details" className="mt-2 text-lg font-semibold">Request details</h2></div>
            <div className="refund-wells">
              <Group title="Customer" icon={UserRound} items={[['Name', row.customerName || 'Not entered'], ['Member number', row.memberNumber || 'Not provided'], ['Contact phone', row.contactPhone || 'Not provided'], ['Contact email', row.contactEmail || 'Not provided', true]]} />
              <Group title="Original payment" icon={CreditCard} items={[['Service', refundServices[row.service]], ['Site', row.clubName], ['Payment date', row.paymentDate ? formatDate(parseDateOnly(row.paymentDate)) : 'Not entered'], ['Payment reference', row.paymentReference || 'Not entered']]} />
            </div>
            <div className="refund-story">
              <div><h3 className="refund-well-title"><FileText aria-hidden="true" />What was bought</h3><p className="refund-quote">{row.description || 'Not entered'}</p></div>
              <div><h3 className="refund-well-title"><MessageSquareQuote aria-hidden="true" />Why they want a refund</h3><p className="refund-quote">{row.reason || 'Not entered'}</p></div>
            </div>
          </div></section>
          {row.status === 'REFUNDED' && <section className="refund-shell" aria-labelledby="payment-record"><div className="refund-core">
            <h2 id="payment-record" className="text-lg font-semibold">External payment record</h2>
            <Facts items={[['Amount', euros(row.approvedCents)], ['Method', paymentMethods[row.paidMethod as keyof typeof paymentMethods] || row.paidMethod || 'Not entered'], ['Reference', row.paidReference || 'Not entered'], ['Recorded by', row.paidByName || 'Not recorded']]} />
            <p className="text-xs text-ui-muted-foreground">The payment was made outside Turnfin.</p></div></section>}
          {receipts}
          {history}
        </div>
      </div>}
  </div>;
}
