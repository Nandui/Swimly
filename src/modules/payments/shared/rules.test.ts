import assert from "node:assert/strict";
import { test } from "node:test";
import { closeChange, contactChange, monthFromFileName, parseFailureSheets, PaymentError, reopenChange, siteForClub } from "./rules";

/** The failure sheet as the bank sends it, with invented people: a heading row, the debits, blank
 *  rows and the totals underneath, and a second tab where one reference fails again for another
 *  amount, and one row appears twice. */
const HEAD = ["Club Name", "Matched", "Contact Name", "Sort Code", "Amount", "Reference", "Return Code", "Return Description", "Membership Number", "Is Processed", "Currency", "Message"];
const debit = (club: string, name: string, amount: number, ref: string, code: string, reason: string, member: string, message: string | null = null) =>
  [club, true, name, "BANKIE2D", amount, ref, code, reason, member, true, "EUR", message];
const workbook = [
  { sheet: "CF", data: [HEAD,
    debit("LW Churchfield", "Synthetic Parent", 54, "A/LWC1001", "AM04", "Insufficient Funds", "LWC1001"),
    debit("LW Bishopstown", "Example Person", 46.5, "B/LWB2002", "MD01", "No Mandate", "lwb 2002"),
    [null, null, null, null, null, null, null, null, null, null, null, null],
    [null, null, null, null, 100.5, 2, null, null, null, null, null, null],
    [null, null, null, null, 54, 1, "SWIM LESSON", null, null, null, null, null]] },
  { sheet: "BT", data: [HEAD,
    debit("LW Bishopstown", "Example Person", 20, "B/LWB2002", "MD01", "No Mandate", "LWB2002"),
    debit("LW Bishopstown", "Another Example", 65, "A/LWB3003", "AG01", "Transaction Forbidden", "LWB3003", "Mandate code does not exist"),
    debit("LW Bishopstown", "Another Example", 65, "A/LWB3003", "AG01", "Transaction Forbidden", "LWB3003", "Mandate code does not exist")] },
  { sheet: "Notes", data: [["Checked by finance"]] },
];

test("the sheet: every row is a debit, amounts in cents, totals and blank rows left out", () => {
  const rows = parseFailureSheets(workbook);
  assert.deepEqual(rows.map((r) => r.reference), ["A/LWC1001", "B/LWB2002", "B/LWB2002", "A/LWB3003", "A/LWB3003"]);
  assert.deepEqual(rows.map((r) => r.amountCents), [5400, 4650, 2000, 6500, 6500]);
  assert.deepEqual(rows.map((r) => r.copy), [1, 1, 1, 1, 2], "the same reference and amount again is a second copy");
  assert.equal(rows[1].memberNumber, "LWB2002", "member numbers in capitals without spaces");
  assert.equal(rows[3].returnReason, "Transaction Forbidden. Mandate code does not exist", "the bank's message joins its reason");
  assert.equal(rows[0].club, "LW Churchfield");
});

test("the sheet: a file without the columns, or a debit without an amount, is refused in words", () => {
  assert.throws(() => parseFailureSheets([{ sheet: "Data", data: [["Name", "Total"], ["x", 1]] }]), PaymentError);
  assert.throws(() => parseFailureSheets([{ sheet: "CF", data: [HEAD, debit("LW Churchfield", "Synthetic", 0, "A/1", "AM04", "", "1")] }]), /Row 2 on CF/);
});

test("club names find their site, by name without LW or by code; two or none is no match", () => {
  const sites = [{ id: "b", name: "Bishopstown", code: "BT" }, { id: "c", name: "Churchfield", code: "CF" }, { id: "d", name: "LeisureWorld Douglas", code: "DO" }];
  assert.equal(siteForClub("LW Churchfield", sites)?.id, "c");
  assert.equal(siteForClub("LW Douglas", sites)?.id, "d");
  assert.equal(siteForClub("bishopstown", sites)?.id, "b");
  assert.equal(siteForClub("BT", sites)?.id, "b");
  assert.equal(siteForClub("LW Riverside", sites), null);
  assert.equal(siteForClub("LW", sites), null);
});

test("the month comes from the file's name: this year, or last year for a month still to come", () => {
  assert.equal(monthFromFileName("Failed Lessons 09.xlsx", "2026-11-02"), "2026-09");
  assert.equal(monthFromFileName("Failed Lessons 12.xlsx", "2027-01-05"), "2026-12");
  assert.equal(monthFromFileName("failures 2026 03.xlsx", "2026-04-01"), "2026-03");
  assert.equal(monthFromFileName("Failed Lessons.xlsx", "2026-11-02"), "");
  assert.equal(monthFromFileName("Failed Lessons 09 (1).xlsx", "2026-11-02"), "2026-09", "a browser's copy number is not the month");
});

test("following up: contacts count while open; closing needs an open payment, cancelling a reason; reopening goes back to where it was", () => {
  const now = new Date("2026-11-02T10:00:00Z"), who = { id: "u1", name: "Synthetic" };
  assert.deepEqual(contactChange("to_contact", now), { status: "contacted", attempts: { increment: 1 }, lastContactAt: now });
  assert.throws(() => contactChange("paid", now), PaymentError);
  assert.equal(closeChange("contacted", "paid", "", who, now).status, "paid");
  assert.throws(() => closeChange("contacted", "cancelled", "", who, now), /Say why/);
  assert.throws(() => closeChange("new_mandate", "paid", "", who, now), PaymentError);
  assert.equal(reopenChange("paid", 2).status, "contacted");
  assert.equal(reopenChange("cancelled", 0).status, "to_contact");
  assert.throws(() => reopenChange("to_contact", 0), PaymentError);
});
