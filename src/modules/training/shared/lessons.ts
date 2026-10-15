import { BookOpen, FileText, PlayCircle } from "lucide-react";

/** E-learning courses (docs/training.md, phase 1): a course is sections of
 *  lessons. The draft lives in TrainingSection/TrainingLesson rows; publishing
 *  freezes it into a TrainingCourseVersion outline, which is what learners get.
 *  Pure and client-safe: the builder, the preview, the staff API and tests use
 *  it. Turnfin Me keeps its own copy of the renderer (apps/me). */

export const LESSON_KINDS = ["READING", "VIDEO", "FILE"] as const;
export type LessonKind = (typeof LESSON_KINDS)[number];

export const LESSON_KIND_META = {
  READING: { label: "Reading", help: "Text with headings, lists, tables and images.", icon: BookOpen },
  VIDEO: { label: "Video", help: "A YouTube, Vimeo or other video link, with notes.", icon: PlayCircle },
  FILE: { label: "File", help: "A PDF or image to open, with notes.", icon: FileText },
} as const satisfies Record<LessonKind, { label: string; help: string; icon: unknown }>;

export const isLessonKind = (value: unknown): value is LessonKind => LESSON_KINDS.includes(value as LessonKind);

/** A Tiptap document. Only the nodes and marks `cleanDoc` keeps reach learners. */
export type DocNode = { type?: string; text?: string; attrs?: Record<string, unknown>; marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: DocNode[] };

export type OutlineLesson = { id: string; kind: LessonKind; title: string; body: DocNode | null; videoUrl: string; fileId: string | null; minutes: number | null };
export type OutlineSection = { id: string; title: string; lessons: OutlineLesson[] };
export type Outline = { sections: OutlineSection[] };

export const MAX_SECTIONS = 30;
export const MAX_LESSONS = 120;
/** The serialised size a lesson's text may reach. Text only: images are files. */
export const MAX_BODY_CHARS = 200_000;

// ---------------------------------------------------------------------------
// Lesson text
// ---------------------------------------------------------------------------

const BLOCKS = new Set(["doc", "paragraph", "heading", "bulletList", "orderedList", "listItem", "blockquote", "horizontalRule", "hardBreak", "image", "table", "tableRow", "tableHeader", "tableCell", "text"]);
const MARKS = new Set(["bold", "italic", "underline", "strike", "link", "code"]);

/** Where a lesson image is served in Work. Turnfin Me reads the file id from it. */
export const fileSrc = (id: string) => `/training/files/${id}`;
export const fileIdFromSrc = (src: unknown) => {
  const match = typeof src === "string" ? /^\/training\/files\/([A-Za-z0-9_-]{1,64})$/.exec(src) : null;
  return match ? match[1] : null;
};
export const safeHref = (value: unknown) => typeof value === "string" && /^(https?:\/\/|mailto:)/i.test(value.trim()) ? value.trim() : null;

function cleanNode(node: DocNode, depth: number): DocNode | null {
  if (!node || typeof node !== "object" || depth > 12 || !BLOCKS.has(String(node.type))) return null;
  if (node.type === "text") {
    if (typeof node.text !== "string" || !node.text) return null;
    const marks = (node.marks ?? []).filter((m) => MARKS.has(m?.type)).flatMap((m) => {
      if (m.type !== "link") return [{ type: m.type }];
      const href = safeHref(m.attrs?.href);
      return href ? [{ type: "link", attrs: { href } }] : [];
    });
    return marks.length ? { type: "text", text: node.text, marks } : { type: "text", text: node.text };
  }
  const out: DocNode = { type: node.type };
  if (node.type === "heading") out.attrs = { level: Math.min(3, Math.max(2, Number(node.attrs?.level) || 2)) };
  if (node.type === "orderedList" && Number(node.attrs?.start) > 1) out.attrs = { start: Math.floor(Number(node.attrs?.start)) };
  if (node.type === "image") {
    const id = fileIdFromSrc(node.attrs?.src);
    if (!id) return null;
    return { type: "image", attrs: { src: fileSrc(id), alt: String(node.attrs?.alt ?? "").slice(0, 300) } };
  }
  if (Array.isArray(node.content)) {
    const kids = node.content.map((child) => cleanNode(child, depth + 1)).filter((child): child is DocNode => !!child);
    if (kids.length) out.content = kids;
  }
  return out;
}

/** Keeps only what the lesson renderers draw, with safe links and images that
 *  are this app's own files. Null when there is nothing left or it is too big. */
export function cleanDoc(value: unknown): DocNode | null {
  if (!value || typeof value !== "object" || (value as DocNode).type !== "doc") return null;
  const doc = cleanNode(value as DocNode, 0);
  if (!doc || !doc.content?.length || JSON.stringify(doc).length > MAX_BODY_CHARS) return null;
  return docText(doc).trim() || docImages(doc).length ? doc : null;
}

/** Plain text, for word counts and "is it empty?". */
export function docText(node: DocNode | null | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  const sep = node.type === "paragraph" || node.type === "heading" || node.type === "listItem" ? "\n" : "";
  return (node.content ?? []).map(docText).join("") + sep;
}

