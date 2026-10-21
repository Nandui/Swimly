import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { validateBody } from "@/modules/docs/shared/content";
import { textOf } from "@/modules/docs/features/import/server/markdown";
import { parseNotionPage } from "@/modules/docs/features/import/server/notion-import";

/** The HR procedures kept in the repository (docs-content/hr-procedures) come
 *  into Docs through the import script as drafts, so each must read cleanly. */
const FOLDER = "docs-content/hr-procedures";
const files = readdirSync(FOLDER).filter((name) => name.endsWith(".md")).sort();

test("every HR procedure reads as a valid Docs draft SOP", () => {
  assert.ok(files.length >= 10);
  const references = new Set<string>();
  for (const name of files) {
    const page = parseNotionPage(readFileSync(join(FOLDER, name), "utf8"), name, "2026-10-21");
    assert.match(page.reference, /^HR-SOP-\d{2}$/, name);
    assert.ok(name.startsWith(page.reference), `${name} is named after its reference`);
    assert.ok(!references.has(page.reference), `${page.reference} is used once`);
    references.add(page.reference);
    assert.equal(page.type, "SOP", name);
    assert.equal(page.draft, true, `${name} stays a draft until its gaps are filled in`);
    assert.equal(page.reviewDate, "2027-10-01", name);
    assert.ok(page.summary.length > 40 && !page.summary.startsWith("Applies to"), `${name} has a Purpose`);
    assert.doesNotThrow(() => validateBody(page.body), name);
  }
});

test("only the overview carries the not-legal-advice note", () => {
  const withNote = files.filter((name) => /not legal advice/i.test(textOf(parseNotionPage(readFileSync(join(FOLDER, name), "utf8"), name).body)));
  assert.deepEqual(withNote, files.filter((name) => name.startsWith("HR-SOP-00")));
});
