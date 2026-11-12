"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Textarea } from "@/components/shadcn/textarea";
import { Field, FormDialog } from "@/components/form-dialog";
import { addViewingNote } from "@/modules/cctv/features/viewings/server/actions";

/** Add to a saved entry: a correction or something learned later, kept under it with a name and time. */
export function AddViewingNote({ id }: { id: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  return (
    <FormDialog portalClassName="turnfin-module"
      trigger={<Button variant="outline" className="min-h-11"><MessageSquarePlus aria-hidden="true" />Add a note</Button>}
      title="Add a note to this record"
      description="The record stays as it was saved. Your note shows under it with your name and the time."
      submitLabel="Add note" successMessage="Note added"
      onOpen={() => setNote("")} onSuccess={() => router.refresh()} submit={() => addViewingNote(id, note)}>
      <Field label="What to add" htmlFor="cctv-note">
        <Textarea id="cctv-note" value={note} onChange={(e) => setNote(e.target.value)} rows={4} required minLength={3} maxLength={2000}
          placeholder="For example: the Gardaí collected the USB key on 22 October." />
      </Field>
    </FormDialog>
  );
}
