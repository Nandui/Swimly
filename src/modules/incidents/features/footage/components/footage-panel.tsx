"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Clock, Film, Mail, RotateCw, Send, Trash2, CheckCheck, CircleSlash } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Textarea } from "@/components/shadcn/textarea";
import { Field, FormDialog } from "@/components/form-dialog";
import { Notice } from "@/components/ui-kit/notice";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate, formatDateTime } from "@/lib/format";
import type { StatusMeta } from "@/lib/status";
import { LINK_DAYS, sizeLabel } from "@/modules/incidents/features/footage/rules";
import { cancelFootage, removeFootageVideo, requestFootage, sendFootageRequestAgain } from "@/modules/incidents/features/footage/server/actions";
import type { FootageOnReport, FootageRequestState } from "@/modules/incidents/features/footage/server/requests";

const THEME = "turnfin-docs turnfin-module";
const text = (data: FormData, key: string) => String(data.get(key) ?? "");

/** Each request's state: its words, tone and icon. */
const REQUEST_STATES = {
  open: { label: "Link open", color: "blue", icon: Clock },
  expired: { label: "Link expired", color: "gray", icon: CircleSlash },
  cancelled: { label: "Cancelled", color: "gray", icon: Ban },
  finished: { label: "Report closed", color: "gray", icon: CheckCheck },
} satisfies Record<FootageRequestState, StatusMeta>;

type Request = FootageOnReport["requests"][number];

/** CCTV footage on a report ("CCTV footage"): ask whoever
 *  holds it, by email, for a link that uploads straight to this report; the
 *  videos then play here. For those who triage at the site only. */
export function FootagePanel({ reportId, data }: { reportId: string; data: FootageOnReport }) {
  const { requests, canRequest, ready } = data;
  if (!requests.length && !canRequest) return null;
  const videos = requests.reduce((n, r) => n + r.footage.length, 0);
  return (
    <section aria-labelledby="inc-footage-h" className="pc-panel flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="inc-footage-h">CCTV footage</h2>
          <p className="text-sm text-ui-muted-foreground">
            {videos ? `${videos} ${videos === 1 ? "video" : "videos"} received. ` : ""}
            Ask whoever holds the recording, on the team or not, such as the security company. They get an email with a link to upload it here, without signing in.
          </p>
        </div>
        {canRequest && ready ? <RequestFootage reportId={reportId} data={data} /> : null}
      </div>
      {canRequest && !ready ? (
        <Notice tone="warning" title="Footage storage isn't set up yet"
          description="Videos are too big to keep with the report's photos, so they need their own private storage, connected in Vercel. Until then, ask for footage by email as before." />
      ) : null}
      {requests.length === 0 ? <p className="text-sm text-ui-muted-foreground">No footage asked for yet. Recorders overwrite within days, so ask early.</p> : (
        <ul className="flex flex-col gap-3">
          {requests.map((r) => <RequestRow key={r.id} request={r} canChange={data.canChange && ready} />)}
        </ul>
      )}
    </section>
  );
}

