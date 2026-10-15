"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, CircleHelp, RotateCw } from "lucide-react";
import { answered, QuestionField, type Answer, type LearnerQuestion } from "@/components/question";
import { Notice } from "@/components/ui";
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
    <div className="reveal" data-open={open || undefined}>
      <button type="button" className="reveal-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{title}</span><ChevronDown aria-hidden="true" />
      </button>
      {open ? <div className="reveal-body">{children}</div> : null}
    </div>
  );
}

/** One flip card: tap to turn it over, and again to turn it back. */
function FlipCard({ front, back }: { front: ReactNode; back: ReactNode }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button type="button" className="flip-card" aria-pressed={flipped} onClick={() => setFlipped(!flipped)}>
      <span className="caption muted">{flipped ? "Back" : "Front"} · tap to turn over</span>
      <span className="flip-face">{flipped ? back : front}</span>
      <RotateCw aria-hidden="true" className="flip-icon" />
    </button>
  );
}

/** Step by step: one step at a time, with Back and Next. */
function Stepper({ steps }: { steps: ReactNode[] }) {
  const [index, setIndex] = useState(0);
  return (
    <div className="stepper" role="group" aria-label="Step by step">
      <p className="caption tabular" aria-live="polite">Step {index + 1} of {steps.length}</p>
      <progress className="course-progress" max={steps.length} value={index + 1} aria-hidden="true" />
      <div className="stepper-body">{steps[index]}</div>
      <div className="lesson-nav">
        {index > 0 ? <button type="button" className="button outline" onClick={() => setIndex(index - 1)}><ChevronLeft aria-hidden="true" />Back</button> : <span />}
        {index + 1 < steps.length ? <button type="button" className="button outline" onClick={() => setIndex(index + 1)}>Next step<ChevronRight aria-hidden="true" /></button> : null}
      </div>
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
          {result && !result.correct && !result.explanation ? <button type="button" className="button ghost" onClick={() => check(true)} disabled={busy}>Show me why</button> : <span />}
          <button type="button" className="button outline" onClick={() => check(false)} disabled={busy || !answered(question, answer)}>{busy ? "Checking…" : "Check my answer"}</button>
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
    case "horizontalRule": return <hr key={key} />;
    case "table": return <table key={key}><tbody>{kids}</tbody></table>;
    case "tableRow": return <tr key={key}>{kids}</tr>;
    case "tableHeader": return <th key={key}>{kids}</th>;
    case "tableCell": return <td key={key}>{kids}</td>;
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
    case "knowledgeCheck": return checks ? <KnowledgeCheck key={key} checks={checks} questionId={String(node.attrs?.questionId ?? "")} /> : null;
    default: return null;
  }
}

/** `checks`: the questions the text's knowledge checks ask, and where to check them. */
export function LessonBody({ body, assignmentId, checks }: { body: unknown; assignmentId: string; checks?: { lessonId: string; questions: LearnerQuestion[] } }) {
  return <div className="doc lesson">{body ? render(body as Node, "n", assignmentId, checks ? { assignmentId, ...checks } : null) : null}</div>;
}
