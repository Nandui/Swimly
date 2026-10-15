"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, CircleMinus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Field } from "@/components/form-dialog";
import { Textarea } from "@/components/ui/textarea";
import { FileField } from "@/components/ui/file-field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { Notice } from "@/components/ui-kit/notice";
import { cn } from "@/lib/utils";
import { returnForPractice, signOffTraining, type ObservationMarks } from "@/modules/training/features/sign-off/server/actions";
import { observationPasses, type ObservationResult, type ObservationStep, type ObservedStep } from "@/modules/training/shared/on-the-job";

type Evidence = { id: string; name: string; addedByName: string };

const CHOICES: { result: ObservationResult; label: string; icon: typeof Check; variant: "default" | "destructive" | "outline" }[] = [
  { result: "met", label: "Met", icon: Check, variant: "default" },
  { result: "not-yet", label: "Not yet", icon: X, variant: "destructive" },
  { result: "na", label: "Not needed", icon: CircleMinus, variant: "outline" },
];

/** The poolside sign-off (e-learning phase 5): tablet-sized, one row per step
 *  with Met, Not yet and Not needed, a note on any step, photos, then Sign off
 *  or Send back. Nothing is saved until one of those two is pressed. */
export function ObservePractical({ id, name, title, steps, evidence: savedEvidence, last }: {
  id: string; name: string; title: string; steps: ObservationStep[]; evidence: Evidence[]; last: ObservedStep[] | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [marks, setMarks] = useState<Record<string, { result?: ObservationResult; note: string }>>({});
  const [notesOpen, setNotesOpen] = useState<Record<string, boolean>>({});
  const [overall, setOverall] = useState("");
  const [evidence, setEvidence] = useState<Evidence[]>(savedEvidence);
  const [uploading, setUploading] = useState(false);

  const mark = (stepId: string, change: Partial<{ result: ObservationResult; note: string }>) =>
    setMarks((now) => ({ ...now, [stepId]: { ...now[stepId], note: now[stepId]?.note ?? "", ...change } }));
  const answered = steps.filter((s) => marks[s.id]?.result).length;
  const complete = answered === steps.length;
  const observed = steps.map((s) => ({ ...s, result: marks[s.id]?.result ?? "met", note: marks[s.id]?.note ?? "" }));
  const passes = complete && observationPasses(observed);
  const payload = (): ObservationMarks => Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, { result: v.result ?? "", note: v.note }]));
  const finish = (run: () => Promise<{ ok: boolean; error?: string }>, done: string) => start(async () => {
    const result = await run();
    if (!result.ok) { toast.error(result.error ?? "That didn't save. Try again."); return; }
    toast.success(done);
    router.push("/training/sign-off");
    router.refresh();
  });

  async function addPhoto(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch(`/training/sign-off/${id}/evidence`, { method: "POST", body: form }).catch(() => null);
      const data = await response?.json().catch(() => null);
      if (!response || !data?.ok) throw new Error(data?.error ?? "Could not add the photo. Try again.");
      setEvidence((now) => [...now, data.evidence as Evidence]);
      toast.success("Photo added");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {last?.some((s) => s.result === "not-yet") ? (
        <Notice tone="info" title="Last time">Not met yet: {last.filter((s) => s.result === "not-yet").map((s) => s.text).join("; ")}.</Notice>
      ) : null}
      <section className="pc-panel" aria-labelledby="steps-heading">
        <div className="pc-panel-head">
          <h2 id="steps-heading">Watch for</h2>
          <span className="text-sm text-ui-muted-foreground tabular-nums" aria-live="polite">{answered} of {steps.length} marked</span>
        </div>
        <ol className="flex flex-col gap-3">
          {steps.map((step, i) => {
            const current = marks[step.id];
            return (
              <li key={step.id} className={cn("flex flex-col gap-3 rounded-[var(--pc-radius-card)] border border-ui-border p-4", current?.result === "not-yet" && "border-ui-destructive")}>
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold tabular-nums text-ui-muted-foreground">{i + 1}</span>
                  <p className="min-w-0 flex-1 text-base font-medium" id={`step-${step.id}`}>{step.text}</p>
                  {step.critical ? <span className="text-xs font-semibold uppercase tracking-wide text-ui-primary">Must be seen</span> : null}
                </div>
                <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby={`step-${step.id}`}>
                  {CHOICES.filter((c) => !(c.result === "na" && step.critical)).map((choice) => {
                    const on = current?.result === choice.result;
                    return (
                      <Button key={choice.result} type="button" variant={on ? choice.variant : "outline"} aria-pressed={on} className={cn("min-h-14 text-base", on && choice.variant === "outline" && "bg-ui-muted")}
                        onClick={() => mark(step.id, { result: choice.result })}>
                        <choice.icon aria-hidden="true" />{choice.label}
                      </Button>
                    );
                  })}
                </div>
                {notesOpen[step.id] || current?.note ? (
                  <Input id={`note-${step.id}`} label="Note" value={current?.note ?? ""} maxLength={500} onChange={(value) => mark(step.id, { note: value })}
                    placeholder={current?.result === "not-yet" ? "What to practise" : "What you saw"} />
                ) : (
                  <Button type="button" variant="ghost" className="min-h-11 self-start" onClick={() => setNotesOpen((now) => ({ ...now, [step.id]: true }))}>Add a note</Button>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="pc-panel" aria-labelledby="photos-heading">
        <div className="pc-panel-head"><h2 id="photos-heading">Photos</h2></div>
        {evidence.length < 6 ? (
          <FileField label="Take or add a photo" description={`Optional. Kept with ${name}'s training record, up to 6. JPEG, PNG or WebP, up to 4 MB.`}
            accept="image/jpeg,image/png,image/webp" capture="environment" pending={uploading} pendingLabel="Adding…"
            onChange={(event) => { const file = event.target.files?.[0]; if (file) void addPhoto(file); event.target.value = ""; }} />
        ) : null}
        {evidence.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {evidence.map((e) => (
              <li key={e.id}>
                <a href={`/training/evidence/${e.id}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[var(--pc-radius-card)] border border-ui-border">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a private file served by this app */}
                  <img src={`/training/evidence/${e.id}`} alt={`Evidence photo ${e.name}`} loading="lazy" className="aspect-video w-full object-cover" />
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="pc-panel" aria-labelledby="decision-heading">
        <h2 id="decision-heading">Your decision</h2>
        <Field label="Note for the record" htmlFor="overall-note" optional hint={passes ? "Where and how you checked." : "Anything else to practise, on top of the steps not met yet."}>
          <Textarea id="overall-note" value={overall} onChange={(event) => setOverall(event.target.value)} rows={3} maxLength={1000} />
        </Field>
        {!complete ? <p className="text-sm text-ui-muted-foreground">Mark every step to sign off {title}.</p>
          : !passes ? <p className="text-sm text-ui-muted-foreground">Some steps are not met yet. Send it back: {name} sees the steps to practise.</p> : null}
        <div className="flex flex-wrap gap-3">
          <Button type="button" className="min-h-14 flex-1 text-base" disabled={pending || !passes}
            onClick={() => finish(() => signOffTraining(id, overall, payload()), `Signed off ${title} for ${name}`)}>
            <Check aria-hidden="true" />Sign off
          </Button>
          <Button type="button" variant="outline" className="min-h-14 flex-1 text-base" disabled={pending || !complete || (passes && !overall.trim())}
            onClick={() => finish(() => returnForPractice(id, overall, payload()), "Sent back with what to practise")}>
            <RotateCcw aria-hidden="true" />Send back
          </Button>
        </div>
      </section>
    </div>
  );
}
