import assert from "node:assert/strict";
import { test } from "node:test";
import { CLASS_PAGE_SIZE, classBrowserHref, classBrowserModel, classDetailsHref, classReturnHref } from "./browse";
import { courseFilterDimensions, EMPTY_FILTERS, filterCourses, parseCourseFilters } from "./filters";
import type { CourseRow } from "./data/courses";

const course = (id: string, changes: Partial<CourseRow> = {}): CourseRow => ({
  id, clubId: "club", club: { id: "club", name: "Demo club" }, name: null,
  dayOfWeek: "MONDAY", startMinutes: 960, durationMinutes: 30, capacity: 10,
  location: "Learner Pool", archivedAt: null, levelId: "level", instructorId: "staff",
  level: { id: "level", name: "Starfish", sortOrder: 0, programme: { id: "programme", name: "Water Safety", sortOrder: 0 } },
  instructor: { id: "staff", name: "Alex Sample" }, _count: { enrolments: 8 }, ...changes,
});

test("Classes opens across the week and isolates archived results", () => {
  const rows = [course("tue", { dayOfWeek: "TUESDAY" }), course("mon"), course("archive", { archivedAt: new Date() })];
  assert.deepEqual(classBrowserModel(rows, {}).rows.map(row => row.id), ["mon", "tue"]);
  assert.deepEqual(classBrowserModel(rows, { state: "archived" }).rows.map(row => row.id), ["archive"]);
  assert.deepEqual(parseCourseFilters({ day: "any" }), EMPTY_FILTERS);
  assert.deepEqual(parseCourseFilters({ day: ["MONDAY", "TUESDAY"] }), EMPTY_FILTERS);
});

test("combined search and pool filters match results and keep honest alternative counts", () => {
  const rows = [course("pool"), course("lane", { location: "Lane 1" }), course("tue", { dayOfWeek: "TUESDAY" })];
  const filters = parseCourseFilters({ q: "starfish", day: "MONDAY", location: "Learner Pool" });
  assert.deepEqual(filterCourses(rows, filters).map(row => row.id), ["pool"]);
  assert.deepEqual(courseFilterDimensions(rows, filters).find(d => d.key === "location")?.options,
    [{ value: "Lane 1", label: "Lane 1", count: 1 }, { value: "Learner Pool", label: "Learner Pool", count: 1 }]);
  const impossible = { ...filters, instructor: "missing" };
  assert.deepEqual(filterCourses(rows, impossible), []);
  assert.equal(courseFilterDimensions(rows, impossible).find(d => d.key === "location")?.options[0].count, 0);
});

test("availability includes uncapped classes and treats full or over-capacity as full", () => {
  const rows = [course("open"), course("uncapped", { capacity: null }), course("full", { capacity: 8 }), course("over", { capacity: 7 })];
  assert.deepEqual(classBrowserModel(rows, { places: "open" }).rows.map(row => row.id), ["open", "uncapped"]);
  assert.deepEqual(classBrowserModel(rows, { places: "full" }).rows.map(row => row.id), ["full", "over"]);
});

test("pages have stable ordering, clamp stale links and keep the inspection return context", () => {
  const rows = Array.from({ length: CLASS_PAGE_SIZE + 2 }, (_, n) => course(String(n).padStart(3, "0")));
  const params = { q: "Starfish", location: "Learner Pool", page: "2" };
  const model = classBrowserModel(rows.reverse(), params);
  assert.equal(model.rows.length, 2);
  assert.equal(model.rows[0].id, "024");
  assert.equal(model.page, 2);
  assert.equal(classBrowserModel(rows, { page: "999" }).page, 2);
  assert.equal(classBrowserModel(rows, { page: "NaN" }).page, 1);
  assert.equal(classBrowserModel(rows, { page: "999999999999999999999" }).page, 1);
  assert.equal(classBrowserModel([], { page: "9" }).page, 1);
  const details = new URL(classDetailsHref("class/id", model.returnTo), "https://example.test");
  assert.equal(details.pathname, "/courses/class%2Fid");
  assert.equal(classReturnHref(details.searchParams.get("returnTo")!), model.returnTo);
  assert.equal(classBrowserHref(params, { day: "MONDAY", page: null }), "/courses?q=Starfish&day=MONDAY&location=Learner+Pool");
});

test("return links stay on the class browser and accept only known query keys", () => {
  for (const input of ["https://evil.test", "//evil.test", "/courses/other", "/courses#anchor", undefined, ["/courses"]]) {
    assert.equal(classReturnHref(input), "/courses");
  }
  assert.equal(classReturnHref("/courses?state=archived&page=2&returnTo=https://evil.test&unknown=1"), "/courses?state=archived&page=2");
});

test("multiword search finds a level, weekday, site and instructor in any order", () => {
  const rows = [course("one"), course("two", { clubId: "north", club: { id: "north", name: "North Pool" }, dayOfWeek: "TUESDAY" })];
  for (const q of ["starfish monday", "MONDAY  starfish", "Alex demo", "starfish 16:00"]) {
    assert.deepEqual(classBrowserModel(rows, { q }).rows.map(c => c.id), q === "starfish 16:00" ? ["one", "two"] : ["one"]);
  }
  assert.deepEqual(classBrowserModel(rows, { q: "North Tuesday" }).rows.map(c => c.id), ["two"]);
  assert.equal(classBrowserModel(rows, { q: "North Monday" }).matches.length, 0);
});

test("site filters combine with availability and survive opening a class", () => {
  const rows = [course("here"), course("there", { clubId: "north", club: { id: "north", name: "North Pool" } }), course("full", { clubId: "north", club: { id: "north", name: "North Pool" }, capacity: 8 })];
  const model = classBrowserModel(rows, { site: "north", places: "open" });
  assert.deepEqual(model.rows.map(c => c.id), ["there"]);
  assert.deepEqual(courseFilterDimensions(rows, model.filters).find(d => d.key === "site")?.options.map(o => [o.value, o.count]), [["club", 1], ["north", 1]]);
  const url = new URL(classDetailsHref("there", model.returnTo), "https://example.test");
  assert.equal(classReturnHref(url.searchParams.get("returnTo")!), "/courses?site=north&places=open");
  assert.deepEqual(classBrowserModel(rows, { site: "north", places: "full" }).rows.map(c => c.id), ["full"]);
});
