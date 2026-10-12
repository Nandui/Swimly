"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { RadioGroup } from "@/components/shadcn/radio-group";
import { Textarea } from "@/components/shadcn/textarea";
import { Field } from "@/components/form-dialog";
import { ChoiceRow } from "@/components/ui/choice-row";
import { toast } from "@/components/ui/toast";
import { Notice } from "@/components/ui-kit/notice";
import { closeReport, triageReport } from "@/modules/incidents/features/triage/server/actions";
import { levelOf } from "@/modules/incidents/shared/rules";
import { severities, type Severity } from "@/modules/incidents/shared/types";

const LEVELS = Object.keys(severities).map(Number) as Severity[];

function SeverityField({ id, label, hint, value, onChange }: { id: string; label: string; hint: string; value: string; onChange: (v: string) => void }) {
  const chosen = severities[Number(value) as Severity];
  return (
    <Field label={label} htmlFor={id} hint={chosen ? chosen.help : hint}>
      <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)} required>
        <NativeSelectOption value="" disabled>Choose a severity</NativeSelectOption>
        {LEVELS.map((n) => <NativeSelectOption key={n} value={String(n)}>{n} {severities[n].label}</NativeSelectOption>)}
      </NativeSelect>
    </Field>
  );
}

/** Triage (docs/incidents.md): rate what happened and what could have, answer
 *  the HSA questions, say who told a child's parent, then investigate or close.
 *  Closing here is only for minimal or minor reports the HSA does not need. */