export function docImages(node: DocNode | null | undefined): string[] {
  if (!node) return [];
  const own = node.type === "image" ? [fileIdFromSrc(node.attrs?.src)].filter((id): id is string => !!id) : [];
  return [...own, ...(node.content ?? []).flatMap(docImages)];
}

/** About 200 words a minute, at least one. */
export const readingMinutes = (doc: DocNode | null) => Math.max(1, Math.round(docText(doc).split(/\s+/).filter(Boolean).length / 200));

/** A course's old plain-text material as a lesson: one paragraph per block of lines. */
export function plainTextDoc(text: string): DocNode | null {
  const blocks = text.replace(/\r\n?/g, "\n").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  if (!blocks.length) return null;
  return { type: "doc", content: blocks.map((block) => ({ type: "paragraph", content: block.split("\n").flatMap((line, i) => [
    ...(i ? [{ type: "hardBreak" }] : []), ...(line ? [{ type: "text", text: line }] : []),
  ]) })) };
}

// ---------------------------------------------------------------------------
// Video links
// ---------------------------------------------------------------------------

/** A video link a lesson can play in place. YouTube and Vimeo play inside the
 *  lesson (YouTube through its no-cookie player); any other https link opens
 *  in a new tab. Null when it is not an https link. */
export function videoFor(raw: string): { href: string; embed: string | null; provider: string } | null {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { return null; }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^(www|m)\./, "");
  const id = (value: string | null | undefined, pattern: RegExp) => value && pattern.test(value) ? value : null;
  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "youtu.be") {
    const parts = url.pathname.split("/").filter(Boolean);
    const yt = host === "youtu.be" ? id(parts[0], /^[\w-]{6,20}$/)
      : parts[0] === "watch" || !parts.length ? id(url.searchParams.get("v"), /^[\w-]{6,20}$/)
      : ["embed", "shorts", "live", "v"].includes(parts[0]) ? id(parts[1], /^[\w-]{6,20}$/) : null;
    if (yt) {
      const start = Number.parseInt(url.searchParams.get("t") ?? url.searchParams.get("start") ?? "", 10);
      return { href: url.toString(), provider: "YouTube", embed: `https://www.youtube-nocookie.com/embed/${yt}?rel=0${start > 0 ? `&start=${start}` : ""}` };
    }
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const vid = parts.find((part) => /^\d{5,12}$/.test(part));
    const hash = parts[parts.indexOf(vid ?? "") + 1];
    if (vid) return { href: url.toString(), provider: "Vimeo", embed: `https://player.vimeo.com/video/${vid}${hash && /^[a-f0-9]{6,20}$/.test(hash) ? `?h=${hash}` : ""}` };
  }
  return { href: url.toString(), provider: host, embed: null };
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

/** What stops a draft being published, worded for its author. Empty when it can go. */
export function publishProblems(outline: Outline): string[] {
  const problems: string[] = [];
  const lessons = outline.sections.flatMap((s) => s.lessons.map((l) => ({ ...l, section: s.title })));
  if (!lessons.length) problems.push("Add at least one lesson.");
  for (const section of outline.sections) if (!section.lessons.length) problems.push(`The section “${section.title}” has no lessons. Add one or remove the section.`);
  for (const lesson of lessons) {
    if (lesson.kind === "READING" && !lesson.body) problems.push(`“${lesson.title}” has no text yet.`);
    if (lesson.kind === "VIDEO" && !videoFor(lesson.videoUrl)) problems.push(`“${lesson.title}” needs a video link starting https://.`);
    if (lesson.kind === "FILE" && !lesson.fileId) problems.push(`“${lesson.title}” needs a file.`);
  }
  return problems;
}

export const outlineLessons = (outline: Outline) => outline.sections.flatMap((s) => s.lessons);

/** Reads a stored version outline, dropping anything malformed. */
export function readOutline(value: unknown): Outline {
  const sections = Array.isArray((value as Outline | null)?.sections) ? (value as Outline).sections : [];
  return { sections: sections.filter((s) => s && typeof s.id === "string").map((s) => ({
    id: s.id, title: String(s.title ?? ""),
    lessons: (Array.isArray(s.lessons) ? s.lessons : []).filter((l) => l && typeof l.id === "string" && isLessonKind(l.kind)).map((l) => ({
      id: l.id, kind: l.kind, title: String(l.title ?? ""), body: cleanDoc(l.body), videoUrl: String(l.videoUrl ?? ""),
      fileId: typeof l.fileId === "string" ? l.fileId : null, minutes: typeof l.minutes === "number" ? l.minutes : null,
    })),
  })) };
}

/** Lessons in order, with where each sits, for the player. */
export function lessonPlace(outline: Outline, lessonId: string) {
  const all = outlineLessons(outline);
  const index = all.findIndex((l) => l.id === lessonId);
  if (index < 0) return null;
  const section = outline.sections.find((s) => s.lessons.some((l) => l.id === lessonId))!;
  return { lesson: all[index], section, index, total: all.length, prev: all[index - 1]?.id ?? null, next: all[index + 1]?.id ?? null };
}

/** How long a lesson takes: the author's figure, or the text's reading time. */
export const lessonMinutes = (lesson: Pick<OutlineLesson, "kind" | "body" | "minutes">) =>
  lesson.minutes ?? (lesson.kind === "READING" ? readingMinutes(lesson.body) : null);
