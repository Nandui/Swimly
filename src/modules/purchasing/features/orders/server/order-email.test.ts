import assert from "node:assert/strict";
import test from "node:test";
import { orderEmail, type OrderEmailInput } from "./order-email";

const order: OrderEmailInput = {
  number: "PO-BT-00007", organisation: "Sample Leisure", site: "Bishopstown",
  supplier: { name: "Sample <Chemicals>", contactName: "", email: "orders@example.invalid", accountNumber: "LW-1" },
  neededBy: "20 Oct 2026", approvedOn: "15 Oct 2026", note: "Back door, <please>", totalCents: 24000,
  lines: [{ name: "Chlorine & tablets", code: "CT-25", unit: "25 kg drum", unitPriceCents: 12000, quantity: 2 }],
  sender: { name: "Sample Person", email: "sample@example.invalid" },
};

test("the email carries the order, and the HTML escapes what people typed", () => {
  const m = orderEmail(order);
  assert.equal(m.subject, "Purchase order PO-BT-00007 from Sample Leisure");
  assert.match(m.text, /^Hello Sample <Chemicals>,/);
  assert.match(m.text, /2 × Chlorine & tablets \(code CT-25\), 25 kg drum, at €120\.00: €240\.00/);
  assert.match(m.text, /Deliver to: Sample Leisure Bishopstown/);
  assert.match(m.text, /Total before VAT: €240\.00/);
  assert.ok(m.html.includes("Chlorine &#38; tablets") && m.html.includes("&#60;please&#62;"));
  assert.ok(!m.html.includes("<please>") && !m.html.includes("Test email"));
});

test("a test is the same email, saying who it would have gone to", () => {
  const t = orderEmail(order, true);
  assert.equal(t.subject, "Test: Purchase order PO-BT-00007 from Sample Leisure");
  assert.match(t.text, /^Test email\. This is exactly what Sample <Chemicals> will receive at orders@example\.invalid\./);
  assert.ok(t.text.endsWith(orderEmail(order).text));
});
