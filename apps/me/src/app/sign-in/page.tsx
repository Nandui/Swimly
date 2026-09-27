"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import { ApiError, api, session } from "@/lib/api";
import { Notice } from "@/components/ui";

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
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "Something went wrong. Try again."); }
    finally { setBusy(false); }
  }
  async function verify(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null);
    try {
      const result = await api<{ accessToken: string }>("auth/verify-code", { method: "POST", body: { challengeId: challenge, code }, auth: false });
      session.set(result.accessToken);
      router.replace(destination);
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "Something went wrong. Try again."); setBusy(false); }
  }

  return (
    <main className="page" style={{ maxWidth: 440, paddingTop: 48 }}>
      <div className="stack">
        <div className="brand" style={{ fontSize: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="" /> Turnfin <span>Me</span>
        </div>
        <div className="stack-sm">
          <h1>{challenge ? "Check your email" : "Sign in"}</h1>
          <p className="muted">
            {challenge
              ? `If ${email} belongs to a LeisureWorld staff account, a six-digit code is on its way. It expires in 10 minutes.`
              : "Your training, reading, qualifications, shifts and HR, on your phone. We email you a code each time you sign in."}
          </p>
        </div>
        {error ? <Notice title={error} tone="error" /> : null}
        {!challenge ? (
          <form className="card stack" onSubmit={sendCode}>
            <div className="field">
              <label htmlFor="email">Work email</label>
              <input id="email" className="input" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button type="submit" className="button block" disabled={busy}><Mail aria-hidden="true" />{busy ? "Sending…" : "Email me a code"}</button>
          </form>
        ) : (
          <form className="card stack" onSubmit={verify}>
            <div className="field">
              <label htmlFor="code">Six-digit code</label>
              <input id="code" className="input code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            </div>
            <button type="submit" className="button block" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Sign in"}</button>
            <button type="button" className="button ghost block" onClick={() => { setChallenge(null); setError(null); }}><ArrowLeft aria-hidden="true" />Use a different email</button>
          </form>
        )}
        <p className="caption">Turnfin Me only shows your own records. Work, like booking swimmers, stays on the centre’s computers.</p>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return <Suspense><SignIn /></Suspense>;
}
