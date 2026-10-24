import { BookOpen, Columns3, FileText, GitBranch, Headphones, Layers, ListChecks, ListTodo, MonitorPlay, PlayCircle, ScanSearch, Upload } from "lucide-react";
import { normaliseQuestion, questionProblem, readExam, type ExamSettings, type Question } from "@/modules/training/shared/questions";

/** E-learning courses (phase 1): a course is sections of
 *  lessons. The draft lives in TrainingSection/TrainingLesson rows; publishing
 *  freezes it into a TrainingCourseVersion outline, which is what learners get.
 *  Pure and client-safe: the builder, the preview, the staff API and tests use
 *  it. Turnfin Me keeps its own copy of the renderer (apps/me). */

export const LESSON_KINDS = ["READING", "VIDEO", "FILE", "QUIZ", "SCENARIO", "FLASHCARDS", "CHECKLIST", "AUDIO", "SORTING", "EXPLORE", "ASSIGNMENT", "EMBED"] as const;
export type LessonKind = (typeof LESSON_KINDS)[number];

export const LESSON_KIND_META = {
  READING: { label: "Reading", help: "Text with headings, lists, tables and images.", icon: BookOpen },
  VIDEO: { label: "Video", help: "A YouTube, Vimeo or other video link, with notes.", icon: PlayCircle },
  FILE: { label: "File", help: "A PDF or image to open, with notes.", icon: FileText },
  QUIZ: { label: "Quiz", help: "Practice questions on this section, with the answer straight away. Not marked.", icon: ListChecks },
  SCENARIO: { label: "Scenario", help: "A real situation told in scenes. Each choice leads somewhere, until they reach the best outcome.", icon: GitBranch },
  FLASHCARDS: { label: "Flashcards", help: "Cards to flip and remember, such as chemical names or signals. Cards they don't know come back.", icon: Layers },
  CHECKLIST: { label: "Checklist", help: "Things to find, check or do on site, ticked off one by one.", icon: ListTodo },
  AUDIO: { label: "Audio", help: "A recording to listen to, such as a briefing or a radio call, with a transcript.", icon: Headphones },
  // The deeper builder (e-learning phase 8).
  SORTING: { label: "Sort into groups", help: "Things to sort into the right group, such as safe and not safe, or which bin each chemical goes in.", icon: Columns3 },
  EXPLORE: { label: "Explore a picture", help: "A photo or plan with numbered spots to open one by one, such as a plant room or a first aid box.", icon: ScanSearch },
  ASSIGNMENT: { label: "Hand in work", help: "A task the learner does and hands in: a written answer, a photo or both, checked by a trainer if you want.", icon: Upload },
  EMBED: { label: "Slides or interactive", help: "Google Slides, Docs or Forms, Canva, Genially, H5P, Microsoft Forms or a Google Drive file, shown inside the lesson.", icon: MonitorPlay },
} as const satisfies Record<LessonKind, { label: string; help: string; icon: unknown }>;

export const isLessonKind = (value: unknown): value is LessonKind => LESSON_KINDS.includes(value as LessonKind);

/** A Tiptap document. Only the nodes and marks `cleanDoc` keeps reach learners. */
export type DocNode = { type?: string; text?: string; attrs?: Record<string, unknown>; marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: DocNode[] };

/** A Scenario: scenes in order, the first is where it starts. A choice leads to
 *  another scene, or ends it (next null); only an ending marked best finishes the lesson. */
export type ScenarioChoice = { id: string; text: string; feedback: string; next: string | null; best: boolean };
export type ScenarioStep = { id: string; text: string; imageId: string | null; choices: ScenarioChoice[] };
export type Flashcard = { id: string; front: string; back: string; imageId: string | null };
export type ChecklistItem = { id: string; text: string };
/** Sort into groups: two to four groups, and things that each belong in one. */
type SortGroup = { id: string; name: string };
export type SortItem = { id: string; text: string; group: string };
/** Explore a picture: numbered spots, in percent of the picture from its top left. */
export type ExploreSpot = { id: string; x: number; y: number; title: string; text: string };
/** Hand in work: what the learner sends, and whether a trainer checks it. */
export const HAND_IN_PARTS = ["required", "optional", "off"] as const;
export type HandInPart = (typeof HAND_IN_PARTS)[number];
export type HandInSettings = { text: HandInPart; photo: HandInPart; review: boolean };
/** What a lesson is made of beyond its text (Audio, File and Explore use fileId; Slides uses videoUrl). */
export type LessonData = { steps?: ScenarioStep[]; cards?: Flashcard[]; items?: ChecklistItem[]; groups?: SortGroup[]; sorts?: SortItem[]; spots?: ExploreSpot[]; handIn?: HandInSettings };

