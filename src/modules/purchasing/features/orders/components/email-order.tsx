"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Send } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { ConfirmAction } from "@/components/confirm-action";
import { emailOrder } from "@/modules/purchasing/features/orders/server/actions";

/** The email exactly as it will arrive, in a frame with no scripts, as tall as its content. */
export function EmailPreview({ html, title }: { html: string; title: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const measure = () => setHeight(frame.current?.contentDocument?.documentElement.scrollHeight || undefined);
  // The frame can finish loading before React attaches onLoad, so measure once on mount too.
  useEffect(() => { if (frame.current?.contentDocument?.readyState === "complete") measure(); }, [html]);
  return (
    <iframe
      ref={frame}
      title={title}
      srcDoc={html}
      sandbox="allow-same-origin"
      className="min-h-96 w-full rounded-card border border-ui-border bg-ui-background"
      height={height}
      onLoad={measure}
    />
  );
}

/** Send the same email to yourself, to check it before any supplier gets one. */
export function SendTest({ id, to }: { id: string; to: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={<Button variant="outline" className="min-h-11"><FlaskConical aria-hidden="true" />Send test to me</Button>}
      title="Send yourself a test?"
      description={`The exact email goes to ${to} only, marked as a test. The supplier gets nothing.`}
      confirmLabel="Send test"
      successMessage={`Test sent to ${to}`}
      run={async () => { const r = await emailOrder(id, "test"); router.refresh(); return r; }}
    />
  );
}

/** Send the order to the supplier. Only offered once emails to suppliers are on. */
export function SendToSupplier({ id, number, supplier, to, copyTo, replyTo, sentBefore }: { id: string; number: string; supplier: string; to: string; copyTo: string; replyTo: string; sentBefore: string | null }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={<Button className="min-h-11"><Send aria-hidden="true" />{sentBefore ? "Send again" : "Send to supplier"}</Button>}
      title={`Send ${number} to ${supplier}?`}
      description={<>
        It goes to {to}{copyTo ? <>, with a copy to {copyTo}</> : null}{replyTo ? <>, and their replies come to you at {replyTo}</> : null}.
        {sentBefore ? <> It was already sent {sentBefore}, so they will get it twice.</> : null}
      </>}
      confirmLabel={sentBefore ? "Send it again" : "Send to supplier"}
      successMessage={`${number} sent to ${supplier}`}
      run={async () => { const r = await emailOrder(id, "supplier"); router.refresh(); return r; }}
    />
  );
}
