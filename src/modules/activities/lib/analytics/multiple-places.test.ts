import assert from "node:assert/strict";
import { test } from "node:test";
import { multiplePlaces, multiplePlacesCsv, type PlaceRow } from "./multiple-places";

function place(studentId: string, day: PlaceRow["dayOfWeek"] = "MONDAY", startMinutes = 990): PlaceRow {
  return { studentId, memberNumber: `M-${studentId}`, firstName: "Ada", lastName: studentId, courseName: null, courseLevelName: "Starfish", dayOfWeek: day, startMinutes };
}

test("lists only swimmers with more than one enrolment, classes in weekly order", () => {
  const swimmers = multiplePlaces([place("one"), place("two", "TUESDAY"), place("two", "MONDAY", 600), place("three"), place("three"), place("three", "SATURDAY")]);
  assert.deepEqual(swimmers.map(s => s.lastName), ["three", "two"]);
  assert.deepEqual(swimmers.find(s => s.id === "two")!.classes, ["Starfish · Mon 10:00", "Starfish · Tue 16:30"]);
  // Two enrolments in the same class count as two.
  assert.equal(swimmers.find(s => s.id === "three")!.classes.length, 3);
});

test("CSV carries the member ID, quotes cells and neutralises formulas", () => {
  const swimmers = multiplePlaces([place("x"), place("x", "FRIDAY")]);
  swimmers[0].lastName = '=HYPERLINK("x")';
  const csv = multiplePlacesCsv("Example Pool", swimmers);
  assert(csv.startsWith("\uFEFF\"Site\",\"Member ID\""));
  assert.equal(csv.split("\r\n")[1], '"Example Pool","M-x","Ada","\'=HYPERLINK(""x"")","2","Starfish · Mon 16:30; Starfish · Fri 16:30"');
});
