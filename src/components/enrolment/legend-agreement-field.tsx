"use client";

import { useId } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/shadcn/radio-group";
import { Label } from "@/components/shadcn/label";
import { useFieldFeedback } from "@/components/ui/form-feedback";

/** No default answer: recording a completed agreement is a staff assertion. */
export function LegendAgreementField({ required = true }: { required?: boolean }) {
  const id = useId();
  const feedback = useFieldFeedback("legendAgreement");
  return <fieldset className="min-w-0 space-y-2 border-t border-ui-border pt-4">
    <legend className="text-sm font-semibold">Legend billing agreement</legend>
    <p id={`${id}-hint`} className="text-sm text-ui-muted-foreground">Has the agreement for this class been updated in Legend?</p>
    <RadioGroup name="legendAgreement" required={required} onValueChange={feedback.clear} aria-label="Legend billing agreement" aria-describedby={`${id}-hint${feedback.error ? ` ${id}-error` : ""}`} className="gap-2">
      <Label htmlFor={`${id}-done`} className="min-h-11 cursor-pointer rounded-ui-md border border-ui-border px-3 py-3 has-[[data-state=checked]]:border-ui-brand-border has-[[data-state=checked]]:bg-ui-brand-soft">
        <RadioGroupItem id={`${id}-done`} value="DONE" aria-invalid={!!feedback.error} />Updated in Legend
      </Label>
      <Label htmlFor={`${id}-pending`} className="min-h-11 cursor-pointer rounded-ui-md border border-ui-border px-3 py-3 has-[[data-state=checked]]:border-ui-brand-border has-[[data-state=checked]]:bg-ui-brand-soft">
        <RadioGroupItem id={`${id}-pending`} value="PENDING" aria-invalid={!!feedback.error} />Still to do — add to follow-up list
      </Label>
    </RadioGroup>
    {feedback.error ? <p id={`${id}-error`} className="text-sm text-ui-destructive" role="alert">{feedback.error}</p> : null}
    {!required ? <p className="text-xs text-ui-muted-foreground">Optional while the class is full. You will be asked again when enrolling from the waitlist.</p> : null}
    <p className="text-xs text-ui-muted-foreground">You can enrol now and finish the agreement later. Swimly records your confirmation; it does not update Legend.</p>
  </fieldset>;
}
