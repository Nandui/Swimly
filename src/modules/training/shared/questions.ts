/** Quizzes and exams (e-learning phase 2). Each section of a
 *  course holds questions. A Quiz lesson practises its section's questions; the
 *  course's final exam draws from every section's. Answers are marked on the
 *  server only: what a learner's phone gets is `learnerQuestion`, never the key.
 *  Pure and client-safe: the builder, the staff API and tests use it. */

export const QUESTION_KINDS = ["SINGLE", "MULTIPLE", "TRUE_FALSE", "ORDER", "MATCH", "FILL_BLANK", "HOTSPOT", "NUMBER", "SHORT_ANSWER"] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

export const QUESTION_KIND_META = {
  SINGLE: { label: "One right answer", help: "Pick one of the options." },
  MULTIPLE: { label: "Several right answers", help: "Tick every option that is right." },
  TRUE_FALSE: { label: "True or false", help: "A statement that is true or false." },
  ORDER: { label: "Put in order", help: "Steps the learner puts in the right order." },
  MATCH: { label: "Match pairs", help: "Match each item with its partner." },
  FILL_BLANK: { label: "Fill in the blanks", help: "A sentence with missing words the learner types in." },
  HOTSPOT: { label: "Pick the spot", help: "A picture where the learner taps the right place." },
  // Phase 8: typed answers.
  NUMBER: { label: "Number", help: "A reading, dose or count, right within a margin you set, such as 1.5 mg/l give or take 0.2." },
  SHORT_ANSWER: { label: "Short answer", help: "A word or a few words the learner types, with every answer you accept." },
} as const satisfies Record<QuestionKind, { label: string; help: string }>;

const isQuestionKind = (value: unknown): value is QuestionKind => QUESTION_KINDS.includes(value as QuestionKind);

/** A spot on a picture, in percent of its width and height from the top left. */
export type Area = { x: number; y: number; w: number; h: number };
/** One option. Fill in the blanks keeps one per blank (text holds the accepted
 *  answers, separated by |); Pick the spot keeps one per right area. Number
 *  keeps one: text is the answer, match the margin either side, unit what it
 *  is measured in. Short answer keeps one per accepted answer. */
export type QuestionOption = { id: string; text: string; imageId: string | null; correct: boolean; match: string; area: Area | null; unit?: string };
export type Question = { id: string; sectionId: string; kind: QuestionKind; prompt: string; imageId: string | null; options: QuestionOption[]; explanation: string };

/** The final exam's rules. Null on a course means it has no exam. */
export type ExamSettings = { passMark: number; attempts: number; draw: number | null; timeLimit: number | null; testOut: boolean };
export const EXAM_DEFAULTS: ExamSettings = { passMark: 80, attempts: 3, draw: null, timeLimit: null, testOut: false };

export const MAX_QUESTIONS = 300;
const MAX_OPTIONS = 8;
/** Seconds after the time limit in which answers sent on the way still count. */
export const GRACE_SECONDS = 30;

