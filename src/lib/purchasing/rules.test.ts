import assert from "node:assert/strict";
import { test } from "node:test";
import { approverRoles, centsOf, euro, mayApprove, orderTotal, poNumber, rulesFor } from "./rules";

test("numbers read PO-<site>-<five digits>, in sequence", () => {
  assert.equal(poNumber("BT", 1), "PO-BT-00001");
  assert.equal(poNumber("CF", 1234), "PO-CF-01234");
  assert.equal(poNumber("DO", 123456), "PO-DO-123456", "past 99,999 it keeps counting");
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
