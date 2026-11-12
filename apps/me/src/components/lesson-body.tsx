"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, CircleHelp, ExternalLink, FileDown, RotateCw } from "lucide-react";
import { answered, QuestionField, type Answer, type LearnerQuestion } from "@/components/question";
import { Button } from "@/components/shadcn/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { Separator } from "@/components/shadcn/separator";
import { Table, TableBody, TableCell, TableHead, TableRow } from "@/components/shadcn/table";
import { Tabs as TabSet, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn/tabs";
import { Bar, Notice } from "@/components/ui";
import { ActivityBlock, AudioBlock, FileView, SlidesBlock } from "@/components/lesson-blocks";
import type { Embed } from "@/components/lesson-kinds-more";
import { ApiError, api, apiFile } from "@/lib/api";

/** Renders a training lesson's text (Tiptap JSON, cleaned by Turnfin) as plain,
 *  safe elements: text is never injected as HTML, links must be http(s) or
 *  mailto, and images are fetched from the staff API with the person's sign-in.
 *  Work keeps the same renderer (src/modules/training/shared/components/lesson-body.tsx). */
type Node = { type?: string; text?: string; attrs?: Record<string, unknown>; marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: Node[] };

const safeHref = (value: unknown) => typeof value === "string" && /^(https?:\/\/|mailto:)/i.test(value) ? value : null;
const fileId = (src: unknown) => typeof src === "string" ? /^\/training\/files\/([A-Za-z0-9_-]{1,64})$/.exec(src)?.[1] ?? null : null;

/** A lesson image: loaded through the staff API, shown from a local object URL. */
function LessonImage({ assignmentId, id, alt }: { assignmentId: string; id: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let url: string | null = null, live = true;
    apiFile(`training/${assignmentId}/files/${id}`)
      .then((blob) => { if (live) { url = URL.createObjectURL(blob); setSrc(url); } })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [assignmentId, id]);
  if (failed) return <p className="caption">This image didn’t load. {alt ? `It shows: ${alt}` : ""}</p>;
  // eslint-disable-next-line @next/next/no-img-element -- a private image from the staff API, not a static asset
  return src ? <img src={src} alt={alt} /> : <span className="lesson-image-placeholder" role="img" aria-label={alt ? `Loading image: ${alt}` : "Loading image"} />;
}

const CALLOUT_LABEL: Record<string, string> = { note: "Note", tip: "Tip", warning: "Take care", danger: "Danger" };

/** Tap to reveal: the title is a button that opens what's under it. */
function Reveal({ title, children }: { title: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="reveal" data-open={open || undefined}>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" className="reveal-toggle"><span>{title}</span><ChevronDown aria-hidden="true" /></Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="reveal-body">{children}</CollapsibleContent>
    </Collapsible>
  );
}

/** One flip card: tap to turn it over, and again to turn it back. */
function FlipCard({ front, back }: { front: ReactNode; back: ReactNode }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <Button type="button" variant="outline" className="flip-card" aria-pressed={flipped} onClick={() => setFlipped(!flipped)}>
      <span className="caption">{flipped ? "Back" : "Front"} · tap to turn over</span>
      <span className="flip-face">{flipped ? back : front}</span>
      <RotateCw aria-hidden="true" className="flip-icon" />
    </Button>
  );
}

/** Step by step: one step at a time, with Back and Next. */
function Stepper({ steps }: { steps: ReactNode[] }) {
  const [index, setIndex] = useState(0);
  return (
    <div className="stepper" role="group" aria-label="Step by step">
      <p className="caption tabular-nums" aria-live="polite">Step {index + 1} of {steps.length}</p>
      <div aria-hidden="true"><Bar max={steps.length} value={index + 1} label="Steps" /></div>
      <div className="stepper-body">{steps[index]}</div>
      <div className="lesson-nav">
        {index > 0 ? <Button type="button" variant="outline" onClick={() => setIndex(index - 1)}><ChevronLeft aria-hidden="true" />Back</Button> : <span />}
        {index + 1 < steps.length ? <Button type="button" variant="outline" onClick={() => setIndex(index + 1)}>Next step<ChevronRight aria-hidden="true" /></Button> : null}
      </div>
    </div>
  );
}

