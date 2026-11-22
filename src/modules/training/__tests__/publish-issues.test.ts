import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanDoc, docTooLong, publishIssues, publishProblems, type DocNode, type Outline, type OutlineLesson } from "../shared/lessons";

/** What stops a draft being published names the exact lesson, so two lessons
 *  called the same thing are never confused, and each carries what to open. */
const text = (words: string): DocNode => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: words }] }] });
const lesson = (id: string, title: string, body: DocNode | null): OutlineLesson => ({ id, kind: "READING", title, body, videoUrl: "", fileId: null, minutes: null, data: null });
const outline = (...sections: { id: string; title: string; lessons: OutlineLesson[] }[]): Outline => ({ sections, questions: [], exam: null });

test("an empty lesson that shares its name is told apart by where it is", () => {
  const draft = outline(
    { id: "s1", title: "Introduction", lessons: [lesson("l1", "Introduction", text("Welcome.")), lesson("l2", "Aim", text("Why we are here."))] },
    { id: "s2", title: "Workplace safety", lessons: [lesson("l3", "Overview", text("Keep walkways clear."))] },
    { id: "s3", title: "Introduction", lessons: [lesson("l4", "Introduction", null)] },
  );
  assert.deepEqual(publishIssues(draft), [
    { text: "“Introduction” (lesson 1 of section 3) has nothing in it yet. Add text, media or an activity.", lessonId: "l4", sectionId: null },
  ]);
  assert.deepEqual(publishProblems(draft), publishIssues(draft).map((issue) => issue.text));
});

test("a name used once is left as it is, and a full course has nothing to fix", () => {
  const draft = outline({ id: "s1", title: "Start", lessons: [lesson("l1", "Welcome", text("Hello.")), lesson("l2", "Fire exits", null)] });
  assert.deepEqual(publishIssues(draft), [{ text: "“Fire exits” has nothing in it yet. Add text, media or an activity.", lessonId: "l2", sectionId: null }]);
  assert.deepEqual(publishIssues(outline({ id: "s1", title: "Start", lessons: [lesson("l1", "Welcome", text("Hello."))] })), []);
});

test("sections with one name are numbered, and a quiz with no questions points at its section", () => {
  const quiz: DocNode = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Have a go." }] }, { type: "activity", attrs: { id: "a1", kind: "QUIZ", data: null } }] };
  const draft = outline(
    { id: "s1", title: "Part", lessons: [lesson("l1", "Check yourself", quiz)] },
    { id: "s2", title: "Part", lessons: [] },
  );
  const issues = publishIssues(draft);
  assert.ok(issues.some((i) => i.text === "Section 2, “Part”, has no lessons. Add one or remove the section." && !i.lessonId));
  assert.ok(issues.some((i) => i.text === "The quiz “Check yourself” needs questions: add them to section 1, “Part”." && i.sectionId === "s1"));
});

test("a lesson too long to keep is recognised, not mistaken for an empty one", () => {
  const long = text("word ".repeat(50_000));
  assert.equal(cleanDoc(long), null);
  assert.equal(docTooLong(long), true);
  assert.equal(docTooLong(text("Short.")), false);
  assert.equal(docTooLong({ type: "doc", content: [{ type: "paragraph" }] }), false);
  assert.equal(docTooLong(null), false);
});
