import assert from "node:assert/strict";
import { test } from "node:test";
import { multiplePlaces, multiplePlacesCsv, type PlaceRow } from "@/modules/activities/features/analytics/server/multiple-places";

function place(studentId: string, extra: Partial<PlaceRow> = {}): PlaceRow {
  return { studentId, memberNumber: `M-${studentId}`, firstName: "Ada", lastName: studentId, courseName: null, courseLevelName: "Starfish",
    dayOfWeek: "MONDAY", startMinutes: 990, siteName: "Riverside", siteOrder: 0, waitlisted: false, ...extra };
}

test("lists only swimmers with more than one enrolment, ordered by site then week", () => {
  const swimmers = multiplePlaces([
    place("one"),
    place("two", { dayOfWeek: "TUESDAY" }), place("two", { startMinutes: 600, siteName: "Hillview", siteOrder: 1 }),
    place("three"), place("three"), place("three", { dayOfWeek: "SATURDAY" }),
  ]);
  assert.deepEqual(swimmers.map(s => s.lastName), ["three", "two"]);
  const two = swimmers.find(s => s.id === "two")!;
  assert.deepEqual(two.sites, ["Riverside", "Hillview"]);
  assert.deepEqual(two.classes.map(c => c.label), ["Starfish · Tue 16:30", "Starfish · Mon 10:00"]);
  // Two enrolments in the same class count as two.
  assert.equal(swimmers.find(s => s.id === "three")!.classes.length, 3);
});

test("a waitlist place counts towards more than one enrolment", () => {
  const [swimmer] = multiplePlaces([place("w"), place("w", { waitlisted: true, dayOfWeek: "FRIDAY" })]);
  assert.equal(swimmer.waitlisted, 1);
  assert.deepEqual(swimmer.classes.map(c => c.waitlisted), [false, true]);
});

test("CSV carries the member ID, sites and waitlist, quotes cells and neutralises formulas", () => {
  const swimmers = multiplePlaces([place("x"), place("x", { dayOfWeek: "FRIDAY", siteName: "Hillview", siteOrder: 1, waitlisted: true })]);
  swimmers[0].lastName = '=HYPERLINK("x")';
  const csv = multiplePlacesCsv(swimmers);
  assert(csv.startsWith("\uFEFF\"Member ID\",\"First name\""));
  assert.equal(csv.split("\r\n")[1], '"M-x","Ada","\'=HYPERLINK(""x"")","Riverside; Hillview","2","1","Starfish · Mon 16:30 · Riverside; Starfish · Fri 16:30 · Hillview (waitlisted)"');
});
