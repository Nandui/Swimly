"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Lock } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { RadioGroup } from "@/components/shadcn/radio-group";
import { Textarea } from "@/components/shadcn/textarea";
import { Field } from "@/components/form-dialog";
import { ChoiceRow } from "@/components/ui/choice-row";
import { toast } from "@/components/ui/toast";
import { Notice } from "@/components/ui-kit/notice";
import { closeReport, triageReport } from "@/modules/incidents/features/triage/server/actions";
import { injuryGuide, staffSupportCheck, triageChecks, triageGuide, type TriageAnswers, type TriageCheck, type TriageGuide } from "@/modules/incidents/shared/triage-guides";
import { levelOf, severities, type Severity } from "@/modules/incidents/shared/types";

const LEVELS = Object.keys(severities).map(Number) as Severity[];

function SeverityField({ id, label, hint, scale, value, onChange }: { id: string; label: string; hint: string; scale: TriageGuide["scale"]; value: string; onChange: (v: string) => void }) {
  const chosen = scale[Number(value) as Severity];
  return (
    <Field label={label} htmlFor={id} hint={chosen ?? hint}>
      <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)} required>
        <NativeSelectOption value="" disabled>Choose a severity</NativeSelectOption>
        {LEVELS.map((n) => <NativeSelectOption key={n} value={String(n)}>{n} {severities[n].label}</NativeSelectOption>)}
      </NativeSelect>
    </Field>
  );
}

/** One question for this kind of report: a tick, a short answer or a choice. */
function CheckField({ check, value, onChange }: { check: TriageCheck; value: boolean | string | undefined; onChange: (v: boolean | string) => void }) {
  const id = `inc-check-${check.key}`;
  if (check.type === "tick") return <ChoiceRow type="checkbox" id={id} title={check.label} hint={check.hint} checked={value === true} onCheckedChange={(on) => onChange(on === true)} />;
  if (check.type === "choice") return (
    <Field label={check.label} htmlFor={id} hint={check.hint}>
      <NativeSelect id={id} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)}>
        <NativeSelectOption value="">Not known</NativeSelectOption>
        {Object.entries(check.options).map(([key, label]) => <NativeSelectOption key={key} value={key}>{label}</NativeSelectOption>)}
      </NativeSelect>
    </Field>
  );
  return (
    <Field label={check.label} htmlFor={id} hint={check.hint}>
      <Input id={id} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} maxLength={300} placeholder={check.placeholder} />
    </Field>
  );
}

type HsaKey = "staffOffOver3Days" | "publicToDoctor" | "deathOrDangerous" | "fatal";
const HSA_QUESTIONS: { key: HsaKey; title: string; hint?: string; injury: boolean }[] = [
  { key: "staffOffOver3Days", title: "A staff member can't do their normal work for more than 3 days in a row", hint: "Not counting the day it happened", injury: true },
  { key: "publicToDoctor", title: "A member of the public was taken from here to a hospital or doctor for treatment", injury: true },
  { key: "deathOrDangerous", title: "It is a dangerous occurrence", hint: "Such as an uncontrolled release of chlorine or another chemical, a fire, or a structural or electrical failure, even if nobody was hurt", injury: false },
  { key: "fatal", title: "Someone died", hint: "Phone the HSA or the Gardaí now if nobody has. The written report is due within 5 working days.", injury: true },
];

/** Triage (docs/incidents.md): rate what happened and what could have on the
 *  scale for this kind of report, answer its questions and the HSA questions
 *  that fit, say who told a child's parent, then investigate or close.
 *  Closing here is only for minimal or minor reports the HSA does not need. */
