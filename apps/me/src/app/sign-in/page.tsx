"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Send } from "lucide-react";
import { ApiError, api, session } from "@/lib/api";
import { claim, flush } from "@/lib/offline";
import { Brand } from "@/components/frame";
import { Notice } from "@/components/ui";
import { Button } from "@/components/shadcn/button";
import { PageShell } from "@/components/ui-kit/page-shell";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Input } from "@/components/ui/input";

/** Sign in with a code sent to the email on your Turnfin account, every time.
 *  There is no password here. */
function SignIn() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null);
    try {
      const result = await api<{ challengeId: string }>("auth/request-code", { method: "POST", body: { email }, auth: false });
      setChallenge(result.challengeId); setCode("");
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "Could not sign you in. Try again."); }
    finally { setBusy(false); }
  }
  async function verify(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null);
    try {
      const result = await api<{ accessToken: string }>("auth/verify-code", { method: "POST", body: { challengeId: challenge, code }, auth: false });
      session.set(result.accessToken);
      // Someone else's saved courses go; this person's waiting changes are sent.
      await claim(email);
      void flush();
      router.replace(destination);
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "Could not sign you in. Try again."); setBusy(false); }
  }

  return (
    <main className="page narrow">
      <title>Sign in · Turnfin Me</title>
      <PageShell header={<PageHeader eyebrow={<div className="mb-4"><Brand /></div>} title={challenge ? "Check your email" : "Sign in"}
        description={challenge
          ? `If ${email} belongs to a staff account, a six-digit code is on its way. It expires in 10 minutes.`
          : "Your training, reading, qualifications, shifts and HR, on your phone. We email you a code each time you sign in."} />}>
        {error ? <Notice title={error} tone="error" live /> : null}
        {!challenge ? (
          <form className="pc-panel" onSubmit={sendCode}>
            <Input id="email" label="Work email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={setEmail} />
            <Button type="submit" className="self-start max-md:self-stretch" disabled={busy}><Send aria-hidden="true" />{busy ? "Sending…" : "Email me a code"}</Button>
          </form>
        ) : (
          <form className="pc-panel" onSubmit={verify}>
            <Input id="code" label="Six-digit code" className="tabular-nums" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} placeholder="123456" required autoFocus value={code} onChange={(value) => setCode(value.replace(/\D/g, ""))} />
            <Button type="submit" className="self-start max-md:self-stretch" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Sign in"}</Button>
            <Button type="button" variant="ghost" className="self-start max-md:self-stretch" onClick={() => { setChallenge(null); setError(null); }}><ChevronLeft aria-hidden="true" />Use a different email</Button>
          </form>
        )}
        <p className="caption">Turnfin Me only shows your own records. Work, like booking swimmers, stays on the centre’s computers.</p>
      </PageShell>
    </main>
  );
}

export default function SignInPage() {
  return <Suspense><SignIn /></Suspense>;
}