/** Tabs: one panel at a time, switched with the tabs or the arrow keys (shadcn Tabs). */
function Tabs({ id, tabs }: { id: string; tabs: { title: ReactNode; body: ReactNode }[] }) {
  return (
    <TabSet defaultValue="0" className="tabs">
      <TabsList className="tab-list" aria-label="Tabs">
        {tabs.map((t, i) => <TabsTrigger key={i} id={`${id}-tab-${i}`} value={String(i)}>{t.title}</TabsTrigger>)}
      </TabsList>
      {tabs.map((t, i) => <TabsContent key={i} value={String(i)} className="tab-panel">{t.body}</TabsContent>)}
    </TabSet>
  );
}

/** A video in the text: YouTube and Vimeo play in place (Turnfin cleans the link). */
function videoEmbed(raw: unknown) {
  let url: URL;
  try { url = new URL(String(raw ?? "")); } catch { return null; }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^(www|m)\./, ""), parts = url.pathname.split("/").filter(Boolean);
  const ok = (v: string | null | undefined) => v && /^[\w-]{6,20}$/.test(v) ? v : null;
  const yt = host === "youtu.be" ? ok(parts[0]) : host === "youtube.com" ? (parts[0] === "watch" ? ok(url.searchParams.get("v")) : ["embed", "shorts", "live"].includes(parts[0]) ? ok(parts[1]) : null) : null;
  if (yt) return { embed: `https://www.youtube-nocookie.com/embed/${yt}?rel=0`, href: url.toString(), provider: "YouTube" };
  const vimeo = host === "vimeo.com" || host === "player.vimeo.com" ? parts.find((p) => /^\d{5,12}$/.test(p)) : null;
  if (vimeo) return { embed: `https://player.vimeo.com/video/${vimeo}`, href: url.toString(), provider: "Vimeo" };
  return { embed: null, href: url.toString(), provider: host };
}

