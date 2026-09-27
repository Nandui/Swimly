"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { DocBody } from "@/components/doc-body";
import { Frame } from "@/components/frame";
import { LoadError, Loading, Notice, useLoad } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { date, day } from "@/lib/format";

type Doc = { documentId: string; versionId: string; version: number; title: string; reference: string; summary: string; body: unknown; dueOn: string | null; status: string; acknowledgedAt: string | null; current: boolean };

export default function ReadingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, setData, error, reload } = useLoad<Doc>(`reading/${id}`);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  async function acknowledge() {
    if (!data) return;
    setBusy(true); setFailure(null);
    try { setData(await api<Doc>(`reading/${id}/acknowledge`, { method: "POST", body: { versionId: data.versionId } })); }
    catch (caught) { setFailure(caught instanceof ApiError ? caught.message : "That didn't save. Try again."); }
    finally { setBusy(false); }
  }
  return (
    <Frame title="Required reading">
      <div className="stack">
        <Link href="/reading" className="button ghost" style={{ alignSelf: "flex-start" }}><ArrowLeft aria-hidden="true" />Required reading</Link>
        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : (
          <>
            <div className="stack-sm">
              <h1>{data.title}</h1>
              <p className="caption">{data.reference} · version {data.version}{data.dueOn ? ` · due ${day(data.dueOn)}` : ""}</p>
              {data.summary ? <p className="muted">{data.summary}</p> : null}
            </div>
            <article className="card"><DocBody body={data.body} /></article>
            {data.acknowledgedAt ? (
              <Notice title={`You read this version on ${date(data.acknowledgedAt)}`} />
            ) : !data.current ? (
              <Notice title="A newer version has been published" tone="warning">It will appear in your reading once it is assigned.</Notice>
            ) : (
              <section className="card stack" aria-labelledby="ack">
                <h2 id="ack">All read?</h2>
                <p className="muted">Confirm you have read and understood version {data.version}. It is recorded against your name.</p>
                {failure ? <Notice title={failure} tone="error" /> : null}
                <button type="button" className="button block" onClick={acknowledge} disabled={busy}><Check aria-hidden="true" />I have read this version</button>
              </section>
            )}
          </>
        )}
      </div>
    </Frame>
  );
}
