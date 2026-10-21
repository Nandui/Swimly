"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CircleCheck, CircleHelp, CircleX, PackageCheck, RotateCcw, UserCheck, type LucideIcon } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";
import { Textarea } from "@/components/ui/textarea";
import { Notice } from "@/components/ui-kit/notice";
import { retryCoinageEmails, saveCoinage } from "@/modules/coinage/features/request/server/actions";
import { coinageNextActions, euros, type CoinageActor, type CoinageNextAction as Action, type CoinageView } from "@/modules/coinage/shared/types";
import { today } from "@/lib/format";

const actionLabels: Record<Action, string> = { claim: "Take this on", information: "Ask for more information", approve: "Approve request", decline: "Decline request", withdraw: "Withdraw request", cancel: "Cancel approval", order: "Record the order" };
const actionIcons: Record<Action, LucideIcon> = { claim: UserCheck, information: CircleHelp, approve: CircleCheck, decline: CircleX, withdraw: Ban, cancel: RotateCcw, order: PackageCheck };
const pendingLabels: Record<Action, string> = { claim: "Saving…", information: "Sending…", approve: "Approving…", decline: "Declining…", withdraw: "Withdrawing…", cancel: "Cancelling…", order: "Recording…" };
/** Outcomes that close a request or undo a decision confirm in the danger colour. */
const closing = new Set<Action>(["decline", "withdraw", "cancel"]);

/** The accounts and desk steps on a request: the buttons (the panel that holds them owns its
 *  heading), the email alert notice for accounts, and one confirm dialog per step. */
export function CoinageAccountsActions({ row, who, deliveryCount }: { row: CoinageView; who: CoinageActor; deliveryCount: number }) {
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null), [note, setNote] = useState(""), [orderedOn, setOrderedOn] = useState(today()), [deliveryOn, setDeliveryOn] = useState(row.neededBy || today()), [orderReference, setOrderReference] = useState("");
  const [pending, setPending] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const trigger = useRef<HTMLButtonElement | null>(null);
  const operation = useRef<{ key: string; id: string } | null>(null);
  const reviewable = ["SUBMITTED", "IN_REVIEW"].includes(row.status), independent = row.creatorId !== who.id;
  const actions = coinageNextActions(row, who), accounts = who.review || who.process;
  const main = actions.filter(key => key !== "withdraw");
  const descriptions: Record<Action, string> = {
    claim: row.handlerName ? `Take over from ${row.handlerName}. The change is recorded; colleagues can still help.` : "Your name will show as the accounts handler. Colleagues can still help.",
    approve: `Approve ${euros(row.totalCents)} of coinage for ${row.forWhom || row.clubName}. Approving doesn’t order it; record the order once it is placed.`,
    information: "Say what the desk needs to add or correct. The request goes back to them to send again.",
    decline: "Explain the decision so the desk knows what to do instead. This closes the request.",
    withdraw: "Withdraw this request before it is approved. Its history is kept.",
    cancel: "Make sure it hasn’t been ordered, then explain why the approval is being cancelled.",
    order: `Record that ${euros(row.totalCents)} of coinage has been ordered for ${row.clubName}. This records the order; it doesn’t place it.`,
  };
  function open(next: Action) { setAction(next); setNote(""); setError(""); }
  async function apply(form: HTMLFormElement) {
    if (!action) return;
    const values = new FormData(form);
    const payload = { id: row.id, version: row.version, action, note: String(values.get("note") ?? note), orderedOn: String(values.get("orderedOn") ?? orderedOn), deliveryOn: String(values.get("deliveryOn") ?? deliveryOn), orderReference: String(values.get("orderReference") ?? orderReference) };
    const key = JSON.stringify(payload);
    if (operation.current?.key !== key) operation.current = { key, id: crypto.randomUUID() };
    setPending(true); setError("");
    try {
      const result = await saveCoinage({ ...payload, operationId: operation.current.id });
      if (!result.ok) { setError(result.error); return; }
      operation.current = null; setAction(null); setNotice(result.warning || "Request updated."); router.refresh();
    } catch { setError("Could not confirm the update. Try again; the same step will not be recorded twice."); }
    finally { setPending(false); }
  }
  async function retry() {
    setPending(true); setNotice("");
    try { const result = await retryCoinageEmails(row.id); setNotice(result.ok ? result.warning || "Email alerts sent again." : result.error); router.refresh(); }
    catch { setNotice("We couldn’t send the alerts again. Try again later."); } finally { setPending(false); }
  }
  const button = (key: Action) => {
    const Icon = actionIcons[key];
    return <Button key={key} className="justify-start" disabled={pending} onClick={event => { trigger.current = event.currentTarget; open(key); }} variant={key === "approve" || key === "order" ? "default" : key === "withdraw" ? "ghost" : "outline"}><Icon aria-hidden="true" />{actionLabels[key]}</Button>;
  };
  const ActionIcon = action ? actionIcons[action] : null;
  return <>
    {reviewable && who.review && !independent && <Notice title="Another accounts colleague must decide your own request." />}
    {main.length > 0 && <div className="flex flex-col gap-2">{main.map(button)}</div>}
    {actions.includes("withdraw") && <div className="flex flex-col gap-2">{button("withdraw")}</div>}
    {deliveryCount > 0 && accounts && <Notice tone="warning" title="We couldn’t confirm the email alert" description="The request is saved. Send it again if they haven’t seen it." actions={<Button onClick={retry} disabled={pending} variant="outline">Send again</Button>} />}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    <Dialog open={!!action} onOpenChange={openState => { if (!openState && !pending) setAction(null); }}>
      <DialogContent onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }} className="max-h-(--pc-overlay-max-height) overflow-y-auto" showCloseButton={false}>
        <DialogHeader><DialogTitle>{action ? actionLabels[action] : ""}</DialogTitle><DialogDescription>{action ? descriptions[action] : ""}</DialogDescription></DialogHeader>
        <form method="post" onSubmit={event => { event.preventDefault(); void apply(event.currentTarget); }} className="space-y-4"><fieldset disabled={pending} className="space-y-4">
          {action === "order" && <>
            <Input id="ordered-on" name="orderedOn" label="Ordered on" type="date" value={orderedOn} max={today()} onChange={setOrderedOn} required />
            <Input id="delivery-on" name="deliveryOn" label="Delivery expected" type="date" value={deliveryOn} min={orderedOn} onChange={setDeliveryOn} required />
            <Input id="order-reference" name="orderReference" label="Order reference" value={orderReference} maxLength={200} onChange={setOrderReference} required description="The bank’s or the cash carrier’s reference for this order." />
          </>}
          {action !== "claim" && <Textarea id="decision-note" name="note" label={action === "order" || action === "approve" ? "Note" : "Reason"} optional={action === "order" || action === "approve"} value={note} maxLength={4000} onChange={event => setNote(event.target.value)} required={action !== "approve" && action !== "order"} rows={4} />}
          {error && <Notice tone="error" live="alert" title={error} />}
          <DialogFooter><Button type="button" variant="outline" onClick={() => setAction(null)}>Go back</Button><LoadingButton type="submit" pending={pending} pendingLabel={action ? pendingLabels[action] : undefined} variant={action && closing.has(action) ? "destructive" : "default"}>{ActionIcon && <ActionIcon aria-hidden="true" />}{action ? actionLabels[action] : "Confirm"}</LoadingButton></DialogFooter>
        </fieldset></form>
      </DialogContent>
    </Dialog>
  </>;
}
