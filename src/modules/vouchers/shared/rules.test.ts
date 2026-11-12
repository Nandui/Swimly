import assert from "node:assert/strict";
import { test } from "node:test";
import { CODE_ALPHABET, acceptedAt, batchState, newCode, newCodes, normaliseCode, usage, voucherState } from "./rules";

const christmas = { validFrom: "2026-12-01", validUntil: "2027-01-31", voided: false };
const unused = { redeemed: false, voided: false };

test("a batch runs from its first day to its last, both included", () => {
  assert.equal(batchState(christmas, "2026-11-30"), "upcoming");
  assert.equal(batchState(christmas, "2026-12-01"), "running");
  assert.equal(batchState(christmas, "2027-01-31"), "running");
  assert.equal(batchState(christmas, "2027-02-01"), "ended");
  assert.equal(batchState({ ...christmas, voided: true }, "2026-12-25"), "void");
});

test("a voucher is valid only between its batch's days, and used wins over everything", () => {
  assert.equal(voucherState(unused, christmas, "2026-11-30"), "upcoming");
  assert.equal(voucherState(unused, christmas, "2026-12-25"), "valid");
  assert.equal(voucherState(unused, christmas, "2027-02-01"), "expired");
  assert.equal(voucherState({ redeemed: false, voided: true }, christmas, "2026-12-25"), "void");
  assert.equal(voucherState(unused, { ...christmas, voided: true }, "2026-12-25"), "void", "a cancelled batch cancels its unused vouchers");
  assert.equal(voucherState({ redeemed: true, voided: false }, { ...christmas, voided: true }, "2027-03-01"), "used", "a used voucher stays used");
});

test("codes are eight characters without look-alikes, in two groups", () => {
  let i = 0;
  const code = newCode((n) => i++ % n);
  assert.match(code, /^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
  for (const c of "01ILO") assert.equal(CODE_ALPHABET.includes(c), false, `${c} is easy to misread`);
});

test("what a person types is forgiven its spaces, dashes and case", () => {
  assert.equal(normaliseCode(" 7k3m 9qxd "), "7K3M-9QXD");
  assert.equal(normaliseCode("7K3M-9QXD"), "7K3M-9QXD");
  assert.equal(normaliseCode("7K3M9QX"), null, "too short");
  assert.equal(normaliseCode("7K3M-9QX0"), null, "0 is never in a code");
  assert.equal(normaliseCode(""), null);
});

test("a batch's codes are all different, and avoid the ones already taken", () => {
  // A draw that repeats itself: the first two codes come out the same.
  const draws = [..."AAAAAAAA", ..."AAAAAAAA", ..."BBBBBBBB", ..."CCCCCCCC"].map((c) => CODE_ALPHABET.indexOf(c));
  let i = 0;
  const codes = newCodes(2, new Set(["BBBB-BBBB"]), () => draws[i++]);
  assert.deepEqual(codes, ["AAAA-AAAA", "CCCC-CCCC"]);
});

test("a voucher is accepted only at the sites its batch names", () => {
  assert.equal(acceptedAt({ siteIds: ["a", "b"] }, "a"), true);
  assert.equal(acceptedAt({ siteIds: ["a", "b"] }, "c"), false);
});

test("usage counts used against made", () => {
  assert.deepEqual(usage(30, 12), { used: 12, unused: 18, percent: 40 });
  assert.deepEqual(usage(0, 0), { used: 0, unused: 0, percent: 0 });
});
