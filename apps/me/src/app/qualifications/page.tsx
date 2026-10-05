"use client";

import { useState, type FormEvent } from "react";
import { Send, Upload } from "lucide-react";
import { Frame } from "@/components/frame";
import { EmptyRows, LoadError, Loading, Notice, Tag, useLoad } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { date } from "@/lib/format";
import { QUALIFICATION_META, UPLOAD_META } from "@/lib/meta";

type Data = {
  items: { id: string; name: string; issuedOn: string | null; expiresOn: string | null; state: string; reference: string }[];
  uploads: { id: string; name: string; status: string; note: string; sentAt: string; fileName: string }[];
  types: { id: string; name: string }[];
};
const MAX = 5 * 1024 * 1024;
const TYPES = ["application/pdf", "image/png", "image/jpeg"];

function base64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function QualificationsPage() {
  const { data, error, reload } = useLoad<Data>("qualifications");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone?: "error"; text: string } | null>(null);
  // null: not chosen yet, so the first qualification type is selected.
  const [pickedType, setPickedType] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const typeId = pickedType ?? data?.types[0]?.id ?? "";

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, values = new FormData(form);
    const file = values.get("file");
    if (!(file instanceof File) || file.size === 0) { setMessage({ tone: "error", text: "Choose a photo or PDF of the certificate." }); return; }
    if (file.size > MAX) { setMessage({ tone: "error", text: "Files can be up to 5 MB. Try a smaller photo." }); return; }
    if (!TYPES.includes(file.type)) { setMessage({ tone: "error", text: "Send a PDF, PNG or JPEG." }); return; }
    setBusy(true); setMessage(null);
    try {
      await api("qualifications/evidence", { method: "POST", body: {
        ...(typeId ? { typeId } : { typeName: String(values.get("typeName") ?? "") }),
        ...(values.get("issuedOn") ? { issuedOn: String(values.get("issuedOn")) } : {}),
        ...(values.get("expiresOn") ? { expiresOn: String(values.get("expiresOn")) } : {}),
        reference: String(values.get("reference") ?? ""), fileName: file.name.slice(0, 120), mime: file.type, data: await base64(file),
      } });
      form.reset();
      setPickedType(null); setFileName("");
      setMessage({ text: "Sent. Your manager will check it and add it to your record." });
      await reload();
    } catch (caught) { setMessage({ tone: "error", text: caught instanceof ApiError ? caught.message : "That didn't send. Try again." }); }
    finally { setBusy(false); }
  }

  return (
    <Frame title="Qualifications">
      <div className="stack">
        <div className="stack-sm"><h1>Qualifications</h1><p className="muted">Your certificates on record, and new ones waiting to be checked.</p></div>
        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : (
          <>
            <section className="pc-panel" aria-labelledby="q-held">
              <div className="pc-panel-head"><h2 id="q-held">On your record</h2></div>
              {data.items.length === 0 ? <EmptyRows>None recorded yet.</EmptyRows> : (
                <ul className="pc-rows">{data.items.map((q) => (
                  <li key={q.id} className="pc-row">
                    <span className="pc-row-body"><span className="pc-row-title">{q.name}</span>
                      <span className="pc-row-hint">Issued {date(q.issuedOn)}{q.expiresOn ? ` · expires ${date(q.expiresOn)}` : " · does not expire"}{q.reference ? ` · ${q.reference}` : ""}</span></span>
                    <span className="pc-row-trail"><Tag meta={QUALIFICATION_META[q.state]} /></span>
                  </li>
                ))}</ul>
              )}
            </section>
            {data.uploads.length > 0 ? (
              <section className="pc-panel" aria-labelledby="q-sent">
                <div className="pc-panel-head"><h2 id="q-sent">Sent to be checked</h2></div>
                <ul className="pc-rows">{data.uploads.map((u) => (
                  <li key={u.id} className="pc-row">
                    <span className="pc-row-body"><span className="pc-row-title">{u.name || "Certificate"}</span>
                      <span className="pc-row-hint">{u.fileName} · sent {date(u.sentAt)}{u.note ? ` · ${u.note}` : ""}</span></span>
                    <span className="pc-row-trail"><Tag meta={UPLOAD_META[u.status]} /></span>
                  </li>
                ))}</ul>
              </section>
            ) : null}
            <form className="pc-panel" onSubmit={upload} aria-labelledby="q-upload">
              <div className="pc-panel-head"><h2 id="q-upload">Upload a certificate</h2></div>
              <div className="field">
                <label htmlFor="typeId">Which qualification</label>
                <select id="typeId" name="typeId" className="input" value={typeId} onChange={(e) => setPickedType(e.target.value)}>
                  {data.types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  <option value="">Something else</option>
                </select>
              </div>
              {typeId === "" ? <div className="field"><label htmlFor="typeName">What is it?</label><input id="typeName" name="typeName" className="input" maxLength={120} required /></div> : null}
              <div className="field"><label htmlFor="issuedOn">Issued</label><input id="issuedOn" name="issuedOn" type="date" className="input" /></div>
              <div className="field"><label htmlFor="expiresOn">Expires (if it says)</label><input id="expiresOn" name="expiresOn" type="date" className="input" /></div>
              <div className="field"><label htmlFor="reference">Certificate number (optional)</label><input id="reference" name="reference" className="input" maxLength={80} /></div>
              <div className="field" role="group" aria-labelledby="file-label">
                <span id="file-label" className="label">Photo or PDF</span>
                <span id="file-hint" className="hint">Up to 5 MB. Make sure every word is readable.</span>
                <input id="file" name="file" type="file" accept="application/pdf,image/png,image/jpeg" className="sr-only" aria-describedby="file-hint" required onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")} />
                <label htmlFor="file" className="button outline"><Upload aria-hidden="true" />{fileName ? "Choose a different file" : "Choose a file"}</label>
                {fileName ? <span className="caption">{fileName}</span> : null}
              </div>
              {message ? <Notice title={message.text} tone={message.tone} live /> : null}
              <button type="submit" className="button block" disabled={busy}><Send aria-hidden="true" />{busy ? "Sending…" : "Send for checking"}</button>
            </form>
          </>
        )}
      </div>
    </Frame>
  );
}