export type OutlineLesson = { id: string; kind: LessonKind; title: string; body: DocNode | null; videoUrl: string; fileId: string | null; minutes: number | null; data: LessonData | null };
type OutlineSection = { id: string; title: string; lessons: OutlineLesson[] };
/** A course: its sections of lessons, every section's questions, and the final
 *  exam's rules (null when it has none). A version freezes all three. */
export type Outline = { sections: OutlineSection[]; questions: Question[]; exam: ExamSettings | null };

/** Starts text a course template left for its author to replace (shared/templates.ts). */
export const TEMPLATE_MARK = "✎";

export const MAX_SECTIONS = 30;
export const MAX_LESSONS = 120;
/** The serialised size a lesson's text may reach. Text only: images are files. */
const MAX_BODY_CHARS = 200_000;
export const MAX_SCENES = 20;
export const MAX_CHOICES = 4;
export const MAX_CARDS = 40;
export const MAX_ITEMS = 30;
export const MAX_GROUPS = 4;
export const MAX_SORTS = 24;
export const MAX_SPOTS = 12;

// ---------------------------------------------------------------------------
// Lesson text
// ---------------------------------------------------------------------------

const BLOCKS = new Set(["doc", "paragraph", "heading", "bulletList", "orderedList", "listItem", "blockquote", "horizontalRule", "hardBreak", "image", "table", "tableRow", "tableHeader", "tableCell", "text",
  // Interactive blocks (phase 3): a coloured callout, a tap-to-reveal, flip
  // cards, a step-by-step and a knowledge check on one of the course's questions.
  "callout", "reveal", "revealTitle", "revealContent", "flipCards", "flipCard", "flipFront", "flipBack", "stepper", "stepItem", "knowledgeCheck",
  // Phase 8: tabs, a video inside the text and a file to download.
  "tabs", "tab", "tabTitle", "tabContent", "videoEmbed", "fileButton"]);

export const CALLOUT_TONES = ["note", "tip", "warning", "danger"] as const;
export type CalloutTone = (typeof CALLOUT_TONES)[number];
export const CALLOUT_META = {
  note: { label: "Note" }, tip: { label: "Tip" }, warning: { label: "Take care" }, danger: { label: "Danger" },
} as const satisfies Record<CalloutTone, { label: string }>;
const MARKS = new Set(["bold", "italic", "underline", "strike", "link", "code"]);

/** Where a lesson image is served in Turnfin. Turnfin Me reads the file id from it. */
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
  if (node.type === "callout") out.attrs = { tone: CALLOUT_TONES.includes(node.attrs?.tone as CalloutTone) ? node.attrs!.tone : "note" };
  if (node.type === "knowledgeCheck") {
    const id = typeof node.attrs?.questionId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(node.attrs.questionId) ? node.attrs.questionId : null;
    return id ? { type: "knowledgeCheck", attrs: { questionId: id } } : null;
  }
  if (node.type === "videoEmbed") {
    const video = typeof node.attrs?.url === "string" ? videoFor(node.attrs.url) : null;
    return video ? { type: "videoEmbed", attrs: { url: video.href } } : null;
  }
  if (node.type === "fileButton") {
    const id = typeof node.attrs?.fileId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(node.attrs.fileId) ? node.attrs.fileId : null;
    return id ? { type: "fileButton", attrs: { fileId: id, label: String(node.attrs?.label ?? "").trim().slice(0, 120) } } : null;
  }
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
  return docText(doc).trim() || docImages(doc).length || docChecks(doc).length || docFiles(doc).length || docVideos(doc).length ? doc : null;
}

/** Files offered to download from the text (fileButton blocks). */
export function docFiles(node: DocNode | null | undefined): string[] {
  if (!node) return [];
  const own = node.type === "fileButton" && typeof node.attrs?.fileId === "string" ? [node.attrs.fileId] : [];
  return [...own, ...(node.content ?? []).flatMap(docFiles)];
}

