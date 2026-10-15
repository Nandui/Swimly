"use client";

import { useEffect, useState, type ReactNode } from "react";
import { apiFile } from "@/lib/api";

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

function render(node: Node, key: string, assignmentId: string): ReactNode {
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
  const kids = (node.content ?? []).map((child, i) => render(child, `${key}-${i}`, assignmentId));
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
    default: return null;
  }
}

export function LessonBody({ body, assignmentId }: { body: unknown; assignmentId: string }) {
  return <div className="doc lesson">{body ? render(body as Node, "n", assignmentId) : null}</div>;
}
