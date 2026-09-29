import assert from "node:assert/strict";
import { test } from "node:test";
import { greeting } from "./greeting";

test("the greeting follows the time of day at the pool, not the server", () => {
  // Dublin is UTC+1 in summer and UTC+0 in winter.
  assert.equal(greeting(new Date("2026-09-29T10:30:00Z")), "Good morning");
  assert.equal(greeting(new Date("2026-09-29T11:30:00Z")), "Good afternoon");
  assert.equal(greeting(new Date("2026-09-29T16:30:00Z")), "Good evening");
  assert.equal(greeting(new Date("2026-12-01T04:30:00Z")), "Good evening");
  assert.equal(greeting(new Date("2026-12-01T05:00:00Z")), "Good morning");
});
