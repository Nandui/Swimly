"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Award, Check, Copy, Printer } from "lucide-react";
import { Frame } from "@/components/frame";
import { LoadError, Loading, useLoad } from "@/components/ui";
import { Button } from "@/components/shadcn/button";
import { PageShell } from "@/components/ui-kit/page-shell";
import { PageHeader } from "@/components/ui-kit/page-header";
import { date } from "@/lib/format";

type Certificate = {
  name: string; course: string; summary: string; completedAt: string; signedOffBy: string | null;
  grants: string | null; version: number | null; code: string;
};

/** A certificate for finished training (e-learning phase 4): to show a
 *  manager, print or save as PDF. A trainer checks its code in Training. */
export default function CertificatePage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, reload } = useLoad<Certificate>(`training/${id}/certificate`);
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!data) return;
    try { await navigator.clipboard.writeText(data.code); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the code is on screen to read */ }
  }
  return (
    <Frame title="Certificate">
      <PageShell className="certificate-page" header={<PageHeader back={{ href: `/training/${id}`, label: "Course" }} title="Your certificate"
        description="Show it to a manager, or print it or save it as a PDF." />}>
        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : (
          <>
            <article className="certificate" aria-label="Certificate of completion">
              <span className="certificate-seal" aria-hidden="true"><Award /></span>
              <p className="caption eyebrow">Certificate of completion</p>
              <p className="certificate-name">{data.name}</p>
              <p className="muted">has finished</p>
              <p className="certificate-course">{data.course}</p>
              <p className="muted tabular">
                {[`on ${date(data.completedAt)}`, data.signedOffBy ? `signed off by ${data.signedOffBy}` : null, data.version ? `version ${data.version}` : null].filter(Boolean).join(" · ")}
              </p>
              {data.grants ? <p className="caption">Recorded as {data.grants}</p> : null}
              <p className="certificate-code tabular">Check code <strong>{data.code}</strong></p>
              <p className="caption muted">LeisureWorld staff training · checked in Turnfin under Training › Check a certificate</p>
            </article>
            <div className="lesson-nav no-print">
              <Button type="button" variant="outline" onClick={copy}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? "Copied" : "Copy the code"}</Button>
              <Button type="button" onClick={() => window.print()}><Printer aria-hidden="true" />Print or save as PDF</Button>
            </div>
          </>
        )}
      </PageShell>
    </Frame>
  );
}
