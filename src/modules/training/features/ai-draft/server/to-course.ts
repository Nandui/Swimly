import { cleanDoc, cleanLessonData, MAX_LESSONS, type DocNode, type LessonData, type LessonKind } from "@/modules/training/shared/lessons";
import { MAX_QUESTIONS, normaliseQuestion, questionProblem, type Question } from "@/modules/training/shared/questions";
import type { Draft, DraftBlock } from "@/modules/training/features/ai-draft/server/schema";

/** Turns Claude's draft into the builder's own lessons and questions, through
 *  the same cleaning every author's edit goes through. Anything that doesn't
 *  survive it (an empty lesson, a question with no right answer) is dropped
 *  and listed, so the author knows. Pure. */

export type DraftLesson = { kind: LessonKind; title: string; minutes: number | null; body: DocNode | null; data: LessonData | null };
export type DraftSection = { title: string; lessons: DraftLesson[]; questions: Omit<Question, "id" | "sectionId">[] };
export type DraftCourse = { title: string; summary: string; category: string; sections: DraftSection[]; notes: string[]; dropped: string[] };

const MAX_SECTIONS = 12;
const clip = (text: string, max: number) => text.trim().replace(/\s+/g, " ").slice(0, max);
const t = (text: string) => ({ type: "text", text: text.trim() });
const p = (text: string): DocNode => ({ type: "paragraph", content: [t(text)] });
const list = (type: "bulletList" | "orderedList", items: string[]): DocNode => ({ type, content: items.map((i) => ({ type: "listItem", content: [p(i)] })) });

function blockNodes(b: DraftBlock): DocNode[] {
  const items = b.items.map((i) => i.trim()).filter(Boolean);
  switch (b.type) {
    case "heading": return b.text.trim() ? [{ type: "heading", attrs: { level: 2 }, content: [t(clip(b.text, 120))] }] : [];
    case "paragraph": return b.text.trim() ? [p(b.text)] : [];
    case "bullets": return items.length ? [list("bulletList", items)] : [];
    case "numbered": return items.length ? [list("orderedList", items)] : [];
    case "steps": {
      const steps = b.steps.filter((s) => s.title.trim() || s.text.trim());
      return steps.length ? [{ type: "stepper", content: steps.map((s) => ({ type: "stepItem", content: [
        { type: "heading", attrs: { level: 3 }, content: [t(clip(s.title || s.text, 120))] }, ...(s.title.trim() && s.text.trim() ? [p(s.text)] : []),
      ] })) }] : [];
    }
    default: return b.text.trim() ? [{ type: "callout", attrs: { tone: b.type }, content: [p(b.text)] }] : [];
  }
}

const doc = (blocks: DraftBlock[]) => {
  const content = blocks.flatMap(blockNodes);
  return content.length ? cleanDoc({ type: "doc", content }) : null;
};
const minutes = (value: number) => Number.isFinite(value) ? Math.min(60, Math.max(1, Math.round(value))) : null;
const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 8);

export function toCourse(draft: Draft, options: { practice: boolean }): DraftCourse {
  const dropped: string[] = [];
  let lessonCount = 0, questionCount = 0;
  const sections: DraftSection[] = [];
  for (const s of draft.sections.slice(0, MAX_SECTIONS)) {
    const lessons: DraftLesson[] = [];
    for (const l of s.lessons) {
      if (lessonCount >= MAX_LESSONS - MAX_SECTIONS) { dropped.push(`“${clip(l.title, 80)}” (too many lessons)`); continue; }
      const body = doc(l.blocks);
      const data = l.kind === "FLASHCARDS"
        ? cleanLessonData("FLASHCARDS", { cards: l.cards.filter((c) => c.front.trim() && c.back.trim()).map((c) => ({ id: newId(), front: c.front, back: c.back, imageId: null })) })
        : l.kind === "CHECKLIST" ? cleanLessonData("CHECKLIST", { items: l.items.filter((i) => i.trim()).map((text) => ({ id: newId(), text })) }) : null;
      const empty = l.kind === "READING" ? !body : l.kind === "FLASHCARDS" ? (data?.cards?.length ?? 0) < 2 : !data?.items?.length;
      if (empty || !l.title.trim()) { dropped.push(`“${clip(l.title, 80) || "A lesson"}” (nothing in it)`); continue; }
      lessons.push({ kind: l.kind, title: clip(l.title, 120), minutes: minutes(l.minutes), body, data });
      lessonCount++;
    }
    const questions: DraftSection["questions"] = [];
    for (const q of s.questions) {
      if (questionCount >= MAX_QUESTIONS) break;
      // True or false is kept as the builder's own two options, whichever the draft marked right.
      const isTrue = q.options.find((o) => o.correct)?.text.trim().toLowerCase() === "true";
      const options = q.kind === "TRUE_FALSE" ? [{ id: "true", correct: isTrue }, { id: "false", correct: !isTrue }] : q.options.map((o) => ({ text: o.text, correct: o.correct }));
      const clean = normaliseQuestion({ id: "q", sectionId: "s", kind: q.kind, prompt: q.prompt, options, explanation: q.explanation }, newId);
      if (!clean || questionProblem(clean)) { dropped.push(`the question “${clip(q.prompt, 80)}”`); continue; }
      questions.push({ kind: clean.kind, prompt: clean.prompt, imageId: null, options: clean.options, explanation: clean.explanation });
      questionCount++;
    }
    // Practice questions after each section's lessons, from that section's bank.
    if (options.practice && questions.length >= 2) {
      lessons.push({ kind: "QUIZ", title: `Check yourself: ${clip(s.title, 100)}`, minutes: Math.max(2, Math.ceil(questions.length / 2)), body: doc([{ type: "paragraph", text: "A few quick questions on this section. They aren’t marked, so have a go.", items: [], steps: [] }]), data: null });
      lessonCount++;
    }
    if (!lessons.length && !questions.length) continue;
    sections.push({ title: clip(s.title, 120) || `Part ${sections.length + 1}`, lessons, questions });
  }
  return {
    title: clip(draft.title, 120), summary: clip(draft.summary, 500), category: clip(draft.category, 40),
    sections, notes: draft.notes.map((n) => clip(n, 300)).filter(Boolean).slice(0, 12), dropped,
  };
}
