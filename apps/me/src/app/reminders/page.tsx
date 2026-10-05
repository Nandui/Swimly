"use client";

import { useState } from "react";
import { Frame } from "@/components/frame";
import { LoadError, Loading, Notice, useLoad } from "@/components/ui";
import { ApiError, api } from "@/lib/api";

const OPTIONS = [
  { key: "trainingDue", label: "Training due soon or overdue" },
  { key: "qualificationExpiry", label: "A qualification about to expire" },
  { key: "readingOverdue", label: "Required reading overdue" },
  { key: "shiftChanges", label: "My shifts change" },
] as const;
type Prefs = Record<(typeof OPTIONS)[number]["key"], boolean>;

export default function RemindersPage() {
  const { data, setData, error, reload } = useLoad<Prefs>("notifications");
  const [failure, setFailure] = useState<string | null>(null);
  async function toggle(key: keyof Prefs, value: boolean) {
    if (!data) return;
    const next = { ...data, [key]: value };
    setData(next); setFailure(null);
    try { setData(await api<Prefs>("notifications", { method: "PUT", body: next })); }
    catch (caught) { setData(data); setFailure(caught instanceof ApiError ? caught.message : "That didn't save."); }
  }
  return (
    <Frame title="Reminders">
      <div className="stack">
        <div className="stack-sm"><h1>Reminders</h1><p className="muted">We email you when something needs you. Emails never include HR details.</p></div>
        {failure ? <Notice title={failure} tone="error" live /> : null}
        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading rows={4} /> : (
          <fieldset className="pc-panel" aria-describedby="reminders-saved">
            <legend className="sr-only">Email me when</legend>
            <div className="pc-rows">
              {OPTIONS.map((o) => (
                <label key={o.key} className="pc-row"><input type="checkbox" checked={data[o.key]} onChange={(e) => toggle(o.key, e.target.checked)} />{o.label}</label>
              ))}
            </div>
            <p id="reminders-saved" className="caption">Saved as soon as you change one.</p>
          </fieldset>
        )}
      </div>
    </Frame>
  );
}
