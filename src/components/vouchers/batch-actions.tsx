"use client";

import { useState } from "react";
import { Ban, Printer } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Textarea } from "@/components/shadcn/textarea";
import { Field, FormDialog } from "@/components/form-dialog";
import { voidBatch } from "@/lib/vouchers/actions";

const THEME = "turnfin-docs turnfin-module turnfin-vouchers";

/** Cancel a whole batch, saying why: its unused vouchers stop working. */
export function CancelBatch({ id, recipient, unused }: { id: string; recipient: string; unused: number }) {
  const [reason, setReason] = useState("");
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button variant="ghost" className="min-h-11 text-[var(--pc-danger)]"><Ban aria-hidden="true" />Cancel batch</Button>}
      title={`Cancel the vouchers for ${recipient}?`}
      description={`${unused === 1 ? "The 1 unused voucher stops" : `All ${unused} unused vouchers stop`} working and cannot be brought back. Used vouchers stay in the record.`}
      submitLabel="Cancel batch"
      cancelLabel="Keep it"
      successMessage="Batch cancelled"
      destructive
      onOpen={() => setReason("")}
      submit={() => voidBatch(id, reason)}
    >
      <Field label="Why" htmlFor="voucher-void-reason"><Textarea id="voucher-void-reason" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={300} rows={3} placeholder="For example: made twice by mistake." /></Field>
    </FormDialog>
  );
}

export function PrintSheet() {
  return <Button className="min-h-11" onClick={() => window.print()}><Printer aria-hidden="true" />Print or save as PDF</Button>;
}
