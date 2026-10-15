/** Quizzes and exams (docs/training.md, e-learning phase 2). Each section of a
 *  course holds questions. A Quiz lesson practises its section's questions; the
 *  course's final exam draws from every section's. Answers are marked on the
 *  server only: what a learner's phone gets is `learnerQuestion`, never the key.
 *  Pure and client-safe: the builder, the staff API and tests use it. */

export const QUESTION_KINDS = ["SINGLE", "MULTIPLE", "TRUE_FALSE", "ORDER", "MATCH"] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

export const QUESTION_KIND_META = {
  SINGLE: { label: "One right answer", help: "Pick one of the options." },
  MULTIPLE: { label: "Several right answers", help: "Tick every option that is right." },
  TRUE_FALSE: { label: "True or false", help: "A statement that is true or false." },
  ORDER: { label: "Put in order", help: "Steps the learner puts in the right order." },
  MATCH: { label: "Match pairs", help: "Match each item with its partner." },
} as const satisfies Record<QuestionKind, { label: string; help: string }>;

export const isQuestionKind = (value: unknown): value is QuestionKind => QUESTION_KINDS.includes(value as QuestionKind);

export type QuestionOption = { id: string; text: string; imageId: string | null; correct: boolean; match: string };
export type Question = { id: string; sectionId: string; kind: QuestionKind; prompt: string; imageId: string | null; options: QuestionOption[]; explanation: string };

/** The final exam's rules. Null on a course means it has no exam. */
export type ExamSettings = { passMark: number; attempts: number; draw: number | null; timeLimit: number | null; testOut: boolean };
export const EXAM_DEFAULTS: ExamSettings = { passMark: 80, attempts: 3, draw: null, timeLimit: null, testOut: false };

export const MAX_QUESTIONS = 300;
export const MAX_OPTIONS = 8;
/** Seconds after the time limit in which answers sent on the way still count. */
export const GRACE_SECONDS = 30;

const TRUE_FALSE = [{ id: "true", text: "True" }, { id: "false", text: "False" }];
const clip = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
const fileId = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : null;
const optionId = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9_-]{1,32}$/.test(value) ? value : null;

/** A question as an author saved it, normalised: True/false always has the
 *  two fixed options, and only choice questions keep "correct" marks. */
export function normaliseQuestion(raw: { id: string; sectionId: string; kind: unknown; prompt: unknown; imageId?: unknown; options?: unknown; explanation?: unknown }, newId: () => string): Question | null {
  if (!isQuestionKind(raw.kind)) return null;
  const kind = raw.kind;
  const given = Array.isArray(raw.options) ? raw.options.slice(0, MAX_OPTIONS) as Partial<QuestionOption>[] : [];
  const options: QuestionOption[] = kind === "TRUE_FALSE"
    ? TRUE_FALSE.map((o) => ({ ...o, imageId: null, match: "", correct: !!given.find((g) => g?.id === o.id)?.correct }))
    : given.map((o) => ({
      id: optionId(o?.id) ?? newId(),
      text: clip(o?.text, 300),
      imageId: kind === "SINGLE" || kind === "MULTIPLE" ? fileId(o?.imageId) : null,
      correct: kind === "SINGLE" || kind === "MULTIPLE" ? !!o?.correct : false,
      match: kind === "MATCH" ? clip(o?.match, 300) : "",
    })).filter((o) => o.text || o.imageId || o.match);
  // Option ids must be unique within the question: answers point at them.
  const seen = new Set<string>();
  for (const o of options) { if (seen.has(o.id)) o.id = newId(); seen.add(o.id); }
  return { id: raw.id, sectionId: raw.sectionId, kind, prompt: clip(raw.prompt, 1000), imageId: fileId(raw.imageId), options, explanation: clip(raw.explanation, 1000) };
}

/** What is wrong with a question, worded for its author. Null when it is ready. */
export function questionProblem(q: Question): string | null {
  if (q.prompt.length < 3) return "Write the question.";
  const right = q.options.filter((o) => o.correct).length;
  switch (q.kind) {
    case "SINGLE":
      if (q.options.length < 2) return "Give at least two options.";
      if (right !== 1) return "Mark exactly one option as right.";
      return null;
    case "MULTIPLE":
      if (q.options.length < 2) return "Give at least two options.";
      if (right < 1) return "Mark at least one option as right.";
      return null;
    case "TRUE_FALSE":
      return right === 1 ? null : "Choose whether the statement is true or false.";
    case "ORDER":
      if (q.options.length < 2) return "Give at least two steps.";
      return q.options.some((o) => !o.text) ? "Every step needs some text." : null;
    case "MATCH":
      if (q.options.length < 2) return "Give at least two pairs.";
      if (q.options.some((o) => !o.text || !o.match)) return "Fill in both sides of every pair.";
      return new Set(q.options.map((o) => o.match.toLowerCase())).size === q.options.length ? null : "Each pair needs a different partner.";
  }
}

/** Files a question shows: its picture and any option pictures. */
export const questionFiles = (q: Question) => [q.imageId, ...q.options.map((o) => o.imageId)].filter((id): id is string => !!id);

// ---------------------------------------------------------------------------
// Answers and marking
// ---------------------------------------------------------------------------

/** A Match question's right-hand side. Its ids are positions, never the left
 *  option's id, so the pairing cannot be read from the ids; the left options
 *  are shuffled and their ids are random. */
const partnerKey = (index: number) => `p${index}`;
export const matchPartners = (q: Question) => q.options.map((o, i) => ({ id: partnerKey(i), text: o.match }));

