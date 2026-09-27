"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, KeyRound } from "lucide-react";
import { Frame } from "@/components/frame";
import { Loading, Notice, Tag } from "@/components/ui";
import { ApiError, api, session } from "@/lib/api";
import { date } from "@/lib/format";
import { REVIEW_META, REVIEW_OVERALL } from "@/lib/meta";

type Review = { id: string; period: string; reviewer: string; status: string; summary: string; strengths: string; goals: string; overall: string | null; comment: string; sharedAt: string | null; acknowledgedAt: string | null };
type HrRecord = { configured: boolean; notes: { id: string; author: string; body: string; createdAt: string }[]; reviews: Review[] };

/** What HR shared with you. Opening it asks for a fresh email code (valid for
 *  15 minutes), even though you are signed in. */
export default function HrPage() {
  const router = useRouter(), pathname = usePathname();
  const [record, setRecord] = useState<HrRecord | null>(null);
  const [locked, setLocked] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [comments, setComments] = useState<{ [id: string]: string }>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  type Outcome = { record: HrRecord } | { locked: true } | { failure: string } | null;
  const request = useCallback(async (): Promise<Outcome> => {
    if (!session.token()) { router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`); return null; }
    try { return { record: await api<HrRecord>("hr") }; }
    catch (caught) {
      if (caught instanceof ApiError && caught.code === "CONFIRM_REQUIRED") return { locked: true };
      if (caught instanceof ApiError && caught.status === 401) { router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`); return null; }
      return { failure: caught instanceof ApiError ? caught.message : "Couldn't load this." };
    }
  }, [pathname, router]);
  const apply = useCallback((outcome: Outcome) => {
    if (!outcome) return;
    if ("record" in outcome) { setRecord(outcome.record); setLocked(false); }
    else if ("locked" in outcome) setLocked(true);
    else setFailure(outcome.failure);
  }, []);
  useEffect(() => {
    let live = true;
    request().then((outcome) => { if (live) apply(outcome); });
    return () => { live = false; };
  }, [request, apply]);
  const load = useCallback(async () => apply(await request()), [request, apply]);

  async function sendCode() {
    setBusy(true); setFailure(null);
    try { setChallenge((await api<{ challengeId: string }>("auth/confirm", { method: "POST", body: {} })).challengeId); setCode(""); }
    catch (caught) { setFailure(caught instanceof ApiError ? caught.message : "That didn't send. Try again."); }
    finally { setBusy(false); }
  }
  async function confirm(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setFailure(null);
    try { await api("auth/confirm/verify", { method: "POST", body: { challengeId: challenge, code } }); setChallenge(null); await load(); }
    catch (caught) { setFailure(caught instanceof ApiError ? caught.message : "That code didn't work."); }
    finally { setBusy(false); }
  }
  async function acknowledge(id: string) {
    setBusy(true); setFailure(null);
    try { setRecord(await api<HrRecord>(`hr/reviews/${id}/acknowledge`, { method: "POST", body: { comment: comments[id] ?? "" } })); }
    catch (caught) {
      if (caught instanceof ApiError && caught.code === "CONFIRM_REQUIRED") { setLocked(true); setRecord(null); }
      else setFailure(caught instanceof ApiError ? caught.message : "That didn't save.");
    } finally { setBusy(false); }
  }

  return (
    <Frame title="Shared by HR">
      <div className="stack">
        <div className="stack-sm"><h1>Shared by HR</h1><p className="muted">Reviews and notes your manager or HR chose to share with you. Private notes are never shown.</p></div>
        {failure ? <Notice title={failure} tone="error" /> : null}
        {locked ? (
          challenge ? (
            <form className="card stack" onSubmit={confirm}>
              <h2>Enter the code we just emailed you</h2>
              <div className="field"><label htmlFor="hr-code">Six-digit code</label><input id="hr-code" className="input code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></div>
              <button type="submit" className="button block" disabled={busy || code.length !== 6}>Open</button>
            </form>
          ) : (
            <section className="card stack">
              <h2>Confirm it&apos;s you</h2>
              <p className="muted">HR records need a fresh code, even when you are signed in. It lasts 15 minutes.</p>
              <button type="button" className="button block" onClick={sendCode} disabled={busy}><KeyRound aria-hidden="true" />Email me a code</button>
            </section>
          )
        ) : !record ? <Loading /> : !record.configured ? <Notice title="HR records are not set up yet" /> : (
          <>
            {record.reviews.length === 0 && record.notes.length === 0 ? <Notice title="Nothing has been shared with you" /> : null}
            {record.reviews.map((r) => (
              <section key={r.id} className="card stack-sm" aria-labelledby={`rv-${r.id}`}>
                <div className="row"><h2 id={`rv-${r.id}`}>{r.period}</h2><Tag meta={REVIEW_META[r.status]} /></div>
                <p className="caption">From {r.reviewer}{r.sharedAt ? ` · shared ${date(r.sharedAt)}` : ""}</p>
                {([["Summary", r.summary], ["Strengths", r.strengths], ["Goals for the next period", r.goals]] as const).map(([label, text]) => text ? (
                  <div key={label} className="stack-sm"><h3>{label}</h3><p className="pre">{text}</p></div>
                ) : null)}
                {r.overall ? <p><strong>Overall:</strong> {REVIEW_OVERALL[r.overall] ?? r.overall}</p> : null}
                {r.status === "acknowledged" ? (
                  <p className="caption">Acknowledged {date(r.acknowledgedAt)}{r.comment ? ` · your comment: ${r.comment}` : ""}</p>
                ) : (
                  <div className="stack-sm">
                    <div className="field">
                      <label htmlFor={`c-${r.id}`}>Your comment (optional)</label>
                      <textarea id={`c-${r.id}`} className="input" maxLength={2000} value={comments[r.id] ?? ""} onChange={(e) => setComments((prev) => ({ ...prev, [r.id]: e.target.value }))} />
                      <span className="hint">Acknowledging says you have read it, not that you agree with every word.</span>
                    </div>
                    <button type="button" className="button block" onClick={() => acknowledge(r.id)} disabled={busy}><Check aria-hidden="true" />Acknowledge</button>
                  </div>
                )}
              </section>
            ))}
            {record.notes.length > 0 ? (
              <section className="card stack-sm" aria-labelledby="hr-notes">
                <h2 id="hr-notes">Notes</h2>
                <ul className="list">{record.notes.map((n) => (
                  <li key={n.id} className="stack-sm" style={{ padding: "12px 0" }}><p className="caption">{n.author} · {date(n.createdAt)}</p><p className="pre">{n.body}</p></li>
                ))}</ul>
              </section>
            ) : null}
          </>
        )}
      </div>
    </Frame>
  );
}
