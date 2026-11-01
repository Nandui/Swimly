import assert from "node:assert/strict";
import { test } from "node:test";
import { MATRIX_CELL_META, OPEN_TRAINING_STATUSES, TRAINING_STATUS_META, TRAINING_STATUSES, trainingState } from "./constants";
import { fileIdFromSrc, fileSrc, isLessonKind, LESSON_KINDS, lessonMinutes, readingMinutes, safeHref, sortingProblems } from "./lessons";
import { readObservation, sessionWhen } from "./on-the-job";
import { cleanArea, drawPaper, EXAM_DEFAULTS, MAX_QUESTIONS, paperSize, readExam, readSpot, seeded, shuffle, type Question } from "./questions";
import { cellTone } from "./rules";

/** Training's small rules beside the ones __tests__ covers end to end: where an assignment
 *  stands, how an exam paper is drawn, and what a lesson may link to. Invented courses. */

test("an assignment is to do, overdue past its due day, awaiting sign-off, completed or cancelled, and each has a tag", () => {
  const due = new Date("2026-10-20T00:00:00Z");
  assert.equal(trainingState({ status: "ASSIGNED", dueOn: due }, "2026-10-20"), "assigned", "due today is not overdue");
  assert.equal(trainingState({ status: "ASSIGNED", dueOn: due }, "2026-10-21"), "overdue");
  assert.equal(trainingState({ status: "ASSIGNED", dueOn: null }, "2030-01-01"), "assigned", "no due day, never overdue");
  assert.equal(trainingState({ status: "SUBMITTED", dueOn: due }, "2026-10-21"), "submitted", "waiting for a trainer is not the learner's lateness");
  assert.equal(trainingState({ status: "COMPLETED", dueOn: due }, "2026-10-21"), "completed");
  assert.equal(trainingState({ status: "CANCELLED", dueOn: due }, "2026-10-21"), "cancelled");
  for (const status of TRAINING_STATUSES) assert.ok(Object.hasOwn(TRAINING_STATUS_META, trainingState({ status, dueOn: null }, "2026-10-21")));
  assert.deepEqual([...OPEN_TRAINING_STATUSES], ["ASSIGNED", "SUBMITTED"]);
});

test("a matrix cell's tone: done or due again soon, to do, awaiting sign-off or overdue, and the rest as they are", () => {
  assert.equal(cellTone({ kind: "done", on: "2026-01-01", dueAgain: "2027-01-01", soon: false }), "done");
  assert.equal(cellTone({ kind: "done", on: "2026-01-01", dueAgain: "2026-11-01", soon: true }), "soon");
  assert.equal(cellTone({ kind: "due", on: null, overdue: false, submitted: false }), "due");
  assert.equal(cellTone({ kind: "due", on: "2026-10-01", overdue: true, submitted: false }), "overdue");
  assert.equal(cellTone({ kind: "due", on: "2026-10-01", overdue: true, submitted: true }), "submitted", "handed in for sign-off counts before overdue");
  assert.equal(cellTone({ kind: "missing" }), "missing");
  assert.equal(cellTone({ kind: "excused" }), "excused");
  assert.equal(cellTone({ kind: "expired", on: "2025-01-01" }), "expired");
  const labels = Object.values(MATRIX_CELL_META).map((m) => m.label);
  assert.equal(new Set(labels).size, labels.length, "every tone reads differently");
});

const question = (id: string): Question => ({ id, sectionId: "s1", kind: "TRUE_FALSE", prompt: `Synthetic ${id}`, imageId: null, explanation: "", options: [] } as unknown as Question);
const bank = ["q1", "q2", "q3", "q4", "q5"].map(question);

test("an exam's stored settings are read within bounds, or fall back to the defaults", () => {
  assert.deepEqual(readExam({ passMark: 70, attempts: 2, draw: 3, timeLimit: 20, testOut: true }), { passMark: 70, attempts: 2, draw: 3, timeLimit: 20, testOut: true });
  assert.deepEqual(readExam({ passMark: 0, attempts: 11, draw: MAX_QUESTIONS + 1, timeLimit: 241, testOut: "yes" }), { ...EXAM_DEFAULTS, draw: null, timeLimit: null, testOut: false });
  assert.deepEqual(readExam({ passMark: 75.5 }), { ...EXAM_DEFAULTS }, "whole numbers only");
  assert.equal(readExam(null), null, "no exam");
  assert.equal(EXAM_DEFAULTS.passMark, 80);
});

test("a paper draws the exam's number of questions from the bank, shuffled, the same for the same seed", () => {
  const exam = { ...EXAM_DEFAULTS, draw: 3 };
  assert.equal(paperSize(exam, 5), 3);
  assert.equal(paperSize(exam, 2), 2, "never more than the bank holds");
  assert.equal(paperSize({ ...EXAM_DEFAULTS, draw: null }, 5), 5, "no draw: every question");
  const paper = drawPaper(exam, bank, seeded("ava:paper-1"));
  assert.equal(paper.length, 3);
  assert.equal(new Set(paper).size, 3, "no question twice");
  assert.deepEqual(drawPaper(exam, bank, seeded("ava:paper-1")), paper, "the same seed, the same paper");
  const shuffled = shuffle(bank.map((q) => q.id), seeded("x"));
  assert.deepEqual([...shuffled].sort(), ["q1", "q2", "q3", "q4", "q5"], "shuffling keeps every item");
  assert.deepEqual(shuffle([], seeded("x")), []);
  const papers = new Set(Array.from({ length: 20 }, (_, i) => drawPaper(exam, bank, seeded(`p${i}`)).join()));
  assert.ok(papers.size > 5, "different people get different papers");
});

