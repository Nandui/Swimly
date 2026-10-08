"use client";

import { useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Flag, MessageSquare, MinusCircle, Plus, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { RadioGroup } from "@/components/shadcn/radio-group";
import { Textarea } from "@/components/shadcn/textarea";
import { ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { ChoiceRow } from "@/components/ui/choice-row";
import { Input } from "@/components/ui/input";
import {
  addTask, addTaskComment, approveTask, cantCompleteTask, notApplicableTask, raiseTaskAction, reopenTask, setTaskActionResolved,
} from "@/lib/tasks/actions";

const THEME = "turnfin-module turnfin-tasks";
const text = (form: FormData, key: string) => String(form.get(key) ?? "");

/** Add a task kept for when it is needed (a spill, a broken locker): a published template
 *  without a schedule, due by the end of the day. */
export function AddTask({ siteId, date, templates }: { siteId: string; date: string; templates: { id: string; title: string; description: string }[] }) {
  const router = useRouter();
  const fid = useId();
  // Read after the save, so a ref rather than state.
  const made = useRef<string | null>(null);
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button><Plus aria-hidden="true" />Add a task</Button>}
      title="Add a task"
      description="Tasks kept for when they are needed. It is due by the end of the day."
      submitLabel="Add it"
      successMessage="Task added"
      width="sm:max-w-lg"
      onSuccess={() => { if (made.current) router.push(`/tasks/${made.current}`); }}
      submit={async (form) => {
        const r = await addTask(text(form, "template"), siteId, date);
        if (r.ok && r.id) made.current = r.id;
        return r;
      }}
    >
      <RadioGroup name="template" className="gap-2" aria-label="Which task" required defaultValue={templates.length === 1 ? templates[0].id : undefined}>
        {templates.map((t) => <ChoiceRow key={t.id} type="radio" id={`${fid}-${t.id}`} value={t.id} title={t.title} hint={t.description || undefined} />)}
      </RadioGroup>
    </FormDialog>
  );
}

/** Raise a follow-up action: from a task, or on its own at a site. */
export function RaiseAction({ siteId, taskId, label = "Raise an action", variant = "outline" }: { siteId: string; taskId?: string; label?: string; variant?: "outline" | "default" }) {
  const router = useRouter();
  const fid = useId();
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button variant={variant}><Flag aria-hidden="true" />{label}</Button>}
      title="Raise a follow-up action"
      description="Something to put right. It stays open on Actions until a reviewer resolves it."
      submitLabel="Raise it"
      successMessage="Action raised"
      onSuccess={() => router.refresh()}
      submit={(form) => raiseTaskAction({ siteId, taskId: taskId ?? null, title: text(form, "title"), dueOn: text(form, "dueOn") })}
    >
      <Field label="What needs to happen" htmlFor={`${fid}-title`}>
        <Textarea id={`${fid}-title`} name="title" required minLength={3} maxLength={300} rows={3} placeholder="For example: retest the pool after dosing and record it." />
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

/** A reason, then a close: can't complete (anyone doing it) or not applicable (a reviewer). */
function ReasonDialog({ trigger, title, description, submitLabel, successMessage, placeholder, run }: {
  trigger: React.ReactNode; title: string; description: string; submitLabel: string; successMessage: string; placeholder: string; run: (reason: string) => Promise<import("@/lib/action-result").ActionResult>;
}) {
  const router = useRouter();
  const fid = useId();
  return (
    <FormDialog portalClassName={THEME} trigger={trigger} title={title} description={description} submitLabel={submitLabel} successMessage={successMessage}
      onSuccess={() => router.refresh()} submit={(form) => run(text(form, "reason"))}>
      <Field label="Why" htmlFor={`${fid}-reason`}>
        <Textarea id={`${fid}-reason`} name="reason" required minLength={3} maxLength={1000} rows={3} placeholder={placeholder} />
      </Field>
    </FormDialog>
  );
}

export function CantComplete({ id, version }: { id: string; version: number }) {
  return (
    <ReasonDialog trigger={<Button variant="ghost"><Flag aria-hidden="true" />Can’t complete</Button>}
      title="Can’t complete this task?" description="It closes as not done and counts as missed in the score. A reviewer can reopen it."
      submitLabel="Close it as not done" successMessage="Task flagged" placeholder="For example: the alarm panel is locked and the key is missing."
      run={(reason) => cantCompleteTask(id, version, reason)} />
  );
}

export function NotApplicable({ id, version }: { id: string; version: number }) {
  return (
    <ReasonDialog trigger={<Button variant="ghost"><MinusCircle aria-hidden="true" />Not applicable</Button>}
      title="Mark it not applicable?" description="It closes and is left out of the score, for a day it does not apply."
      submitLabel="Mark not applicable" successMessage="Marked not applicable" placeholder="For example: the pool was closed for maintenance."
      run={(reason) => notApplicableTask(id, version, reason)} />
  );
}

export function ApproveTask({ id, version }: { id: string; version: number }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={<Button><ShieldCheck aria-hidden="true" />Approve</Button>}
      title="Approve this task?"
      description="You have checked what was done and recorded. It counts as done."
      confirmLabel="Approve"
      successMessage="Task approved"
      run={async () => { const r = await approveTask(id, version); if (r.ok) router.refresh(); return r; }}
    />
  );
}

export function ReopenTask({ id, version }: { id: string; version: number }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={<Button variant="outline"><RotateCcw aria-hidden="true" />Reopen</Button>}
      title="Reopen this task?"
      description="Its answers stay; who completed or approved it is cleared, and it can be changed and completed again."
      confirmLabel="Reopen"
      successMessage="Task reopened"
      run={async () => { const r = await reopenTask(id, version); if (r.ok) router.refresh(); return r; }}
    />
  );
}

export function AddComment({ id }: { id: string }) {
  const router = useRouter();
  const fid = useId();
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button variant="outline"><MessageSquare aria-hidden="true" />Add a comment</Button>}
      title="Add a comment"
      description="Everyone who sees this task reads it."
      submitLabel="Add it"
      successMessage="Comment added"
      onSuccess={() => router.refresh()}
      submit={(form) => addTaskComment(id, text(form, "comment"))}
    >
      <Field label="Comment" htmlFor={`${fid}-comment`}>
        <Textarea id={`${fid}-comment`} name="comment" required minLength={2} maxLength={2000} rows={4} placeholder="A clear note for the next person." />
      </Field>
    </FormDialog>
  );
}

