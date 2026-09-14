"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/ui/loading-button";
import { FormFeedbackProvider, useFormFeedback } from "@/components/ui/form-feedback";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/shadcn/dialog";
import { Alert, AlertDescription } from "@/components/shadcn/alert";
import type { ActionConfirmation, ActionResult, ConfirmationReply } from "@/lib/action-result";
import { toast } from "@/lib/toast";
import { withTimeout } from "@/lib/save-feedback";
import { cn } from "@/lib/utils";

/** Keeps a reviewable server confirmation and the original form together. */
export function ProfileActionDialog({ trigger, title, description, submitLabel = "Save", success = "Saved", submit, children, wide = false, footer, submitDisabled = false, onOpenChange }: {
  trigger: React.ReactNode; title: string; description: string; submitLabel?: string; success?: string;
  submit: (data: FormData, confirmation?: ConfirmationReply) => Promise<ActionResult>; children: React.ReactNode;
  wide?: boolean; footer?: React.ReactNode; submitDisabled?: boolean; onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const { formRef, summaryRef, ...feedback } = useFormFeedback();
  const error = feedback.message;
  const confirmationHeading = useRef<HTMLElement>(null);
  const [confirmation, setConfirmation] = useState<ActionConfirmation | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingChoice, setPendingChoice] = useState<string | null>(null);
  useEffect(() => { if (confirmation) confirmationHeading.current?.focus({ preventScroll: true }); }, [confirmation]);
  const data = useRef<FormData | null>(null), busy = useRef(false);
  const router = useRouter();
  function run(values: FormData, reply?: ConfirmationReply) {
    if (busy.current) return;
    busy.current = true; setPendingChoice(reply?.choice ?? null); data.current = values; feedback.reset();
    startTransition(async () => {
      try {
        const result = await withTimeout(submit(values, reply));
        if (!result.ok) { setConfirmation(result.confirmation ?? null); if (result.confirmation) feedback.reset(); else feedback.report(result); return; }
        setOpen(false); onOpenChange?.(false); setConfirmation(null); toast.success(success); router.refresh();
      } catch { feedback.report("Could not confirm the save. Check the swimmer’s history before trying again. Your entries are still here."); }
      finally { busy.current = false; }
    });
  }
  function changeOpen(next: boolean) { if (!pending) { setOpen(next); onOpenChange?.(next); feedback.reset(); if (!next) setConfirmation(null); } }
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild>{trigger}</DialogTrigger>
    <DialogContent className={cn("max-h-[90dvh] overflow-y-auto sm:max-w-2xl", wide && "flex flex-col gap-0 overflow-hidden p-0 sm:max-w-[calc(100%-2rem)] xl:max-w-6xl [&>[data-slot=dialog-close]]:top-2 [&>[data-slot=dialog-close]]:right-2 [&>[data-slot=dialog-close]]:flex [&>[data-slot=dialog-close]]:size-11 [&>[data-slot=dialog-close]]:items-center [&>[data-slot=dialog-close]]:justify-center")} showCloseButton={!pending}>
      <DialogHeader className={cn(wide && "shrink-0 p-4 pr-14 text-left sm:p-6 sm:pr-14")}><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      <FormFeedbackProvider feedback={feedback}><form ref={formRef} aria-busy={pending} onSubmit={event => { event.preventDefault(); if (!confirmation && !submitDisabled) run(new FormData(event.currentTarget)); }} className={cn(wide ? "flex min-h-0 flex-1 flex-col" : "space-y-5")}>
        <div className={cn(wide ? "min-h-0 space-y-4 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6" : "space-y-4")}>
        <fieldset disabled={pending || !!confirmation} hidden={!!confirmation} className="min-w-0 space-y-4">{children}</fieldset>
        {confirmation ? <section ref={confirmationHeading} tabIndex={-1} className="space-y-3" aria-label="Confirm this change"><h3 className="font-semibold">{confirmation.title}</h3><p className="whitespace-pre-line text-sm">{confirmation.description}</p></section> : null}
        {error ? <Alert ref={summaryRef} tabIndex={-1} variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
        </div>
        <div className={cn(wide && "flex shrink-0 flex-col gap-3 border-t border-ui-border p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6")}>
        {wide && !confirmation ? <div className="min-w-0 text-sm">{footer}</div> : null}
        <DialogFooter className={cn(wide && "shrink-0 flex-row flex-wrap justify-end sm:ml-auto [&_button]:min-h-11")}><Button type="button" variant="outline" disabled={pending} onClick={() => confirmation ? setConfirmation(null) : changeOpen(false)}>{confirmation ? "Back" : "Cancel"}</Button>
          {confirmation ? confirmation.choices.map(choice => <LoadingButton type="button" key={choice.value} disabled={pending} pending={pending && pendingChoice === choice.value} pendingLabel="Working…" onClick={() => data.current && run(data.current, { choice: choice.value, ids: confirmation.ids })}>{choice.label}</LoadingButton>)
            : <LoadingButton type="submit" disabled={submitDisabled} pending={pending} pendingLabel="Working…">{submitLabel}</LoadingButton>}
        </DialogFooter>
        </div>
      </form></FormFeedbackProvider>
    </DialogContent>
  </Dialog>;
}
