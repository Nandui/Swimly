"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { put } from "@vercel/blob/client";
import { CheckCircle2, Film } from "lucide-react";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Progress } from "@/components/shadcn/progress";
import { Textarea } from "@/components/shadcn/textarea";
import { FileField } from "@/components/ui/file-field";
import { Notice } from "@/components/ui-kit/notice";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { formatDate, formatDateTime } from "@/lib/format";
import { FOOTAGE_ACCEPT, footageProblem, MULTIPART_FROM_BYTES, sizeLabel } from "@/modules/incidents/features/footage/rules";
import type { FootageLink } from "@/modules/incidents/features/footage/server/uploads";

type Item = { key: string; name: string; size: number; percent: number; state: "waiting" | "sending" | "done" | "failed"; error?: string };

async function call(path: string, body: unknown) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = (await response.json().catch(() => ({ ok: false }))) as { ok: boolean; error?: string } & Record<string, unknown>;
  if (!result.ok) throw new Error(result.error ?? "Something went wrong. Try again.");
  return result;
}

/** The page the emailed link opens ("CCTV footage"): what
 *  was asked for, a name, the videos, each sent straight to the store with its
 *  progress, and what has arrived so far. Nothing else of the report. */
export function UploadFootage({ token, link }: { token: string; link: FootageLink }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [uploadedBy, setUploadedBy] = useState(link.recipientName);
  const [note, setNote] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const busy = items.some((i) => i.state === "sending" || i.state === "waiting");
  const patch = (key: string, change: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...change } : i)));

  async function send(files: File[]) {
    setError(null);
    if (uploadedBy.trim().length < 2) { setError("Enter your name first, so we know who sent it."); return; }
    const queued = files.map((f, n) => ({ file: f, item: { key: `${Date.now()}-${n}`, name: f.name, size: f.size, percent: 0, state: "waiting" as const } }));
    setItems((list) => [...list, ...queued.map((q) => q.item)]);
    let received = link.received.length;
    for (const { file, item } of queued) {
      const problem = footageProblem(file, received);
      if (problem) { patch(item.key, { state: "failed", error: problem }); continue; }
      patch(item.key, { state: "sending" });
      try {
        const start = await call("/api/incidents/footage/upload", { token, name: file.name, size: file.size, uploadedBy, note });
        await put(String(start.pathname), file, {
          access: "private", token: String(start.clientToken), contentType: String(start.contentType),
          multipart: file.size >= MULTIPART_FROM_BYTES,
          onUploadProgress: ({ percentage }) => patch(item.key, { percent: Math.min(99, Math.round(percentage)) }),
        });
        await call("/api/incidents/footage/received", { token, footageId: start.footageId });
        patch(item.key, { state: "done", percent: 100 });
        received++;
      } catch (failure) {
        patch(item.key, { state: "failed", error: failure instanceof Error && failure.message ? failure.message : "The upload stopped. Check the connection and try again." });
      }
    }
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <PageShell spacing="roomy" header={<PageHeader title="Send CCTV footage" description={`${link.requestedByName} at ${link.site} asked for it, for incident report ${link.reference}.`} />}>

      <div className="pc-note flex-col items-start gap-1">
        <p className="text-sm font-semibold">What is needed</p>
        <p className="text-sm whitespace-pre-line">{link.details}</p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cctv-by">Your name</Label>
          <Input id="cctv-by" value={uploadedBy} onChange={(e) => setUploadedBy(e.target.value)} maxLength={200} autoComplete="name" disabled={busy} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cctv-note">A note <span className="font-normal text-ui-muted-foreground">(optional)</span></Label>
          <Textarea id="cctv-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} disabled={busy}
            placeholder="Such as which camera each file is, or that the recorder's clock is 5 minutes fast" />
        </div>
        <FileField ref={input} id="cctv-files" label="The videos" multiple accept={FOOTAGE_ACCEPT} pending={busy} pendingLabel="Sending…"
          description="As the recorder exports them: MP4, MOV, AVI, MKV, DAV, H.264 or a zip, up to 5 GB each"
          onChange={(e) => { const files = [...(e.target.files ?? [])]; if (files.length) void send(files); }} />
        <p className="text-xs text-ui-muted-foreground">You can choose several at once. Keep this page open until each one says Sent.</p>
        {error ? <Notice tone="error" live="alert" title={error} /> : null}
      </div>

      {items.length ? (
        <ul className="flex flex-col gap-3" aria-live="polite">
          {items.map((i) => (
            <li key={i.key} className="flex flex-col gap-2">
              <p className="flex min-w-0 items-center gap-2 text-sm">
                {i.state === "done" ? <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-ui-primary" /> : <Film aria-hidden="true" className="size-4 shrink-0 text-ui-muted-foreground" />}
                <span className="min-w-0 flex-1 truncate font-semibold">{i.name}</span>
                <span className="shrink-0 tabular-nums text-ui-muted-foreground">
                  {i.state === "done" ? "Sent" : i.state === "failed" ? "Not sent" : i.state === "waiting" ? "Waiting" : `${i.percent}%`}
                </span>
              </p>
              {i.state === "sending" ? <Progress value={i.percent} aria-label={`Sending ${i.name}`} /> : null}
              {i.state === "failed" ? <Notice tone="error" title={i.error ?? "Not sent."} /> : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Received so far</h2>
        {link.received.length === 0 ? <p className="text-sm text-ui-muted-foreground">Nothing yet.</p> : (
          <ul className="flex flex-col gap-1 text-sm">
            {link.received.map((f) => <li key={f.id} className="min-w-0 break-all">{f.name} <span className="text-ui-muted-foreground">· {sizeLabel(f.size)} · {formatDateTime(f.receivedAt)}</span></li>)}
          </ul>
        )}
        <p className="text-xs text-ui-muted-foreground">This link works until {formatDate(link.expiresAt)}. Thank you.</p>
      </div>
    </PageShell>
  );
}

/** A link that can't take uploads any more: say why and who to ask, nothing else. */
export function FootageLinkClosed({ problem, askedBy }: { problem: string; askedBy: string | null }) {
  return (
    <PageShell header={<PageHeader title="This link can’t take footage"
      description={`${problem} ${askedBy ? `Reply to the email from ${askedBy} if you still have footage to send.` : "Reply to the email it came in if you still have footage to send."}`} />} />
  );
}
