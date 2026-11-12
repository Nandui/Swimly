"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Textarea } from "@/components/shadcn/textarea";
import { Field, FormDialog } from "@/components/form-dialog";
import { addAddendum } from "@/modules/incidents/features/report/server/actions";

const THEME = "turnfin-docs turnfin-module";

/** Add to a locked report: a correction or a fact learned later, kept beside
 *  the original with a name and time. */
export function AddAddendum({ id }: { id: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button variant="outline" className="min-h-11"><MessageSquarePlus aria-hidden="true" />Add to the report</Button>}
      title="Add to this report"
      description="The report stays as it was written. What you add here shows under it with your name and the time."
      submitLabel="Add it"
      successMessage="Added to the report"
      onOpen={() => setNote("")}
      onSuccess={() => router.refresh()}
      submit={() => addAddendum(id, note)}
    >
      <Field label="What to add" htmlFor="inc-addendum">
        <Textarea id="inc-addendum" value={note} onChange={(e) => setNote(e.target.value)} rows={4} required minLength={3} maxLength={2000}
          placeholder="For example: the swimmer's mother called to say the X-ray was clear." />
      </Field>
    </FormDialog>
  );
}