test("pick the spot: an area stays inside the picture and is at least 2% each way; a tap is two numbers out of 100", () => {
  assert.deepEqual(cleanArea({ x: 10, y: 20, w: 30, h: 40 }), { x: 10, y: 20, w: 30, h: 40 });
  assert.deepEqual(cleanArea({ x: 99, y: -5, w: 50, h: 0.5 }), { x: 98, y: 0, w: 2, h: 2 }, "pulled back inside, never too small to tap");
  assert.deepEqual(cleanArea({ x: 10, y: 10, w: 0.5, h: 1 }), { x: 10, y: 10, w: 2, h: 2 }, "a sliver grows to 2% each way");
  assert.deepEqual(cleanArea({ x: 12.345, y: 0, w: 10, h: 10 }), { x: 12.3, y: 0, w: 10, h: 10 });
  assert.equal(cleanArea({ x: 1, y: 2, w: 3 }), null);
  assert.equal(cleanArea({ x: Number.NaN, y: 2, w: 3, h: 4 }), null);
  assert.deepEqual(readSpot("12.5,99"), { x: 12.5, y: 99 });
  assert.deepEqual(readSpot("100,0"), { x: 100, y: 0 });
  for (const tap of ["101,5", "5,101", "5","-1,5", "1.25,5", "a,b", 5]) assert.equal(readSpot(tap), null, String(tap));
});

test("a lesson links only to web pages and email, and shows only this course's own files", () => {
  assert.equal(safeHref(" https://example.invalid/guide "), "https://example.invalid/guide");
  assert.equal(safeHref("mailto:training@example.invalid"), "mailto:training@example.invalid");
  for (const href of ["javascript:alert(1)", "/admin", "data:text/html,x", 42]) assert.equal(safeHref(href), null, String(href));
  assert.equal(fileSrc("file_1"), "/training/files/file_1");
  assert.equal(fileIdFromSrc(fileSrc("file_1")), "file_1");
  for (const src of ["/training/files/../secret", "https://example.invalid/training/files/x", "/training/files/", null]) assert.equal(fileIdFromSrc(src), null, String(src));
  assert.equal(isLessonKind("READING"), true);
  assert.equal(isLessonKind("reading"), false);
  assert.ok(LESSON_KINDS.length > 3);
});

test("a reading lesson takes a minute for every 200 words, at least one, unless the author says how long", () => {
  const words = (n: number) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: Array(n).fill("water").join(" ") }] }] });
  assert.equal(readingMinutes(words(10)), 1);
  assert.equal(readingMinutes(words(600)), 3);
  assert.equal(readingMinutes(null), 1);
  assert.equal(lessonMinutes({ kind: "READING", body: words(600), minutes: null }), 3);
  assert.equal(lessonMinutes({ kind: "READING", body: words(600), minutes: 10 }), 10, "the author's time wins");
  assert.equal(lessonMinutes({ kind: "VIDEO", body: null, minutes: null }), null, "only reading is worked out");
});

test("a sorting lesson needs two named groups and two things to sort, each in a group", () => {
  const groups = [{ id: "g1", name: "Acid" }, { id: "g2", name: "Alkali" }];
  const sorts = [{ id: "s1", text: "Sodium bisulphate", group: "g1" }, { id: "s2", text: "Soda ash", group: "g2" }];
  assert.deepEqual(sortingProblems("Chemicals", { groups, sorts } as never), []);
  assert.deepEqual(sortingProblems("Chemicals", null), ["“Chemicals” needs at least two groups with names.", "“Chemicals” needs at least two things to sort."]);
  assert.deepEqual(sortingProblems("Chemicals", { groups: [groups[0], { id: "g2", name: "" }], sorts } as never), ["“Chemicals” needs at least two groups with names.", "Something to sort in “Chemicals” is missing its text or its group."]);
  assert.deepEqual(sortingProblems("Chemicals", { groups, sorts: [sorts[0], { id: "s2", text: "Soda ash", group: "gone" }] } as never), ["Something to sort in “Chemicals” is missing its text or its group."]);
});

test("a stored checklist is read without trusting it; a session reads in Irish time", () => {
  assert.deepEqual(readObservation([{ id: "a", text: "Checks the area", critical: true }, { id: "b", text: "Signals" }, { text: "no id" }, null, "x"]),
    [{ id: "a", text: "Checks the area", critical: true }, { id: "b", text: "Signals", critical: false }]);
  assert.deepEqual(readObservation({ steps: [] }), []);
  assert.equal(sessionWhen(new Date("2026-11-03T18:30:00Z"), 90), "Tue 3 Nov 2026, 18:30 to 20:00");
  assert.equal(sessionWhen(new Date("2026-07-07T17:30:00Z"), 60), "Tue 7 Jul 2026, 18:30 to 19:30", "Irish summer time");
});
