"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { LoadingButton } from "@/components/ui/loading-button";
import { Notice } from "@/components/ui-kit/notice";
import { Ban, Banknote, CircleCheck, CircleHelp, CircleX, RotateCcw, UserCheck, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveRefund, retryRefundEmails } from "@/modules/refunds/features/request/server/actions";
import { euros, paymentMethods, refundNextActions, type RefundActor, type RefundFinanceAction as Action, type RefundView } from "@/modules/refunds/shared/types";
import { today } from "@/lib/format";

const actionLabels: Record<Action, string> = { claim: "Take responsibility", information: "Request information", approve: "Approve refund", decline: "Decline request", withdraw: "Withdraw request", cancel: "Cancel approval", pay: "Record payment" };
const actionIcons: Record<Action, LucideIcon> = { claim: UserCheck, information: CircleHelp, approve: CircleCheck, decline: CircleX, withdraw: Ban, cancel: RotateCcw, pay: Banknote };
const pendingLabels: Record<Action, string> = { claim: "Saving…", information: "Sending…", approve: "Approving…", decline: "Declining…", withdraw: "Withdrawing…", cancel: "Cancelling…", pay: "Recording…" };
/** Outcomes that close a request or undo a decision confirm in the danger colour. */
const closing = new Set<Action>(["decline", "withdraw", "cancel"]);

/** The finance and reception steps on a request: the triggers (the panel that holds them owns
 *  its heading), the email alert notice for finance, and one confirm dialog per step. */
export function RefundFinanceActions({ row, who, deliveryCount }: { row: RefundView; who: RefundActor; deliveryCount: number }) {
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null), [note, setNote] = useState(''), [amount, setAmount] = useState(''), [paidOn, setPaidOn] = useState(today()), [paidMethod, setPaidMethod] = useState('CARD'), [paidReference, setPaidReference] = useState('');
  const [pending, setPending] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const trigger = useRef<HTMLButtonElement | null>(null);
  const operation = useRef<{ key: string; id: string } | null>(null);
  const reviewable = ['SUBMITTED', 'IN_REVIEW'].includes(row.status), independent = row.creatorId !== who.id;
  const actions = refundNextActions(row, who), finance = who.review || who.process;
  const main = actions.filter(key => key !== 'withdraw');
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
    try { const result = await retryRefundEmails(row.id); setNotice(result.ok ? result.warning || 'Email alerts sent again.' : result.error); router.refresh(); }
    catch { setNotice('We couldn’t send the alerts again. Try again later.'); } finally { setPending(false); }
  }
  const button = (key: Action) => {
    const Icon = actionIcons[key];
    return <Button key={key} disabled={pending} onClick={event => { trigger.current = event.currentTarget; open(key); }} variant={key === 'approve' || key === 'pay' ? 'default' : key === 'withdraw' ? 'ghost' : 'outline'}><Icon aria-hidden="true" />{actionLabels[key]}</Button>;
  };
  const ActionIcon = action ? actionIcons[action] : null;
  return <>
    {reviewable && who.review && !independent && <Notice title="Another finance colleague must review your request." />}
    {main.length > 0 && <div className="refund-action-buttons">{main.map(button)}</div>}
    {actions.includes('withdraw') && <div className="refund-action-buttons">{button('withdraw')}</div>}
    {deliveryCount > 0 && finance && <Notice tone="warning" title="We couldn’t confirm the email alert" description="The request is saved. Send it again if they haven’t seen it." actions={<Button onClick={retry} disabled={pending} variant="outline">Send again</Button>} />}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    <Dialog open={!!action} onOpenChange={openState => { if (!openState && !pending) setAction(null); }}><DialogContent portalClassName="turnfin-docs turnfin-refunds" onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }} className="max-h-(--pc-overlay-max-height) overflow-y-auto" showCloseButton={false}><DialogHeader><DialogTitle>{action ? actionLabels[action] : ''}</DialogTitle><DialogDescription>{action ? descriptions[action] : ''}</DialogDescription></DialogHeader>
      <form method="post" onSubmit={event => { event.preventDefault(); void apply(event.currentTarget); }} className="space-y-4"><fieldset disabled={pending} className="space-y-4">
        {action === 'approve' && <Input id="approved-amount" name="amount" label="Approved refund (€)" value={amount} onChange={setAmount} inputMode="decimal" required />}
        {action === 'pay' && <><Input id="paid-on" name="paidOn" label="Refund payment date" type="date" value={paidOn} onChange={setPaidOn} required /><Select id="paid-method" name="paidMethod" label="Payment method" value={paidMethod} onValueChange={setPaidMethod} options={Object.entries(paymentMethods).map(([value, label]) => ({ value, label }))} required /><Input id="paid-reference" name="paidReference" label="External payment reference" value={paidReference} maxLength={200} onChange={setPaidReference} required /></>}
        {action !== 'claim' && <Textarea id="decision-note" name="note" label={action === 'pay' ? 'Payment note' : action === 'approve' ? 'Decision note' : 'Reason'} optional={action === 'pay'} description={action === 'approve' ? 'Needed when you approve less than requested.' : undefined} value={note} maxLength={4000} onChange={event => setNote(event.target.value)} required={action !== 'approve' && action !== 'pay'} rows={4} />}
        {error && <Notice tone="error" live="alert" title={error} />}
        <DialogFooter><Button type="button" variant="outline" onClick={() => setAction(null)}>Go back</Button><LoadingButton type="submit" pending={pending} pendingLabel={action ? pendingLabels[action] : undefined} variant={action && closing.has(action) ? 'destructive' : 'default'}>{ActionIcon && <ActionIcon aria-hidden="true" />}{action ? actionLabels[action] : 'Confirm'}</LoadingButton></DialogFooter>
      </fieldset></form>
    </DialogContent></Dialog>
  </>;
}
