"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ListPlus, MessageSquareQuote, RotateCcw } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { RadioGroup } from "@/components/shadcn/radio-group";
import { Textarea } from "@/components/shadcn/textarea";
import { Field, FormDialog } from "@/components/form-dialog";
import { ChoiceRow } from "@/components/ui/choice-row";
import { toast } from "@/components/ui/toast";
import { Notice } from "@/components/ui-kit/notice";
import { Tag } from "@/components/ui-kit/tag";
import { addDaysIso, formatDate, formatDateTime } from "@/lib/format";
import { addStatement, finishAction, raiseAction, reopenReport, saveInvestigation } from "@/modules/incidents/features/investigation/server/actions";
import { actionStatus, actionStatuses, MAX_WHYS } from "@/modules/incidents/shared/types";

const THEME = "turnfin-docs turnfin-module";
const day = (iso: string) => formatDate(new Date(`${iso}T12:00:00Z`));
const text = (data: FormData, key: string) => String(data.get(key) ?? "");

type Statement = { id: string; givenBy: string; givenAs: string; takenOn: string; text: string; recordedByName: string; createdAt: Date };
type Action = {
  id: string; title: string; ownerName: string; dueOn: string; status: string; note: string;
  doneByName: string | null; doneAt: Date | null; emailError: string | null;
};
export type InvestigationProps = {
  id: string; version: number; today: string; occurredOn: string;
  statements: Statement[]; whys: string[]; rootCause: string; actions: Action[];
  owners: { id: string; name: string; jobTitle: string | null }[];
  canWork: boolean; needsRootCause: boolean;
};

/** The investigation (docs/incidents.md, phase 2): statements in people's own
 *  words, five whys to the root cause, and the actions that fix it. Shown to
 *  those who triage at the site; editable while it is under investigation. */
export function Investigation(p: InvestigationProps) {
  return (
    <section aria-labelledby="inc-investigation-h" className="pc-panel flex flex-col gap-6">
      <div className="space-y-1">
        <h2 id="inc-investigation-h">Investigation</h2>
        <p className="text-sm text-ui-muted-foreground">Look for what let it happen, not who to blame. Fix the cause, then check the fix worked.</p>
      </div>
      <Statements {...p} />
      <RootCause {...p} />
      <Actions {...p} />
    </section>
  );
}

