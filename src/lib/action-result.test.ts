import assert from "node:assert/strict";
import { test } from "node:test";
import { fail, onUniqueViolation, validationFailure } from "./action-result";

test("validation keeps the first error for each field and a summary", () => {
  assert.deepEqual(validationFailure([
    { path: ["contactEmail"], message: "Enter a valid email address." },
    { path: ["contactEmail"], message: "Another email error." },
    { path: ["dateOfBirth"], message: "The date cannot be in the future." },
  ]), { ok: false, error: "Enter a valid email address.", fieldErrors: {
    contactEmail: "Enter a valid email address.", dateOfBirth: "The date cannot be in the future.",
  } });
});

test("section errors and existing callers keep their result contract", () => {
  assert.deepEqual(fail("Could not save."), { ok: false, error: "Could not save." });
  assert.deepEqual(validationFailure([{ path: [], message: "Check this placement." }]), {
    ok: false, error: "Check this placement.", fieldErrors: {},
  });
});

test("a racing unique constraint identifies the field without hiding other failures", async () => {
  assert.deepEqual(await onUniqueViolation(async () => { throw { code: "P2002" }; }, "Number already used.", "memberNumber"), {
    ok: false, error: "Number already used.", fieldErrors: { memberNumber: "Number already used." },
  });
  const connectionError = new Error("offline");
  await assert.rejects(onUniqueViolation(async () => { throw connectionError; }, "Number already used.", "memberNumber"), connectionError);
});
