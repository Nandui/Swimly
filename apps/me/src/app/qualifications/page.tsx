"use client";

import { useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import { Frame } from "@/components/frame";
import { useLiveBanner } from "@/components/ui-kit/live-banner";
import { EmptyRows, LoadError, Loading, Notice, Section, Tag, useLoad } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { date } from "@/lib/format";
import { QUALIFICATION_META, UPLOAD_META } from "@/lib/meta";
import { Button } from "@/components/shadcn/button";
import { PageShell } from "@/components/ui-kit/page-shell";
import { PageHeader } from "@/components/ui-kit/page-header";
import { FileField } from "@/components/ui/file-field";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

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
  const banner = useLiveBanner();
  // null: not chosen yet, so the first qualification type is selected.
  const [pickedType, setPickedType] = useState<string | null>(null);
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
      setPickedType(null);
      banner("Certificate sent", "Your manager will check it and add it to your record");
      await reload();
    } catch (caught) { setMessage({ tone: "error", text: caught instanceof ApiError ? caught.message : "That didn't send. Try again." }); }
    finally { setBusy(false); }
  }

  return (
    <Frame title="Qualifications">
      <PageShell spacing="roomy" header={<PageHeader back={{ href: "/more", label: "More" }} title="Qualifications" description="Your certificates on record, and new ones waiting to be checked." />}>
        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : (
          <>
            <Section id="q-held" title="On your record">
              {data.items.length === 0 ? <EmptyRows>None recorded yet.</EmptyRows> : (
                <ul className="pc-list">{data.items.map((q) => (
                  <li key={q.id} className="pc-row">
                    <span className="pc-row-body"><span className="pc-row-title">{q.name}</span>
                      <span className="pc-row-hint">{q.issuedOn ? `Issued ${date(q.issuedOn)} · ` : ""}{q.expiresOn ? `Expires ${date(q.expiresOn)}` : "Does not expire"}{q.reference ? ` · ${q.reference}` : ""}</span></span>
                    <span className="pc-row-trail"><Tag meta={QUALIFICATION_META[q.state]} /></span>
                  </li>
                ))}</ul>
              )}
            </Section>
            {data.uploads.length > 0 ? (
              <Section id="q-sent" title="Sent to be checked">
                <ul className="pc-list">{data.uploads.map((u) => (
                  <li key={u.id} className="pc-row">
                    <span className="pc-row-body"><span className="pc-row-title">{u.name || "Certificate"}</span>
                      <span className="pc-row-hint">{u.fileName} · sent {date(u.sentAt)}{u.note ? ` · ${u.note}` : ""}</span></span>
                    <span className="pc-row-trail"><Tag meta={UPLOAD_META[u.status]} /></span>
                  </li>
                ))}</ul>
              </Section>
            ) : null}
            <Section id="q-upload" title="Upload a certificate">
            <form className="pc-panel" onSubmit={upload} aria-labelledby="q-upload">
              <Select id="typeId" name="typeId" label="Which qualification" value={typeId} onValueChange={setPickedType}
                options={[...data.types.map((t) => ({ value: t.id, label: t.name })), { value: "", label: "Something else" }]} />
              {typeId === "" ? <Input id="typeName" name="typeName" label="What is it?" maxLength={120} required /> : null}
              <Input id="expiresOn" name="expiresOn" label="Expires" type="date" required />
              <Input id="issuedOn" name="issuedOn" label="Issued" optional type="date" />
              <Input id="reference" name="reference" label="Certificate number" optional maxLength={80} />
              <FileField id="file" name="file" label="Photo or PDF" description="Up to 5 MB. Make sure every word is readable." accept="application/pdf,image/png,image/jpeg" required />
              {message ? <Notice title={message.text} tone={message.tone} live /> : null}
              <Button type="submit" className="self-start max-md:self-stretch" disabled={busy}><Send aria-hidden="true" />{busy ? "Sending…" : "Send for checking"}</Button>
            </form>
            </Section>
          </>
        )}
      </PageShell>
    </Frame>
  );
}
