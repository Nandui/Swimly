"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { LoadingButton } from "@/components/ui/loading-button";
import { toast } from "@/components/ui/toast";
import { Notice } from "@/components/ui-kit/notice";
import { formatDay } from "@/lib/format";
import type { EmailPlan } from "@/modules/activities/features/failed-payments/server/email";
import { sendPaymentEmail } from "@/modules/activities/features/failed-payments/server/actions";
import { EMAIL_STEP_LABEL } from "@/modules/activities/shared/payments/emails";

const SEND: Record<1 | 2 | 3, string> = { 1: "Send first email", 2: "Send reminder", 3: "Send final notice" };

/** Reception sends the next warning email from the payment's page (owner, 2 November 2026): the
 *  button opens the email exactly as the family will read it, with who it goes to, and sends it on
 *  Send email. Before it is due the button waits and says when; with no address it says why. */
export function SendEmail({ failure, plan }: { failure: { id: string; version: number }; plan: EmailPlan }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const operation = useRef("");
  const label = SEND[plan.step];

  if (plan.blocked) return <Notice tone="warning" title={`${EMAIL_STEP_LABEL[plan.step]} can’t be sent`} description={plan.blocked} />;
  if (!plan.due) {
    return (
      <div className="flex flex-col gap-1">
        <Button variant="outline" className="justify-start" disabled><Mail aria-hidden="true" />{label}</Button>
        <p className="text-sm text-ui-muted-foreground">Due on {formatDay(plan.dueOn)}.</p>
      </div>
    );
  }
  function send() {
    start(async () => {
      const result = await sendPaymentEmail({ id: failure.id, operationId: operation.current, version: failure.version, step: plan.step });
      if (!result.ok) { setError(result.error); return; }
      setOpen(false); toast.success(`${EMAIL_STEP_LABEL[plan.step]} sent`); router.refresh();
    });
  }
  return (
    <>
      <Button className="justify-start" onClick={() => { operation.current = crypto.randomUUID(); setError(null); setOpen(true); }}>
        <Mail aria-hidden="true" />{label}
      </Button>
      <Dialog open={open} onOpenChange={(o) => { if (!pending) setOpen(o); }}>
        <DialogContent className="max-h-(--overlay-max-height) overflow-y-auto sm:max-w-xl" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>To {plan.to}. This is the email the family will get.</DialogDescription>
          </DialogHeader>
          <div className="rounded-ui-lg border border-ui-border bg-ui-accent p-4">
            <p className="mb-3 text-sm"><span className="text-ui-muted-foreground">Subject: </span><strong>{plan.subject}</strong></p>
            <p className="text-sm whitespace-pre-wrap break-words">{plan.text}</p>
          </div>
          {error ? <Notice tone="error" live="alert" title={error} /> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Go back</Button>
            <LoadingButton type="button" pending={pending} pendingLabel="Sending…" onClick={send}><Mail aria-hidden="true" />Send email</LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
