import Link from "next/link";
import { Button } from "@/components/shadcn/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { BadgeCheck, ChevronDown, ChevronLeft, Euro, ReceiptText, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { Notice } from "@/components/ui-kit/notice";
import { RefundFinanceActions } from "@/components/refunds/finance-actions";
import { RefundRequestForm } from "@/components/refunds/request-form";
import { RefundReceipts } from "@/components/refunds/receipts";
import { editableRefund, euros, paymentMethods, refundActions, refundNextActions, refundNextStep, refundNumber, refundServices, refundStatuses, type RefundActor, type RefundDetail as Detail, type RefundView } from "@/lib/refunds/types";
import { formatDate, formatDateTime, parseDateOnly } from "@/lib/format";
import { cn } from "@/lib/utils";

/** One fact: a caption over its value. Long text takes the whole row. */
function Facts({ items }: { items: [string, string, boolean?][] }) {
  return <dl className="refund-facts">{items.map(([label, value, wide]) => <div key={label} className={cn("min-w-0", wide && "refund-wide")}>
    <dt className="text-xs font-semibold text-ui-muted-foreground">{label}</dt>
    <dd className={cn("mt-1 break-words", wide && "whitespace-pre-wrap")}>{value}</dd>
  </div>)}</dl>;
}

/** The three figures at the top of a request: what was asked, what was approved, and payment. */
function summary(row: RefundView): { label: string; value: string; hint: string; icon: LucideIcon }[] {
  const decided = row.approvedCents !== null && (row.status === "APPROVED" || row.status === "REFUNDED");
  const approved = decided ? euros(row.approvedCents)
    : row.status === "WITHDRAWN" && row.approvedCents !== null ? "Approval cancelled"
    : row.status === "DECLINED" || row.status === "WITHDRAWN" ? "Not approved"
    : row.status === "DRAFT" ? "Not submitted" : "Pending";
  return [
    { label: "Requested", value: euros(row.requestedCents), hint: refundServices[row.service], icon: Euro },
    { label: "Approved", value: approved, hint: decided && row.approvedByName ? `By ${row.approvedByName}` : row.status === "DECLINED" || row.status === "WITHDRAWN" ? "Closed without a refund" : "Not decided yet", icon: BadgeCheck },
    { label: "Payment", value: row.status === "REFUNDED" ? (row.paidOn ? formatDate(parseDateOnly(row.paidOn)) : "Recorded") : row.status === "APPROVED" ? "Not paid yet" : "Not recorded", hint: "Made outside Turnfin", icon: ReceiptText },
  ];
}

