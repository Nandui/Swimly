import type { ReactNode } from "react";

/** Renders a Docs document body (Tiptap JSON) as plain, safe HTML elements.
 *  Text is never injected as HTML; links must be http(s) or mailto; images
 *  and attachments are left for the library at work. */
type Node = { type?: string; text?: string; attrs?: Record<string, unknown>; marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: Node[] };

const safeHref = (value: unknown) => typeof value === "string" && /^(https?:|mailto:)/i.test(value) ? value : null;

function render(node: Node, key: string): ReactNode {
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
    case "heading": {
      const level = Math.min(4, Math.max(2, Number(node.attrs?.level) || 2));
      const H = `h${level}` as "h2" | "h3" | "h4";
      return <H key={key}>{kids}</H>;
    }
    case "bulletList": case "taskList": return <ul key={key}>{kids}</ul>;
    case "orderedList": return <ol key={key}>{kids}</ol>;
    case "listItem": case "taskItem": return <li key={key}>{kids}</li>;
    case "blockquote": return <blockquote key={key}>{kids}</blockquote>;
    case "codeBlock": return <pre key={key}><code>{kids}</code></pre>;
    case "hardBreak": return <br key={key} />;
    case "horizontalRule": return <hr key={key} />;
    case "table": return <table key={key}><tbody>{kids}</tbody></table>;
    case "tableRow": return <tr key={key}>{kids}</tr>;
    case "tableHeader": return <th key={key}>{kids}</th>;
    case "tableCell": return <td key={key}>{kids}</td>;
    case "image": return <p key={key} className="caption">An image is in this document. Open it in the library at work to see it.</p>;
    default: return kids.length ? <div key={key} className={node.type === "callout" ? "callout" : undefined}>{kids}</div> : null;
  }
}

export function DocBody({ body }: { body: unknown }) {
  return <div className="doc">{render((body ?? {}) as Node, "n")}</div>;
}
