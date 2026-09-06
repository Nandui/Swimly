import assert from "node:assert/strict";
import test from "node:test";
import { parseAttendanceDraft } from "./draft";

test("attendance drafts retain the class note and accept older mark-only drafts", () => {
  const marks = { swimmer: { status: "PRESENT", note: "Arrived with the group" } };
  assert.deepEqual(parseAttendanceDraft(JSON.stringify({ version: 1, marks, note: "Pool closed early" })), { marks, note: "Pool closed early" });
  assert.deepEqual(parseAttendanceDraft(JSON.stringify(marks)), { marks, note: undefined });
});

test("corrupt browser drafts cannot introduce invalid attendance states", () => {
  for (const raw of ["broken", "null", "[]", '{"version":1,"marks":null}']) assert.equal(parseAttendanceDraft(raw), null);
  const draft = parseAttendanceDraft('{"swimmer":{"status":"PRESENT","note":42},"bad":{"status":"EXCUSED"}}');
  assert.deepEqual(draft?.marks, { swimmer: { status: "PRESENT", note: "" } });
});

test("drafts retain the original revision so reload cannot approve an unseen register", () => {
  const revision = "a".repeat(64);
  const marks = { swimmer: { status: "LATE", note: "" } };
  assert.deepEqual(parseAttendanceDraft(JSON.stringify({ version: 2, marks, revision, note: "" })), { marks, revision, note: "" });
  assert.equal(parseAttendanceDraft(JSON.stringify({ version: 2, marks, revision: "invalid" }))?.revision, null);
  assert.equal(parseAttendanceDraft(JSON.stringify({ version: 3, marks })), null);
});
