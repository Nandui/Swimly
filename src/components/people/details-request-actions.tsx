"use client";

import { Check, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Field, FormDialog } from "@/components/form-dialog";
import { Textarea } from "@/components/ui/textarea";
import { applyDetailChange, declineDetailChange } from "@/lib/people/details-actions";

export function ApplyDetailChange({ id, name }: { id: string; name: string }) {
  return (
    <FormDialog
      trigger={<Button><Check aria-hidden="true" className="size-4" />Apply changes</Button>}
      title={`Apply ${name}'s changes?`}
      description="Their record is updated with exactly what they asked for. It is recorded in the activity log."
      submitLabel="Apply changes"
      successMessage="Changes applied"
      submit={(formData) => applyDetailChange(id, String(formData.get("reply") ?? ""))}
    >
      <Field label="Note to them" htmlFor="reply" optional>
        <Textarea id="reply" name="reply" maxLength={500} rows={2} />
      </Field>
    </FormDialog>
  );
}

export function DeclineDetailChange({ id, name }: { id: string; name: string }) {
  return (
    <FormDialog
      trigger={<Button variant="outline"><X aria-hidden="true" className="size-4" />Decline</Button>}
      title={`Decline ${name}'s changes?`}
      description="Nothing on their record changes. They see your reply in Turnfin Me."
      submitLabel="Decline"
      successMessage="Changes declined"
      submit={(formData) => declineDetailChange(id, String(formData.get("reply") ?? ""))}
    >
      <Field label="Reply" htmlFor="reply" hint="For example: please call the office so we can confirm this.">
        <Textarea id="reply" name="reply" required minLength={3} maxLength={500} rows={3} autoFocus />
      </Field>
    </FormDialog>
  );
}
