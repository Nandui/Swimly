import assert from "node:assert/strict";
import { test } from "node:test";
import { staffCodeEmail, staffReminderEmail } from "./email";

/** The Turnfin Me emails: Poolside Clear v2 values, no club name, the fin only when there is a
 *  public address for it, and no markup let through from a reminder line. */
const FIN = "https://me.example.test/icon-192.png";
const code = staffCodeEmail("123456", "sign-in", FIN);
const confirm = staffCodeEmail("654321", "confirm", "");
const reminder = staffReminderEmail("Your training is due tomorrow.", "https://me.example.test/training", FIN);

test("no retired palette, club name or letter-spacing", () => {
  for (const mail of [code, confirm, reminder]) {
    for (const part of [mail.text, mail.html]) {
      for (const banned of ["LeisureWorld", "#0a5d80", "#f4f8f9", "letter-spacing"]) assert.ok(!part.includes(banned), `found ${banned}`);
    }
  }
});

test("v2 canvas, ink and 24px panel; the reminder has the blue pill", () => {
  for (const mail of [code, confirm, reminder]) {
    for (const value of ["#eef2f6", "#0f1b2d", "border-radius:24px"]) assert.ok(mail.html.includes(value), `missing ${value}`);
  }
  assert.ok(reminder.html.includes("#1d5fd1"));
  assert.ok(reminder.html.includes("border-radius:999px"));
});

test("the code is on one line, and the copy is neutral", () => {
  assert.match(code.html, /white-space:nowrap">123456</);
  assert.ok(code.text.includes("Nobody will ever ask you for this code."));
  assert.ok(confirm.text.includes("open your HR records"));
});

test("the fin appears only when there is a fin address", () => {
  assert.ok(code.html.includes(`<img src="${FIN}"`));
  assert.ok(!confirm.html.includes("<img"));
  assert.ok(confirm.html.includes("Turnfin Me</td>"));
});

test("a reminder line cannot inject markup", () => {
  const mail = staffReminderEmail("<script>alert(1)</script> & more", "https://me.example.test/", "");
  assert.ok(!mail.html.includes("<script>"));
  assert.ok(mail.html.includes("scriptalert(1)/script  more"));
});