/** Video links played inside the text (videoEmbed blocks). */
export function docVideos(node: DocNode | null | undefined): string[] {
  if (!node) return [];
  const own = node.type === "videoEmbed" && typeof node.attrs?.url === "string" ? [node.attrs.url] : [];
  return [...own, ...(node.content ?? []).flatMap(docVideos)];
}

/** The questions a lesson's knowledge checks ask, in order. */
export function docChecks(node: DocNode | null | undefined): string[] {
  if (!node) return [];
  const own = node.type === "knowledgeCheck" && typeof node.attrs?.questionId === "string" ? [node.attrs.questionId] : [];
  return [...own, ...(node.content ?? []).flatMap(docChecks)];
}

// ---------------------------------------------------------------------------
// Scenario, Flashcards and Checklist lessons
// ---------------------------------------------------------------------------

const clip = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
const cleanId = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9_-]{1,32}$/.test(value) ? value : null;
const cleanFile = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : null;
const list = (value: unknown, max: number) => (Array.isArray(value) ? value.slice(0, max) : []) as Record<string, unknown>[];
/** Gives every row a unique id: answers and progress point at them. */
function uniqueIds<T extends { id: string }>(rows: T[], newId: () => string) {
  const seen = new Set<string>();
  for (const row of rows) { if (!row.id || seen.has(row.id)) row.id = newId(); seen.add(row.id); }
  return rows;
}

/** A lesson's own settings, cleaned: only what its kind uses, within limits.
 *  Null for kinds that keep none. A draft keeps empty rows the author is
 *  still filling in (`draft`); a published version drops them. */
export function cleanLessonData(kind: LessonKind, raw: unknown, newId: () => string = () => crypto.randomUUID().slice(0, 8), draft = false): LessonData | null {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (kind === "SCENARIO") {
    const steps = uniqueIds(list(value.steps, MAX_SCENES).map((step) => ({
      id: cleanId(step?.id) ?? "", text: clip(step?.text, 1500), imageId: cleanFile(step?.imageId),
      choices: uniqueIds(list(step?.choices, MAX_CHOICES).map((c) => ({
        id: cleanId(c?.id) ?? "", text: clip(c?.text, 200), feedback: clip(c?.feedback, 600), next: cleanId(c?.next), best: c?.best === true,
      })).filter((c) => draft || c.text), newId),
    })), newId);
    const ids = new Set(steps.map((s) => s.id));
    // A choice can only lead to another scene; anything else ends the scenario.
    for (const step of steps) for (const c of step.choices) {
      if (c.next && (!ids.has(c.next) || c.next === step.id)) c.next = null;
      if (c.next) c.best = false;
    }
    return { steps };
  }
  if (kind === "FLASHCARDS") {
    return { cards: uniqueIds(list(value.cards, MAX_CARDS).map((c) => ({ id: cleanId(c?.id) ?? "", front: clip(c?.front, 200), back: clip(c?.back, 600), imageId: cleanFile(c?.imageId) }))
      .filter((c) => draft || c.front || c.back || c.imageId), newId) };
  }
  if (kind === "CHECKLIST") {
    return { items: uniqueIds(list(value.items, MAX_ITEMS).map((i) => ({ id: cleanId(i?.id) ?? "", text: clip(i?.text, 200) })).filter((i) => draft || i.text), newId) };
  }
  if (kind === "SORTING") {
    const groups = uniqueIds(list(value.groups, MAX_GROUPS).map((g) => ({ id: cleanId(g?.id) ?? "", name: clip(g?.name, 60) })).filter((g) => draft || g.name), newId);
    const ids = new Set(groups.map((g) => g.id));
    const sorts = uniqueIds(list(value.sorts, MAX_SORTS).map((i) => ({ id: cleanId(i?.id) ?? "", text: clip(i?.text, 200), group: cleanId(i?.group) ?? "" }))
      .map((i) => ({ ...i, group: ids.has(i.group) ? i.group : "" })).filter((i) => draft || (i.text && i.group)), newId);
    return { groups, sorts };
  }
  if (kind === "EXPLORE") {
    const pct = (n: unknown) => typeof n === "number" && Number.isFinite(n) ? Math.round(Math.min(100, Math.max(0, n)) * 10) / 10 : 50;
    return { spots: uniqueIds(list(value.spots, MAX_SPOTS).map((sp) => ({ id: cleanId(sp?.id) ?? "", x: pct(sp?.x), y: pct(sp?.y), title: clip(sp?.title, 120), text: clip(sp?.text, 1000) }))
      .filter((sp) => draft || sp.title), newId) };
  }
  if (kind === "ASSIGNMENT") {
    const raw = (value.handIn && typeof value.handIn === "object" ? value.handIn : {}) as Record<string, unknown>;
    const part = (v: unknown, fallback: HandInPart) => HAND_IN_PARTS.includes(v as HandInPart) ? v as HandInPart : fallback;
    return { handIn: { text: part(raw.text, "required"), photo: part(raw.photo, "optional"), review: raw.review !== false } };
  }
  return null;
}

