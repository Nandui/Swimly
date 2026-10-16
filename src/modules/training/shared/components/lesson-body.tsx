import type { ReactNode } from "react";
import { Separator } from "@/components/shadcn/separator";
import { Table, TableBody, TableCell, TableHead, TableRow } from "@/components/shadcn/table";
import { FileDown, PlayCircle } from "lucide-react";
import { CALLOUT_META, fileSrc, safeHref, videoFor, type CalloutTone, type DocNode } from "@/modules/training/shared/lessons";
import { blankedPrompt, type Question } from "@/modules/training/shared/questions";

/** Draws a lesson's text (cleaned Tiptap JSON) as plain elements. Text is never
 *  injected as HTML, links must be http(s) or mailto, and images are this app's
 *  own files. Styled by `.tf-lesson` in src/app/training/lesson.css; Turnfin Me
 *  keeps the same renderer in apps/me. */
function render(node: DocNode, key: string, questions: Question[]): ReactNode {
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
  const kids = (node.content ?? []).map((child, i) => render(child, `${key}-${i}`, questions));
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
    // Interactive blocks (phase 3), shown open for the author; Turnfin Me makes them interactive.
    case "callout": {
      const tone = (node.attrs?.tone as CalloutTone) ?? "note";
      return <aside key={key} className="tf-callout" data-tone={tone} data-label={CALLOUT_META[tone]?.label ?? "Note"}>{kids}</aside>;
    }
    case "reveal": return <div key={key} className="tf-reveal">{kids}</div>;
    case "revealTitle": return <p key={key} className="tf-reveal-title">{kids}</p>;
    case "revealContent": return <div key={key} className="tf-reveal-content">{kids}</div>;
    case "flipCards": return <div key={key} className="tf-flip-cards">{kids}</div>;
    case "flipCard": return <div key={key} className="tf-flip-card">{kids}</div>;
    case "flipFront": return <div key={key} className="tf-flip-front">{kids}</div>;
    case "flipBack": return <div key={key} className="tf-flip-back">{kids}</div>;
    case "stepper": return <div key={key} className="tf-stepper">{kids}</div>;
    case "stepItem": return <div key={key} className="tf-step">{kids}</div>;
    case "tabs": return <div key={key} className="tf-tabs">{kids}</div>;
    case "tab": return <div key={key} className="tf-tab">{kids}</div>;
    case "tabTitle": return <p key={key} className="tf-tab-title">{kids}</p>;
    case "tabContent": return <div key={key}>{kids}</div>;
    case "videoEmbed": {
      const video = videoFor(String(node.attrs?.url ?? ""));
      if (!video) return null;
      return video.embed
        ? <div key={key} className="tf-video"><iframe src={video.embed} title={`Video on ${video.provider}`} allow="encrypted-media; picture-in-picture; fullscreen" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /></div>
        : <a key={key} href={video.href} target="_blank" rel="noopener noreferrer" className="tf-media-block"><PlayCircle aria-hidden="true" />Watch on {video.provider}</a>;
    }
    case "fileButton": {
      const id = String(node.attrs?.fileId ?? "");
      return <a key={key} href={fileSrc(id)} target="_blank" rel="noopener noreferrer" className="tf-media-block"><FileDown aria-hidden="true" />{String(node.attrs?.label || "Download")}</a>;
    }
    case "knowledgeCheck": {
      const q = questions.find((x) => x.id === node.attrs?.questionId);
      return (
        <div key={key} className="tf-check">
          <span><strong>Knowledge check</strong>: {q ? (q.kind === "FILL_BLANK" ? blankedPrompt(q.prompt) : q.prompt) : "this question has been removed."}</span>
        </div>
      );
    }
    default: return null;
  }
}

/** `questions`: the course's questions, for the knowledge checks in the text. */
export function LessonBody({ body, questions = [] }: { body: DocNode | null; questions?: Question[] }) {
  return <div className="tf-lesson">{body ? render(body, "n", questions) : null}</div>;
}
