"use client";

import { useTransition } from "react";
import { FlaskConical } from "lucide-react";
import { LoadingButton } from "@/components/ui/loading-button";
import { toast } from "@/components/ui/toast";
import { sendTestPaymentEmail } from "@/modules/activities/features/failed-payments/server/actions";

/** Admins check the warning emails actually go (owner, 4 November 2026): sends this payment's next
 *  email, marked as a test, to the signed-in person's own address. The family gets nothing and the
 *  payment does not change. */
export function SendTestEmail({ failureId }: { failureId: string }) {
  const [pending, start] = useTransition();
  function send() {
    start(async () => {
      const result = await sendTestPaymentEmail({ id: failureId });
      if (!result.ok) { toast.error(result.error); return; }
      toast.success(`Test email sent to ${result.to}`);
    });
  }
  return (
    <LoadingButton type="button" variant="outline" className="justify-start" pending={pending} pendingLabel="Sending test…" onClick={send}>
      <FlaskConical aria-hidden="true" />Send test email to me
    </LoadingButton>
  );
}
