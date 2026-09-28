"use client";

import { Check, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Field, FormDialog } from "@/components/form-dialog";
import { Textarea } from "@/components/ui/textarea";
import { applyParentChange, declineParentChange } from "@/modules/aquatics/lib/students/actions/parent-changes";

export function ApplyParentChange({ id, name }: { id: string; name: string }) {
  return (
    <FormDialog
      trigger={<Button variant="default"><Check aria-hidden="true" className="size-4" />Apply changes</Button>}
      title={`Apply these changes to ${name}?`}
      description="The swimmer's record is updated with exactly what the parent proposed. It is recorded in the activity log."
      submitLabel="Apply changes"
      successMessage="Changes applied"
      submit={(formData) => applyParentChange(id, String(formData.get("reply") ?? ""))}
    >
      <Field label="Reply to the parent (optional)" htmlFor="reply">
        <Textarea id="reply" name="reply" maxLength={500} rows={2} />
      </Field>
    </FormDialog>
  );
}

export function DeclineParentChange({ id, name }: { id: string; name: string }) {
  return (
    <FormDialog
      trigger={<Button variant="outline"><X aria-hidden="true" className="size-4" />Decline</Button>}
      title={`Decline the changes for ${name}?`}
      description="Nothing on the swimmer changes. The parent sees your reply."
      submitLabel="Decline"
      successMessage="Changes declined"
      submit={(formData) => declineParentChange(id, String(formData.get("reply") ?? ""))}
    >
      <Field label="Reply to the parent" htmlFor="reply" hint="For example: please call reception so we can confirm this with you.">
        <Textarea id="reply" name="reply" required minLength={3} maxLength={500} rows={3} autoFocus />
      </Field>
    </FormDialog>
  );
}
