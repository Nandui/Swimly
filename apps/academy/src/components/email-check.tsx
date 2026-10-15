"use client";

import { useState, type FormEvent } from "react";
import { ChevronLeft, Send } from "lucide-react";
import { api, message, session } from "@/lib/api";
import { Notice } from "@/components/ui";

/** Signing in: an email, then the six-digit code we send to it. The same on the sign-in page and
 *  inside a course's booking panel. */
export function EmailCheck({ onDone, lead }: { onDone: () => void; lead?: string }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(work: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await work(); } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  const send = (event: FormEvent) => { event.preventDefault(); return run(async () => {
    const r = await api<{ challengeId: string }>("auth/request-code", { method: "POST", body: { email } });
    setChallenge(r.challengeId); setCode(""); setStep("code");
  }); };
  const verify = (event: FormEvent) => { event.preventDefault(); return run(async () => {
    const r = await api<{ token: string; email: string; expiresAt: string }>("auth/verify-code", { method: "POST", body: { challengeId: challenge, code } });
    session.set(r); onDone();
  }); };

  return (
    <div className="stack">
      <p className="muted">
        {step === "email" ? lead ?? "We email you a code to check it's you. No password needed." : `We sent a six-digit code to ${email}. It works for 10 minutes. Not there? Check your junk folder.`}
      </p>
      {error ? <Notice title={error} tone="error" live /> : null}
      {step === "email" ? (
        <form key="email" className="stack" onSubmit={send}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button type="submit" className="button block" disabled={busy}><Send aria-hidden="true" />{busy ? "Sending…" : "Send me a code"}</button>
        </form>
      ) : (
        <form key="code" className="stack" onSubmit={verify}>
          <div className="field">
            <label htmlFor="code">Six-digit code</label>
            <input id="code" className="input tabular code-input" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          </div>
          <button type="submit" className="button block" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Sign in"}</button>
          <button type="button" className="button ghost block" onClick={() => { setStep("email"); setError(null); }}><ChevronLeft aria-hidden="true" />Use a different email</button>
        </form>
      )}
    </div>
  );
}
