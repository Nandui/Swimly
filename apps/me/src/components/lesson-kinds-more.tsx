"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Check, CircleCheck, ExternalLink, FileText, ImagePlus, Send, X } from "lucide-react";
import { CourseImage } from "@/components/question";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { RadioGroup, RadioGroupItem } from "@/components/shadcn/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { leftOf, topOf } from "@/components/ui-kit/scale";
import { Bar, Notice } from "@/components/ui";
import { ApiError, api, apiFile } from "@/lib/api";

/** Lessons added in Training e-learning phase 8: sort into groups, explore a
 *  picture, slides or an interactive activity, and hand in work. Like the
 *  phase 3 kinds, each tells the lesson page when the learner may carry on. */

export type Sorting = { groups: { id: string; name: string }[]; sorts: { id: string; text: string; group: string }[] };
export type Spot = { id: string; x: number; y: number; title: string; text: string };
export type Embed = { src: string; href: string; provider: string };
export type HandInInfo = {
  text: "required" | "optional" | "off"; photo: "required" | "optional" | "off"; review: boolean;
  submission: { status: "SUBMITTED" | "ACCEPTED" | "RETURNED"; text: string; fileName: string | null; feedback: string; reviewedBy: string | null; reviewedAt: string | null; submittedAt: string; waiting?: boolean } | null;
};

/** The same mixed-up order every time for the same lesson, without randomness during render. */
function mixed<T extends { id: string }>(rows: T[]) {
  const hash = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return [...rows].sort((a, b) => hash(a.id) - hash(b.id));
}

// ---------------------------------------------------------------------------
// Sort into groups
// ---------------------------------------------------------------------------

