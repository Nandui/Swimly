"use client";

import { Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Field, FormDialog } from "@/components/form-dialog";
import { Textarea } from "@/components/ui/textarea";
import { THEME } from "@/modules/training/shared/components/dialog-kit";
import { acceptHandIn, returnHandIn } from "@/modules/training/features/hand-ins/server/actions";

export function AcceptHandIn({ id, name, lesson }: { id: string; name: string; lesson: string }) {
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button className="min-h-11"><Check aria-hidden="true" />Accept</Button>}
      title={`Accept ${name}’s work for ${lesson}?`}
      description="It finishes the lesson for them. Your note shows with it in Turnfin Me."
      submitLabel="Accept"
      successMessage="Accepted"
      submit={(formData) => acceptHandIn(id, String(formData.get("note") ?? ""))}
    >
      <Field label="Note" htmlFor={`accept-${id}`} optional hint="What was good, for them and the record.">
        <Textarea id={`accept-${id}`} name="note" rows={3} maxLength={1000} />
      </Field>
    </FormDialog>
  );
}

export function ReturnHandIn({ id, name, lesson }: { id: string; name: string; lesson: string }) {
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button variant="outline" className="min-h-11"><RotateCcw aria-hidden="true" />Send back</Button>}
      title={`Send ${lesson} back to ${name}?`}
      description="They see your note in Turnfin Me and hand it in again."
      submitLabel="Send back"
      successMessage="Sent back with your note"
      submit={(formData) => returnHandIn(id, String(formData.get("feedback") ?? ""))}
    >
      <Field label="What to change" htmlFor={`return-${id}`}>
        <Textarea id={`return-${id}`} name="feedback" rows={3} required minLength={3} maxLength={1000} autoFocus />
      </Field>
    </FormDialog>
  );
}
