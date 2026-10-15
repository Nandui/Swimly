import assert from "node:assert/strict";
import test from "node:test";
import { orderEmail, type OrderEmailInput } from "./order-email";

const order: OrderEmailInput = {
  number: "PO-BT-00007", organisation: "Sample Leisure", site: "Bishopstown",
  supplier: { name: "Sample <Chemicals>", contactName: "", email: "orders@example.invalid", accountNumber: "LW-1" },
  neededBy: "20 Oct 2026", approvedOn: "15 Oct 2026", note: "Back door, <please>",
  lines: [
    { name: "Chlorine & tablets", code: "CT-25", unit: "25 kg drum", brand: "", size: "", colour: "", quantity: 2 },
    { name: "Training suit", code: "TS-1", unit: "", brand: "Speedo", size: "30", colour: "Navy", quantity: 3 },
  ],
  sender: { name: "Sample Person", email: "sample@example.invalid" },
};

test("the email carries the order without prices, and says where invoices go", () => {
  const m = orderEmail(order);
  assert.equal(m.subject, "Purchase order PO-BT-00007 from Sample Leisure");
  assert.match(m.text, /^Hello Sample <Chemicals>,/);
  assert.match(m.text, /2 × Chlorine & tablets \(code CT-25\), 25 kg drum\r\n/);
  assert.match(m.text, /3 × Training suit, Speedo · Size 30 · Navy \(code TS-1\), each\r\n/);
  assert.ok(m.html.includes("Speedo · Size 30 · Navy"), "the brand, size and colour are on the line");
  assert.match(m.text, /Deliver to: Sample Leisure Bishopstown/);
  assert.ok(!/€|VAT|price/i.test(m.text + m.html), "no prices or totals");
  assert.match(m.text, /INVOICES: Please submit all invoices for this order to invoices@leisureworldcork\.com, quoting PO-BT-00007\./);
  assert.ok(m.html.includes("mailto:invoices@leisureworldcork.com"));
  assert.ok(m.html.includes("Chlorine &#38; tablets") && m.html.includes("&#60;please&#62;"));
  assert.ok(!m.html.includes("<please>") && !m.html.includes("Test email"));
  assert.ok(m.html.includes('src="cid:leisureworld-logo@turnfin"'), "the logo is carried inside the email");
  assert.ok(orderEmail(order, false, "/purchasing/email-logo").html.includes('src="/purchasing/email-logo"'), "the preview shows it from Turnfin");
});

test("a test is the same email, saying who it would have gone to", () => {
  const t = orderEmail(order, true);
  assert.equal(t.subject, "Test: Purchase order PO-BT-00007 from Sample Leisure");
  assert.match(t.text, /^Test email\. This is exactly what Sample <Chemicals> will receive at orders@example\.invalid\./);
  assert.ok(t.text.endsWith(orderEmail(order).text));
});
