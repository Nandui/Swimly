import assert from "node:assert/strict";
import { test } from "node:test";
import { afterFailure, cleanEmail, hashToken, IDLE_MINUTES, LOCK_MINUTES, MAX_FAILURES, newToken, sessionLive } from "./tokens";

const at = (minutes: number) => new Date(Date.UTC(2026, 10, 27, 9, 0) + minutes * 60_000);

test("tokens are random and stored only as a hash", () => {
  const a = newToken();
  assert.notEqual(a, newToken());
  assert.ok(a.length >= 43);
  assert.equal(hashToken(a), hashToken(a));
  assert.notEqual(hashToken(a), a);
  assert.match(hashToken(a), /^[0-9a-f]{64}$/);
});

test("a session ends at its expiry", () => {
  assert.equal(sessionLive({ expiresAt: at(60), lastSeenAt: at(0) }, at(10)), true);
  assert.equal(sessionLive({ expiresAt: at(10), lastSeenAt: at(9) }, at(10)), false);
});

test("a session left idle is over", () => {
  const session = { expiresAt: at(600), lastSeenAt: at(0) };
  assert.equal(sessionLive(session, at(IDLE_MINUTES - 1)), true);
  assert.equal(sessionLive(session, at(IDLE_MINUTES)), false);
});

test("wrong passwords count up and then lock", () => {
  assert.deepEqual(afterFailure(0, at(0)), { failedSignIns: 1, lockedUntil: null });
  const locked = afterFailure(MAX_FAILURES - 1, at(0));
  assert.equal(locked.failedSignIns, MAX_FAILURES);
  assert.deepEqual(locked.lockedUntil, at(LOCK_MINUTES));
});

test("emails are compared in lower case without spaces", () => {
  assert.equal(cleanEmail("  Sam.Example@Example.COM "), "sam.example@example.com");
});
