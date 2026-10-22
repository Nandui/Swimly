import assert from "node:assert/strict";
import test from "node:test";
import {
  linkProblem, MAX_WELLBEING_TO, recipientList, recipientsProblem, tokenShape, updateProblem, wellbeingExpiry, wellbeingRequestSchema,
  wellbeingState, wellbeingUpdateSchema,
} from "./rules";

const now = new Date("2026-10-22T10:00:00Z");
const later = new Date("2026-11-01T10:00:00Z");
const before = new Date("2026-10-21T10:00:00Z");

test("a check reads as waiting, following up, done, cancelled or expired", () => {
  assert.equal(wellbeingState({ status: "open", expiresAt: later, updates: 0 }, now), "waiting");
  assert.equal(wellbeingState({ status: "open", expiresAt: later, updates: 2 }, now), "following");
  assert.equal(wellbeingState({ status: "open", expiresAt: before, updates: 1 }, now), "expired");
  assert.equal(wellbeingState({ status: "done", expiresAt: before, updates: 1 }, now), "done");
  assert.equal(wellbeingState({ status: "cancelled", expiresAt: later, updates: 0 }, now), "cancelled");
});

test("a link takes updates only while open and in date", () => {
  assert.equal(linkProblem({ status: "open", expiresAt: later }, now), null);
  assert.match(linkProblem({ status: "open", expiresAt: before }, now)!, /expired/);
  assert.match(linkProblem({ status: "cancelled", expiresAt: later }, now)!, /cancelled/);
  assert.match(linkProblem({ status: "done", expiresAt: later }, now)!, /finished/);
  assert.equal(wellbeingExpiry(now).toISOString(), "2026-11-21T10:00:00.000Z");
  assert.equal(tokenShape("a".repeat(43)), true);
  assert.equal(tokenShape("a".repeat(42)), false);
});

test("the HR addresses are split, cleaned and checked", () => {
  assert.deepEqual(recipientList(" HR@LeisureWorld.example ; payroll@example.com,\nhr@leisureworld.example "), ["hr@leisureworld.example", "payroll@example.com"]);
  assert.deepEqual(recipientList(""), []);
  assert.equal(recipientsProblem(["hr@example.com"]), null);
  assert.equal(recipientsProblem([]), null);
  assert.match(recipientsProblem(["not-an-address"])!, /not an email address/);
  assert.match(recipientsProblem(Array.from({ length: MAX_WELLBEING_TO + 1 }, (_, n) => `p${n}@example.com`))!, /up to/);
});

test("a request needs a reason, and an update needs what was done and what happens next", () => {
  assert.equal(wellbeingRequestSchema.safeParse({ userId: "", name: "Sam Example", reason: "short" }).success, false);
  assert.equal(wellbeingRequestSchema.safeParse({ userId: "u1", name: "", reason: "Shaken after the rescue at the deep end." }).success, true);
  const update = { token: "x", byName: "Pat HR", doneOn: "2026-10-22", whatDone: "Phoned them at home.", nextSteps: "", finished: false };
  assert.equal(wellbeingUpdateSchema.safeParse(update).success, true);
  assert.match(updateProblem(update, "2026-10-20", "2026-10-22")!, /what happens next/);
  assert.equal(updateProblem({ ...update, finished: true }, "2026-10-20", "2026-10-22"), null);
  assert.equal(updateProblem({ ...update, nextSteps: "Call again on Monday." }, "2026-10-20", "2026-10-22"), null);
  assert.match(updateProblem({ ...update, doneOn: "2026-10-23", finished: true }, "2026-10-20", "2026-10-22")!, /future/);
  assert.match(updateProblem({ ...update, doneOn: "2026-10-19", finished: true }, "2026-10-20", "2026-10-22")!, /before HR was asked/);
});
