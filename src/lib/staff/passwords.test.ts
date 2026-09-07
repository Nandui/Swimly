import assert from "node:assert/strict";
import { test } from "node:test";
import { passwordSchema } from "./passwords";

test("passwords require at least eight characters", () => {
  const short = passwordSchema.safeParse("Abc123!");
  assert.equal(short.success, false);
  if (!short.success) assert.equal(short.error.issues[0].message, "Use at least 8 characters.");
  assert.equal(passwordSchema.safeParse("Abc123!x").success, true);
});

test("passwords obey bcrypt's UTF-8 byte limit without silent truncation", () => {
  for (const password of ["a".repeat(72), "é".repeat(36), "🏊".repeat(18)]) {
    assert.equal(passwordSchema.safeParse(password).success, true);
  }
  for (const password of ["a".repeat(73), "é".repeat(37), "🏊".repeat(19)]) {
    assert.equal(passwordSchema.safeParse(password).success, false);
  }
});
