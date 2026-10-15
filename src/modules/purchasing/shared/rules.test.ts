import assert from "node:assert/strict";
import { test } from "node:test";
import { approverRoles, centsOf, euro, mayApprove, orderTotal, poNumber, rulesFor } from "./rules";

test("numbers read <site>-<month>-<running number>", () => {
  assert.equal(poNumber("BT", new Date("2026-10-15T12:00:00Z"), 42), "BT-OCT-0042");
  assert.equal(poNumber("cf", new Date("2026-09-01T12:00:00Z"), 1234), "CF-SEP-1234");
  assert.equal(poNumber("DO", new Date("2027-01-05T12:00:00Z"), 12345), "DO-JAN-12345", "past 9,999 it keeps counting");
  assert.equal(poNumber("BT", new Date("2026-10-31T23:30:00Z"), 7), "BT-OCT-0007", "Irish time: still October at 23:30 GMT");
  assert.equal(poNumber("BT", new Date("2026-06-30T23:30:00Z"), 7), "BT-JUL-0007", "Irish summer time: already July");
});

test("amounts: typed, totalled and shown in euro", () => {
  assert.equal(centsOf("12.5"), 1250);
  assert.equal(centsOf("€1,200"), 120000);
  assert.equal(centsOf("12.345"), null);
  assert.equal(centsOf("-3"), null);
  assert.equal(orderTotal([{ unitPriceCents: 250, quantity: 4 }, { unitPriceCents: 1999, quantity: 1 }]), 2999);
  assert.equal(euro(123450), "€1,234.50");
});

test("a supplier's own rules win over the ones for every supplier; the limit decides", () => {
  const rules = [
    { supplierId: null, roleId: "duty", limitCents: 50000 },
    { supplierId: null, roleId: "gm", limitCents: null },
    { supplierId: "chem", roleId: "ops", limitCents: 200000 },
  ];
  assert.deepEqual(rulesFor(rules, "chem").map((r) => r.roleId), ["ops"]);
  assert.equal(mayApprove(rules, "chem", "duty", 100), false, "the chemicals supplier has its own approvers");
  assert.equal(mayApprove(rules, "chem", "ops", 200000), true);
  assert.equal(mayApprove(rules, "chem", "ops", 200001), false, "over the limit");
  assert.equal(mayApprove(rules, "office", "duty", 50000), true);
  assert.equal(mayApprove(rules, "office", "duty", 50001), false);
  assert.equal(mayApprove(rules, "office", "gm", 9_999_999), true, "no limit");
  assert.equal(mayApprove(rules, "office", null, 1), false);
  assert.deepEqual(approverRoles(rules, "office", 10000), ["duty", "gm"], "the smallest limit first");
  assert.deepEqual(approverRoles(rules, "office", 60000), ["gm"]);
  assert.deepEqual(approverRoles(rules, "chem", 300000), [], "nobody may approve that much");
});
