import assert from "node:assert/strict";
import { test } from "node:test";
import { coverAskSchema, offerLine, openRequestFor, shiftCovering, stillToCover } from "@/modules/plan/shared/cover";

const h = (n: number) => n * 60;

test("one ask at a time for a need: an open request over some of the stretch is found", () => {
  const open = [{ needKey: "s:swim:guard", start: h(9), end: h(12) }];
  assert.equal(openRequestFor(open, "s:swim:guard", { start: h(11), end: h(13) }), open[0]);
  assert.equal(openRequestFor(open, "s:swim:guard", { start: h(12), end: h(13) }), null, "touching is not overlapping");
  assert.equal(openRequestFor(open, "s:swim:desk", { start: h(9), end: h(12) }), null, "another duty is another need");
});

test("what is still to cover is the asked stretch inside the need as it runs now", () => {
  assert.deepEqual(stillToCover({ start: h(9), end: h(12) }, { start: h(10), end: h(14) }), { start: h(10), end: h(12) });
  assert.equal(stillToCover({ start: h(9), end: h(12) }, { start: h(12), end: h(14) }), null, "the session moved past it");
  assert.equal(stillToCover({ start: h(9), end: h(12) }, null), null, "the session is off that day");
});

test("a chosen person's shift takes the stretch in: new, grown, or left alone", () => {
  assert.deepEqual(shiftCovering(null, { start: h(9), end: h(12) }), { start: h(9), end: h(12), changed: true });
  assert.deepEqual(shiftCovering({ start: h(10), end: h(14) }, { start: h(9), end: h(12) }), { start: h(9), end: h(14), changed: true });
  assert.deepEqual(shiftCovering({ start: h(8), end: h(14) }, { start: h(9), end: h(12) }), { start: h(8), end: h(14), changed: false });
});

test("answers read as one line", () => {
  assert.equal(offerLine([]), "No answers yet");
  assert.equal(offerLine([{ answer: "yes" }, { answer: "yes" }, { answer: "no" }]), "2 can cover · 1 can't");
  assert.equal(offerLine([{ answer: "no" }]), "1 can't");
});

test("asking needs a day, a need and a stretch that ends after it starts", () => {
  const ask = { siteId: "site", date: "2026-11-14", needKey: "s:swim:guard", start: h(9), end: h(12) };
  assert.equal(coverAskSchema.safeParse(ask).success, true);
  assert.equal(coverAskSchema.safeParse({ ...ask, end: h(9) }).success, false);
  assert.equal(coverAskSchema.safeParse({ ...ask, date: "tomorrow" }).success, false);
  assert.equal(coverAskSchema.parse({ ...ask, departmentId: "" }).departmentId, null);
});
