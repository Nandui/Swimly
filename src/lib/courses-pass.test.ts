import assert from "node:assert/strict";
import { test } from "node:test";
import { coursesPassConfig, isPassState, PASS_SECONDS, signPass } from "./courses-pass";

const secret = "example-secret-for-tests-only-0123456789";
const state = "state-for-tests-0123456789";
const now = new Date(Date.UTC(2026, 10, 27, 9, 0, 0));

/** The same example is checked by Courses' verifier (apps/courses/src/access/pass.test.ts).
 *  If this string changes, the two sides no longer agree: change both together. */
const EXAMPLE_PASS =
  "v1.eyJzdWIiOiJwZXJzb25fZXhhbXBsZSIsInN0YXRlIjoic3RhdGUtZm9yLXRlc3RzLTAxMjM0NTY3ODkiLCJleHAiOjE3OTU3NzAwNjAsImF1ZCI6InR1cm5maW4tY291cnNlcyJ9.8-Kdw8nQZSBoQIE8WruoOxQC_EOZgIe9Dw-IKIilIt8";

test("a pass names the person, the state and a one-minute expiry, signed", () => {
  const pass = signPass({ userId: "person_example", state, secret, now });
  const [version, payload, signature] = pass.split(".");
  assert.equal(version, "v1");
  assert.deepEqual(JSON.parse(Buffer.from(payload!, "base64url").toString()), {
    sub: "person_example", state, exp: Math.floor(now.getTime() / 1000) + PASS_SECONDS, aud: "turnfin-courses",
  });
  assert.match(signature!, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(pass, EXAMPLE_PASS);
});

test("another secret signs differently", () => {
  assert.notEqual(signPass({ userId: "person_example", state, secret, now }), signPass({ userId: "person_example", state, secret: `${secret}x`, now }));
});

test("the state must look like one Courses made", () => {
  assert.equal(isPassState(state), true);
  assert.equal(isPassState("short"), false);
  assert.equal(isPassState("has spaces in it and is long enough"), false);
  assert.equal(isPassState("https://example.test/somewhere-else"), false);
  assert.equal(isPassState(undefined), false);
});

test("the pass is off without a long secret and an exact https address", () => {
  assert.equal(coursesPassConfig({}), null);
  assert.equal(coursesPassConfig({ COURSES_URL: "https://courses.example.test", COURSES_PASS_SECRET: "too-short" }), null);
  assert.equal(coursesPassConfig({ COURSES_URL: "not a url", COURSES_PASS_SECRET: secret }), null);
  assert.equal(coursesPassConfig({ COURSES_URL: "http://courses.example.test", COURSES_PASS_SECRET: secret }), null);
  assert.deepEqual(coursesPassConfig({ COURSES_URL: "https://courses.example.test/some/path", COURSES_PASS_SECRET: secret }), { coursesUrl: "https://courses.example.test", secret });
});

test("plain http is allowed only on localhost, outside production", () => {
  const local = { COURSES_URL: "http://courses.localhost:3103", COURSES_PASS_SECRET: secret };
  assert.deepEqual(coursesPassConfig({ ...local, NODE_ENV: "development" }), { coursesUrl: "http://courses.localhost:3103", secret });
  assert.equal(coursesPassConfig({ ...local, NODE_ENV: "production" }), null);
});
