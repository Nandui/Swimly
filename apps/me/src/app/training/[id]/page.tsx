"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { Frame } from "@/components/frame";
import { LoadError, Loading, Notice, Tag, useLoad } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { date, day } from "@/lib/format";
import { TRAINING_META } from "@/lib/meta";

type Detail = {
  id: string; title: string; summary: string; content: string; state: string; requiresSignoff: boolean; grants: string | null;
  dueOn: string | null; assignedBy: string; assignedAt: string; completedAt: string | null; signedOffBy: string | null; trainerNote: string;
};

export default function TrainingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, setData, error, reload } = useLoad<Detail>(`training/${id}`);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  async function complete() {
    setBusy(true); setFailure(null);
    try { setData(await api<Detail>(`training/${id}/complete`, { method: "POST", body: { note } })); }
    catch (caught) { setFailure(caught instanceof ApiError ? caught.message : "That didn't save. Try again."); }
    finally { setBusy(false); }
  }
  return (
    <Frame title="Training">
      <div className="stack">
        <Link href="/training" className="button ghost" style={{ alignSelf: "flex-start" }}><ArrowLeft aria-hidden="true" />My training</Link>
        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : (
          <>
            <div className="stack-sm">
              <div className="row"><h1>{data.title}</h1><Tag meta={TRAINING_META[data.state]} /></div>
              {data.summary ? <p className="muted">{data.summary}</p> : null}
              <p className="caption">
                {[`Assigned by ${data.assignedBy} on ${date(data.assignedAt)}`, data.dueOn ? `due ${day(data.dueOn)}` : null,
                  data.requiresSignoff ? "a trainer signs this off in person" : null, data.grants ? `records your ${data.grants}` : null].filter(Boolean).join(" · ")}
              </p>
            </div>
            {data.state === "submitted" ? <Notice title="Waiting for sign-off">A trainer will watch you do it and sign it off.</Notice> : null}
            {data.state === "completed" ? <Notice title={`Completed ${date(data.completedAt)}`}>{data.signedOffBy ? `Signed off by ${data.signedOffBy}.${data.trainerNote ? ` ${data.trainerNote}` : ""}` : "Well done."}</Notice> : null}
            {(data.state === "assigned" || data.state === "overdue") && data.trainerNote ? <Notice title={`Not signed off yet${data.signedOffBy ? ` by ${data.signedOffBy}` : ""}`} tone="warning">{data.trainerNote}</Notice> : null}
            <section className="card stack-sm" aria-labelledby="material">
              <h2 id="material">What to do</h2>
              {data.content ? <p className="pre">{data.content}</p> : <p className="muted">Your trainer will go through this with you.</p>}
            </section>
            {data.state === "assigned" || data.state === "overdue" ? (
              <section className="card stack" aria-labelledby="done-title">
                <h2 id="done-title">{data.requiresSignoff ? "Ready for sign-off?" : "Done it?"}</h2>
                <div className="field">
                  <label htmlFor="note">{data.requiresSignoff ? "Note for your trainer (optional)" : "Note (optional)"}</label>
                  <textarea id="note" className="input" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
                  {data.requiresSignoff ? <span className="hint">For example, when you are next on shift to show it.</span> : null}
                </div>
                {failure ? <Notice title={failure} tone="error" /> : null}
                <button type="button" className="button block" onClick={complete} disabled={busy}><Check aria-hidden="true" />{data.requiresSignoff ? "Ask for sign-off" : "Mark as done"}</button>
              </section>
            ) : null}
          </>
        )}
      </div>
    </Frame>
  );
}
