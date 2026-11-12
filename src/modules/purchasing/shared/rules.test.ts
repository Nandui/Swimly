import assert from "node:assert/strict";
import { test } from "node:test";
import {
  APPROVAL_LIST_META, approverRoles, centsOf, copyList, EDITABLE, euro, lineDetails, MAX_COPY_TO, mayApprove, MONTHS, optionsOf, orderTotal, PO_EMAIL_META, PO_STATUS_META, poNumber, rulesFor,
  SUPPLIER_EMAILS_META, variantProblem,
} from "./rules";

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

test("retail details: sizes and colours typed as a list, shown as one phrase", () => {
  assert.deepEqual(optionsOf(" S, M ,, l, m, X  L "), ["S", "M", "l", "X L"]);
  assert.deepEqual(optionsOf(""), []);
  assert.equal(lineDetails({ brand: "Speedo", size: "30", colour: "Navy" }), "Speedo · Size 30 · Navy");
  assert.equal(lineDetails({ brand: "", size: "", colour: "" }), "");
});

test("an order line picks one of the product's sizes and colours, or none when it has none", () => {
  const suit = { name: "Suit", sizes: ["28", "30"], colours: ["Navy"] };
  assert.equal(variantProblem(suit, { size: "30", colour: "Navy" }), null);
  assert.equal(variantProblem(suit, { size: "", colour: "Navy" }), "Choose a size for Suit.");
  assert.equal(variantProblem(suit, { size: "30", colour: "Red" }), "Choose a colour for Suit.");
  const chlorine = { name: "Chlorine", sizes: [], colours: [] };
  assert.equal(variantProblem(chlorine, { size: "", colour: "" }), null);
  assert.equal(variantProblem(chlorine, { size: "M", colour: "" }), "Chlorine has no sizes.");
});

test("the requester changes an order only while it is a draft or after it is rejected", () => {
  assert.deepEqual([...EDITABLE], ["draft", "rejected"]);
  for (const status of EDITABLE) assert.ok(Object.hasOwn(PO_STATUS_META, status));
  assert.equal(EDITABLE.includes("pending"), false, "waiting for approval, it is the approver's");
  assert.equal(EDITABLE.includes("approved"), false, "approved is final");
});

test("every tag has its own icon, so colour is never the only signal", () => {
  for (const meta of [PO_STATUS_META, APPROVAL_LIST_META, PO_EMAIL_META, SUPPLIER_EMAILS_META]) {
    const tags = Object.values(meta);
    assert.equal(new Set(tags.map((t) => t.icon)).size, tags.length);
    for (const t of tags) assert.ok(t.label.length > 1);
  }
  assert.equal(MONTHS.length, 12);
  assert.equal(new Set(MONTHS).size, 12);
});

test("amounts typed with spaces or nothing at all", () => {
  assert.equal(centsOf(" 12 "), 1200);
  assert.equal(centsOf("0"), 0);
  assert.equal(centsOf(""), null);
  assert.equal(centsOf("12."), null);
  assert.equal(centsOf("twelve"), null);
  assert.equal(orderTotal([]), 0);
});

test("Copy to: addresses split by commas, semicolons or spaces, each once whatever its case, in the order given", () => {
  assert.deepEqual(copyList(" gina@example.invalid; accounts@example.invalid,GINA@example.invalid  ops@example.invalid\n"), ["gina@example.invalid", "accounts@example.invalid", "ops@example.invalid"]);
  assert.deepEqual(copyList(""), []);
  assert.deepEqual(copyList(" , ; "), []);
  assert.equal(MAX_COPY_TO, 5, "a few, not a mailing list");
});