function Statements({ id, statements, canWork, today, occurredOn }: InvestigationProps) {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold">Statements</h3>
        {canWork ? (
          <FormDialog portalClassName={THEME} width="sm:max-w-lg"
            trigger={<Button variant="outline" className="min-h-11"><MessageSquareQuote aria-hidden="true" />Take a statement</Button>}
            title="Take a statement"
            description="Write it in their words, as close to how they said it as you can. Once saved it can't be changed; a correction is another statement."
            submitLabel="Save the statement" successMessage="Statement saved" onSuccess={() => router.refresh()}
            submit={(data) => addStatement(id, { givenBy: text(data, "givenBy"), givenAs: text(data, "givenAs"), takenOn: text(data, "takenOn"), text: text(data, "text") })}>
            <Field label="Who gave it" htmlFor="inc-st-by"><Input id="inc-st-by" name="givenBy" required maxLength={200} /></Field>
            <Field label="As what" htmlFor="inc-st-as" hint="Such as lifeguard on the slide, or the swimmer's mother" optional><Input id="inc-st-as" name="givenAs" maxLength={200} /></Field>
            <Field label="Day given" htmlFor="inc-st-day"><Input id="inc-st-day" name="takenOn" type="date" defaultValue={today} min={occurredOn} max={today} required /></Field>
            <Field label="Their statement" htmlFor="inc-st-text"><Textarea id="inc-st-text" name="text" rows={8} required minLength={10} maxLength={8000} /></Field>
          </FormDialog>
        ) : null}
      </div>
      {statements.length === 0 ? <p className="text-sm text-ui-muted-foreground">No statements yet.</p> : (
        <ul className="flex flex-col gap-3">
          {statements.map((s) => (
            <li key={s.id} className="inc-statement flex flex-col gap-2 rounded-[var(--pc-radius-inner)] border border-ui-border p-4">
              <p className="text-sm font-semibold">{s.givenBy}{s.givenAs ? <span className="font-normal text-ui-muted-foreground">, {s.givenAs}</span> : null}</p>
              <p className="text-sm whitespace-pre-line">{s.text}</p>
              <p className="text-xs text-ui-muted-foreground">Given {day(s.takenOn)}. Written down by {s.recordedByName}, {formatDateTime(s.createdAt)}.</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RootCause({ id, version, whys, rootCause, canWork, needsRootCause }: InvestigationProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState(() => Array.from({ length: MAX_WHYS }, (_, i) => whys[i] ?? ""));
  const [cause, setCause] = useState(rootCause);
  // One more "why?" appears as each is answered, up to five.
  const answered = answers.reduce((last, a, i) => (a.trim() ? i + 1 : last), 0);
  const shown = Math.min(MAX_WHYS, answered + 1);

  if (!canWork) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-base font-semibold">Why it happened</h3>
        {whys.length ? <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">{whys.map((w, i) => <li key={i}>{w}</li>)}</ol> : null}
        <p className="text-sm whitespace-pre-line">{rootCause || <span className="text-ui-muted-foreground">Not recorded.</span>}</p>
      </div>
    );
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    start(async () => {
      const result = await saveInvestigation(id, version, { whys: answers.map((a) => a.trim()), rootCause: cause });
      if (!result.ok) { setError(result.error); return; }
      toast.success("Root cause saved");
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} aria-labelledby="inc-cause-h" className="flex flex-col gap-4" noValidate>
      <div className="space-y-1">
        <h3 id="inc-cause-h" className="text-base font-semibold">Why it happened</h3>
        <p className="text-sm text-ui-muted-foreground">Ask why it happened, then why that happened, until the answer is something you can change. Stop when you get there; five is the most.{needsRootCause ? " A root cause is needed before closing." : ""}</p>
      </div>
      <ol className="flex flex-col gap-3">
        {answers.slice(0, shown).map((a, i) => (
          <li key={i}>
            <Field label={i === 0 ? "Why did it happen?" : `Why? (${i + 1})`} htmlFor={`inc-why-${i}`} optional={i > 0}>
              <Input id={`inc-why-${i}`} value={a} maxLength={500} onChange={(e) => setAnswers((list) => list.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={i === 0 ? "For example: the step was wet" : undefined} />
            </Field>
          </li>
        ))}
      </ol>
      <Field label="Root cause" htmlFor="inc-root" hint="The thing to change, such as 'no one owns checking the slide steps between sessions'.">
        <Textarea id="inc-root" value={cause} onChange={(e) => setCause(e.target.value)} rows={3} maxLength={2000} />
      </Field>
      {error ? <Notice tone="error" live="alert" title={error} /> : null}
      <div><Button type="submit" className="min-h-11" disabled={pending}><Check aria-hidden="true" />Save the root cause</Button></div>
    </form>
  );
}

function Actions({ id, actions, owners, canWork, today }: InvestigationProps) {
  const router = useRouter();
  const open = actions.filter((a) => a.status === "open").length;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Actions</h3>
          <p className="text-sm text-ui-muted-foreground">{actions.length ? `${open} open of ${actions.length}.` : "What will change, who owns it and by when."} The report closes when none is open.</p>
        </div>
        {canWork ? (
          <FormDialog portalClassName={THEME} width="sm:max-w-lg"
            trigger={<Button variant="outline" className="min-h-11"><ListPlus aria-hidden="true" />Raise an action</Button>}
            title="Raise an action"
            description="One change that fixes the cause. The owner gets an email now, the day before it is due and the day after if it is still open. Leave names and injuries out of it."
            submitLabel="Raise it" successMessage="Action raised" onSuccess={() => router.refresh()}
            submit={(data) => raiseAction(id, { title: text(data, "title"), ownerId: text(data, "ownerId"), dueOn: text(data, "dueOn") })}>
            <Field label="What will change" htmlFor="inc-act-title"><Textarea id="inc-act-title" name="title" rows={2} required minLength={5} maxLength={300} placeholder="For example: add the slide steps to the hourly poolside check" /></Field>
            <Field label="Owner" htmlFor="inc-act-owner" hint="Someone who works at this site">
              <NativeSelect id="inc-act-owner" name="ownerId" defaultValue="" required>
                <NativeSelectOption value="" disabled>Choose someone</NativeSelectOption>
                {owners.map((o) => <NativeSelectOption key={o.id} value={o.id}>{o.jobTitle ? `${o.name}, ${o.jobTitle}` : o.name}</NativeSelectOption>)}
              </NativeSelect>
            </Field>
            <Field label="Due by" htmlFor="inc-act-due"><Input id="inc-act-due" name="dueOn" type="date" defaultValue={addDaysIso(today, 14)} min={today} required /></Field>
          </FormDialog>
        ) : null}
      </div>
      {actions.length === 0 ? <p className="text-sm text-ui-muted-foreground">No actions yet.</p> : (
        <ul className="pc-rows">
          {actions.map((a) => {
            const state = actionStatus(a, today);
            return (
              <li key={a.id} className="pc-row flex-wrap">
                <span className="pc-row-body">
                  <span className="pc-row-title whitespace-pre-line">{a.title}</span>
                  <span className="pc-row-hint tabular-nums">{a.ownerName} · due {day(a.dueOn)}</span>
                  {a.status !== "open" && a.note ? <span className="pc-row-hint whitespace-pre-line">{a.status === "done" ? "Done" : "Cancelled"} by {a.doneByName}{a.doneAt ? `, ${formatDateTime(a.doneAt)}` : ""}: {a.note}</span> : null}
                  {a.status === "open" && a.emailError ? <span className="pc-row-hint">Email to the owner failed: {a.emailError} Tell them directly.</span> : null}
                </span>
                <span className="pc-row-trail">
                  <Tag meta={actionStatuses[state]} />
                  {canWork && a.status === "open" ? <FinishAction action={a} mayCancel /> : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Done or cancelled, with a note. Owners only see Done; investigators may also cancel. */
export function FinishAction({ action, mayCancel }: { action: { id: string; title: string }; mayCancel: boolean }) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<"done" | "cancelled">("done");
  return (
    <FormDialog portalClassName={THEME}
      trigger={<Button variant="outline" className="min-h-11"><Check aria-hidden="true" />{mayCancel ? "Finish" : "Mark done"}</Button>}
      title={mayCancel ? "Finish this action" : "Mark this action done"}
      description={action.title}
      submitLabel={outcome === "done" ? "Mark done" : "Cancel the action"} destructive={outcome === "cancelled"} cancelLabel="Keep it open"
      successMessage={outcome === "done" ? "Action done" : "Action cancelled"}
      onOpen={() => setOutcome("done")} onSuccess={() => router.refresh()}
      submit={(data) => finishAction(action.id, { outcome, note: text(data, "note") })}>
      {mayCancel ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Outcome</legend>
          <RadioGroup value={outcome} onValueChange={(v) => setOutcome(v as "done" | "cancelled")} className="gap-2">
            <ChoiceRow type="radio" id={`inc-fin-done-${action.id}`} value="done" title="Done" hint="It has been changed" />
            <ChoiceRow type="radio" id={`inc-fin-cancel-${action.id}`} value="cancelled" title="Cancelled" hint="It won't be done, or another action covers it" />
          </RadioGroup>
        </fieldset>
      ) : null}
      <Field label={outcome === "done" ? "What was done" : "Why it was dropped"} htmlFor={`inc-fin-note-${action.id}`}>
        <Textarea id={`inc-fin-note-${action.id}`} name="note" rows={3} required minLength={3} maxLength={2000} />
      </Field>
    </FormDialog>
  );
}

/** Reopening a closed report, with the reason kept in its history. */
export function ReopenReport({ id, version }: { id: string; version: number }) {
  const router = useRouter();
  return (
    <FormDialog portalClassName={THEME}
      trigger={<Button variant="outline" className="min-h-11"><RotateCcw aria-hidden="true" />Reopen</Button>}
      title="Reopen this report"
      description="It goes back under investigation and needs closing again. Use it for new facts, or an action that did not work."
      submitLabel="Reopen it" successMessage="Report reopened" onSuccess={() => router.refresh()}
      submit={(data) => reopenReport(id, version, text(data, "reason"))}>
      <Field label="Why" htmlFor="inc-reopen"><Textarea id="inc-reopen" name="reason" rows={3} required minLength={10} maxLength={2000} /></Field>
    </FormDialog>
  );
}
