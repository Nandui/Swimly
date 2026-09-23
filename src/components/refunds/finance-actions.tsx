"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { LoadingButton } from "@/components/ui/loading-button";
import { Notice } from "@/components/ui-kit/notice";
import { RefundInput, RefundSelect, RefundText } from "@/components/refunds/fields";
import { saveRefund, retryRefundEmails } from "@/lib/refunds/actions";
import { euros, paymentMethods, type RefundActor, type RefundView } from "@/lib/refunds/types";
import { today } from "@/lib/format";

const actionLabels = { claim: "Take responsibility", information: "Request information", approve: "Approve refund", decline: "Decline request", withdraw: "Withdraw request", cancel: "Cancel approval", pay: "Record payment" };
type Action = keyof typeof actionLabels;
export function RefundFinanceActions({ row, who, deliveryCount }: { row: RefundView; who: RefundActor; deliveryCount: number }) {
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null), [note, setNote] = useState(''), [amount, setAmount] = useState(''), [paidOn, setPaidOn] = useState(today()), [paidMethod, setPaidMethod] = useState('CARD'), [paidReference, setPaidReference] = useState('');
  const [pending, setPending] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const trigger = useRef<HTMLButtonElement | null>(null);
  const operation = useRef<{ key: string; id: string } | null>(null);
  const reviewable = ['SUBMITTED', 'IN_REVIEW'].includes(row.status), independent = row.creatorId !== who.id;
  const actions: Action[] = [
    ...((reviewable && who.review || row.status === 'APPROVED' && who.process) && row.handlerId !== who.id ? ['claim' as const] : []),
    ...(reviewable && who.review && independent ? ['approve', 'information', 'decline'] as const : []),
    ...(row.status === 'APPROVED' && who.process ? ['pay' as const] : []),
    ...(row.status === 'APPROVED' && (who.review || who.process) ? ['cancel' as const] : []),
    ...(who.request && ['DRAFT','SUBMITTED','IN_REVIEW','NEEDS_INFORMATION'].includes(row.status) ? ['withdraw' as const] : []),
  ];
  const descriptions: Record<Action, string> = {
    claim: row.handlerName ? `Take over from ${row.handlerName}. The change will be recorded; colleagues can still help with the request.` : 'Your name will appear as the finance handler. Colleagues can still help with the request.',
    approve: `Requested: ${euros(row.requestedCents)}. Approval does not issue a payment. Explain any reduction in the amount.`,
    information: 'Explain what reception needs to add or correct. The request will return to reception for resubmission.',
    decline: 'Explain the decision so reception can answer the customer. This closes the request without a refund.',
    withdraw: 'Withdraw this unapproved request. Its history will be kept.',
    cancel: 'Confirm that the approved refund has not been paid elsewhere, then explain why the approval is being cancelled.',
    pay: `Confirm that ${euros(row.approvedCents)} has already been paid through your payment system. This records the payment; it does not send money.`,
  };
  function open(next: Action) { setAction(next); setNote(''); setAmount(row.requestedCents ? (row.requestedCents / 100).toFixed(2) : ''); setError(''); }
  async function apply(form: HTMLFormElement) {
    if (!action) return;
    const values = new FormData(form);
    const payload = { id: row.id, version: row.version, action, note: String(values.get('note') ?? note), amount: String(values.get('amount') ?? amount), paidOn: String(values.get('paidOn') ?? paidOn), paidMethod: String(values.get('paidMethod') ?? paidMethod), paidReference: String(values.get('paidReference') ?? paidReference) };
    setNote(payload.note); setAmount(payload.amount); setPaidOn(payload.paidOn); setPaidMethod(payload.paidMethod); setPaidReference(payload.paidReference);
    const key = JSON.stringify(payload);
    if (operation.current?.key !== key) operation.current = { key, id: crypto.randomUUID() };
    setPending(true); setError('');
    try {
      const result = await saveRefund({ ...payload, operationId: operation.current.id });
      if (!result.ok) { setError(result.error); return; }
      operation.current = null; setAction(null); setNotice(result.warning || 'Request updated.'); router.refresh();
    } catch { setError('Could not confirm the update. Try again; the same action will not be recorded twice.'); }
    finally { setPending(false); }
  }
  async function retry() {
    setPending(true); setNotice('');
    try { const result = await retryRefundEmails(row.id); setNotice(result.ok ? result.warning || 'Staff alerts submitted to the email provider.' : result.error); router.refresh(); }
    catch { setNotice('Could not retry alerts. Try again later.'); } finally { setPending(false); }
  }
  return <section className="space-y-4" aria-labelledby="next-action"><h2 id="next-action" className="text-lg font-semibold">Next action</h2>
    <p className="text-sm leading-relaxed text-ui-muted-foreground">{row.status === 'DRAFT' ? 'Complete the details and submit to finance when ready.' : row.status === 'NEEDS_INFORMATION' ? 'Reception needs to answer the finance query and resubmit.' : row.status === 'APPROVED' ? 'Finance needs to issue the refund in the payment system, then record it here.' : reviewable ? 'Finance needs to review the request and decide the outcome.' : 'This request is closed. Its decisions and payment history are retained.'}</p>
    {reviewable && who.review && !independent && <Notice title="Another finance colleague must review your request." />}
    <div className="flex flex-wrap gap-2">{actions.map(key => <Button key={key} disabled={pending} onClick={event => { trigger.current = event.currentTarget; open(key); }} variant={key === 'approve' || key === 'pay' ? 'default' : 'outline'} className="min-h-11">{actionLabels[key]}</Button>)}</div>
    {deliveryCount > 0 && <Notice tone="warning" title={`${deliveryCount} staff ${deliveryCount === 1 ? 'alert is' : 'alerts are'} waiting for delivery.`} description="The refund request is saved. An uncertain send may already have arrived, so a retry can send another alert." actions={(who.review || who.process) ? <Button onClick={retry} disabled={pending} variant="outline" className="min-h-11">Retry staff alerts</Button> : undefined} />}
    {notice && <p role="status" className="text-sm leading-relaxed">{notice}</p>}
    <Dialog open={!!action} onOpenChange={openState => { if (!openState && !pending) setAction(null); }}><DialogContent portalClassName="turnfin-docs turnfin-refunds" onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }} className="max-h-[90svh] overflow-y-auto [&>button]:flex [&>button]:min-h-11 [&>button]:min-w-11 [&>button]:items-center [&>button]:justify-center"><DialogHeader><DialogTitle>{action ? actionLabels[action] : ''}</DialogTitle><DialogDescription>{action ? descriptions[action] : ''}</DialogDescription></DialogHeader>
      <form onSubmit={event => { event.preventDefault(); void apply(event.currentTarget); }} className="space-y-4"><fieldset disabled={pending} className="space-y-4">
        {action === 'approve' && <RefundInput id="approved-amount" name="amount" label="Approved refund (€)" value={amount} onChange={event => setAmount(event.target.value)} inputMode="decimal" required />}
        {action === 'pay' && <><RefundInput id="paid-on" name="paidOn" label="Refund payment date" type="date" value={paidOn} onChange={event => setPaidOn(event.target.value)} required /><RefundSelect id="paid-method" name="paidMethod" label="Payment method" value={paidMethod} onChange={setPaidMethod} options={Object.entries(paymentMethods).map(([value, label]) => ({ value, label }))} /><RefundInput id="paid-reference" name="paidReference" label="External payment reference" value={paidReference} maxLength={200} onChange={event => setPaidReference(event.target.value)} required /></>}
        {action !== 'claim' && <RefundText id="decision-note" name="note" label={action === 'pay' ? 'Payment note (optional)' : action === 'approve' ? 'Decision note (required for a reduced amount)' : 'Reason'} value={note} maxLength={4000} onChange={event => setNote(event.target.value)} required={action !== 'approve' && action !== 'pay'} />}
        {error && <Notice tone="error" title={error} />}
        <DialogFooter><Button type="button" variant="outline" className="min-h-11" onClick={() => setAction(null)}>Go back</Button><LoadingButton type="submit" pending={pending} className="min-h-11">{action ? actionLabels[action] : 'Confirm'}</LoadingButton></DialogFooter>
      </fieldset></form>
    </DialogContent></Dialog>
  </section>;
}
