import assert from "node:assert/strict";
import { test } from "node:test";
import { classReturnDestination } from "./navigation";

test("attendance and competencies return to the calendar or Instructor that opened them", () => {
  const access = { calendar: true, instructor: true, courses: true };
  assert.deepEqual(classReturnDestination(access, "today", "demo"), { href: "/today", label: "Today", source: "today" });
  assert.deepEqual(classReturnDestination(access, "instructor", "demo"), { href: "/instructor", label: "Instructor", source: "instructor" });
  assert.equal(classReturnDestination(access, undefined, "demo")?.href, "/instructor");
});

test("return destinations cannot escape screen permissions or redirect to arbitrary URLs", () => {
  const calendar = { calendar: true, instructor: false, courses: false };
  assert.equal(classReturnDestination(calendar, "instructor", "demo")?.href, "/today");
  assert.equal(classReturnDestination(calendar, "https://example.test", "demo")?.href, "/today");
  assert.equal(classReturnDestination({ calendar: false, instructor: false, courses: true }, "today", "demo")?.href, "/courses/demo");
  assert.equal(classReturnDestination({ calendar: false, instructor: false, courses: false }, "today", "demo"), null);
});
