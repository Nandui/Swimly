"use client";

import { useState } from "react";
import { ClipboardCheck, Plus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { ChoiceRow } from "@/components/ui/choice-row";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { Notice } from "@/components/ui-kit/notice";
import { saveObservationChecklist } from "@/modules/training/features/builder/server/actions";
import { id, moved, RowTools } from "@/modules/training/features/builder/components/lesson-kinds";
import { useAct } from "@/modules/training/features/builder/components/question-bank";
import { MAX_OBSERVATION_STEPS, type ObservationStep } from "@/modules/training/shared/on-the-job";

/** The practical checklist (e-learning phase 5): the steps a trainer watches
 *  for at the sign-off, ticked at the poolside on a tablet. Steps that must be
 *  seen can't be skipped; the person is signed off only when none is "not yet". */
export function PracticalPanel({ courseId, steps: saved, requiresSignoff, canEdit }: { courseId: string; steps: ObservationStep[]; requiresSignoff: boolean; canEdit: boolean }) {
  const { act, pending } = useAct();
  const [steps, setSteps] = useState<ObservationStep[]>(saved.length ? saved : [{ id: id(), text: "", critical: true }]);
  const [dirty, setDirty] = useState(false);
  const set = (next: ObservationStep[]) => { setSteps(next); setDirty(true); };
  const filled = steps.filter((s) => s.text.trim());
  return (
    <section className="pc-panel flex flex-col gap-5" aria-labelledby="practical-heading">
      <div className="flex flex-wrap items-center gap-3">
        <span className="pc-tile-icon"><ClipboardCheck aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-ui-muted-foreground">Sign-off</p>
          <h2 id="practical-heading" className="text-[length:var(--pc-text-title)] leading-[var(--pc-leading-title)]">Practical checklist</h2>
        </div>
      </div>
      {!requiresSignoff ? (
        <Notice tone="info" title="This course has no practical sign-off">Turn on “A trainer signs it off in person at the end” in the course settings to use this checklist.</Notice>
      ) : null}
      <p className="text-sm text-ui-muted-foreground">What the trainer watches for, one step at a time. At the sign-off they mark each step met, not yet, or not needed, with a note and photos. Staff see the list in Turnfin Me before they ask to be signed off.</p>
      <fieldset className="flex flex-col gap-3" disabled={!canEdit || pending}>
        <legend className="sr-only">Steps</legend>
        <ol className="flex flex-col gap-3">
          {steps.map((step, i) => (
            <li key={step.id} className="flex flex-col gap-2 rounded-[var(--pc-radius-card)] bg-ui-muted p-3">
              <div className="flex items-end gap-2">
                <Input id={`step-${step.id}`} label={`Step ${i + 1}`} value={step.text} maxLength={300} className="min-w-0 flex-1"
                  placeholder="Checks the casualty for breathing for 10 seconds" onChange={(value) => set(steps.map((s) => s.id === step.id ? { ...s, text: value } : s))} />
                <RowTools label={`step ${i + 1}`} index={i} count={steps.length} min={1} onMove={(by) => set(moved(steps, i, by))} onRemove={() => set(steps.filter((s) => s.id !== step.id))} />
              </div>
              <ChoiceRow type="checkbox" id={`critical-${step.id}`} title="Must be seen" hint="Can’t be marked as not needed."
                checked={step.critical} onCheckedChange={(on) => set(steps.map((s) => s.id === step.id ? { ...s, critical: on === true } : s))} />
            </li>
          ))}
        </ol>
        {steps.length < MAX_OBSERVATION_STEPS ? (
          <Button type="button" variant="outline" className="min-h-11 self-start" onClick={() => set([...steps, { id: id(), text: "", critical: false }])}><Plus aria-hidden="true" />Add a step</Button>
        ) : null}
      </fieldset>
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" className="min-h-11" disabled={pending || !dirty}
            onClick={() => act(() => saveObservationChecklist(courseId, filled), () => { setDirty(false); toast.success(filled.length ? "Checklist saved" : "Checklist removed"); })}>
            {filled.length ? "Save checklist" : "Remove checklist"}
          </Button>
          <span className="text-sm text-ui-muted-foreground tabular-nums">{filled.length} {filled.length === 1 ? "step" : "steps"}, {filled.filter((s) => s.critical).length} must be seen. Applies to the next sign-off; no need to publish.</span>
        </div>
      ) : null}
    </section>
  );
}
