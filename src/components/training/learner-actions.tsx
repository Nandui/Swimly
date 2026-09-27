"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Field, FormDialog } from "@/components/form-dialog";
import { Textarea } from "@/components/ui/textarea";
import { completeMyTraining } from "@/lib/training/actions";

/** The learner's one action: say they have done it. A practical course then
 *  waits for a trainer; anything else is complete straight away. */
export function CompleteTraining({ id, title, requiresSignoff }: { id: string; title: string; requiresSignoff: boolean }) {
  return (
    <FormDialog
      trigger={<Button className="min-h-11"><Check aria-hidden="true" />{requiresSignoff ? "I'm ready for sign-off" : "Mark as done"}</Button>}
      title={requiresSignoff ? `Ready for sign-off on ${title}?` : `Mark ${title} as done?`}
      description={requiresSignoff
        ? "A trainer will watch you do it and sign it off. Until then it shows as awaiting sign-off."
        : "Confirm you have read and understood the material. It is recorded against your name."}
      submitLabel={requiresSignoff ? "Ask for sign-off" : "Mark as done"}
      successMessage={requiresSignoff ? "Sent for sign-off" : "Training completed"}
      submit={(formData) => completeMyTraining(id, String(formData.get("note") ?? ""))}
    >
      <Field label="Note for your trainer (optional)" htmlFor="note" hint="For example, when you are next on shift to show it.">
        <Textarea id="note" name="note" maxLength={1000} rows={3} />
      </Field>
    </FormDialog>
  );
}
