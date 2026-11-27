import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { readPass, turnfinConfig } from "./pass";

const secret = "example-secret-for-tests-only-0123456789";
const state = "state-for-tests-0123456789";
/** One second before the example's expiry, and one second after. */
const inTime = new Date(1795770059_000);
const tooLate = new Date(1795770061_000);

/** The same example Turnfin's signer is held to (../../../../src/lib/courses-pass.test.ts).
 *  If this string changes, the two sides no longer agree: change both together. */
const EXAMPLE_PASS =
  "v1.eyJzdWIiOiJwZXJzb25fZXhhbXBsZSIsInN0YXRlIjoic3RhdGUtZm9yLXRlc3RzLTAxMjM0NTY3ODkiLCJleHAiOjE3OTU3NzAwNjAsImF1ZCI6InR1cm5maW4tY291cnNlcyJ9.8-Kdw8nQZSBoQIE8WruoOxQC_EOZgIe9Dw-IKIilIt8";

/** A pass signed here, to try claims Turnfin would never make. */
function forge(claims: Record<string, unknown>, key = secret): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `v1.${payload}.${createHmac("sha256", key).update(`v1.${payload}`).digest("base64url")}`;
}
const good = { sub: "person_example", state, exp: 1795770060, aud: "turnfin-courses" };

test("Turnfin's pass is read as the person it names", () => {
  assert.deepEqual(readPass({ pass: EXAMPLE_PASS, state, secret, now: inTime }), { userId: "person_example" });
  assert.deepEqual(readPass({ pass: forge(good), state, secret, now: inTime }), { userId: "person_example" });
});

test("a pass is good for its minute only", () => {
  assert.equal(readPass({ pass: EXAMPLE_PASS, state, secret, now: tooLate }), null);
});

test("a pass made for another browser is refused", () => {
  assert.equal(readPass({ pass: EXAMPLE_PASS, state: "another-browsers-state-000", secret, now: inTime }), null);
  assert.equal(readPass({ pass: EXAMPLE_PASS, state: "", secret, now: inTime }), null);
  assert.equal(readPass({ pass: EXAMPLE_PASS, state: undefined, secret, now: inTime }), null);
});

test("a pass signed with another secret, or changed, is refused", () => {
  assert.equal(readPass({ pass: forge(good, `${secret}x`), state, secret, now: inTime }), null);
  const [v, , signature] = EXAMPLE_PASS.split(".");
  const swapped = Buffer.from(JSON.stringify({ ...good, sub: "someone_else" })).toString("base64url");
  assert.equal(readPass({ pass: `${v}.${swapped}.${signature}`, state, secret, now: inTime }), null);
  assert.equal(readPass({ pass: EXAMPLE_PASS.slice(0, -2), state, secret, now: inTime }), null);
});

test("a pass for something else, or missing a part, is refused", () => {
  assert.equal(readPass({ pass: forge({ ...good, aud: "turnfin-me" }), state, secret, now: inTime }), null);
  assert.equal(readPass({ pass: forge({ ...good, sub: "" }), state, secret, now: inTime }), null);
  assert.equal(readPass({ pass: forge({ ...good, exp: "1795770060" }), state, secret, now: inTime }), null);
  assert.equal(readPass({ pass: "v2.a.b", state, secret, now: inTime }), null);
  assert.equal(readPass({ pass: "not-a-pass", state, secret, now: inTime }), null);
  assert.equal(readPass({ pass: null, state, secret, now: inTime }), null);
});

test("Continue with Turnfin is off without a long secret and an exact https address", () => {
  assert.equal(turnfinConfig({}), null);
  assert.equal(turnfinConfig({ TURNFIN_URL: "https://turnfin.example.test", COURSES_PASS_SECRET: "too-short" }), null);
  assert.equal(turnfinConfig({ TURNFIN_URL: "http://turnfin.example.test", COURSES_PASS_SECRET: secret }), null);
  assert.deepEqual(turnfinConfig({ TURNFIN_URL: "https://turnfin.example.test/", COURSES_PASS_SECRET: secret }), { turnfinUrl: "https://turnfin.example.test", secret });
  assert.deepEqual(turnfinConfig({ TURNFIN_URL: "http://box.localhost:3190", COURSES_PASS_SECRET: secret, NODE_ENV: "development" }), { turnfinUrl: "http://box.localhost:3190", secret });
  assert.equal(turnfinConfig({ TURNFIN_URL: "http://box.localhost:3190", COURSES_PASS_SECRET: secret, NODE_ENV: "production" }), null);
});
