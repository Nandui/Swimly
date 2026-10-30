import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cleanDoc, docActivities, frozenOutline, learnerDoc, lessonFiles, lessonText, MAX_ACTIVITY_BLOCKS, publishProblems, readOutline, type DocNode,
} from "../shared/lessons";

/** Several things in one lesson (owner decision, 29 October 2026): recordings,
 *  slides, files shown in place and activities in any lesson's text. Pure rules. */

const p = (text: string): DocNode => ({ type: "paragraph", content: [{ type: "text", text }] });
const doc = (...content: DocNode[]): DocNode => ({ type: "doc", content });
const SLIDES = "https://docs.google.com/presentation/d/1AbCdEfGhIjKlMnOp/edit";
const checklist = (id: string, items: string[]): DocNode => ({ type: "activity", attrs: { id, kind: "CHECKLIST", data: { items: items.map((text, i) => ({ id: `i${i}`, text })) } } });
const scenario: DocNode = { type: "activity", attrs: { id: "sc1", kind: "SCENARIO", data: { steps: [
  { id: "s1", text: "The alarm sounds.", imageId: "pic1", choices: [{ id: "c1", text: "Clear the pool", feedback: "Right.", next: null, best: true }, { id: "c2", text: "Wait", feedback: "No.", next: null, best: false }] },
] } } };
const lesson = (body: DocNode | null, kind = "READING") => ({ id: "l1", kind, title: "Opening up", body, videoUrl: "", fileId: null, minutes: null, data: null });
const outline = (body: DocNode | null, kind = "READING") => readOutline({ exam: null, questions: [], sections: [{ id: "s1", title: "Start", lessons: [lesson(body, kind)] }] });

test("audio, slides, files and activities survive cleaning; unsafe ones don't", () => {
  const body = cleanDoc(doc(
    p("Listen while you go through the slides."),
    { type: "audioBlock", attrs: { fileId: "rec1", transcript: "Good morning team.", onplay: "x" } },
    { type: "slidesBlock", attrs: { url: SLIDES } },
    { type: "slidesBlock", attrs: { url: "https://example.com/deck" } },
    { type: "fileView", attrs: { fileId: "pdf1" } },
    { type: "fileView", attrs: { fileId: "../etc" } },
    checklist("ck1", ["Lights on", "Doors open"]),
    { type: "activity", attrs: { id: "bad", kind: "READING", data: {} } },
  ));
  assert.ok(body);
  assert.deepEqual(body.content?.map((n) => n.type), ["paragraph", "audioBlock", "slidesBlock", "fileView", "activity"], "unknown slides, a bad file id and a kind that is no activity go");
  assert.deepEqual(body.content?.[1].attrs, { fileId: "rec1", transcript: "Good morning team." });
  assert.deepEqual(docActivities(body).map((b) => [b.id, b.kind]), [["ck1", "CHECKLIST"]]);
  assert.ok(cleanDoc(doc({ type: "audioBlock", attrs: { fileId: "rec1", transcript: "" } })), "a recording on its own is not empty text");
});

test("activities only count straight under the text, never inside a tab", () => {
  const body = cleanDoc(doc(
    { type: "tabs", content: [{ type: "tab", content: [{ type: "tabTitle", content: [{ type: "text", text: "Day" }] }, { type: "tabContent", content: [p("Open up."), checklist("hidden", ["x"])] }] }] },
    { type: "tabs", content: [{ type: "tab", content: [{ type: "tabTitle", content: [{ type: "text", text: "Night" }] }, { type: "tabContent", content: [{ type: "audioBlock", attrs: { fileId: "rec1", transcript: "" } }] }] }] },
  ));
  assert.equal(docActivities(body).length, 0);
  assert.equal(JSON.stringify(body).includes("hidden"), false, "a hidden activity is dropped");
  assert.equal(JSON.stringify(body).includes("audioBlock"), true, "media may sit inside a tab");
});

test("publishing checks each activity and the limit of six", () => {
  assert.deepEqual(publishProblems(frozenOutline(outline(doc(p("Hi"), checklist("ck1", ["Lights on"]))))), []);
  const empty = publishProblems(frozenOutline(outline(doc(p("Hi"), checklist("ck1", [""])))));
  assert.deepEqual(empty, ["“Checklist in Opening up” needs at least one thing to tick off."]);
  const many = doc(p("Hi"), ...Array.from({ length: MAX_ACTIVITY_BLOCKS + 1 }, (_, i) => checklist(`ck${i}`, ["Tick"])));
  assert.ok(publishProblems(frozenOutline(outline(many))).some((x) => x.includes(`up to ${MAX_ACTIVITY_BLOCKS}`)));
  const two = publishProblems(frozenOutline(outline(doc(p("Hi"), checklist("a", ["x"]), checklist("b", [""])))));
  assert.deepEqual(two, ["“Checklist 2 in Opening up” needs at least one thing to tick off."], "two of a kind are numbered");
  assert.deepEqual(publishProblems(frozenOutline(outline(doc(checklist("a", ["x"])), "EMBED"))).filter((x) => x.includes("Checklist")), [], "any lesson kind can hold activities");
});

test("publishing drops activity rows left empty in the draft", () => {
  const frozen = frozenOutline(outline(doc(checklist("ck1", ["Lights on", ""]))));
  assert.deepEqual(docActivities(frozen.sections[0].lessons[0].body)[0].data?.items?.map((i) => i.text), ["Lights on"]);
});

test("block files and words belong to the lesson", () => {
  const body = cleanDoc(doc({ type: "audioBlock", attrs: { fileId: "rec1", transcript: "Morning ✎ team" } }, { type: "fileView", attrs: { fileId: "pdf1" } }, scenario,
    { type: "activity", attrs: { id: "ex1", kind: "EXPLORE", fileId: "plan1", data: { spots: [{ id: "a", x: 10, y: 10, title: "Pump", text: "" }] } } }));
  assert.deepEqual(lessonFiles({ fileId: null, body, data: null }).sort(), ["pdf1", "pic1", "plan1", "rec1"]);
  assert.ok(lessonText({ body, data: null }).includes("Clear the pool"));
  assert.ok(publishProblems(outline(body)).some((x) => x.includes("template text")), "template marks in a transcript are caught");
});

test("learners get slides they can play and scenarios that keep the best ending hidden", () => {
  const scene = { ...scenario, attrs: { ...scenario.attrs, data: { steps: [{ id: "s1", text: "Alarm", imageId: null, choices: [
    { id: "c1", text: "Go on", feedback: "", next: "s2", best: true }, { id: "c2", text: "Stop", feedback: "", next: null, best: true },
  ] }, { id: "s2", text: "Then", imageId: null, choices: [{ id: "c3", text: "End", feedback: "", next: null, best: true }] }] } } };
  const body = learnerDoc(cleanDoc(doc({ type: "slidesBlock", attrs: { url: SLIDES } }, scene)));
  assert.equal((body?.content?.[0].attrs?.embed as { provider: string }).provider, "Google Slides");
  const steps = (body?.content?.[1].attrs?.data as { steps: { choices: { best: boolean }[] }[] }).steps;
  assert.equal(steps[0].choices[0].best, false, "a choice that leads on is never marked best");
});
