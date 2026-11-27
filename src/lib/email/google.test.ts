import assert from "node:assert/strict";
import { test } from "node:test";
import { refusalCode } from "@/lib/email/google";

test("a refusal keeps only Google's short reason code", () => {
  assert.equal(refusalCode({ error: "invalid_grant", error_description: "Token has been expired or revoked." }), "invalid_grant");
  assert.equal(refusalCode({ error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "User-rate limit exceeded for someone@example.test" } }), "RESOURCE_EXHAUSTED");
});

test("anything that is not a reason code is dropped", () => {
  for (const body of [null, "text", {}, { error: "a sentence with someone@example.test" }, { error: { status: 429 } }, { error: "x".repeat(41) }]) {
    assert.equal(refusalCode(body), null);
  }
});
