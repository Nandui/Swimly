"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CircleCheck, Landmark, PhoneCall, RotateCcw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { Textarea } from "@/components/shadcn/textarea";
import { Field } from "@/components/form-dialog";
import { LoadingButton } from "@/components/ui/loading-button";
import { toast } from "@/components/ui/toast";
import { Notice } from "@/components/ui-kit/notice";
import { SegmentedChoice } from "@/components/ui-kit/segmented-links";
import { closeFailure, logContact, reopenFailure } from "@/modules/payments/features/failures/server/actions";
import { CONTACT_METHODS, CONTACT_RESULTS, METHOD_LABEL, OUTCOME_HINT, RESULT_LABEL, type ContactMethod, type ContactResult, type Outcome, type PaymentView } from "@/modules/payments/shared/types";

type Step = "contact" | Outcome | "reopen";
const LABEL: Record<Step, string> = { contact: "Log a contact", paid: "Paid at the desk", new_mandate: "New mandate set up", cancelled: "Place cancelled", reopen: "Open again" };
const ICON: Record<Step, LucideIcon> = { contact: PhoneCall, paid: CircleCheck, new_mandate: Landmark, cancelled: Ban, reopen: RotateCcw };
const SAYS: Record<Step, string> = {
  contact: "Record that you got in touch, or tried to. Each one is counted.",
  ...OUTCOME_HINT,
  reopen: "Open it again, for example when it was closed by mistake or the new mandate failed too.",
};
const DONE: Record<Step, string> = { contact: "Contact logged", paid: "Marked paid at the desk", new_mandate: "Marked new mandate set up", cancelled: "Marked place cancelled", reopen: "Opened again" };

/** The steps on a failed payment, beside it in "Next action": Log a contact first, then the three
 *  ways it ends, each with a short dialog; Open again for Manage once it is closed. */
export function FollowUpActions({ failure, follow, manage }: { failure: PaymentView; follow: boolean; manage: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step | null>(null);
  const [method, setMethod] = useState<ContactMethod>("phone");
  const [result, setResult] = useState<ContactResult>("spoke");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const operation = useRef("");
  const trigger = useRef<HTMLButtonElement | null>(null);
  const open = failure.status === "to_contact" || failure.status === "contacted";
  const steps: Step[] = open ? (follow ? ["contact", "paid", "new_mandate", "cancelled"] : []) : manage ? ["reopen"] : [];
  if (!steps.length) return null;

  function begin(next: Step, button: HTMLButtonElement) {
    trigger.current = button; operation.current = crypto.randomUUID(); setError(null); setMethod("phone"); setResult("spoke"); setStep(next);
  }
  function send(form: HTMLFormElement) {
    if (!step) return;
    const note = String(new FormData(form).get("note") ?? "");
    const base = { id: failure.id, operationId: operation.current, version: failure.version, note };
    start(async () => {
      const done = step === "contact" ? await logContact({ ...base, method, result })
        : step === "reopen" ? await reopenFailure(base)
        : await closeFailure({ ...base, outcome: step });
      if (!done.ok) { setError(done.error); return; }
      toast.success(DONE[step]); setStep(null); router.refresh();
    });
  }
  const back = (event: Event) => { event.preventDefault(); trigger.current?.focus(); };
  const Icon = step ? ICON[step] : null;
  const noteRequired = step === "cancelled" || step === "reopen";

  return (
    <>
      <div className="flex flex-col gap-2">
        {steps.map((s, i) => {
          const StepIcon = ICON[s];
          return <Button key={s} className="justify-start" variant={i === 0 ? "default" : "outline"} disabled={pending} onClick={(e) => begin(s, e.currentTarget)}><StepIcon aria-hidden="true" />{LABEL[s]}</Button>;
        })}
      </div>

      <Dialog open={!!step} onOpenChange={(o) => { if (!o && !pending) setStep(null); }}>
        <DialogContent onCloseAutoFocus={back} className="max-h-(--overlay-max-height) overflow-y-auto" showCloseButton={false}>
          <DialogHeader><DialogTitle>{step ? LABEL[step] : ""}</DialogTitle><DialogDescription>{step ? SAYS[step] : ""}</DialogDescription></DialogHeader>
          <form method="post" onSubmit={(e) => { e.preventDefault(); send(e.currentTarget); }} className="space-y-4">
            <fieldset disabled={pending} className="space-y-4">
              {step === "contact" ? (
                <>
                  <div className="space-y-2">
                    <p id="pay-method" className="text-sm font-semibold">How</p>
                    <SegmentedChoice name="method" aria-labelledby="pay-method" fill="phone" value={method} onValueChange={(v) => setMethod(v as ContactMethod)}
                      options={CONTACT_METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }))} />
                  </div>
                  <div className="space-y-2">
                    <p id="pay-result" className="text-sm font-semibold">What happened</p>
                    <SegmentedChoice name="result" aria-labelledby="pay-result" fill="phone" value={result} onValueChange={(v) => setResult(v as ContactResult)}
                      options={CONTACT_RESULTS.map((r) => ({ value: r, label: RESULT_LABEL[r] }))} />
                  </div>
                </>
              ) : null}
              <Field label={step === "cancelled" ? "Why the place was cancelled" : step === "reopen" ? "Why it is open again" : "Note"} htmlFor="pay-note" optional={!noteRequired}>
                <Textarea id="pay-note" name="note" rows={3} maxLength={1000} required={noteRequired}
                  placeholder={step === "contact" ? "For example: will pay at the desk on Saturday" : step === "paid" ? "For example: paid by card, Legend receipt 4471" : undefined} />
              </Field>
              {error ? <Notice tone="error" live="alert" title={error} /> : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setStep(null)}>Go back</Button>
                <LoadingButton type="submit" pending={pending} pendingLabel="Saving…">{Icon ? <Icon aria-hidden="true" /> : null}{step ? LABEL[step] : ""}</LoadingButton>
              </DialogFooter>
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
