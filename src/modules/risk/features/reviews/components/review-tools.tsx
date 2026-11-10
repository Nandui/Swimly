"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Check, MessageCircleQuestion, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { RadioGroup } from "@/components/shadcn/radio-group";
import { Textarea } from "@/components/shadcn/textarea";
import { Field } from "@/components/form-dialog";
import { ChoiceRow } from "@/components/ui/choice-row";
import { LoadingButton } from "@/components/ui/loading-button";
import { toast } from "@/components/ui/toast";
import { Notice } from "@/components/ui-kit/notice";
import { answerRequest, askForReview, logReview } from "@/modules/risk/features/reviews/server/actions";
import { OUTCOME_LABEL, REVIEW_OUTCOMES, type ReviewOutcome, type RiskResult } from "@/modules/risk/shared/types";

const OUTCOME_HINT: Record<ReviewOutcome, string> = {
  no_changes: "The hazards and controls still hold.",
  updated: "The assessment was changed as part of this review.",
  escalated: "Something needs a decision from someone more senior.",
};

/** A button that opens a short form in a dialog, sends it once and refreshes the page. */
function DialogForm({ button, title, says, submit, done, send, children }: {
  button: { label: string; icon: LucideIcon; variant?: "default" | "outline" | "ghost" }; title: string; says: string; submit: string; done: string;
  send(form: FormData, operationId: string): Promise<RiskResult>; children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const operation = useRef("");
  const trigger = useRef<HTMLButtonElement | null>(null);
  const Icon = button.icon;
  return (
    <>
      <Button ref={trigger} variant={button.variant ?? "outline"} onClick={() => { operation.current = crypto.randomUUID(); setError(null); setOpen(true); }}><Icon aria-hidden="true" />{button.label}</Button>
      <Dialog open={open} onOpenChange={(o) => { if (!o && !pending) setOpen(false); }}>
        <DialogContent onCloseAutoFocus={(event) => { event.preventDefault(); trigger.current?.focus(); }} className="max-h-(--overlay-max-height) overflow-y-auto" showCloseButton={false}>
          <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{says}</DialogDescription></DialogHeader>
          <form method="post" className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            start(async () => {
              const result = await send(form, operation.current);
              if (!result.ok) { setError(result.error); return; }
              setOpen(false); toast.success(done); router.refresh();
            });
          }}>
            <fieldset disabled={pending} className="space-y-4">
              {children}
              {error ? <Notice tone="error" live="alert" title={error} /> : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Go back</Button>
                <LoadingButton type="submit" pending={pending} pendingLabel="Saving…">{submit}</LoadingButton>
              </DialogFooter>
            </fieldset>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Log a review that was carried out: the day, what it found and any notes. */
export function LogReview({ id, version, today, prominent }: { id: string; version: number; today: string; prominent: boolean }) {
  const [outcome, setOutcome] = useState<ReviewOutcome>("no_changes");
  return (
    <DialogForm title="Log a review" says="Record a review that has been carried out. The next review moves on from this day." submit="Log the review" done="Review logged"
      button={{ label: "Log a review", icon: CalendarCheck, variant: prominent ? "default" : "outline" }}
      send={(form, operationId) => logReview({ id, operationId, version, reviewedOn: String(form.get("reviewedOn") ?? ""), outcome, notes: String(form.get("notes") ?? "") })}>
      <Field label="Reviewed on" htmlFor="risk-review-on"><Input id="risk-review-on" name="reviewedOn" type="date" defaultValue={today} max={today} required /></Field>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">What it found</legend>
        <RadioGroup value={outcome} onValueChange={(v) => setOutcome(v as ReviewOutcome)} className="gap-2">
          {REVIEW_OUTCOMES.map((o) => <ChoiceRow key={o} type="radio" id={`risk-review-${o}`} value={o} title={OUTCOME_LABEL[o]} hint={OUTCOME_HINT[o]} />)}
        </RadioGroup>
      </fieldset>
      <Field label="Notes" htmlFor="risk-review-notes" optional><Textarea id="risk-review-notes" name="notes" rows={3} maxLength={2000} /></Field>
    </DialogForm>
  );
}

/** Ask for the assessment, or one of its hazards, to be looked at again. */
export function AskForReview({ id, hazards }: { id: string; hazards: { id: string; label: string }[] }) {
  return (
    <DialogForm title="Ask for a review" says="Tell whoever writes this assessment what should be looked at again. They answer it here." submit="Send the request" done="Review asked for"
      button={{ label: "Ask for a review", icon: MessageCircleQuestion }}
      send={(form, operationId) => askForReview({ id, operationId, hazardId: String(form.get("hazardId") ?? ""), notes: String(form.get("notes") ?? "") })}>
      {hazards.length ? (
        <Field label="About" htmlFor="risk-request-hazard">
          <NativeSelect id="risk-request-hazard" name="hazardId" defaultValue="" className="min-h-11 w-full">
            <NativeSelectOption value="">The whole assessment</NativeSelectOption>
            {hazards.map((h) => <NativeSelectOption key={h.id} value={h.id}>{h.label}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
      ) : null}
      <Field label="What should be looked at, and why" htmlFor="risk-request-notes"><Textarea id="risk-request-notes" name="notes" rows={4} maxLength={2000} required /></Field>
    </DialogForm>
  );
}

/** A writer's answer to one request: acted on, or dismissed with a reason. */
export function AnswerRequest({ requestId }: { requestId: string }) {
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <DialogForm title="Acted on" says="Say what was done about it. Whoever asked sees this on the assessment." submit="Mark acted on" done="Request acted on"
        button={{ label: "Acted on", icon: Check }}
        send={(form, operationId) => answerRequest({ requestId, operationId, answer: "actioned", note: String(form.get("note") ?? "") })}>
        <Field label="What was done" htmlFor={`risk-answer-${requestId}`} optional><Textarea id={`risk-answer-${requestId}`} name="note" rows={3} maxLength={2000} /></Field>
      </DialogForm>
      <DialogForm title="Dismiss the request" says="Close it without a change, and say why. Whoever asked sees this on the assessment." submit="Dismiss" done="Request dismissed"
        button={{ label: "Dismiss", icon: X, variant: "ghost" }}
        send={(form, operationId) => answerRequest({ requestId, operationId, answer: "dismissed", note: String(form.get("note") ?? "") })}>
        <Field label="Why it is dismissed" htmlFor={`risk-dismiss-${requestId}`}><Textarea id={`risk-dismiss-${requestId}`} name="note" rows={3} maxLength={2000} required /></Field>
      </DialogForm>
    </div>
  );
}
