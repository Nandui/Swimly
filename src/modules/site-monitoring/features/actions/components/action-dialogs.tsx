"use client";

import { useId } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, RotateCcw } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Textarea } from "@/components/shadcn/textarea";
import { ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { setMonitoringActionClosed } from "@/modules/site-monitoring/features/actions/server/actions";

const THEME = "turnfin-module";

/** Close an action with what was done. */
export function CloseAction({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const fid = useId();
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button variant="outline"><CircleCheck aria-hidden="true" />Close</Button>}
      title="Close this action?"
      description={title}
      submitLabel="Close it"
      successMessage="Action closed"
      onSuccess={() => router.refresh()}
      submit={(form) => setMonitoringActionClosed(id, true, String(form.get("note") ?? ""))}
    >
      <Field label="What was done" htmlFor={`${fid}-note`}>
        <Textarea id={`${fid}-note`} name="note" required minLength={3} maxLength={1000} rows={3} placeholder="For example: dosing adjusted, retested at 14:10 and back in range." />
      </Field>
    </FormDialog>
  );
}

export function ReopenAction({ id }: { id: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={<Button variant="ghost"><RotateCcw aria-hidden="true" />Open again</Button>}
      title="Open this action again?"
      description="It goes back to the actions that need doing. What was written when it was closed is cleared."
      confirmLabel="Open again"
      successMessage="Action opened again"
      run={async () => { const r = await setMonitoringActionClosed(id, false, ""); if (r.ok) router.refresh(); return r; }}
    />
  );
}
