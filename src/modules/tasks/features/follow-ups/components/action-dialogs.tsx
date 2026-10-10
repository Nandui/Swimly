"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Flag, RotateCcw } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Textarea } from "@/components/shadcn/textarea";
import { ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { raiseTaskAction, setTaskActionResolved } from "@/modules/tasks/features/follow-ups/server/actions";
import { THEME, text } from "@/modules/tasks/shared/components/dialog-kit";

/** Raise a follow-up action: from a task, or on its own at a site. */
export function RaiseAction({ siteId, taskId, label = "Raise an action", variant = "outline", templates = [] }: {
  siteId: string; taskId?: string; label?: string; variant?: "outline" | "default";
  /** Published follow-up action templates: choosing one also makes its task, to record the work. */
  templates?: { id: string; title: string; description: string }[];
}) {
  const router = useRouter();
  const fid = useId();
  const [template, setTemplate] = useState("");
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button variant={variant}><Flag aria-hidden="true" />{label}</Button>}
      title="Raise a follow-up action"
      description="Something to put right. It stays open on Actions until a reviewer resolves it."
      submitLabel="Raise it"
      successMessage="Action raised"
      onOpen={() => setTemplate("")}
      onSuccess={() => router.refresh()}
      submit={(form) => raiseTaskAction({ siteId, taskId: taskId ?? null, title: text(form, "title"), dueOn: text(form, "dueOn"), templateId: template || null })}
    >
      {templates.length ? (
        <Field label="Follow-up" htmlFor={`${fid}-tpl`} optional hint="A follow-up template also adds its task for today, with its checklist and questions.">
          <NativeSelect id={`${fid}-tpl`} value={template} onChange={(e) => setTemplate(e.target.value)} className="w-full">
            <NativeSelectOption value="">Write my own</NativeSelectOption>
            {templates.map((t) => <NativeSelectOption key={t.id} value={t.id}>{t.title}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
      ) : null}
      <Field label="What needs to happen" htmlFor={`${fid}-title`} optional={!!template} hint={template ? "Leave it empty to use the template's title." : undefined}>
        <Textarea id={`${fid}-title`} name="title" required={!template} minLength={3} maxLength={300} rows={3} placeholder="For example: retest the pool after dosing and record it." />
      </Field>
      <Field label="Needed by" htmlFor={`${fid}-due`} optional><Input id={`${fid}-due`} name="dueOn" type="date" /></Field>
    </FormDialog>
  );
}

/** Resolve a follow-up with what was done. */
export function ResolveAction({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const fid = useId();
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button variant="outline"><CircleCheck aria-hidden="true" />Resolve</Button>}
      title="Resolve this action?"
      description={title}
      submitLabel="Resolve"
      successMessage="Action resolved"
      onSuccess={() => router.refresh()}
      submit={(form) => setTaskActionResolved(id, true, text(form, "note"))}
    >
      <Field label="What was done" htmlFor={`${fid}-note`}>
        <Textarea id={`${fid}-note`} name="note" required minLength={3} maxLength={1000} rows={3} placeholder="For example: dosing adjusted, retested at 14:10, pH 7.4." />
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
      description="It goes back to the open actions. What was written when it was resolved is cleared."
      confirmLabel="Open again"
      successMessage="Action opened again"
      run={async () => { const r = await setTaskActionResolved(id, false, ""); if (r.ok) router.refresh(); return r; }}
    />
  );
}
