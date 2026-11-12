import assert from "node:assert/strict";
import { test } from "node:test";
import { familyEmailHtml, familyEmailText } from "@/modules/activities/shared/parents/family-email";
import { nextEmail, paymentEmail, type PaymentEmailFacts } from "./emails";

/** The failed payment warning emails, with an invented family: when each is due, and what each says. */
const facts: PaymentEmailFacts = { greet: "Synthetic Parent", child: "Casey", amountCents: 5400, month: "2026-09", returnCode: "AM04",
  site: "Churchfield", phone: "021 000 0000", firstEmailOn: null, sentOn: "2026-11-03" };

test("the first email any time; the reminder 3 days and the final notice 7 days after the first; nothing once closed or all sent", () => {
  assert.deepEqual(nextEmail({ status: "to_contact", emailsSent: 0, firstEmailOn: null }, "2026-11-03"), { step: 1, dueOn: "2026-11-03", due: true });
  assert.deepEqual(nextEmail({ status: "contacted", emailsSent: 1, firstEmailOn: "2026-11-03" }, "2026-11-05"), { step: 2, dueOn: "2026-11-06", due: false });
  assert.equal(nextEmail({ status: "contacted", emailsSent: 1, firstEmailOn: "2026-11-03" }, "2026-11-06")?.due, true);
  assert.deepEqual(nextEmail({ status: "contacted", emailsSent: 2, firstEmailOn: "2026-11-03" }, "2026-11-10"), { step: 3, dueOn: "2026-11-10", due: true });
  assert.equal(nextEmail({ status: "contacted", emailsSent: 3, firstEmailOn: "2026-11-03" }, "2026-12-01"), null);
  assert.equal(nextEmail({ status: "paid", emailsSent: 1, firstEmailOn: "2026-11-03" }, "2026-12-01"), null);
});

test("the first email: the swimmer, amount, month and the bank's reason in plain words, and how to pay", () => {
  const { subject, email } = paymentEmail(1, facts);
  assert.equal(subject, "Casey's swimming lesson payment didn't go through");
  const text = familyEmailText(email);
  for (const part of ["Hello Synthetic Parent,", "€54.00", "September 2026", "Not enough money in the account", "021 000 0000", "already paid"]) assert.ok(text.includes(part), part);
  assert.equal(email.tone, "info");
});

test("the reminder gives the first email's day and a pay-by 7 days after it; the final notice gives 3 days and the place", () => {
  const reminder = familyEmailText(paymentEmail(2, { ...facts, firstEmailOn: "2026-11-03", sentOn: "2026-11-06" }).email);
  assert.match(reminder, /We wrote to you on Tuesday 3 November( 2026)? because/);
  assert.match(reminder, /Please pay by: Tuesday 10 November( 2026)?\r\n/);
  const final = paymentEmail(3, { ...facts, firstEmailOn: "2026-11-03", sentOn: "2026-11-10" });
  assert.equal(final.subject, "Final notice: Casey's swimming place");
  assert.match(familyEmailText(final.email), /by Friday 13 November( 2026)?, Casey's place in their class may be cancelled/);
  assert.equal(final.email.tone, "final");
});

test("no phone: pay at the site's reception; an unknown reason is left out; names are escaped in the HTML", () => {
  const { email } = paymentEmail(1, { ...facts, phone: "", returnCode: "ZZ99", greet: "<b>Parent</b>" });
  const text = familyEmailText(email);
  assert.match(text, /You can pay at reception at Churchfield\./);
  assert.ok(!text.includes("Bank's reason"));
  assert.ok(!familyEmailHtml(email).includes("<b>Parent</b>"));
});
