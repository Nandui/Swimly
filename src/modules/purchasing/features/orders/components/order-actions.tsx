"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, Printer, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Textarea } from "@/components/shadcn/textarea";
import { ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { cancelOrder, decideOrder } from "@/modules/purchasing/features/orders/server/actions";

const THEME = "turnfin-docs turnfin-module turnfin-purchasing";

/** Approve: the order gets the site's next number. */
export function ApproveOrder({ id, total }: { id: string; total: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={<Button className="min-h-11"><Check aria-hidden="true" />Approve</Button>}
      title={`Approve this order for ${total}?`}
      description="It gets the site's next purchase order number, ready to send to the supplier."
      confirmLabel="Approve and number it"
      successMessage="Approved"
      run={async () => { const r = await decideOrder(id, "approve", ""); if (r.ok) router.refresh(); return r; }}
    />
  );
}

/** Reject, saying why, so the requester can change it and send it again. */
export function RejectOrder({ id }: { id: string }) {
  const [reason, setReason] = useState("");
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button variant="outline" className="min-h-11"><X aria-hidden="true" />Reject</Button>}
      title="Reject this order?"
      description="It goes back to whoever raised it, with your reason, to change and send again."
      submitLabel="Reject"
      successMessage="Rejected"
      onOpen={() => setReason("")}
      submit={() => decideOrder(id, "reject", reason)}
    >
      <Field label="Why" htmlFor="po-reject"><Textarea id="po-reject" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={1000} rows={3} placeholder="For example: order half now, the rest next month." /></Field>
    </FormDialog>
  );
}

export function CancelOrder({ id }: { id: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={<Button variant="ghost" className="min-h-11 text-[var(--pc-danger)]"><Ban aria-hidden="true" />Cancel order</Button>}
      title="Cancel this order?"
      description="It stays in the record as cancelled and is never numbered."
      confirmLabel="Cancel order"
      successMessage="Order cancelled"
      destructive
      run={async () => { const r = await cancelOrder(id); if (r.ok) router.refresh(); return r; }}
    />
  );
}

export function PrintOrder() {
  return <Button variant="outline" className="min-h-11" onClick={() => window.print()}><Printer aria-hidden="true" />Print or save as PDF</Button>;
}
