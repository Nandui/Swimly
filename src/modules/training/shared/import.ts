import { normaliseQuestion, questionProblem, type Question, type QuestionKind } from "@/modules/training/shared/questions";

/** Questions pasted from a spreadsheet (docs/training.md, e-learning phase 3).
 *  One question a row, copied straight out of Excel (tab-separated) or as CSV:
 *
 *    Type | Question | Option A | Option B | … | Option F | Right answer | Why
 *
 *  Type is One, Several, True/false, Order, Match or Blanks. Right answer is a
 *  letter (A), letters (A, C) or True / False. Order lists the steps in the right
 *  order; Match writes each pair as "item = partner"; Blanks puts the missing
 *  words in [square brackets] in the question. A first row starting "Type" is
 *  skipped. Pure and client-safe, so the builder can show what it found first. */

export const IMPORT_COLUMNS = ["Type", "Question", "Option A", "Option B", "Option C", "Option D", "Option E", "Option F", "Right answer", "Why"];
export const MAX_IMPORT_ROWS = 100;

const TYPES: Record<string, QuestionKind> = {
  one: "SINGLE", single: "SINGLE", "one right answer": "SINGLE",
  several: "MULTIPLE", multiple: "MULTIPLE", "several right answers": "MULTIPLE",
  "true/false": "TRUE_FALSE", "true or false": "TRUE_FALSE", truefalse: "TRUE_FALSE", tf: "TRUE_FALSE",
  order: "ORDER", "put in order": "ORDER",
  match: "MATCH", "match pairs": "MATCH",
  blanks: "FILL_BLANK", blank: "FILL_BLANK", "fill in the blanks": "FILL_BLANK",
};

/** Splits pasted text into rows of cells: tab-separated if any line has a tab, otherwise CSV with quotes. */
export function readRows(text: string): string[][] {
  const clean = text.replace(/\r\n?/g, "\n").replace(/^﻿/, "");
  const delimiter = clean.includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && !cell.trim()) { quoted = true; cell = ""; }
    else if (ch === delimiter) { row.push(cell.trim()); cell = ""; }
    else if (ch === "\n") { row.push(cell.trim()); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  row.push(cell.trim());
  rows.push(row);
  return rows.filter((r) => r.some((c) => c));
}

const LETTERS = "ABCDEF";

export type ImportResult = { questions: Omit<Question, "id" | "sectionId">[]; problems: { row: number; message: string }[] };

/** Every question it could read, and what is wrong with each row it couldn't. */
export function parseQuestions(text: string, newId: () => string): ImportResult {
  const rows = readRows(text);
  if (rows[0]?.[0]?.toLowerCase() === "type") rows.shift();
  const result: ImportResult = { questions: [], problems: [] };
  rows.slice(0, MAX_IMPORT_ROWS).forEach((cells, index) => {
    const row = index + 1;
    const kind = TYPES[(cells[0] ?? "").toLowerCase().replace(/\s+/g, " ").trim()];
    if (!kind) { result.problems.push({ row, message: `“${cells[0] ?? ""}” isn't a type. Use One, Several, True/false, Order, Match or Blanks.` }); return; }
    const prompt = cells[1] ?? "";
    const given = cells.slice(2, 8).filter(Boolean);
    const right = (cells[8] ?? "").toUpperCase().split(/[\s,;]+/).filter(Boolean);
    const why = cells[9] ?? "";
    let options: { id?: string; text: string; imageId: null; correct: boolean; match: string; area: null }[] = [];
    if (kind === "TRUE_FALSE") {
      const truth = right[0] === "TRUE" || right[0] === "T" ? "true" : right[0] === "FALSE" || right[0] === "F" ? "false" : null;
      if (!truth) { result.problems.push({ row, message: "Say True or False under Right answer." }); return; }
      options = [{ id: "true", text: "True", imageId: null, correct: truth === "true", match: "", area: null }, { id: "false", text: "False", imageId: null, correct: truth === "false", match: "", area: null }];
    } else if (kind === "MATCH") {
      options = given.map((cell) => {
        const [left, ...rest] = cell.split("=");
        return { text: left.trim(), imageId: null, correct: false, match: rest.join("=").trim(), area: null };
      });
    } else if (kind === "SINGLE" || kind === "MULTIPLE") {
      const bad = right.find((letter) => !LETTERS.includes(letter) || LETTERS.indexOf(letter) >= given.length);
      if (bad || !right.length) { result.problems.push({ row, message: `Under Right answer, give the letter of ${kind === "SINGLE" ? "the right option" : "each right option"}, such as ${kind === "SINGLE" ? "B" : "A, C"}.` }); return; }
      options = given.map((cell, i) => ({ text: cell, imageId: null, correct: right.includes(LETTERS[i]), match: "", area: null }));
    } else if (kind === "ORDER") {
      options = given.map((cell) => ({ text: cell, imageId: null, correct: false, match: "", area: null }));
    }
    const question = normaliseQuestion({ id: "import", sectionId: "import", kind, prompt, options, explanation: why }, newId);
    const problem = question ? questionProblem(question) : "That row couldn't be read.";
    if (!question || problem) { result.problems.push({ row, message: problem ?? "That row couldn't be read." }); return; }
    result.questions.push({ kind: question.kind, prompt: question.prompt, imageId: question.imageId, options: question.options, explanation: question.explanation });
  });
  if (rows.length > MAX_IMPORT_ROWS) result.problems.push({ row: MAX_IMPORT_ROWS + 1, message: `Only the first ${MAX_IMPORT_ROWS} rows are read at a time.` });
  return result;
}
