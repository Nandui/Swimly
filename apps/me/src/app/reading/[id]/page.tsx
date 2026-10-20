"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { DocBody } from "@/components/doc-body";
import { Frame } from "@/components/frame";
import { LoadError, Loading, Notice, useLoad } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { date, day } from "@/lib/format";
import { Button } from "@/components/shadcn/button";
import { PageShell } from "@/components/ui-kit/page-shell";
import { PageHeader } from "@/components/ui-kit/page-header";

type Doc = { documentId: string; versionId: string; version: number; title: string; reference: string; summary: string; body: unknown; dueOn: string | null; status: string; acknowledgedAt: string | null; current: boolean };

export default function ReadingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, setData, error, reload } = useLoad<Doc>(`reading/${id}`);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // The acknowledged Notice is announced only when this visit just produced it.
  const [justDone, setJustDone] = useState(false);
  async function acknowledge() {
    if (!data) return;
    setBusy(true); setFailure(null);
    try { setData(await api<Doc>(`reading/${id}/acknowledge`, { method: "POST", body: { versionId: data.versionId } })); setJustDone(true); }
    catch (caught) { setFailure(caught instanceof ApiError ? caught.message : "That didn't save. Try again."); }
    finally { setBusy(false); }
  }
  return (
    <Frame title="Required reading">
      <PageShell header={<PageHeader back={{ href: "/reading", label: "Required reading" }} title={data?.title ?? "Required reading"}
        description={data ? <>{`${data.reference} · version ${data.version}${data.dueOn ? ` · due ${day(data.dueOn)}` : ""}`}{data.summary ? <><br />{data.summary}</> : null}</> : undefined} />}>
        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : (
          <>
            <article className="pc-panel"><DocBody body={data.body} /></article>
            {data.acknowledgedAt ? (
              <Notice title={`You read this version on ${date(data.acknowledgedAt)}`} live={justDone} />
            ) : !data.current ? (
              <Notice title="A newer version has been published" tone="warning">It will appear in your reading once it is assigned.</Notice>
            ) : (
              <section className="pc-panel" aria-labelledby="ack">
                <h2 id="ack">All read?</h2>
                <p>Confirm you have read and understood version {data.version}. It is recorded against your name.</p>
                {failure ? <Notice title={failure} tone="error" live /> : null}
                <Button type="button" onClick={acknowledge} disabled={busy} className="self-start max-md:self-stretch"><CircleCheck aria-hidden="true" />I have read this version</Button>
              </section>
            )}
          </>
        )}
      </PageShell>
    </Frame>
  );
}