function RequestFootage({ reportId, data }: { reportId: string; data: FootageOnReport }) {
  const router = useRouter();
  const [who, setWho] = useState("");
  return (
    <FormDialog portalClassName={THEME} width="sm:max-w-lg"
      trigger={<Button variant="outline" className="min-h-11"><Film aria-hidden="true" />Ask for footage</Button>}
      title="Ask for CCTV footage"
      description={`They get an email with a link to upload the videos to this report, open for ${LINK_DAYS} days. The link shows only what you write below: leave out who was involved and what happened.`}
      submitLabel="Send the request" successMessage="Request saved" onOpen={() => setWho("")} onSuccess={() => router.refresh()}
      submit={(form) => requestFootage(reportId, { userId: who, name: text(form, "name"), email: text(form, "email"), details: text(form, "details") })}>
      <Field label="Who has the footage" htmlFor="inc-cctv-who">
        <NativeSelect id="inc-cctv-who" value={who} onChange={(e) => setWho(e.target.value)}>
          <NativeSelectOption value="">Someone else: type their email</NativeSelectOption>
          {data.staff.map((p) => <NativeSelectOption key={p.id} value={p.id}>{p.jobTitle ? `${p.name}, ${p.jobTitle}` : p.name}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      {who ? null : (
        <>
          <Field label="Their name, or the company's" htmlFor="inc-cctv-name"><Input id="inc-cctv-name" name="name" required minLength={2} maxLength={200} autoComplete="off" /></Field>
          <Field label="Their email" htmlFor="inc-cctv-email"><Input id="inc-cctv-email" name="email" type="email" required maxLength={254} autoComplete="off" /></Field>
        </>
      )}
      <Field label="What you need" htmlFor="inc-cctv-details" hint="The cameras or place, the day and the times. Add a few minutes either side.">
        <Textarea id="inc-cctv-details" name="details" rows={4} required minLength={10} maxLength={2000} defaultValue={data.details} />
      </Field>
    </FormDialog>
  );
}

function RequestRow({ request: r, canChange }: { request: Request; canChange: boolean }) {
  const router = useRouter();
  const meta = REQUEST_STATES[r.state];
  return (
    <li className="flex flex-col gap-3 rounded-card border border-ui-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold">{r.recipientName} <span className="font-normal text-ui-muted-foreground break-all">{r.recipientEmail}</span></p>
          <p className="text-sm whitespace-pre-line">{r.details}</p>
          <p className="text-xs text-ui-muted-foreground">
            Asked by {r.requestedByName}, {formatDateTime(r.createdAt)}.
            {r.state === "open" ? ` The link works until ${formatDate(r.expiresAt)}.` : r.state === "cancelled" && r.cancelledByName ? ` Cancelled by ${r.cancelledByName}.` : ""}
          </p>
        </div>
        <Tag meta={meta} />
      </div>
      {r.emailError && r.state === "open" ? (
        <Notice tone="error" title="The email didn't go" description={`${r.emailError} Use Send again, or call them.`} />
      ) : null}
      {r.footage.length ? (
        <ul className="pc-rows">
          {r.footage.map((f) => (
            <li key={f.id} className="pc-row flex-wrap">
              <Film aria-hidden="true" className="size-5 shrink-0 text-ui-muted-foreground" />
              <span className="pc-row-body">
                <a href={`/api/incidents/footage/${f.id}`} target="_blank" rel="noreferrer" className="pc-row-title break-all underline-offset-4 hover:underline">{f.name}</a>
                <span className="pc-row-hint tabular-nums">{sizeLabel(f.size)} · sent by {f.uploadedBy} · {formatDateTime(f.receivedAt)}</span>
                {f.note ? <span className="pc-row-hint whitespace-pre-line">&ldquo;{f.note}&rdquo;</span> : null}
              </span>
              {canChange && r.state !== "finished" ? (
                <span className="pc-row-trail">
                  <FormDialog portalClassName={THEME}
                    trigger={<Button type="button" variant="ghost" className="min-h-11" aria-label={`Remove ${f.name}`}><Trash2 aria-hidden="true" />Remove</Button>}
                    title="Remove this video?" description={`${f.name} is hidden from the report. It is kept, with a note in the history, never deleted.`}
                    submitLabel="Remove it" destructive cancelLabel="Keep it" successMessage="Video removed" onSuccess={() => router.refresh()}
                    submit={() => removeFootageVideo(f.id)}>{null}</FormDialog>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : r.state === "open" ? <p className="text-sm text-ui-muted-foreground"><Mail aria-hidden="true" className="mr-1 inline size-4 align-text-bottom" />Waiting for {r.recipientName} to upload it.</p> : null}
      {canChange && r.state !== "finished" ? (
        <div className="flex flex-wrap gap-2">
          <FormDialog portalClassName={THEME}
            trigger={<Button type="button" variant="outline" className="min-h-11">{r.state === "open" ? <Send aria-hidden="true" /> : <RotateCw aria-hidden="true" />}Send again</Button>}
            title="Send the request again?" description={`${r.recipientName} gets a new link, open for ${LINK_DAYS} days. The old link stops working.`}
            submitLabel="Send it" successMessage="Request sent again" onSuccess={() => router.refresh()}
            submit={() => sendFootageRequestAgain(r.id)}>{null}</FormDialog>
          {r.state === "open" ? (
            <FormDialog portalClassName={THEME}
              trigger={<Button type="button" variant="ghost" className="min-h-11"><Ban aria-hidden="true" />Stop the link</Button>}
              title="Stop this link?" description="Use it once you have all the footage, or if it went to the wrong person. Videos already received stay on the report."
              submitLabel="Stop the link" destructive cancelLabel="Keep it open" successMessage="Link stopped" onSuccess={() => router.refresh()}
              submit={() => cancelFootage(r.id)}>{null}</FormDialog>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
