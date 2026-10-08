import assert from "node:assert/strict";
import test from "node:test";
import { emailSender } from "./sender";

const google = (prefix: string, from: string) => ({
  [`${prefix}_GOOGLE_CLIENT_ID`]: `${prefix}-client`, [`${prefix}_GOOGLE_CLIENT_SECRET`]: `${prefix}-secret`,
  [`${prefix}_GOOGLE_REFRESH_TOKEN`]: `${prefix}-refresh`, [`${prefix}_EMAIL_FROM`]: from,
});
const decoded = (header: string) => header.replace(/=\?UTF-8\?B\?([^?]+)\?=\s?/g, (_, b64: string) => Buffer.from(b64, "base64").toString("utf8"));

test("Turnfin's own settings come first, then the parent app's", () => {
  const both = emailSender("Turnfin Me", { ...google("PARENT", "Aquatics <parent@example.test>"), ...google("TURNFIN", "no-reply@example.test") });
  assert.equal(both?.sender, "no-reply@example.test");
  assert.equal(both?.clientId, "TURNFIN-client");
  const parentOnly = emailSender("Turnfin Me", google("PARENT", "Aquatics <parent@example.test>"));
  assert.equal(parentOnly?.sender, "parent@example.test");
  assert.equal(parentOnly?.refreshToken, "PARENT-refresh");
});

test("each module names its own email, and a name cannot add headers", () => {
  const env = google("TURNFIN", "Ignored name <no-reply@example.test>");
  assert.equal(decoded(emailSender("LeisureWorld Academy", env)!.fromHeader), "LeisureWorld Academy<no-reply@example.test>");
  assert.ok(!/[\r\n]/.test(emailSender("Bad\r\nBcc: x@example.test", env)!.fromHeader));
});

test("no mailbox, no sender", () => {
  assert.equal(emailSender("Turnfin Me", {}), null);
  assert.equal(emailSender("Turnfin Me", google("TURNFIN", "not an address")), null);
});