export function RefundDetail({ data, who, sites }: { data: Detail; who: RefundActor; sites: { id: string; name: string }[] }) {
  const row = data.request, editable = editableRefund(row, who);
  const query = row.status === 'NEEDS_INFORMATION' ? [...data.events].reverse().find(event => event.action === 'information') : undefined;
  const facts: [string, string, boolean?][] = [
    ['Customer', row.customerName || 'Not entered'], ['Site', row.clubName], ['Service', refundServices[row.service]],
    ['Member number', row.memberNumber || 'Not provided'], ['Contact email', row.contactEmail || 'Not provided'], ['Contact phone', row.contactPhone || 'Not provided'],
    ['Original payment date', row.paymentDate ? formatDate(parseDateOnly(row.paymentDate)) : 'Not entered'], ['Original payment reference', row.paymentReference || 'Not entered'],
    ['Submitted by', row.creatorName], ['Finance handler', row.handlerName || 'Unassigned'],
    ['Service description', row.description || 'Not entered', true], ['Refund reason', row.reason || 'Not entered', true],
  ];
  const finance = <RefundFinanceActions row={row} who={who} deliveryCount={data.delivery.length} />;
  const receipts = <RefundReceipts id={row.id} version={row.version} attachments={data.attachments} editable={editable} />;
  const history = <section className="pc-panel" aria-labelledby="history-heading"><h2 id="history-heading" className="text-lg font-semibold">Request history</h2>
    <ol className="pc-feed refund-history">{data.events.map(event => {
      const recorded = Object.entries({ Customer: event.snapshot.customerName, Site: event.snapshot.clubName, 'Service description': event.snapshot.description, Reason: event.snapshot.reason, 'Payment reference': event.snapshot.paymentReference, 'Refund reference': event.snapshot.paidReference }).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '');
      return <li key={event.id}><span className="pc-feed-dot" aria-hidden="true" /><div className="min-w-0 flex-1">
        <p className="break-words"><strong className="font-semibold">{refundActions[event.action as keyof typeof refundActions] || event.action}</strong> · {event.actorName} · {formatDateTime(new Date(event.createdAt))}</p>
        {event.note && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{event.note}</p>}
        {['submit', 'approve', 'pay'].includes(event.action) && <p className="text-xs text-ui-muted-foreground">Requested {euros(typeof event.snapshot.requestedCents === 'number' ? event.snapshot.requestedCents : null)}{typeof event.snapshot.approvedCents === 'number' ? ` · Approved ${euros(event.snapshot.approvedCents)}` : ''}</p>}
        {recorded.length > 0 && <Collapsible><CollapsibleTrigger asChild><Button variant="ghost" className="group"><ChevronDown aria-hidden="true" className="transition-transform group-data-[state=open]:rotate-180" />View recorded details</Button></CollapsibleTrigger>
          <CollapsibleContent><div className="mt-2 rounded-ui-md bg-ui-muted p-4"><Facts items={recorded.map(([label, value]) => [label, value, label === 'Service description' || label === 'Reason'])} /></div></CollapsibleContent></Collapsible>}
      </div></li>;
    })}</ol>
  </section>;
  return <>
    <PageHeader title={refundNumber(row.number)} description={`${row.customerName || 'New customer refund'} · ${row.clubName}`} status={<Tag meta={refundStatuses[row.status]} />}
      actions={<Button asChild variant="outline"><Link href="/refunds"><ChevronLeft aria-hidden="true" />Back to requests</Link></Button>} />
    <ul className="pc-stats refund-summary" aria-label="Summary">{summary(row).map(({ label, value, hint, icon: Icon }) => <li key={label} className="flex"><div className="pc-stat w-full">
      <span className="pc-tile-icon"><Icon aria-hidden="true" /></span>
      <span><span className="pc-stat-figure block break-words">{value}</span><span className="block font-semibold">{label}</span></span>
      <span className="text-xs text-ui-muted-foreground">{hint}</span>
    </div></li>)}</ul>
    {query && <Notice tone="warning" title="Finance needs more information" description={query.note} />}
    {editable ? <RefundRequestForm id={row.id} row={row} sites={sites} actions={finance}>{receipts}{history}</RefundRequestForm>
      : <div className="refund-detail-columns">
        <div className="refund-main">
          <section className="pc-panel" aria-labelledby="request-details"><h2 id="request-details" className="text-lg font-semibold">Request details</h2><Facts items={facts} /></section>
          {row.status === 'REFUNDED' && <section className="pc-panel" aria-labelledby="payment-record"><h2 id="payment-record" className="text-lg font-semibold">External payment record</h2>
            <Facts items={[['Amount', euros(row.approvedCents)], ['Method', paymentMethods[row.paidMethod as keyof typeof paymentMethods] || row.paidMethod || 'Not entered'], ['Reference', row.paidReference || 'Not entered'], ['Recorded by', row.paidByName || 'Not recorded']]} />
            <p className="text-xs text-ui-muted-foreground">The payment was made outside Turnfin.</p></section>}
          {receipts}
          {history}
        </div>
        {/* Only a request this person can move on gets the edge; a closed one is a plain panel. */}
        <aside className={cn('pc-panel', refundNextActions(row, who).length > 0 && 'refund-action-panel')} aria-labelledby="next-action">
          <h2 id="next-action" className="text-lg font-semibold">Next action</h2>
          <p className="text-sm text-ui-muted-foreground">{refundNextStep(row.status)}</p>
          {finance}
        </aside>
      </div>}
  </>;
}
