import assert from "node:assert/strict";
import { test } from "node:test";
import { CCTV_REASON_META as frontDoorReasons } from "@/modules/cctv";
import { CCTV_REASON_META, CCTV_REASONS, incidentLabel, noteSchema, parseIncidentNumber, reasonMeta, viewingNumber, viewingProblem, viewingSchema, type ViewingInput } from "./rules";

/** The CCTV log's pure rules, at their edges: the incident number in the ways people type it, the
 *  times an entry may give, notes, and how numbers and reasons show. The main cases are in
 *  __tests__/cctv.test.ts. */
const entry = (change: Partial<ViewingInput> = {}): ViewingInput => ({
  siteId: "site", viewedOn: "2026-10-21", viewedAt: "10:30", checkedBy: "Duty manager", othersPresent: "", reason: "theft",
  background: "A member reported a bag missing from a locker.", purpose: "Whether anyone opened locker 14",
  cameras: "Camera 3, changing village corridor", footageOn: "2026-10-21", footageFrom: "08:00", footageTo: "09:00",
  findings: "Nobody went near locker 14 in that hour.", copies: "", incident: "", ...change,
});
const problem = (change: Partial<ViewingInput>, today = "2026-10-21") => viewingProblem(viewingSchema.parse(entry(change)), today);

test("an incident number is read the ways people type it, and anything else is refused", () => {
  for (const typed of ["INC-00042", "inc 42", "Inc-42", "INC42", "  42 ", "00042"]) assert.equal(parseIncidentNumber(typed), 42, typed);
  for (const typed of ["0", "INC-0", "INC-", "-42", "4.2", "INC-42a", "1234567890", "CCTV-00042"]) assert.equal(parseIncidentNumber(typed), undefined, typed);
  assert.equal(parseIncidentNumber("   "), null);
  assert.match(problem({ incident: "INC-forty" })!, /incident report's number/);
  assert.equal(problem({ incident: "inc 42" }), null);
});

test("times: footage that ends when it starts is refused, the same day as the check is fine, and clocks are hours and minutes", () => {
  assert.match(problem({ footageFrom: "09:00", footageTo: "09:00" })!, /end time must be after/);
  assert.equal(problem({ footageFrom: "23:00", footageTo: "23:59" }), null);
  assert.equal(problem({ viewedOn: "2026-10-21", footageOn: "2026-10-21" }), null, "checked on the day it was filmed");
  assert.equal(problem({ viewedOn: "2026-10-21", footageOn: "2026-10-01" }), null, "older footage");
  assert.match(problem({ viewedOn: "2026-10-22", footageOn: "2026-10-22" })!, /future/);
  for (const clock of ["24:00", "9:30", "10:60", "10.30", ""]) assert.ok(!viewingSchema.safeParse(entry({ viewedAt: clock })).success, clock);
  assert.ok(!viewingSchema.safeParse(entry({ viewedOn: "2026-02-30" })).success, "a day that does not exist");
  assert.ok(!viewingSchema.safeParse(entry({ siteId: "" })).success, "a site is required");
});

test("an entry says enough: who checked, what led to it, what was looked for, which cameras, what was seen", () => {
  for (const [field, short] of [["checkedBy", "A"], ["background", "Bag gone"], ["purpose", "Bag"], ["cameras", "3"], ["findings", "None"]] as const) {
    const parsed = viewingSchema.safeParse(entry({ [field]: short }));
    assert.ok(!parsed.success, `${field} too short`);
  }
  const parsed = viewingSchema.parse(entry({ checkedBy: "  Duty manager  ", othersPresent: undefined, copies: undefined, incident: undefined }));
  assert.equal(parsed.checkedBy, "Duty manager", "trimmed");
  assert.deepEqual([parsed.othersPresent, parsed.copies, parsed.incident], ["", "", ""], "optional fields default to empty");
});

test("a note says something, and not too much", () => {
  assert.ok(!noteSchema.safeParse("  ok ").success, "under three letters once trimmed");
  assert.equal(noteSchema.parse("  Copy given to the Garda.  "), "Copy given to the Garda.");
  assert.ok(noteSchema.safeParse("x".repeat(2000)).success);
  assert.ok(!noteSchema.safeParse("x".repeat(2001)).success);
});

test("every reason has a label in the form's order, an unknown one shows as something else, and numbers read like incidents'", () => {
  assert.equal(frontDoorReasons, CCTV_REASON_META);
  assert.deepEqual(Object.keys(CCTV_REASON_META), [...CCTV_REASONS]);
  assert.equal(CCTV_REASON_META.safeguarding.color, "red", "safeguarding stands out");
  assert.equal(reasonMeta("garda"), CCTV_REASON_META.garda);
  assert.equal(reasonMeta("curiosity"), CCTV_REASON_META.other);
  assert.equal(viewingNumber(42), "CCTV-00042");
  assert.equal(incidentLabel(42), "INC-00042");
  assert.equal(parseIncidentNumber(incidentLabel(123456)), 123456, "a label reads back as its number");
});