/** A file to download from the text: fetched with the person's sign-in, then opened. */
function FileButton({ assignmentId, fileId, label }: { assignmentId: string; fileId: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function open() {
    setBusy(true); setFailed(false);
    // Opened first, so a phone doesn't block it as a pop-up once the file arrives.
    const tab = window.open("", "_blank");
    try {
      const url = URL.createObjectURL(await apiFile(`training/${assignmentId}/files/${fileId}`));
      if (tab) tab.location.href = url; else window.location.href = url;
    } catch { tab?.close(); setFailed(true); }
    finally { setBusy(false); }
  }
  return (
    <div className="stack-sm">
      <Button type="button" variant="outline" className="self-start max-md:self-stretch" onClick={open} disabled={busy}><FileDown aria-hidden="true" />{busy ? "Getting it…" : label || "Download"}</Button>
      {failed ? <p className="caption">That file didn’t open. Check your connection and try again.</p> : null}
    </div>
  );
}

type Checks = { assignmentId: string; lessonId: string; questions: LearnerQuestion[] };

/** A knowledge check in the text: answer it here and Turnfin says if it's right. Not marked. */
function KnowledgeCheck({ checks, questionId }: { checks: Checks; questionId: string }) {
  const question = checks.questions.find((q) => q.id === questionId);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [result, setResult] = useState<{ correct: boolean; explanation: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  if (!question) return null;
  async function check(giveUp: boolean) {
    setBusy(true); setFailure(null);
    try { setResult(await api(`training/${checks.assignmentId}/lessons/${checks.lessonId}/check`, { method: "POST", body: { questionId, answer, giveUp } })); }
    catch (caught) { setFailure(caught instanceof ApiError ? caught.message : "That didn't check. Try again."); }
    finally { setBusy(false); }
  }
  const settled = !!result?.correct;
  return (
    <section className="knowledge-check" aria-label="Knowledge check">
      <p className="caption knowledge-check-label"><CircleHelp aria-hidden="true" />Knowledge check</p>
      <QuestionField assignmentId={checks.assignmentId} question={question} answer={answer} locked={settled || busy}
        onChange={(value) => { setAnswer(value); if (result && !settled) setResult(null); }} />
      {result ? (result.correct
        ? <Notice title="That's right" live>{result.explanation || undefined}</Notice>
        : <Notice title="Not quite" tone="warning" live>{result.explanation || "Have another look and try again."}</Notice>) : null}
      {failure ? <Notice title={failure} tone="error" live /> : null}
      {settled ? null : (
        <div className="lesson-nav">
          {result && !result.correct && !result.explanation ? <Button type="button" variant="ghost" onClick={() => check(true)} disabled={busy}>Show me why</Button> : <span />}
          <Button type="button" variant="outline" onClick={() => check(false)} disabled={busy || !answered(question, answer)}>{busy ? "Checking…" : "Check my answer"}</Button>
        </div>
      )}
    </section>
  );
}

function render(node: Node, key: string, assignmentId: string, checks: Checks | null): ReactNode {
  if (node.type === "text") {
    let out: ReactNode = node.text ?? "";
    for (const [i, mark] of (node.marks ?? []).entries()) {
      const k = `${key}-${i}`;
      if (mark.type === "bold") out = <strong key={k}>{out}</strong>;
      else if (mark.type === "italic") out = <em key={k}>{out}</em>;
      else if (mark.type === "underline") out = <u key={k}>{out}</u>;
      else if (mark.type === "strike") out = <s key={k}>{out}</s>;
      else if (mark.type === "code") out = <code key={k}>{out}</code>;
      else if (mark.type === "link" && safeHref(mark.attrs?.href)) out = <a key={k} href={safeHref(mark.attrs?.href)!} rel="noopener noreferrer" target="_blank">{out}</a>;
    }
    return <span key={key}>{out}</span>;
  }
  const kids = (node.content ?? []).map((child, i) => render(child, `${key}-${i}`, assignmentId, checks));
  const part = (type: string) => {
    const index = (node.content ?? []).findIndex((c) => c.type === type);
    return index < 0 ? null : kids[index];
  };
  switch (node.type) {
    case "doc": return <>{kids}</>;
    case "paragraph": return <p key={key}>{kids.length ? kids : <br />}</p>;
    case "heading": return Number(node.attrs?.level) === 3 ? <h3 key={key}>{kids}</h3> : <h2 key={key}>{kids}</h2>;
    case "bulletList": return <ul key={key}>{kids}</ul>;
    case "orderedList": return <ol key={key}>{kids}</ol>;
    case "listItem": return <li key={key}>{kids}</li>;
    case "blockquote": return <blockquote key={key}>{kids}</blockquote>;
    case "hardBreak": return <br key={key} />;
    case "horizontalRule": return <Separator key={key} />;
    case "table": return <Table key={key}><TableBody>{kids}</TableBody></Table>;
    case "tableRow": return <TableRow key={key}>{kids}</TableRow>;
    case "tableHeader": return <TableHead key={key}>{kids}</TableHead>;
    case "tableCell": return <TableCell key={key}>{kids}</TableCell>;
    case "image": {
      const id = fileId(node.attrs?.src);
      return id ? <LessonImage key={key} assignmentId={assignmentId} id={id} alt={String(node.attrs?.alt ?? "")} /> : null;
    }
    case "callout": {
      const tone = String(node.attrs?.tone ?? "note");
      return <aside key={key} className="callout-box" data-tone={tone}><p className="callout-label">{CALLOUT_LABEL[tone] ?? "Note"}</p>{kids}</aside>;
    }
    case "reveal": {
      const title = node.content?.find((c) => c.type === "revealTitle");
      const body = node.content?.find((c) => c.type === "revealContent");
      return <Reveal key={key} title={title ? (title.content ?? []).map((c, i) => render(c, `${key}-t${i}`, assignmentId, checks)) : "Tap to see"}>
        {body ? (body.content ?? []).map((c, i) => render(c, `${key}-b${i}`, assignmentId, checks)) : null}
      </Reveal>;
    }
    case "flipCards": return <div key={key} className="flip-cards">{kids}</div>;
    case "flipCard": return <FlipCard key={key} front={part("flipFront")} back={part("flipBack")} />;
    case "flipFront": case "flipBack": case "revealContent": return <span key={key} className="flip-text">{kids}</span>;
    case "stepper": return <Stepper key={key} steps={kids} />;
    case "stepItem": return <div key={key} className="step-item">{kids}</div>;
    case "tabs": return <Tabs key={key} id={key} tabs={(node.content ?? []).filter((t) => t.type === "tab").map((t, i) => ({
      title: (t.content?.find((c) => c.type === "tabTitle")?.content ?? []).map((c, j) => render(c, `${key}-${i}-t${j}`, assignmentId, checks)),
      body: (t.content?.find((c) => c.type === "tabContent")?.content ?? []).map((c, j) => render(c, `${key}-${i}-b${j}`, assignmentId, checks)),
    }))} />;
    case "videoEmbed": {
      const video = videoEmbed(node.attrs?.url);
      if (!video) return null;
      return video.embed
        ? <div key={key} className="lesson-video"><iframe src={video.embed} title={`Video on ${video.provider}`} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" loading="lazy" /></div>
        : <Button key={key} asChild variant="outline" className="w-full"><a href={video.href} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />Watch on {video.provider}</a></Button>;
    }
    case "fileButton": {
      const id = typeof node.attrs?.fileId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(node.attrs.fileId) ? node.attrs.fileId : null;
      return id ? <FileButton key={key} assignmentId={assignmentId} fileId={id} label={String(node.attrs?.label ?? "")} /> : null;
    }
    case "knowledgeCheck": return checks ? <KnowledgeCheck key={key} checks={checks} questionId={String(node.attrs?.questionId ?? "")} /> : null;
    // Several things in one lesson (29 October 2026): Turnfin cleans these, and sends slides with the address they play from.
    case "audioBlock": {
      const id = fileId(`/training/files/${String(node.attrs?.fileId ?? "")}`);
      return id ? <AudioBlock key={key} assignmentId={assignmentId} fileId={id} transcript={String(node.attrs?.transcript ?? "")} /> : null;
    }
    case "slidesBlock": return <SlidesBlock key={key} embed={(node.attrs?.embed ?? null) as Embed | null} />;
    case "fileView": {
      const id = fileId(`/training/files/${String(node.attrs?.fileId ?? "")}`);
      return id ? <FileView key={key} assignmentId={assignmentId} fileId={id} /> : null;
    }
    case "activity": {
      const id = typeof node.attrs?.id === "string" ? node.attrs.id : null;
      const file = fileId(`/training/files/${String(node.attrs?.fileId ?? "")}`);
      return id ? <ActivityBlock key={key} assignmentId={assignmentId} id={id} kind={String(node.attrs?.kind ?? "")} fileId={file} data={(node.attrs?.data ?? null) as Parameters<typeof ActivityBlock>[0]["data"]} /> : null;
    }
    default: return null;
  }
}

/** `checks`: the questions the text's knowledge checks ask, and where to check them. */
export function LessonBody({ body, assignmentId, checks }: { body: unknown; assignmentId: string; checks?: { lessonId: string; questions: LearnerQuestion[] } }) {
  return <div className="doc lesson">{body ? render(body as Node, "n", assignmentId, checks ? { assignmentId, ...checks } : null) : null}</div>;
}