export function TriageForm({ id, version, category, injured, hasStaff, needsParent }: { id: string; version: number; category: string; injured: boolean; hasStaff: boolean; needsParent: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [actual, setActual] = useState("");
  const [potential, setPotential] = useState("");
  const [answers, setAnswers] = useState<TriageAnswers>({});
  const [hsa, setHsa] = useState<Record<HsaKey, boolean>>({ staffOffOver3Days: false, publicToDoctor: false, deathOrDangerous: false, fatal: false });
  const [parentInformed, setParentInformed] = useState("");
  const [outcome, setOutcome] = useState<"" | "investigate" | "close">("");
  const [note, setNote] = useState("");
  const guide = triageGuide(category);
  const checks = triageChecks({ category, hasStaff }, answers);
  const level = actual && potential ? levelOf(Number(actual), Number(potential)) : 0;
  const reportable = Object.values(hsa).some(Boolean);
  const mayClose = level > 0 && level <= 2 && !reportable;
  // The HSA questions that fit this report come first; the rest stay one click away.
  const fits = (q: (typeof HSA_QUESTIONS)[number]) => (q.injury ? injured : guide.dangerous);
  const [hsaShown, others] = [HSA_QUESTIONS.filter(fits), HSA_QUESTIONS.filter((q) => !fits(q))];
  const [othersOpen, setOthersOpen] = useState(false);
  const hsaRow = (q: (typeof HSA_QUESTIONS)[number]) => (
    <ChoiceRow key={q.key} type="checkbox" id={`inc-hsa-${q.key}`} title={q.title} hint={q.hint} checked={hsa[q.key]} onCheckedChange={(on) => setHsa((h) => ({ ...h, [q.key]: on === true }))} />
  );

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    start(async () => {
      const result = await triageReport(id, version, { severityActual: Number(actual), severityPotential: Number(potential), ...hsa, parentInformed, answers, outcome: outcome || ("" as "close"), note });
      if (!result.ok) { setError(result.error); return; }
      toast.success(outcome === "close" ? "Triaged and closed" : "Triaged");
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} aria-labelledby="inc-triage" className="pc-panel flex flex-col gap-5" noValidate>
      <div className="space-y-1">
        <h2 id="inc-triage">Triage</h2>
        <p className="text-sm text-ui-muted-foreground"><span className="font-semibold text-ui-foreground">{guide.label}.</span> {guide.intro} The worse of the two decides how it is handled.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SeverityField id="inc-sev-actual" label="What happened" hint="What actually happened." scale={guide.scale} value={actual} onChange={setActual} />
        <SeverityField id="inc-sev-potential" label="What could have happened" hint="The worst realistic outcome." scale={guide.scale} value={potential} onChange={setPotential} />
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">How to rate {guide.label.toLowerCase()}</h3>
        <dl className="grid grid-cols-auto-fill gap-x-3 gap-y-1 text-sm">
          {LEVELS.map((n) => [
            <dt key={`t${n}`} className="font-semibold tabular-nums">{n} {severities[n].label}</dt>,
            <dd key={`d${n}`} className="text-ui-muted-foreground">{guide.scale[n]}</dd>,
          ])}
        </dl>
        {injured && guide !== injuryGuide ? (
          <p className="text-sm text-ui-muted-foreground">Someone was hurt as well. Where the injury is worse, rate by it: 3 if they were seen by a GP or treated off site, 4 for hospital, an ambulance or a staff member off more than 3 days, and 5 for a death or an injury that changes a life.</p>
        ) : null}
      </div>
      {checks.length ? (
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">About this {guide.label.toLowerCase()}</legend>
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            {checks.map((c) => (
              <div key={c.key} className={c.type === "tick" || c.key === staffSupportCheck.key ? "sm:col-span-2" : undefined}>
                <CheckField check={c} value={answers[c.key]} onChange={(v) => setAnswers((a) => ({ ...a, [c.key]: v }))} />
              </div>
            ))}
          </div>
        </fieldset>
      ) : null}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Does the Health and Safety Authority need a report?</legend>
        <p className="text-sm text-ui-muted-foreground">
          {hsaShown.length ? "Tick any that apply. Any tick means it is reported to the HSA within 10 working days, or 5 after a death." : "Nobody on this report was hurt and this kind of report is not a dangerous occurrence, so the HSA rarely needs one."}
        </p>
        {hsaShown.map(hsaRow)}
        {others.length ? (
          <Collapsible open={othersOpen || others.some((q) => hsa[q.key])} onOpenChange={setOthersOpen} className="space-y-2">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="min-h-11 px-2"><ChevronDown aria-hidden="true" className="transition-transform [[data-state=open]>&]:rotate-180" />{hsaShown.length ? "Other HSA questions" : "Check the HSA questions anyway"}</Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2">{others.map(hsaRow)}</CollapsibleContent>
          </Collapsible>
        ) : null}
      </fieldset>
      {needsParent ? (
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
