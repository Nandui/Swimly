"use client";

import { useState } from "react";
import { StickyNote, Undo2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Textarea } from "@/components/shadcn/textarea";
import { RadioGroup } from "@/components/shadcn/radio-group";
import { Field, FormDialog } from "@/components/form-dialog";
import { ChoiceRow } from "@/components/ui/choice-row";
import { NOTE_VISIBILITY_META, NOTE_VISIBILITIES } from "@/modules/hr/shared/constants";
import { addNote, withdrawNote } from "@/modules/hr/features/person/server/actions";
import { THEME } from "@/modules/hr/shared/components/dialog-kit";

export function AddNote({ subjectUserId, name }: { subjectUserId: string; name: string }) {
  const [visibility, setVisibility] = useState("record");
  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-lg"
      trigger={<Button className="min-h-11"><StickyNote aria-hidden="true" />Add note</Button>}
      title={`Add a note for ${name}`}
      description="Keep to facts: what happened, when, and what was agreed. It is recorded against your name."
      submitLabel="Add note"
      successMessage="Note added"
      onOpen={() => setVisibility("record")}
      submit={(formData) => addNote(subjectUserId, String(formData.get("body") ?? ""), visibility)}
    >
      <Field label="Note" htmlFor="hr-note-body">
        <Textarea id="hr-note-body" name="body" rows={6} required minLength={3} maxLength={5000} />
      </Field>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Who can read it</legend>
        <RadioGroup value={visibility} onValueChange={setVisibility} className="gap-2">
          {NOTE_VISIBILITIES.map((key) => (
            <ChoiceRow key={key} type="radio" id={`hr-vis-${key}`} value={key} title={NOTE_VISIBILITY_META[key].label} hint={NOTE_VISIBILITY_META[key].hint} />
          ))}
        </RadioGroup>
      </fieldset>
    </FormDialog>
  );
}

export function WithdrawNote({ id }: { id: string }) {
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button variant="outline" className="min-h-11"><Undo2 aria-hidden="true" />Withdraw</Button>}
      title="Withdraw this note?"
      description="It stops showing on the record and in their Turnfin Me. A superadmin can still see it in a subject export."
      submitLabel="Withdraw note"
      destructive
      successMessage="Note withdrawn"
      submit={(formData) => withdrawNote(id, String(formData.get("reason") ?? ""))}
    >
      <Field label="Why" htmlFor="hr-withdraw-reason">
        <Textarea id="hr-withdraw-reason" name="reason" rows={2} required minLength={3} maxLength={300} autoFocus />
      </Field>
    </FormDialog>
  );
}
