"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilLine, Plus, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/shadcn/alert-dialog";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Textarea } from "@/components/shadcn/textarea";
import { Field } from "@/components/form-dialog";
import { ChoiceRow } from "@/components/ui/choice-row";
import { LoadingButton } from "@/components/ui/loading-button";
import { toast } from "@/components/ui/toast";
import { Notice } from "@/components/ui-kit/notice";
import { Tag } from "@/components/ui-kit/tag";
import { addHazard, editHazard, removeHazard } from "@/modules/risk/features/hazards/server/actions";
import { riskBand, riskScore } from "@/modules/risk/shared/rules";
import { CATEGORY_LABEL, LIKELIHOOD_LABELS, PERSONS_AT_RISK, RISK_BAND_META, RISK_CATEGORIES, SEVERITY_HINTS, SEVERITY_LABELS, type PersonAtRisk, type RiskCategory, type RiskHazardView } from "@/modules/risk/shared/types";

type On = { assessmentId: string; version: number; signed: boolean };

/** Likelihood and severity for one stage, with the score they make. */
function Ratings({ id, legend, likelihood, severity, onChange }: { id: string; legend: string; likelihood: number; severity: number; onChange(next: { likelihood: number; severity: number }): void }) {
  const score = riskScore(likelihood, severity);
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{legend}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="How likely" htmlFor={`${id}-l`}>
          <NativeSelect id={`${id}-l`} value={String(likelihood)} onChange={(e) => onChange({ likelihood: Number(e.target.value), severity })} className="min-h-11 w-full">
            {LIKELIHOOD_LABELS.map((label, i) => <NativeSelectOption key={label} value={String(i + 1)}>{`${i + 1} · ${label}`}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <Field label="How severe" htmlFor={`${id}-s`} hint={SEVERITY_HINTS[severity - 1]}>
          <NativeSelect id={`${id}-s`} value={String(severity)} onChange={(e) => onChange({ likelihood, severity: Number(e.target.value) })} className="min-h-11 w-full">
            {SEVERITY_LABELS.map((label, i) => <NativeSelectOption key={label} value={String(i + 1)}>{`${i + 1} · ${label}`}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
      </div>
      <p className="flex flex-wrap items-center gap-2 text-sm text-ui-muted-foreground" role="status"><span className="tabular-nums">{`${likelihood} × ${severity} = ${score}`}</span><Tag meta={RISK_BAND_META[riskBand(score)]} /></p>
    </fieldset>
  );
}

function HazardForm({ on, hazard, pending, error, onCancel, onSend }: { on: On; hazard?: RiskHazardView; pending: boolean; error: string | null; onCancel(): void; onSend(fields: Fields): void }) {
  const id = hazard?.id ?? "new";
  const [f, setF] = useState<Fields>({
    hazard: hazard?.hazard ?? "", riskFactor: hazard?.riskFactor ?? "", personsAtRisk: hazard?.personsAtRisk ?? [], consequence: hazard?.consequence ?? "",
    inherentLikelihood: hazard?.inherentLikelihood ?? 3, inherentSeverity: hazard?.inherentSeverity ?? 3, controls: hazard?.controls ?? "",
    likelihood: hazard?.likelihood ?? 2, severity: hazard?.severity ?? 2, furtherAction: hazard?.furtherAction ?? "", category: hazard?.category ?? "physical",
  });
  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => setF((x) => ({ ...x, [key]: value }));
  const toggle = (person: PersonAtRisk, checked: boolean) => set("personsAtRisk", PERSONS_AT_RISK.filter((p) => (p === person ? checked : f.personsAtRisk.includes(p))));
  return (
    <form method="post" onSubmit={(e) => { e.preventDefault(); onSend(f); }} className="space-y-4" noValidate>
      <fieldset disabled={pending} className="space-y-4">
        {on.signed ? <Notice tone="warning" title="This clears the sign-off" description="The assessment goes back to waiting for sign-off until its owner signs the changed assessment." /> : null}
        <Field label="Hazard" htmlFor={`hz-${id}-hazard`} hint="What could cause harm">
          <Input id={`hz-${id}-hazard`} value={f.hazard} onChange={(e) => set("hazard", e.target.value)} maxLength={300} required placeholder="For example: Wet floor at the pool edge" />
        </Field>
        <Field label="Kind of hazard" htmlFor={`hz-${id}-category`}>
          <NativeSelect id={`hz-${id}-category`} value={f.category} onChange={(e) => set("category", e.target.value as RiskCategory)} className="min-h-11 w-full">
            {RISK_CATEGORIES.map((c) => <NativeSelectOption key={c} value={c}>{CATEGORY_LABEL[c]}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Who could be harmed</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {PERSONS_AT_RISK.map((p) => <ChoiceRow key={p} type="checkbox" id={`hz-${id}-p-${p}`} title={p} checked={f.personsAtRisk.includes(p)} onCheckedChange={(checked) => toggle(p, checked === true)} />)}
          </div>
        </fieldset>
        <Field label="What makes it a risk" htmlFor={`hz-${id}-factor`} optional>
          <Textarea id={`hz-${id}-factor`} value={f.riskFactor} onChange={(e) => set("riskFactor", e.target.value)} rows={2} maxLength={1000} />
        </Field>
        <Field label="What could happen" htmlFor={`hz-${id}-consequence`} optional>
          <Textarea id={`hz-${id}-consequence`} value={f.consequence} onChange={(e) => set("consequence", e.target.value)} rows={2} maxLength={1000} />
        </Field>
        <Ratings id={`hz-${id}-before`} legend="Before any controls" likelihood={f.inherentLikelihood} severity={f.inherentSeverity} onChange={(r) => setF((x) => ({ ...x, inherentLikelihood: r.likelihood, inherentSeverity: r.severity }))} />
        <Field label="Controls in place" htmlFor={`hz-${id}-controls`} hint="What is done now to make it less likely or less severe" optional>
          <Textarea id={`hz-${id}-controls`} value={f.controls} onChange={(e) => set("controls", e.target.value)} rows={4} maxLength={4000} />
        </Field>
        <Ratings id={`hz-${id}-after`} legend="With the controls in place" likelihood={f.likelihood} severity={f.severity} onChange={(r) => setF((x) => ({ ...x, ...r }))} />
        <Field label="Still to do" htmlFor={`hz-${id}-further`} hint="What else is needed to bring it down to the target" optional>
          <Textarea id={`hz-${id}-further`} value={f.furtherAction} onChange={(e) => set("furtherAction", e.target.value)} rows={3} maxLength={4000} />
        </Field>
        {error ? <Notice tone="error" live="alert" title={error} /> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>Go back</Button>
          <LoadingButton type="submit" pending={pending} pendingLabel="Saving…">{hazard ? "Save changes" : "Add the hazard"}</LoadingButton>
        </DialogFooter>
      </fieldset>
    </form>
  );
}
type Fields = Pick<RiskHazardView, "hazard" | "riskFactor" | "personsAtRisk" | "consequence" | "inherentLikelihood" | "inherentSeverity" | "controls" | "likelihood" | "severity" | "furtherAction" | "category">;

/** A writer's tools for hazards: Add a hazard (no `hazard`), or Change and Remove for one. Each
 *  opens a dialog; removing asks first, because the hazard's number is retired with it. */
export function HazardTools({ on, hazard }: { on: On; hazard?: RiskHazardView }) {
  const router = useRouter();
  const [open, setOpen] = useState<"form" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ids = useRef({ operationId: "", hazardId: "" });
  const trigger = useRef<HTMLButtonElement | null>(null);

  function show(which: "form" | "remove", button: HTMLButtonElement) {
    trigger.current = button; ids.current = { operationId: crypto.randomUUID(), hazardId: crypto.randomUUID() }; setError(null); setOpen(which);
  }
  function done(message: string) { setOpen(null); toast.success(message); router.refresh(); }
  function send(fields: Fields) {
    setError(null);
    if (fields.hazard.trim().length < 2) return setError("Say what the hazard is, such as ‘Wet floor at the pool edge’.");
    if (!fields.personsAtRisk.length) return setError("Choose who could be harmed.");
    start(async () => {
      const common = { assessmentId: on.assessmentId, version: on.version, operationId: ids.current.operationId, ...fields };
      const result = hazard ? await editHazard({ ...common, hazardId: hazard.id }) : await addHazard({ ...common, hazardId: ids.current.hazardId });
      if (!result.ok) { setError(result.error); return; }
      done(hazard ? "Hazard changed" : "Hazard added");
    });
  }
  function remove() {
    if (!hazard) return;
    start(async () => {
      const result = await removeHazard({ assessmentId: on.assessmentId, version: on.version, operationId: ids.current.operationId, hazardId: hazard.id });
      if (!result.ok) { setOpen(null); toast.error(result.error); return; }
      done("Hazard removed");
    });
  }
  const back = (event: Event) => { event.preventDefault(); trigger.current?.focus(); };

  return (
    <>
      {hazard ? (
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" disabled={pending} onClick={(e) => show("form", e.currentTarget)}><PencilLine aria-hidden="true" />Change<span className="sr-only">{` ${hazard.reference}`}</span></Button>
          <Button variant="ghost" disabled={pending} onClick={(e) => show("remove", e.currentTarget)}><Trash2 aria-hidden="true" />Remove<span className="sr-only">{` ${hazard.reference}`}</span></Button>
        </div>
      ) : (
        <Button variant="outline" disabled={pending} onClick={(e) => show("form", e.currentTarget)}><Plus aria-hidden="true" />Add a hazard</Button>
      )}

      <Dialog open={open === "form"} onOpenChange={(o) => { if (!o && !pending) setOpen(null); }}>
        <DialogContent onCloseAutoFocus={back} className="max-h-(--overlay-max-height) overflow-y-auto" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{hazard ? `Change ${hazard.reference}` : "Add a hazard"}</DialogTitle>
            <DialogDescription>Rate it twice: as it would be with nothing done, then with the controls in place.</DialogDescription>
          </DialogHeader>
          {open === "form" ? <HazardForm on={on} hazard={hazard} pending={pending} error={error} onCancel={() => setOpen(null)} onSend={send} /> : null}
        </DialogContent>
      </Dialog>

      {hazard ? (
        <AlertDialog open={open === "remove"} onOpenChange={(o) => { if (!o && !pending) setOpen(null); }}>
          <AlertDialogContent onCloseAutoFocus={back}>
            <AlertDialogHeader>
              <AlertDialogTitle>{`Remove ${hazard.reference}?`}</AlertDialogTitle>
              <AlertDialogDescription>{`“${hazard.hazard}” leaves the assessment and its number is not used again.${on.signed ? " The assessment goes back to waiting for sign-off." : ""} The history keeps that it was here.`}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={pending} onClick={(e) => { e.preventDefault(); remove(); }}>Remove hazard</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
}
