"use client";

import { useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { Frame } from "@/components/frame";
import { useLiveBanner } from "@/components/ui-kit/live-banner";
import { LoadError, Loading, Notice, Section, useLoad } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { date } from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/shadcn/avatar";
import { Button } from "@/components/shadcn/button";
import { PageShell } from "@/components/ui-kit/page-shell";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const FIELDS = [
  { key: "phone", label: "Phone", type: "tel", max: 40 },
  { key: "homeAddress", label: "Home address", type: "textarea", max: 300 },
  { key: "emergencyName", label: "Emergency contact", type: "text", max: 120 },
  { key: "emergencyPhone", label: "Emergency phone", type: "tel", max: 40 },
  { key: "emergencyRelationship", label: "Their relationship to you", type: "text", max: 60 },
] as const;
type Profile = {
  name: string; email: string; jobTitle: string; site: string | null; details: Record<string, string>;
  pendingChange: { proposed: Record<string, string>; sentAt: string } | null;
  lastDecision: { status: string; reply: string; decidedAt: string | null } | null;
};

/** "Aoife Byrne" → "AB": the first and last initials. */
function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
}

/** Your own contact and emergency details. Changes go to the office to check
 *  before your record changes. */
export default function DetailsPage() {
  const { data, error, reload } = useLoad<Profile>("me");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone?: "error"; text: string } | null>(null);
  const banner = useLiveBanner();

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const values = new FormData(event.currentTarget);
    const changed = Object.fromEntries(FIELDS.map((f) => [f.key, String(values.get(f.key) ?? "").trim()]).filter(([key, value]) => value !== (data.details[key] ?? "")));
    if (Object.keys(changed).length === 0) { setMessage({ tone: "error", text: "Nothing has changed yet." }); return; }
    setBusy(true); setMessage(null);
    try {
      await api("me", { method: "PATCH", body: { ...changed, message: String(values.get("message") ?? "") } });
      banner("Changes sent", "The office will check them and update your record");
      await reload();
    } catch (caught) { setMessage({ tone: "error", text: caught instanceof ApiError ? caught.message : "That didn't send. Try again." }); }
    finally { setBusy(false); }
  }

  return (
    <Frame title="My details">
      <PageShell spacing="roomy" header={<PageHeader back={{ href: "/more", label: "More" }} title="My details" description="Keep these right so we can reach you, and someone for you in an emergency." />}>
        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : (
          <>
            <section className="pc-list" aria-label="You">
              <div className="pc-row">
                <Avatar aria-hidden="true"><AvatarFallback>{initials(data.name)}</AvatarFallback></Avatar>
                <span className="pc-row-body">
                  <span className="pc-row-title">{data.name}</span>
                  <span className="pc-row-hint">{[data.jobTitle, data.site, data.email].filter(Boolean).join(" · ")}</span>
                </span>
              </div>
            </section>
            {data.pendingChange ? <Notice title={`Changes sent ${date(data.pendingChange.sentAt)}`}>The office is checking them. You can send more once they are done.</Notice>
              : data.lastDecision?.status === "DECLINED" ? <Notice title="Your last changes were not made" tone="warning">{data.lastDecision.reply}</Notice> : null}
            <Section id="details-title" title="Your details">
            <form className="pc-panel" onSubmit={send} aria-labelledby="details-title">
              <fieldset disabled={!!data.pendingChange || busy} className="stack">
                {FIELDS.map((f) => f.type === "textarea"
                  ? <Textarea key={f.key} id={f.key} name={f.key} label={f.label} maxLength={f.max} defaultValue={data.details[f.key] ?? ""} />
                  : <Input key={f.key} id={f.key} name={f.key} label={f.label} type={f.type} maxLength={f.max} defaultValue={data.details[f.key] ?? ""} autoComplete={f.key === "phone" ? "tel" : "off"} />)}
                <Textarea id="message" name="message" label="Note for the office" optional maxLength={500} />
                {message ? <Notice title={message.text} tone={message.tone} live /> : null}
                <Button type="submit" className="self-start max-md:self-stretch"><Send aria-hidden="true" />Send changes</Button>
              </fieldset>
            </form>
            </Section>
          </>
        )}
      </PageShell>
    </Frame>
  );
}
