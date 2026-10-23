import assert from "node:assert/strict";
import { test } from "node:test";
import { IDLE_SIGN_OUT_MINUTES, SESSION_MAX_AGE_SECONDS, minutesAndSeconds, outlivesIdleLimit } from "./idle";

test("the server keeps a sign-in a little longer than the screen's 30 minutes, never much longer", () => {
  assert.equal(IDLE_SIGN_OUT_MINUTES, 30);
  assert.ok(SESSION_MAX_AGE_SECONDS > IDLE_SIGN_OUT_MINUTES * 60);
  assert.ok(SESSION_MAX_AGE_SECONDS <= (IDLE_SIGN_OUT_MINUTES + 5) * 60);
});

test("a sign-in made before the idle limit (30 days) reads as signed out; a renewed one does not", () => {
  const now = Date.UTC(2026, 9, 23, 10);
  assert.equal(outlivesIdleLimit(now + 30 * 24 * 60 * 60 * 1000, now), true);
  assert.equal(outlivesIdleLimit(now + SESSION_MAX_AGE_SECONDS * 1000, now), false);
  assert.equal(outlivesIdleLimit(now + 5 * 60 * 1000, now), false);
  assert.equal(outlivesIdleLimit(null, now), false);
});

test("the warning counts down in minutes and seconds", () => {
  assert.equal(minutesAndSeconds(120_000), "2:00");
  assert.equal(minutesAndSeconds(104_200), "1:45");
  assert.equal(minutesAndSeconds(-5), "0:00");
});
