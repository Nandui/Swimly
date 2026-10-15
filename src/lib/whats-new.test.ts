import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { boldRuns, parseReleaseNotes } from "./whats-new";

test("parses releases, lists, headings and plain lines", () => {
  const notes = parseReleaseNotes([
    "# What's new in Turnfin",
    "",
    "Patch notes for everyone.",
    "",
    "## 1.2.0 · 7 October 2026 · Two things",
    "",
    "Nothing changes for you.",
    "",
    "**Tasks**",
    "- One",
    "  carried on",
    "- Two",
    "",
    "## 1.1.0 · 6 October 2026 · First",
    "",
    "- Only",
  ].join("\n"));
  assert.deepEqual(notes.intro, ["Patch notes for everyone."]);
  assert.equal(notes.releases.length, 2);
  assert.deepEqual(notes.releases[0], {
    version: "1.2.0",
    date: "7 October 2026",
    title: "Two things",
    blocks: [
      { kind: "text", text: "Nothing changes for you." },
      { kind: "heading", text: "Tasks" },
      { kind: "list", items: ["One carried on", "Two"] },
    ],
  });
});

test("bold runs", () => {
  assert.deepEqual(boldRuns("Press **Save** now"), [
    { text: "Press ", bold: false },
    { text: "Save", bold: true },
    { text: " now", bold: false },
  ]);
});

test("CHANGELOG.md reads cleanly and its newest release is the app's version", () => {
  const notes = parseReleaseNotes(readFileSync("CHANGELOG.md", "utf8"));
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
  assert.equal(notes.releases[0]?.version, pkg.version);
  for (const release of notes.releases) assert.ok(release.blocks.length > 0, `${release.version} has notes`);
});