export function TriageForm({ id, version, hasChild }: { id: string; version: number; hasChild: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [actual, setActual] = useState("");
  const [potential, setPotential] = useState("");
  const [hsa, setHsa] = useState({ staffOffOver3Days: false, publicToDoctor: false, deathOrDangerous: false });
  const [parentInformed, setParentInformed] = useState("");
  const [outcome, setOutcome] = useState<"" | "investigate" | "close">("");
  const [note, setNote] = useState("");
  const level = actual && potential ? levelOf(Number(actual), Number(potential)) : 0;
  const reportable = hsa.staffOffOver3Days || hsa.publicToDoctor || hsa.deathOrDangerous;
  const mayClose = level > 0 && level <= 2 && !reportable;

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    start(async () => {
      const result = await triageReport(id, version, { severityActual: Number(actual), severityPotential: Number(potential), ...hsa, parentInformed, outcome: outcome || ("" as "close"), note });
      if (!result.ok) { setError(result.error); return; }
      toast.success(outcome === "close" ? "Triaged and closed" : "Triaged");
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} aria-labelledby="inc-triage" className="pc-panel flex flex-col gap-5" noValidate>
      <div className="space-y-1">
        <h2 id="inc-triage">Triage</h2>
        <p className="text-sm text-ui-muted-foreground">Rate it twice: what happened, and the worst that realistically could have. The worse of the two decides how it is handled.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SeverityField id="inc-sev-actual" label="What happened" hint="The harm actually done." value={actual} onChange={setActual} />
        <SeverityField id="inc-sev-potential" label="What could have happened" hint="The worst realistic outcome." value={potential} onChange={setPotential} />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Does the Health and Safety Authority need a report?</legend>
        <p className="text-sm text-ui-muted-foreground">Tick any that apply. Any tick means it is reported to the HSA within 10 working days.</p>
        <ChoiceRow type="checkbox" id="inc-hsa-staff" title="A staff member is off work for more than 3 days" hint="Not counting the day it happened" checked={hsa.staffOffOver3Days} onCheckedChange={(on) => setHsa((h) => ({ ...h, staffOffOver3Days: on === true }))} />
        <ChoiceRow type="checkbox" id="inc-hsa-public" title="A member of the public went to a doctor or hospital because of it" checked={hsa.publicToDoctor} onCheckedChange={(on) => setHsa((h) => ({ ...h, publicToDoctor: on === true }))} />
        <ChoiceRow type="checkbox" id="inc-hsa-death" title="Someone died, or it is a dangerous occurrence" hint="Such as a chlorine gas release" checked={hsa.deathOrDangerous} onCheckedChange={(on) => setHsa((h) => ({ ...h, deathOrDangerous: on === true }))} />
      </fieldset>
      {hasChild ? (
        <Field label="Who told the child's parent or guardian, and when" htmlFor="inc-parent">
          <Input id="inc-parent" value={parentInformed} onChange={(e) => setParentInformed(e.target.value)} maxLength={500} required placeholder="For example: Sam at reception, by phone at 15:10" />
        </Field>
      ) : null}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">What next</legend>
        <RadioGroup value={outcome} onValueChange={(v) => setOutcome(v as "investigate" | "close")} className="gap-2">
          <ChoiceRow type="radio" id="inc-out-investigate" value="investigate" title="Investigate" hint="Find the cause and what to change. Moderate and worse, and anything for the HSA, always go here." />
          <ChoiceRow type="radio" id="inc-out-close" value="close" title="Close it now" hint={mayClose ? "Minimal or minor, nothing for the HSA: your note is the record." : "Only for minimal or minor reports the HSA does not need."} disabled={!mayClose} />
        </RadioGroup>
      </fieldset>
      <Field label="Your note" htmlFor="inc-triage-note" hint="Why you rated it this way, and anything done since.">
        <Textarea id="inc-triage-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} required minLength={3} maxLength={4000} />
      </Field>
      {error ? <Notice tone="error" live="alert" title={error} /> : null}
      <div><Button type="submit" className="min-h-11" disabled={pending}><Check aria-hidden="true" />{pending ? "Saving" : "Save triage"}</Button></div>
    </form>
  );
}

/** Close a report under investigation: what was found and what changed, and
 *  the HSA reference when one was due. Serious and moderate ones need a manager. */
export function CloseForm({ id, version, hsaDue, openActions = 0, missingRootCause = false }: { id: string; version: number; hsaDue: string | null; openActions?: number; missingRootCause?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [hsaReference, setHsaReference] = useState("");
  const blockers = [
    openActions ? `${openActions === 1 ? "One action is" : `${openActions} actions are`} still open: mark ${openActions === 1 ? "it" : "them"} done or cancel ${openActions === 1 ? "it" : "them"} under Investigation.` : null,
    missingRootCause ? "Record the root cause under Investigation." : null,
  ].filter((b): b is string => b !== null);

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    start(async () => {
      const result = await closeReport(id, version, { note, hsaReference });
      if (!result.ok) { setError(result.error); return; }
      toast.success("Report closed");
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} aria-labelledby="inc-close" className="pc-panel flex flex-col gap-5" noValidate>
      <div className="space-y-1">
        <h2 id="inc-close">Close the report</h2>
        <p className="text-sm text-ui-muted-foreground">Closing locks it. The reporter sees your note, so write it for them too.</p>
      </div>
      {blockers.length ? <Notice tone="warning" title="Not ready to close" description={blockers.join(" ")} /> : null}
      {hsaDue ? (
        <Field label="HSA report reference" htmlFor="inc-hsa-ref" hint={`The IR1 or IR3 reference, or the date it was sent. Due by ${hsaDue}.`}>
          <Input id="inc-hsa-ref" value={hsaReference} onChange={(e) => setHsaReference(e.target.value)} maxLength={200} required />
        </Field>
      ) : null}
      <Field label="What was found and what changed" htmlFor="inc-close-note" hint="The cause, not who to blame, and what was done so it does not happen again.">
        <Textarea id="inc-close-note" value={note} onChange={(e) => setNote(e.target.value)} rows={4} required minLength={10} maxLength={4000} />
      </Field>
      {error ? <Notice tone="error" live="alert" title={error} /> : null}
      <div><Button type="submit" className="min-h-11" disabled={pending || blockers.length > 0}><Lock aria-hidden="true" />{pending ? "Closing" : "Close and lock"}</Button></div>
    </form>
  );
}
