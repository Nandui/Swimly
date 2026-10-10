"use client";

import { Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Field, FormDialog } from "@/components/form-dialog";
import { Textarea } from "@/components/ui/textarea";
import { returnForPractice, signOffTraining } from "@/modules/training/features/sign-off/server/actions";
import { THEME } from "@/modules/training/shared/components/dialog-kit";

export function SignOff({ id, name, title }: { id: string; name: string; title: string }) {
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button className="min-h-11"><Check aria-hidden="true" />Sign off</Button>}
      title={`Sign off ${title} for ${name}?`}
      description="Confirm you watched them do it. It completes the course and records any qualification it grants, verified by you."
      submitLabel="Sign off"
      successMessage="Signed off"
      submit={(formData) => signOffTraining(id, String(formData.get("note") ?? ""))}
    >
      <Field label="Note" htmlFor="signoff-note" optional hint="Where and how you checked, for the record.">
        <Textarea id="signoff-note" name="note" rows={3} maxLength={1000} />
      </Field>
    </FormDialog>
  );
}

export function ReturnForPractice({ id, name, title }: { id: string; name: string; title: string }) {
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button variant="outline" className="min-h-11"><RotateCcw aria-hidden="true" />Not yet</Button>}
      title={`Not ready to sign off ${title}?`}
      description={`It goes back to ${name} as to do, with your note.`}
      submitLabel="Send back"
      successMessage="Sent back with your note"
      submit={(formData) => returnForPractice(id, String(formData.get("note") ?? ""))}
    >
      <Field label="What to practise" htmlFor="return-note">
        <Textarea id="return-note" name="note" rows={3} required minLength={3} maxLength={1000} autoFocus />
      </Field>
    </FormDialog>
  );
}
