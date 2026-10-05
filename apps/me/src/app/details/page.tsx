"use client";

import { useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { Frame } from "@/components/frame";
import { LoadError, Loading, Notice, useLoad } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { date } from "@/lib/format";

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

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const values = new FormData(event.currentTarget);
    const changed = Object.fromEntries(FIELDS.map((f) => [f.key, String(values.get(f.key) ?? "").trim()]).filter(([key, value]) => value !== (data.details[key] ?? "")));
    if (Object.keys(changed).length === 0) { setMessage({ tone: "error", text: "Nothing has changed yet." }); return; }
    setBusy(true); setMessage(null);
    try {
      await api("me", { method: "PATCH", body: { ...changed, message: String(values.get("message") ?? "") } });
      setMessage({ text: "Sent. The office will check it and update your record." });
      await reload();
    } catch (caught) { setMessage({ tone: "error", text: caught instanceof ApiError ? caught.message : "That didn't send. Try again." }); }
    finally { setBusy(false); }
  }

  return (
    <Frame title="My details">
      <div className="stack">
        <div className="stack-sm"><h1>My details</h1><p className="muted">Keep these right so we can reach you, and someone for you in an emergency.</p></div>
        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : (
          <>
            <section className="pc-panel" aria-label="You">
              <div className="pc-row">
                <span className="avatar" aria-hidden="true">{initials(data.name)}</span>
                <span className="pc-row-body">
                  <span className="pc-row-title">{data.name}</span>
                  <span className="pc-row-hint">{[data.jobTitle, data.site, data.email].filter(Boolean).join(" · ")}</span>
                </span>
              </div>
            </section>
            {data.pendingChange ? <Notice title={`Changes sent ${date(data.pendingChange.sentAt)}`}>The office is checking them. You can send more once they are done.</Notice>
              : data.lastDecision?.status === "DECLINED" ? <Notice title="Your last changes were not made" tone="warning">{data.lastDecision.reply}</Notice> : null}
            <form className="pc-panel" onSubmit={send} aria-labelledby="details-title">
              <div className="pc-panel-head"><h2 id="details-title">Your details</h2></div>
              <fieldset disabled={!!data.pendingChange || busy} className="stack">
                {FIELDS.map((f) => (
                  <div key={f.key} className="field">
                    <label htmlFor={f.key}>{f.label}</label>
                    {f.type === "textarea"
                      ? <textarea id={f.key} name={f.key} className="input" maxLength={f.max} defaultValue={data.details[f.key] ?? ""} />
                      : <input id={f.key} name={f.key} type={f.type} className="input" maxLength={f.max} defaultValue={data.details[f.key] ?? ""} autoComplete={f.key === "phone" ? "tel" : "off"} />}
                  </div>
                ))}
                <div className="field"><label htmlFor="message">Note for the office (optional)</label><textarea id="message" name="message" className="input" maxLength={500} /></div>
                {message ? <Notice title={message.text} tone={message.tone} live /> : null}
                <button type="submit" className="button block"><Send aria-hidden="true" />Send changes</button>
              </fieldset>
            </form>
          </>
        )}
      </div>
    </Frame>
  );
}
