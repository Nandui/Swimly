import assert from "node:assert/strict";
import { test } from "node:test";
import { validateBody } from "./content";
import { firstParagraphAfter, inline, markdownToDoc, textOf } from "./markdown";

/** Shapes taken from the Notion SOP register; the wording is invented. */
const SAMPLE = [
  "**Status:** Issued \\| **Version:** 3.0 \\| **Next review:** June 2027",
  "<columns>",
  "\t<column>",
  "\t\tDocument owner: Duty Manager",
  "\t\tApplies to: the sample site",
  "\t</column>",
  "</columns>",
  "# 1. Purpose",
  "To keep everyone **safe** at the sample site.",
  "# 7. Procedure",
  "### Step 1 — Decide",
  "1. Alarm sounds.",
  "2. Roll call:",
  "\t- Staff: headcount against \\[OPS-BT-MA-SOP-09\\].",
  "\t- Visitors: the sign-in book.",
  "3. Record it.",
  "- [ ] Checked the panel",
  "- [x] Called 999",
  "| Area | Owner |",
  "| --- | --- |",
  "| Pool | Lifeguard \\| senior |",
  "<callout icon=\"⚠️\" color=\"red_bg\">",
  "\tDo **not** re-enter.",
  "</callout>",
  "> Quoted guidance",
  "See [the policy](https://example.com/policy) and [a Notion page](Other%20page.md).",
].join("\n");

test("a Notion SOP becomes a valid Docs body", () => {
  const doc = markdownToDoc(SAMPLE);
  assert.doesNotThrow(() => validateBody(doc));
  const types = (doc.content ?? []).map((n) => n.type);
  assert.deepEqual(types, ["paragraph", "paragraph", "paragraph", "heading", "paragraph", "heading", "heading", "orderedList", "taskList", "table", "callout", "blockquote", "paragraph"]);
});

test("escapes, emphasis and links survive; relative links keep their words", () => {
  assert.deepEqual(inline("**Status:** Issued \\| v3"), [
    { type: "text", text: "Status:", marks: [{ type: "bold" }] },
    { type: "text", text: " Issued | v3" },
  ]);
  const doc = markdownToDoc(SAMPLE);
  const last = doc.content!.at(-1)!;
  assert.equal(textOf(last), "See the policy and a Notion page.");
  assert.deepEqual(last.content![1].marks, [{ type: "link", attrs: { href: "https://example.com/policy" } }]);
});

test("numbered steps keep their nested bullets", () => {
  const doc = markdownToDoc(SAMPLE);
  const steps = doc.content!.find((n) => n.type === "orderedList")!;
  assert.equal(steps.content!.length, 3);
  const nested = steps.content![1].content![1];
  assert.equal(nested.type, "bulletList");
  assert.equal(textOf(nested.content![0]), "Staff: headcount against [OPS-BT-MA-SOP-09].");
});

test("tables keep escaped pipes inside cells; callouts carry their kind", () => {
  const doc = markdownToDoc(SAMPLE);
  const table = doc.content!.find((n) => n.type === "table")!;
  assert.equal(table.content![0].content![0].type, "tableHeader");
  assert.equal(textOf(table.content![1].content![1]), "Lifeguard | senior");
  const callout = doc.content!.find((n) => n.type === "callout")!;
  assert.equal(callout.attrs!.kind, "warning");
});

test("the purpose gives a summary", () => {
  assert.equal(firstParagraphAfter(markdownToDoc(SAMPLE), /purpose/i), "To keep everyone safe at the sample site.");
});