/** One option id (one answer, true/false), several (several answers, order), or pairs (left option id to partner id, match). */
export type Answer = string | string[] | Record<string, string>;

/** The answer in the shape its question takes, keeping only this question's own
 *  option ids. Null when it is not an answer to this question. */
export function cleanAnswer(q: Question, raw: unknown): Answer | null {
  const ids = new Set(q.options.map((o) => o.id));
  if (q.kind === "SINGLE" || q.kind === "TRUE_FALSE") return typeof raw === "string" && ids.has(raw) ? raw : null;
  if (q.kind === "MULTIPLE" || q.kind === "ORDER") {
    if (!Array.isArray(raw) || raw.some((id) => typeof id !== "string" || !ids.has(id))) return null;
    const unique = [...new Set(raw as string[])];
    if (q.kind === "ORDER" && unique.length !== q.options.length) return null;
    return unique.length ? unique : null;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const partners = new Set(q.options.map((_, i) => partnerKey(i)));
  const pairs = Object.entries(raw as Record<string, unknown>).filter(([left, right]) => ids.has(left) && typeof right === "string" && partners.has(right));
  return pairs.length ? Object.fromEntries(pairs) as Record<string, string> : null;
}

/** All or nothing: the whole question has to be right. */
export function isCorrect(q: Question, answer: Answer | null | undefined): boolean {
  if (answer == null) return false;
  const right = q.options.filter((o) => o.correct).map((o) => o.id);
  switch (q.kind) {
    case "SINGLE":
    case "TRUE_FALSE":
      return typeof answer === "string" && right.length === 1 && answer === right[0];
    case "MULTIPLE":
      return Array.isArray(answer) && answer.length === right.length && right.every((id) => answer.includes(id));
    case "ORDER":
      return Array.isArray(answer) && answer.length === q.options.length && q.options.every((o, i) => answer[i] === o.id);
    case "MATCH":
      return typeof answer === "object" && !Array.isArray(answer) && q.options.every((o, i) => answer[o.id] === partnerKey(i));
  }
}

/** The right answer, for the review after a passed exam and for the builder's preview. */
export function rightAnswer(q: Question): Answer {
  if (q.kind === "SINGLE" || q.kind === "TRUE_FALSE") return q.options.find((o) => o.correct)?.id ?? "";
  if (q.kind === "MULTIPLE") return q.options.filter((o) => o.correct).map((o) => o.id);
  if (q.kind === "ORDER") return q.options.map((o) => o.id);
  return Object.fromEntries(q.options.map((o, i) => [o.id, partnerKey(i)]));
}

// ---------------------------------------------------------------------------
// What a learner sees
// ---------------------------------------------------------------------------

/** A seeded random number generator, so the same paper shows the same order every time it is opened. */
export function seeded(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A question with no key: options shuffled (true/false stays in order), and for
 *  Match pairs the partners in their own shuffled list, by the option id they belong to. */
export function learnerQuestion(q: Question, random: () => number) {
  const options = q.kind === "TRUE_FALSE" ? q.options : shuffle(q.options, random);
  // An Order question never starts in the right order when it can be helped.
  const order = q.kind === "ORDER" && q.options.length > 1 && options.every((o, i) => o.id === q.options[i].id) ? [...options.slice(1), options[0]] : options;
  return {
    id: q.id, kind: q.kind, prompt: q.prompt, imageId: q.imageId,
    options: order.map((o) => ({ id: o.id, text: o.text, imageId: o.imageId })),
    partners: q.kind === "MATCH" ? shuffle(matchPartners(q), random) : null,
  };
}
export type LearnerQuestion = ReturnType<typeof learnerQuestion>;

// ---------------------------------------------------------------------------
// The exam
// ---------------------------------------------------------------------------

export function readExam(value: unknown): ExamSettings | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<ExamSettings>;
  const int = (n: unknown, min: number, max: number) => typeof n === "number" && Number.isInteger(n) && n >= min && n <= max ? n : null;
  return {
    passMark: int(v.passMark, 1, 100) ?? EXAM_DEFAULTS.passMark,
    attempts: int(v.attempts, 1, 10) ?? EXAM_DEFAULTS.attempts,
    draw: int(v.draw, 1, MAX_QUESTIONS),
    timeLimit: int(v.timeLimit, 1, 240),
    testOut: v.testOut === true,
  };
}

/** How many questions a paper has. */
export const paperSize = (exam: ExamSettings, bank: number) => Math.min(bank, exam.draw ?? bank);

/** The questions on one person's paper, in their order: a random draw when the
 *  exam draws fewer than the bank holds, always shuffled. */
export const drawPaper = (exam: ExamSettings, questions: readonly Question[], random: () => number) =>
  shuffle(questions, random).slice(0, paperSize(exam, questions.length)).map((q) => q.id);

export type ExamMark = { correct: number; total: number; percent: number; passed: boolean; results: Record<string, boolean> };

export function markPaper(exam: ExamSettings, questions: readonly Question[], paper: readonly string[], answers: Record<string, unknown>): ExamMark {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const results: Record<string, boolean> = {};
  for (const id of paper) {
    const q = byId.get(id);
    results[id] = !!q && isCorrect(q, cleanAnswer(q, answers[id]));
  }
  const total = paper.length, correct = Object.values(results).filter(Boolean).length;
  const percent = total ? Math.floor((correct / total) * 100) : 0;
  return { correct, total, percent, passed: total > 0 && percent >= exam.passMark, results };
}
