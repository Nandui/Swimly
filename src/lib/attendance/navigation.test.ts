import assert from "node:assert/strict";
import { test } from "node:test";
import { classReturnDestination, instructorClassHref, instructorHomeHref, legacyClassHref } from "./navigation";

test("attendance and competencies remain in their workspace even with every screen granted", () => {
  const access = { calendar: true, instructor: true, courses: true };
  assert.deepEqual(classReturnDestination(access, "today", "demo"), { href: "/today", label: "Today", source: "today" });
  assert.deepEqual(classReturnDestination(access, "today", "demo", "instructor"), { href: "/instructor", label: "Instructor", source: "instructor" });
  assert.equal(classReturnDestination(access, "instructor", "demo")?.href, "/courses/demo");
  assert.equal(classReturnDestination(access, undefined, "demo")?.href, "/courses/demo");
});

test("return destinations cannot escape screen permissions or redirect to arbitrary URLs", () => {
  const calendar = { calendar: true, instructor: false, courses: false };
  assert.equal(classReturnDestination(calendar, "instructor", "demo")?.href, "/today");
  assert.equal(classReturnDestination(calendar, "https://example.test", "demo")?.href, "/today");
  assert.equal(classReturnDestination({ calendar: false, instructor: false, courses: true }, "today", "demo")?.href, "/courses/demo");
  assert.equal(classReturnDestination({ calendar: false, instructor: false, courses: false }, "today", "demo"), null);
  assert.equal(classReturnDestination(calendar, undefined, "demo", "instructor"), null);
  assert.equal(classReturnDestination({ calendar: false, instructor: true, courses: false }, "instructor", "demo"), null);
});

test("the deck keeps allowed list context through opening, changing step and returning", () => {
  const params = { tab: "all", group: "level", date: "2026-09-11", from: "today", returnTo: "https://example.test" };
  assert.equal(instructorClassHref("a&b", params), "/instructor/classes/a%26b?tab=all&group=level&date=2026-09-11");
  assert.equal(instructorClassHref("demo", { ...params, step: "competencies" }), "/instructor/classes/demo?tab=all&group=level&date=2026-09-11&step=competencies");
  assert.equal(instructorHomeHref(params), "/instructor?tab=all&group=level");
  assert.equal(instructorHomeHref({ tab: ["all"], group: "anything" }), "/instructor");
});

test("legacy bookmarks keep the requested attendance or competency date in the authorized workspace", () => {
  const params = { from: "instructor", date: "2026-09-04", step: "competencies", tab: "all" };
  assert.equal(legacyClassHref("demo", params, true, true), "/instructor/classes/demo?tab=all&date=2026-09-04&step=competencies");
  assert.equal(legacyClassHref("demo", { date: params.date }, true, false), "/instructor/classes/demo?date=2026-09-04");
  assert.equal(legacyClassHref("demo", params, false, true), "/courses/demo/class?date=2026-09-04&step=competencies");
  assert.equal(legacyClassHref("demo", { from: "today" }, true, true), "/courses/demo/class?from=today");
});