/** Put each one in a group, then check. Wrong ones are shown; right ones stay put. */
export function SortBoard({ sorting, onFinished }: { sorting: Sorting; onFinished: () => void }) {
  const items = useMemo(() => mixed(sorting.sorts), [sorting.sorts]);
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean> | null>(null);
  const allRight = !!checked && items.every((i) => checked[i.id]);
  useEffect(() => { if (allRight) onFinished(); }, [allRight, onFinished]);
  const ready = items.every((i) => placed[i.id]);
  const rightCount = checked ? items.filter((i) => checked[i.id]).length : 0;
  return (
    <section className="pc-panel stack" aria-labelledby="sort-title">
      <div className="stack-sm">
        <h2 id="sort-title">Sort into groups</h2>
        <p className="caption">Choose the group each one belongs in, then check.</p>
      </div>
      <ul className="stack-sm sort-list">
        {items.map((item) => {
          const state = checked && placed[item.id] ? (checked[item.id] ? "right" : "wrong") : null;
          const locked = state === "right";
          return (
            <li key={item.id} className="sort-item" data-state={state ?? undefined}>
              <fieldset className="stack-sm" disabled={locked}>
                <legend className="sort-text">
                  {state === "right" ? <CircleCheck aria-hidden="true" className="inline-icon" /> : state === "wrong" ? <X aria-hidden="true" className="inline-icon" /> : null}
                  {item.text}
                  {state ? <span className="sr-only">{state === "right" ? " (right)" : " (in the wrong group)"}</span> : null}
                </legend>
                <RadioGroup className="sort-groups" aria-label={`Group for ${item.text}`} name={`sort-${item.id}`} value={placed[item.id] ?? ""} disabled={locked}
                  onValueChange={(value) => { setPlaced((now) => ({ ...now, [item.id]: value })); if (checked) setChecked((now) => now && { ...now, [item.id]: false }); }}>
                  {sorting.groups.map((g) => (
                    <Label key={g.id} className="sort-group" data-chosen={placed[item.id] === g.id || undefined}>
                      <RadioGroupItem value={g.id} />
                      <span>{g.name}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </fieldset>
            </li>
          );
        })}
      </ul>
      {checked ? (allRight
        ? <Notice title="All in the right groups" live><Check aria-hidden="true" className="inline-icon" />Well done.</Notice>
        : <Notice title={`${rightCount} of ${items.length} right`} tone="warning" live>Move the ones marked with a cross, then check again.</Notice>) : null}
      {allRight ? null : (
        <Button type="button" className="self-start max-md:self-stretch" disabled={!ready} onClick={() => setChecked(Object.fromEntries(items.map((i) => [i.id, placed[i.id] === i.group])))}>
          {ready ? "Check my groups" : `Place ${items.filter((i) => !placed[i.id]).length} more to check`}
        </Button>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Explore a picture
// ---------------------------------------------------------------------------

/** Numbered spots on a picture: open each one. Every spot is also a button in the list below. */
export function ExplorePicture({ assignmentId, fileId, title, spots, onFinished }: { assignmentId: string; fileId: string; title: string; spots: Spot[]; onFinished: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const all = spots.length > 0 && spots.every((s) => seen.has(s.id));
  useEffect(() => { if (all) onFinished(); }, [all, onFinished]);
  const show = (id: string) => { setOpen(id); setSeen((now) => new Set(now).add(id)); };
  const current = spots.find((s) => s.id === open);
  return (
    <section className="pc-panel stack" aria-labelledby="explore-title">
      <div className="stack-sm">
        <h2 id="explore-title">Explore the picture</h2>
        <p className="caption tabular-nums" aria-live="polite">{seen.size} of {spots.length} opened</p>
        <div aria-hidden="true"><Bar max={spots.length} value={seen.size} label="Spots opened" /></div>
      </div>
      <div className="explore-frame">
        <CourseImage assignmentId={assignmentId} fileId={fileId} alt={`${title}: a picture with ${spots.length} numbered spots`} />
        {spots.map((s, i) => (
          <Button key={s.id} type="button" size="icon" className={`explore-marker ${leftOf(s.x / 100)} ${topOf(s.y / 100)}`} data-seen={seen.has(s.id) || undefined} data-open={open === s.id || undefined}
            aria-label={`Spot ${i + 1}: ${s.title}${seen.has(s.id) ? ", opened" : ""}`} aria-pressed={open === s.id} onClick={() => show(s.id)}>
            {i + 1}
          </Button>
        ))}
      </div>
      {current ? (
        <div className="explore-detail" aria-live="polite">
          <h3>{spots.indexOf(current) + 1}. {current.title}</h3>
          {current.text ? <p className="pre-line">{current.text}</p> : null}
        </div>
      ) : <p className="caption">Tap a number on the picture, or a spot in the list.</p>}
      <ol className="choices">
        {spots.map((s, i) => (
          <li key={s.id}>
            <Button type="button" variant="outline" className="choice selectable explore-row" aria-pressed={open === s.id} onClick={() => show(s.id)}>
              <span className="order-number tabular-nums" aria-hidden="true">{i + 1}</span>
              <span className="choice-text">{s.title}</span>
              {seen.has(s.id) ? <Check aria-label="Opened" className="inline-icon" /> : null}
            </Button>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Slides or an interactive activity
// ---------------------------------------------------------------------------

export function EmbedFrame({ embed, title }: { embed: Embed; title: string }) {
  return (
    <div className="stack-sm">
      <div className="lesson-embed"><iframe src={embed.src} title={`${embed.provider}: ${title}`} allow="fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" loading="lazy" /></div>
      <Button asChild variant="ghost" className="self-start"><a href={embed.href} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />Open in {embed.provider}</a></Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hand in work
// ---------------------------------------------------------------------------

const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_PDF = 3 * 1024 * 1024;

function base64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** A phone photo made small enough to send: at most 1600 pixels across, as a JPEG. */
async function shrink(file: File): Promise<{ blob: Blob; name: string; mime: string }> {
  if (file.type === "application/pdf") return { blob: file, name: file.name, mime: file.type };
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("photo");
  return { blob, name: `${file.name.replace(/\.[^.]+$/, "") || "photo"}.jpg`, mime: "image/jpeg" };
}

const STATUS_TEXT = {
  SUBMITTED: { title: "Handed in, waiting for a trainer", tone: undefined },
  ACCEPTED: { title: "Accepted", tone: undefined },
  RETURNED: { title: "Sent back to change", tone: "warning" as const },
} as const;

/** Write an answer, add a photo or PDF, and hand it in. A trainer may accept it or send it back. */
export function HandInForm({ assignmentId, lessonId, info, open, onSaved }: { assignmentId: string; lessonId: string; info: HandInInfo; open: boolean; onSaved: () => void }) {
  const sent = info.submission;
  const [editing, setEditing] = useState(!sent || sent.status === "RETURNED");
  const [text, setText] = useState(sent?.text ?? "");
  const [file, setFile] = useState<File | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const keep = !file && !!sent?.fileName;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    if (info.text === "required" && !text.trim()) { setFailure("Write your answer first."); return; }
    if (info.photo === "required" && !file && !keep) { setFailure("Add a photo or PDF first."); return; }
    if (file && !TYPES.includes(file.type)) { setFailure("Send a photo (JPEG, PNG or WebP) or a PDF."); return; }
    if (file?.type === "application/pdf" && file.size > MAX_PDF) { setFailure("PDFs can be up to 3 MB. Try a photo of the page instead."); return; }
    setBusy(true);
    try {
      const small = file ? await shrink(file) : null;
      await api(`training/${assignmentId}/lessons/${lessonId}/hand-in`, { method: "POST", body: {
        text, keepFile: keep, file: small ? { fileName: small.name.slice(0, 120), mime: small.mime, data: await base64(small.blob) } : null,
      } });
      setEditing(false); setFile(null);
      onSaved();
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : "That didn’t send. Check the photo and try again.");
    } finally { setBusy(false); }
  }
  async function openFile() {
    try { window.open(URL.createObjectURL(await apiFile(`training/${assignmentId}/lessons/${lessonId}/hand-in/file`)), "_blank", "noopener"); }
    catch { setFailure("Your file didn’t open. Try again."); }
  }
  const status = sent ? STATUS_TEXT[sent.status] : null;
  return (
    <section className="pc-panel stack" aria-labelledby="hand-in-title">
      <h2 id="hand-in-title">Your work</h2>
      {sent?.waiting ? (
        <Notice title="Waiting for signal">Your work is saved on this phone and goes to Turnfin when you’re back online.</Notice>
      ) : sent && status ? (
        <Notice title={status.title} tone={status.tone}>
          {sent.status === "SUBMITTED" ? (info.review ? "You can carry on with other lessons. This one is done once a trainer accepts it." : "")
            : sent.feedback ? `${sent.reviewedBy ?? "Your trainer"}: ${sent.feedback}` : sent.reviewedBy ? `By ${sent.reviewedBy}.` : ""}
        </Notice>
      ) : null}
      {sent && !editing ? (
        <div className="stack-sm">
          {sent.text ? <blockquote className="pre-line">{sent.text}</blockquote> : null}
          {sent.fileName && !sent.waiting ? <Button type="button" variant="outline" className="self-start max-md:self-stretch" onClick={openFile}><FileText aria-hidden="true" />Open {sent.fileName}</Button> : null}
          {open && sent.status === "SUBMITTED" ? <Button type="button" variant="ghost" className="self-start" onClick={() => setEditing(true)}>Change what I handed in</Button> : null}
        </div>
      ) : open ? (
        <form className="stack" onSubmit={submit}>
          {info.text !== "off" ? (
            <Textarea id="hand-in-text" label="Your answer" optional={info.text === "optional"} rows={6} maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} />
          ) : null}
          {info.photo !== "off" ? (
            <div className="flex flex-col gap-2">
              <Label id="hand-in-file-label" htmlFor="hand-in-file-button">A photo or PDF{info.photo === "optional" ? " (optional)" : ""}</Label>
              <Input ref={picker} id="hand-in-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <Button id="hand-in-file-button" type="button" variant="outline" className="self-start max-md:self-stretch" aria-describedby="hand-in-file-hint" onClick={() => picker.current?.click()}><ImagePlus aria-hidden="true" />{file ? `Chosen: ${file.name}` : keep ? `Keep ${sent?.fileName}, or choose another` : "Take or choose a photo"}</Button>
              <p id="hand-in-file-hint" className="caption">Photos are made smaller before they are sent. PDFs up to 3 MB.</p>
            </div>
          ) : null}
          {failure ? <Notice title={failure} tone="error" live /> : null}
          <Button type="submit" className="self-start max-md:self-stretch" disabled={busy}><Send aria-hidden="true" />{busy ? "Sending…" : sent ? "Hand it in again" : "Hand it in"}</Button>
        </form>
      ) : null}
      {failure && !editing ? <Notice title={failure} tone="error" live /> : null}
    </section>
  );
}
