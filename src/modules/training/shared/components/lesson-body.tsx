import type { ReactNode } from "react";
import { Separator } from "@/components/shadcn/separator";
import { Table, TableBody, TableCell, TableHead, TableRow } from "@/components/shadcn/table";
import { safeHref, type DocNode } from "@/modules/training/shared/lessons";

/** Draws a lesson's text (cleaned Tiptap JSON) as plain elements. Text is never
 *  injected as HTML, links must be http(s) or mailto, and images are this app's
 *  own files. Styled by `.tf-lesson` in src/app/training/lesson.css; Turnfin Me
 *  keeps the same renderer in apps/me. */
function render(node: DocNode, key: string): ReactNode {
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
  const kids = (node.content ?? []).map((child, i) => render(child, `${key}-${i}`));
  switch (node.type) {
    case "doc": return <>{kids}</>;
    case "paragraph": return <p key={key}>{kids.length ? kids : <br />}</p>;
    case "heading": return Number(node.attrs?.level) === 3 ? <h3 key={key}>{kids}</h3> : <h2 key={key}>{kids}</h2>;
    case "bulletList": return <ul key={key}>{kids}</ul>;
    case "orderedList": return <ol key={key} start={Number(node.attrs?.start) || undefined}>{kids}</ol>;
    case "listItem": return <li key={key}>{kids}</li>;
    case "blockquote": return <blockquote key={key}>{kids}</blockquote>;
    case "hardBreak": return <br key={key} />;
    case "horizontalRule": return <Separator key={key} />;
    case "table": return <Table key={key}><TableBody>{kids}</TableBody></Table>;
    case "tableRow": return <TableRow key={key}>{kids}</TableRow>;
    case "tableHeader": return <TableHead key={key}>{kids}</TableHead>;
    case "tableCell": return <TableCell key={key}>{kids}</TableCell>;
    // eslint-disable-next-line @next/next/no-img-element -- a private file served by this app, sized by the lesson CSS
    case "image": return <img key={key} src={String(node.attrs?.src)} alt={String(node.attrs?.alt ?? "")} loading="lazy" />;
    default: return null;
  }
}

export function LessonBody({ body }: { body: DocNode | null }) {
  return <div className="tf-lesson">{body ? render(body, "n") : null}</div>;
}