/** Where a new Scenario, Flashcards or Checklist lesson starts, so its author has something to fill in. */
export function startingLessonData(kind: LessonKind, newId: () => string = () => crypto.randomUUID().slice(0, 8)): LessonData | null {
  const choice = () => ({ id: newId(), text: "", feedback: "", next: null, best: false });
  if (kind === "SCENARIO") return { steps: [{ id: newId(), text: "", imageId: null, choices: [choice(), choice()] }] };
  if (kind === "FLASHCARDS") return { cards: [1, 2, 3].map(() => ({ id: newId(), front: "", back: "", imageId: null })) };
  if (kind === "CHECKLIST") return { items: [1, 2, 3].map(() => ({ id: newId(), text: "" })) };
  if (kind === "SORTING") {
    const groups = [newId(), newId()].map((id) => ({ id, name: "" }));
    return { groups, sorts: [0, 1, 0, 1].map((g) => ({ id: newId(), text: "", group: groups[g].id })) };
  }
  if (kind === "EXPLORE") return { spots: [] };
  if (kind === "ASSIGNMENT") return { handIn: { text: "required", photo: "optional", review: true } };
  return null;
}

/** Scenes the learner can get to from the first one. */
function reachableScenes(steps: readonly ScenarioStep[]) {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const queue = steps[0] ? [steps[0].id] : [];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const c of byId.get(id)?.choices ?? []) if (c.next) queue.push(c.next);
  }
  return seen;
}

/** Every file a lesson shows: its own file, images in its text, and pictures in its scenes or cards. */
export const lessonFiles = (lesson: Pick<OutlineLesson, "fileId" | "body" | "data">) => [
  ...(lesson.fileId ? [lesson.fileId] : []), ...docImages(lesson.body), ...docFiles(lesson.body),
  ...(lesson.data?.steps ?? []).map((s) => s.imageId), ...(lesson.data?.cards ?? []).map((c) => c.imageId),
].filter((id): id is string => !!id);

/** Plain text, for word counts and "is it empty?". */
function docText(node: DocNode | null | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  const sep = node.type === "paragraph" || node.type === "heading" || node.type === "listItem" ? "\n" : "";
  return (node.content ?? []).map(docText).join("") + sep;
}