const TRUE_FALSE = [{ id: "true", text: "True" }, { id: "false", text: "False" }];
const clip = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
const fileId = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : null;
const optionId = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9_-]{1,32}$/.test(value) ? value : null;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** An area kept inside the picture, at least 2% each way. Null when it isn't one. */
export function cleanArea(value: unknown): Area | null {
  const v = value as Partial<Area> | null;
  if (!v || typeof v !== "object" || ![v.x, v.y, v.w, v.h].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  const x = Math.min(98, Math.max(0, v.x!)), y = Math.min(98, Math.max(0, v.y!));
  const w = Math.min(100 - x, Math.max(2, v.w!)), h = Math.min(100 - y, Math.max(2, v.h!));
  return { x: round1(x), y: round1(y), w: round1(w), h: round1(h) };
}

// ---------------------------------------------------------------------------
// Fill in the blanks: the author writes the sentence with each missing word in
// [square brackets], other accepted answers after a |, as in
// "Free chlorine should be between [1|1.0] and [3|3.0] mg/l".
// ---------------------------------------------------------------------------

const BLANK = /\[([^\[\]]{1,200})\]/g;
const MAX_BLANKS = 8;
const blankId = (index: number) => `b${index}`;

/** The text around the blanks, and each blank's accepted answers. */
export function readBlanks(prompt: string) {
  const segments: string[] = [], blanks: string[][] = [];
  let last = 0;
  for (const match of prompt.matchAll(BLANK)) {
    if (blanks.length >= MAX_BLANKS) break;
    const accepted = match[1].split("|").map((a) => a.trim()).filter(Boolean).slice(0, 10);
    if (!accepted.length) continue;
    segments.push(prompt.slice(last, match.index));
    blanks.push(accepted);
    last = match.index! + match[0].length;
  }
  segments.push(prompt.slice(last));
  return { segments, blanks };
}

/** The sentence as a learner reads it, with a gap for each blank. */
export const blankedPrompt = (prompt: string) => readBlanks(prompt).segments.join("____");

/** How a typed answer is compared: case, spaces and a final full stop don't
 *  matter, and numbers match whichever way they are written (1, 1.0 or 1,0). */
export function sameAnswer(given: string, accepted: string) {
  const norm = (value: string) => value.toLowerCase().normalize("NFKC").replace(/\s+/g, " ").trim().replace(/[.!]+$/, "");
  const a = norm(given), b = norm(accepted);
  if (a === b) return true;
  const number = (value: string) => /^-?\d+(?:[.,]\d+)?$/.test(value) ? Number(value.replace(",", ".")) : null;
  const na = number(a), nb = number(b);
  return na !== null && nb !== null && na === nb;
}

/** A typed number, written with a full stop or a comma. Null when it isn't one. */
export function readNumber(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim().replace(/\s+/g, "").replace(",", ".");
  if (!/^-?\d{1,9}(?:\.\d{1,6})?$/.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}
const numberText = (n: number) => String(Math.round(n * 1e6) / 1e6);

/** A question as an author saved it, normalised: True/false always has the
 *  two fixed options, and only choice questions keep "correct" marks. */
export function normaliseQuestion(raw: { id: string; sectionId: string; kind: unknown; prompt: unknown; imageId?: unknown; options?: unknown; explanation?: unknown }, newId: () => string): Question | null {
  if (!isQuestionKind(raw.kind)) return null;
  const kind = raw.kind;
  const given = Array.isArray(raw.options) ? raw.options.slice(0, MAX_OPTIONS) as Partial<QuestionOption>[] : [];
  const prompt = clip(raw.prompt, 1000);
  const options: QuestionOption[] = kind === "TRUE_FALSE"
    ? TRUE_FALSE.map((o) => ({ ...o, imageId: null, match: "", area: null, correct: !!given.find((g) => g?.id === o.id)?.correct }))
    // The blanks come from the sentence itself, so the two can never disagree.
    : kind === "FILL_BLANK"
      ? readBlanks(prompt).blanks.map((accepted, i) => ({ id: blankId(i), text: accepted.join(" | "), imageId: null, correct: true, match: "", area: null }))
      : kind === "NUMBER"
        ? (() => {
          const o = given[0], answer = readNumber(o?.text), margin = readNumber(o?.match);
          return answer === null ? [] : [{ id: "n", text: numberText(answer), imageId: null, correct: true, match: numberText(Math.abs(margin ?? 0)), area: null, unit: clip(o?.unit, 20) }];
        })()
      : kind === "SHORT_ANSWER"
        ? given.map((o): QuestionOption => ({ id: optionId(o?.id) ?? newId(), text: clip(o?.text, 120), imageId: null, correct: true, match: "", area: null })).filter((o) => o.text)
      : kind === "HOTSPOT"
        ? given.map((o): QuestionOption => ({ id: optionId(o?.id) ?? newId(), text: clip(o?.text, 300), imageId: null, correct: true, match: "", area: cleanArea(o?.area) }))
          .filter((o) => !!o.area)
        : given.map((o) => ({
          id: optionId(o?.id) ?? newId(),
          text: clip(o?.text, 300),
          imageId: kind === "SINGLE" || kind === "MULTIPLE" ? fileId(o?.imageId) : null,
          correct: kind === "SINGLE" || kind === "MULTIPLE" ? !!o?.correct : false,
          match: kind === "MATCH" ? clip(o?.match, 300) : "",
          area: null,
        })).filter((o) => o.text || o.imageId || o.match);
  // Option ids must be unique within the question: answers point at them.
  const seen = new Set<string>();
  for (const o of options) { if (seen.has(o.id)) o.id = newId(); seen.add(o.id); }
  return { id: raw.id, sectionId: raw.sectionId, kind, prompt, imageId: fileId(raw.imageId), options, explanation: clip(raw.explanation, 1000) };
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
    case "FILL_BLANK":
      if (!q.options.length) return "Put each missing word in [square brackets], for example: Free chlorine is measured in [mg/l].";
      return blankedPrompt(q.prompt).replace(/____/g, "").trim().length < 3 ? "Write some of the sentence around the blanks." : null;
    case "HOTSPOT":
      if (!q.imageId) return "Add the picture people tap on.";
      return q.options.length ? null : "Mark at least one right spot on the picture.";
    case "NUMBER":
      return q.options.length ? null : "Give the right number, such as 1.5.";
    case "SHORT_ANSWER":
      return q.options.length ? null : "Give at least one answer you accept.";
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

/** A tapped spot, written "x,y" in percent of the picture with one decimal. */
export const spotAnswer = (x: number, y: number) => `${round1(Math.min(100, Math.max(0, x)))},${round1(Math.min(100, Math.max(0, y)))}`;
export function readSpot(value: unknown): { x: number; y: number } | null {
  const match = typeof value === "string" ? /^(\d{1,3}(?:\.\d)?),(\d{1,3}(?:\.\d)?)$/.exec(value) : null;
  if (!match) return null;
  const x = Number(match[1]), y = Number(match[2]);
  return x <= 100 && y <= 100 ? { x, y } : null;
}
const inside = (spot: { x: number; y: number }, a: Area) => spot.x >= a.x && spot.x <= a.x + a.w && spot.y >= a.y && spot.y <= a.y + a.h;

/** The answer in the shape its question takes, keeping only this question's own
 *  option ids. Null when it is not an answer to this question. */
export function cleanAnswer(q: Question, raw: unknown): Answer | null {
  const ids = new Set(q.options.map((o) => o.id));
  if (q.kind === "SINGLE" || q.kind === "TRUE_FALSE") return typeof raw === "string" && ids.has(raw) ? raw : null;
  if (q.kind === "HOTSPOT") return readSpot(raw) ? raw as string : null;
  if (q.kind === "NUMBER") return readNumber(raw) === null ? null : String(raw).trim().slice(0, 32);
  if (q.kind === "SHORT_ANSWER") return typeof raw === "string" && raw.trim() ? raw.trim().slice(0, 200) : null;
  if (q.kind === "FILL_BLANK") {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const typed = Object.entries(raw as Record<string, unknown>)
      .filter(([id, value]) => ids.has(id) && typeof value === "string" && value.trim())
      .map(([id, value]) => [id, (value as string).trim().slice(0, 64)]);
    return typed.length ? Object.fromEntries(typed) : null;
  }
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
    case "FILL_BLANK":
      return typeof answer === "object" && !Array.isArray(answer) && q.options.length > 0
        && q.options.every((o) => typeof answer[o.id] === "string" && o.text.split("|").some((accepted) => sameAnswer(answer[o.id], accepted)));
    case "HOTSPOT": {
      const spot = readSpot(answer);
      return !!spot && q.options.some((o) => o.area && inside(spot, o.area));
    }
    case "NUMBER": {
      const given = readNumber(answer), right = readNumber(q.options[0]?.text), margin = readNumber(q.options[0]?.match) ?? 0;
      // A hair of slack so 1.3 is within 0.2 of 1.5 despite how computers store decimals.
      return given !== null && right !== null && Math.abs(given - right) <= margin + 1e-9;
    }
    case "SHORT_ANSWER":
      return typeof answer === "string" && q.options.some((o) => sameAnswer(answer, o.text));
  }
}

/** The right answer, for the review after a passed exam and for the builder's preview. */
export function rightAnswer(q: Question): Answer {
  if (q.kind === "SINGLE" || q.kind === "TRUE_FALSE") return q.options.find((o) => o.correct)?.id ?? "";
  if (q.kind === "MULTIPLE") return q.options.filter((o) => o.correct).map((o) => o.id);
  if (q.kind === "ORDER") return q.options.map((o) => o.id);
  if (q.kind === "FILL_BLANK") return Object.fromEntries(q.options.map((o) => [o.id, o.text.split("|")[0].trim()]));
  if (q.kind === "NUMBER" || q.kind === "SHORT_ANSWER") return q.options[0]?.text ?? "";
  if (q.kind === "HOTSPOT") {
    const a = q.options[0]?.area;
    return a ? spotAnswer(a.x + a.w / 2, a.y + a.h / 2) : "";
  }
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
  // Blanks stay in sentence order and never carry their answers; the right
  // spots on a picture are never sent at all.
  // A typed answer: a Number question sends only its unit, a Short answer nothing.
  if (q.kind === "NUMBER" || q.kind === "SHORT_ANSWER") {
    return {
      id: q.id, kind: q.kind, prompt: q.prompt, imageId: q.imageId,
      options: q.kind === "NUMBER" ? [{ id: "n", text: q.options[0]?.unit ?? "", imageId: null as string | null }] : [],
      partners: null as { id: string; text: string }[] | null, segments: null as string[] | null,
    };
  }
  if (q.kind === "FILL_BLANK" || q.kind === "HOTSPOT") {
    return {
      id: q.id, kind: q.kind, prompt: q.kind === "FILL_BLANK" ? blankedPrompt(q.prompt) : q.prompt, imageId: q.imageId,
      options: q.kind === "FILL_BLANK" ? q.options.map((o) => ({ id: o.id, text: "", imageId: null as string | null })) : [],
      partners: null as { id: string; text: string }[] | null,
      segments: q.kind === "FILL_BLANK" ? readBlanks(q.prompt).segments : null,
    };
  }
  const options = q.kind === "TRUE_FALSE" ? q.options : shuffle(q.options, random);
  // An Order question never starts in the right order when it can be helped.
  const order = q.kind === "ORDER" && q.options.length > 1 && options.every((o, i) => o.id === q.options[i].id) ? [...options.slice(1), options[0]] : options;
  return {
    id: q.id, kind: q.kind, prompt: q.prompt, imageId: q.imageId,
    options: order.map((o) => ({ id: o.id, text: o.text, imageId: o.imageId })),
    partners: q.kind === "MATCH" ? shuffle(matchPartners(q), random) : null,
    segments: null as string[] | null,
  };
}

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
