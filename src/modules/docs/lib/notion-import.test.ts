import assert from "node:assert/strict";
import { test } from "node:test";
import { validateBody } from "./content";
import { parseNotionPage, reviewDateFrom } from "./notion-import";

/** Invented pages in the shapes Notion produces. */
const EXPORTED = [
  "# [OPS-BT-MA-SOP-99] Sample Evacuation SOP",
  "",
  "Owner: Sample Owner",
  "Tags: SOP, Bishopstown",
  "Verification: Verified",
  "",
  "**Status:** Issued | **Version:** 3.0 | **Next review:** June 2027",
  "",
  "# 1. Purpose",
  "",
  "To move everyone out safely.",
  "",
  "# 2. Scope",
  "",
  "- The whole sample site.",
].join("\n");

const CONNECTOR = `<page url="x">
<properties>
{"Verification":"verified","title":"\\\\[OPS-BT-CL-SOP-98\\\\] Sample Cleaning SOP","Tags":"[\\"SOP\\",\\"Cleaning\\",\\"Draft\\"]"}
</properties>
<content>
**Status:** Draft \\| **Next review:** 2027-03-31
Applies to: the sample changing rooms
# 2. Scope
Every cubicle.
</content>
</page>`;

test("an exported page gives reference, title, type, status, review date and summary", () => {
  const page = parseNotionPage(EXPORTED, "", "2026-09-29");
  assert.deepEqual([page.reference, page.title, page.type, page.draft, page.reviewDate, page.summary, page.tags],
    ["OPS-BT-MA-SOP-99", "Sample Evacuation SOP", "SOP", false, "2027-06-01", "To move everyone out safely.", ["SOP", "Bishopstown"]]);
  assert.doesNotThrow(() => validateBody(page.body));
  assert.equal(page.body.content![0].type, "paragraph", "the property lines are not part of the body");
});

test("the connector's page text is read too; a Draft tag keeps it a draft", () => {
  const page = parseNotionPage(CONNECTOR, "", "2026-09-29");
  assert.deepEqual([page.reference, page.title, page.draft, page.reviewDate, page.summary],
    ["OPS-BT-CL-SOP-98", "Sample Cleaning SOP", true, "2027-03-31", "Applies to the sample changing rooms"]);
});

test("the NOP and EAPs get their own types; no review date means a year from today", () => {
  assert.equal(parseNotionPage("# [OPS-BT-NOP] Normal Operating Procedure\n\nTags: Bishopstown, NOP\n\nText.").type, "NOP");
  const eap = parseNotionPage("# [OPS-BT-MA-SOP-23] Missing Person and Child EAP\n\nText.", "", "2026-09-29");
  assert.deepEqual([eap.type, eap.reviewDate], ["EAP", "2027-09-29"]);
  assert.equal(reviewDateFrom("September 2026"), "2026-09-01");
});