function docImages(node: DocNode | null | undefined): string[] {
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
// Slides and interactive content (phase 8)
// ---------------------------------------------------------------------------

/** Where a "Slides or interactive" lesson may come from. Only these play
 *  inside the lesson; their own share or publish link is turned into the
 *  embed address. Null for anything else. */
export const EMBED_SOURCES = "Google Slides, Docs, Sheets or Forms, a Google Drive file, Canva, Genially, H5P or Microsoft Forms";
export function embedFor(raw: string): { src: string; href: string; provider: string } | null {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { return null; }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase(), parts = url.pathname.split("/").filter(Boolean);
  const okId = (value: string | undefined) => !!value && /^[\w-]{6,200}$/.test(value);
  const out = (src: string, provider: string) => ({ src, href: url.toString(), provider });
  if (host === "docs.google.com") {
    const [app, d, a, b] = parts;
    const published = d === "d" && a === "e" && okId(b);
    const id = published ? `e/${b}` : d === "d" && okId(a) ? a : null;
    if (!id) return null;
    if (app === "presentation") return out(`https://docs.google.com/presentation/d/${id}/${published ? "embed" : "embed?start=false&loop=false"}`, "Google Slides");
    if (app === "document") return out(`https://docs.google.com/document/d/${id}/${published ? "pub?embedded=true" : "preview"}`, "Google Docs");
    if (app === "spreadsheets") return out(`https://docs.google.com/spreadsheets/d/${id}/${published ? "pubhtml?widget=true" : "preview"}`, "Google Sheets");
    if (app === "forms") return out(`https://docs.google.com/forms/d/${id}/viewform?embedded=true`, "Google Forms");
    return null;
  }
  if (host === "drive.google.com" && parts[0] === "file" && parts[1] === "d" && okId(parts[2])) return out(`https://drive.google.com/file/d/${parts[2]}/preview`, "Google Drive");
  if ((host === "www.canva.com" || host === "canva.com") && parts[0] === "design" && okId(parts[1]) && okId(parts[2])) return out(`https://www.canva.com/design/${parts[1]}/${parts[2]}/view?embed`, "Canva");
  if (host === "view.genial.ly" && okId(parts[0])) return out(`https://view.genial.ly/${parts[0]}`, "Genially");
  if (/^[a-z0-9-]+\.h5p\.com$/.test(host) && parts[0] === "content" && /^\d{6,24}$/.test(parts[1] ?? "")) return out(`https://${host}/content/${parts[1]}/embed`, "H5P");
  if (host === "forms.office.com" || host === "forms.microsoft.com") {
    const id = url.searchParams.get("id");
    return id && /^[\w-]{10,200}$/.test(id) ? out(`https://forms.office.com/Pages/ResponsePage.aspx?id=${id}&embed=true`, "Microsoft Forms") : null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

/** The outline as a version keeps it: rows left empty in the draft dropped. */
export const frozenOutline = (outline: Outline): Outline => ({
  ...outline, sections: outline.sections.map((s) => ({ ...s, lessons: s.lessons.map((l) => ({ ...l, data: cleanLessonData(l.kind, l.data) })) })),
});

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
    if (lesson.kind === "AUDIO" && !lesson.fileId) problems.push(`“${lesson.title}” needs a recording.`);
    if (lesson.kind === "SCENARIO") problems.push(...scenarioProblems(lesson.title, lesson.data?.steps ?? []));
    if (lesson.kind === "FLASHCARDS" && (lesson.data?.cards ?? []).filter((c) => (c.front || c.imageId) && c.back).length < 2) problems.push(`“${lesson.title}” needs at least two cards with a front and a back.`);
    if (lesson.kind === "FLASHCARDS" && (lesson.data?.cards ?? []).some((c) => !(c.front || c.imageId) || !c.back)) problems.push(`A card in “${lesson.title}” is missing its front or back.`);
    if (lesson.kind === "CHECKLIST" && !(lesson.data?.items ?? []).length) problems.push(`“${lesson.title}” needs at least one thing to tick off.`);
    if (lesson.kind === "SORTING") problems.push(...sortingProblems(lesson.title, lesson.data));
    if (lesson.kind === "EXPLORE" && !lesson.fileId) problems.push(`“${lesson.title}” needs the picture to explore.`);
    if (lesson.kind === "EXPLORE" && !(lesson.data?.spots ?? []).length) problems.push(`“${lesson.title}” needs at least one spot on the picture.`);
    if (lesson.kind === "EMBED" && !embedFor(lesson.videoUrl)) problems.push(`“${lesson.title}” needs a link from ${EMBED_SOURCES}.`);
    if (lesson.kind === "ASSIGNMENT" && !lesson.body) problems.push(`“${lesson.title}” needs the task written out: what to do and what to hand in.`);
    if (lesson.kind === "ASSIGNMENT" && lesson.data?.handIn?.text === "off" && lesson.data.handIn.photo === "off") problems.push(`“${lesson.title}” must ask for a written answer, a photo or both.`);
    if (lessonText(lesson).includes(TEMPLATE_MARK)) problems.push(`“${lesson.title}” still has template text marked ${TEMPLATE_MARK}. Replace it with your own.`);
    for (const id of docChecks(lesson.body)) {
      if (!outline.questions.some((q) => q.id === id)) problems.push(`A knowledge check in “${lesson.title}” uses a question that has been removed. Take it out or choose another.`);
    }
  }
  for (const section of outline.sections) {
    const quiz = section.lessons.find((l) => l.kind === "QUIZ");
    if (quiz && !outline.questions.some((q) => q.sectionId === section.id)) problems.push(`The quiz “${quiz.title}” needs questions: add them to the section “${section.title}”.`);
  }
  outline.questions.forEach((q, i) => {
    const problem = questionProblem(q);
    if (problem) problems.push(`Question ${i + 1} (“${q.prompt.slice(0, 40) || "no text"}”): ${problem}`);
  });
  if (outline.exam && !outline.questions.length) problems.push("The final exam needs questions. Add them to a section, or turn the exam off.");
  return problems;
}

/** All the words in a lesson: its text, scenes, choices, cards and checklist. */
export const lessonText = (lesson: Pick<OutlineLesson, "body" | "data">) => [
  docText(lesson.body),
  ...(lesson.data?.steps ?? []).flatMap((s) => [s.text, ...s.choices.flatMap((c) => [c.text, c.feedback])]),
  ...(lesson.data?.cards ?? []).flatMap((c) => [c.front, c.back]),
  ...(lesson.data?.items ?? []).map((i) => i.text),
  ...(lesson.data?.groups ?? []).map((g) => g.name), ...(lesson.data?.sorts ?? []).map((i) => i.text),
  ...(lesson.data?.spots ?? []).flatMap((sp) => [sp.title, sp.text]),
].join("\n");

/** What stops a Sort into groups lesson working, worded for its author. */
export function sortingProblems(title: string, data: LessonData | null): string[] {
  const groups = (data?.groups ?? []).filter((g) => g.name), sorts = data?.sorts ?? [];
  const problems: string[] = [];
  if (groups.length < 2) problems.push(`“${title}” needs at least two groups with names.`);
  if (sorts.length < 2) problems.push(`“${title}” needs at least two things to sort.`);
  if (sorts.some((i) => !i.text || !groups.some((g) => g.id === i.group))) problems.push(`Something to sort in “${title}” is missing its text or its group.`);
  return problems;
}

/** What stops a scenario working, worded for its author. */
export function scenarioProblems(title: string, steps: readonly ScenarioStep[]): string[] {
  if (!steps.length) return [`“${title}” needs at least one scene.`];
  const problems: string[] = [];
  steps.forEach((step, i) => {
    if (!step.text) problems.push(`Scene ${i + 1} of “${title}” has no text.`);
    if (!step.choices.length) problems.push(`Scene ${i + 1} of “${title}” needs at least one choice.`);
  });
  const reachable = reachableScenes(steps);
  steps.forEach((step, i) => { if (!reachable.has(step.id)) problems.push(`Nothing leads to scene ${i + 1} of “${title}”. Point a choice at it or remove it.`); });
  if (!steps.some((s) => reachable.has(s.id) && s.choices.some((c) => !c.next && c.best))) problems.push(`“${title}” needs an ending marked as the best outcome, so learners can finish it.`);
  return problems;
}

export const outlineLessons = (outline: Outline) => outline.sections.flatMap((s) => s.lessons);

/** Reads a stored version outline, dropping anything malformed. */
export function readOutline(value: unknown): Outline {
  const sections = Array.isArray((value as Outline | null)?.sections) ? (value as Outline).sections : [];
  const questions = Array.isArray((value as Outline | null)?.questions) ? (value as Outline).questions : [];
  return { exam: readExam((value as Outline | null)?.exam), questions: questions
    .map((q) => q && typeof q.id === "string" && typeof q.sectionId === "string" ? normaliseQuestion(q, () => "x") : null)
    .filter((q): q is Question => !!q),
  sections: sections.filter((s) => s && typeof s.id === "string").map((s) => ({
    id: s.id, title: String(s.title ?? ""),
    lessons: (Array.isArray(s.lessons) ? s.lessons : []).filter((l) => l && typeof l.id === "string" && isLessonKind(l.kind)).map((l) => ({
      id: l.id, kind: l.kind, title: String(l.title ?? ""), body: cleanDoc(l.body), videoUrl: String(l.videoUrl ?? ""),
      fileId: typeof l.fileId === "string" ? l.fileId : null, minutes: typeof l.minutes === "number" ? l.minutes : null,
      data: cleanLessonData(l.kind, l.data, () => "x"),
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

/** A Scenario as the learner gets it: every scene, but whether an ending is the
 *  best one only shows once they reach it. Practice, so nothing else is held back. */
export const learnerScenario = (steps: readonly ScenarioStep[]) => steps.map((s) => ({
  id: s.id, text: s.text, imageId: s.imageId, choices: s.choices.map((c) => ({ id: c.id, text: c.text, feedback: c.feedback, next: c.next, best: c.next ? false : c.best })),
}));
