import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReceptionClassOption } from "./data";
import { emptyClassFilters, findReceptionClasses, invalidTimeRange } from "./finder";

function course(id: string, values: Partial<ReceptionClassOption> = {}): ReceptionClassOption {
  return { id, clubId: "site-a", club: { id: "site-a", name: "Site A" }, name: null, dayOfWeek: "MONDAY", startMinutes: 990, durationMinutes: 30,
    location: "Learner Pool", capacity: 8, instructor: null,
    level: { id: "penguins", name: "Penguins", sortOrder: 1, programme: { id: "water", name: "Water Safety", sortOrder: 0 } },
    _count: { enrolments: 5 }, ...values };
}

test("weekly finder orders weekdays chronologically, then by start time", () => {
  const options = [course("sat", { dayOfWeek: "SATURDAY" }), course("tue", { dayOfWeek: "TUESDAY" }), course("late", { startMinutes: 1020 }), course("early")];
  assert.deepEqual(findReceptionClasses(options, emptyClassFilters(), []).map(row => row.id), ["early", "late", "tue", "sat"]);
});

test("available only excludes full and overbooked classes; unlimited is available", () => {
  const options = [course("full", { _count: { enrolments: 8 } }), course("over", { _count: { enrolments: 10 } }), course("unlimited", { capacity: null }), course("free")];
  assert.deepEqual(findReceptionClasses(options, emptyClassFilters(), []).map(row => row.id), ["free", "unlimited"]);
  assert.equal(findReceptionClasses(options, { ...emptyClassFilters(), availableOnly: false }, []).length, 4);
});

test("combines exact level identity, preferred day and inclusive time bounds without duplicate open places", () => {
  const sameName = course("different-programme", { level: { ...course("x").level, id: "other-penguins", programme: { id: "other", name: "Other", sortOrder: 1 } } });
  const options = [course("from"), course("until", { startMinutes: 1020 }), course("late", { startMinutes: 1050 }), course("tue", { dayOfWeek: "TUESDAY" }), course("already-waitlisted"), sameName];
  const filters = { ...emptyClassFilters("penguins"), day: "MONDAY", from: "990", until: "1020" };
  assert.deepEqual(findReceptionClasses(options, filters, ["already-waitlisted"]).map(row => row.id), ["from", "until"]);
});

test("an inverted time range cannot silently return booking targets", () => {
  const filters = { ...emptyClassFilters(), from: "1050", until: "990" };
  assert.equal(invalidTimeRange(filters), true);
  assert.deepEqual(findReceptionClasses([course("a")], filters, []), []);
});

test("the working-site filter can expand to both sites without changing the swimmer's occupied places", () => {
  const options = [course("local"), course("other", { clubId: "site-b", club: { id: "site-b", name: "Site B" } }), course("occupied")];
  assert.deepEqual(findReceptionClasses(options, emptyClassFilters("any", "site-a"), ["occupied"]).map(c => c.id), ["local"]);
  assert.deepEqual(findReceptionClasses(options, emptyClassFilters(), ["occupied"]).map(c => c.id), ["local", "other"]);
});
