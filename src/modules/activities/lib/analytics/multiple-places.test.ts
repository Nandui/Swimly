import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesKind, multiplePlaces, multiplePlacesCsv, type PlaceRow } from "./multiple-places";

const levels = [
  { id: "starfish", sharedWithId: null, name: "Starfish" },
  { id: "starfish-b", sharedWithId: "starfish", name: "Starfish" },
  { id: "dolphins", sharedWithId: null, name: "Dolphins" },
  { id: "sharks-1", sharedWithId: null, name: "Sharks 1" },
];
const programmes = [
  { id: "wsf", sharedWithId: null, name: "Water Safety & Fun" },
  { id: "wsf-b", sharedWithId: "wsf", name: "Water Safety & Fun" },
  { id: "sharks", sharedWithId: null, name: "Sharks" },
];

function place(studentId: string, courseId: string, levelId: string, programmeId: string, day: PlaceRow["dayOfWeek"] = "MONDAY", startMinutes = 990): PlaceRow {
  return { studentId, memberNumber: `M-${studentId}`, firstName: "Ada", lastName: studentId, courseId, courseName: null, courseLevelName: "Starfish", dayOfWeek: day, startMinutes, levelId, programmeId };
}

test("lists only swimmers with two or more places, resolving shared curriculum copies", () => {
  const { swimmers, totals } = multiplePlaces([
    place("one", "a", "starfish", "wsf"),
    place("two", "a", "starfish", "wsf"), place("two", "b", "starfish-b", "wsf-b", "SATURDAY"),
    place("three", "a", "starfish", "wsf"), place("three", "c", "dolphins", "wsf"),
    place("four", "a", "starfish", "wsf", "TUESDAY"), place("four", "d", "sharks-1", "sharks", "MONDAY", 600),
  ], levels, programmes);
  assert.deepEqual(swimmers.map(s => s.lastName), ["four", "three", "two"]);
  assert.deepEqual(totals, { classes: 3, levels: 2, programmes: 1 });
  const two = swimmers.find(s => s.id === "two")!;
  assert.deepEqual(two.levels, ["Starfish"]);
  assert.equal(matchesKind(two, "levels"), false);
  const four = swimmers.find(s => s.id === "four")!;
  assert.deepEqual(four.programmes, ["Sharks", "Water Safety & Fun"]);
  assert.deepEqual(four.classes, ["Starfish · Mon 10:00", "Starfish · Tue 16:30"]);
});

test("two places in the same class count as two classes", () => {
  const { totals } = multiplePlaces([place("x", "a", "starfish", "wsf"), place("x", "a", "starfish", "wsf")], levels, programmes);
  assert.deepEqual(totals, { classes: 1, levels: 0, programmes: 0 });
});

test("CSV carries the member ID, quotes cells and neutralises formulas", () => {
  const { swimmers } = multiplePlaces([place("x", "a", "starfish", "wsf"), place("x", "b", "dolphins", "wsf")], levels, programmes);
  swimmers[0].lastName = '=HYPERLINK("x")';
  const csv = multiplePlacesCsv("Example Pool", swimmers);
  assert(csv.startsWith("\uFEFF\"Site\",\"Member ID\""));
  const row = csv.split("\r\n")[1];
  assert(row.startsWith('"Example Pool","M-x","Ada","\'=HYPERLINK(""x"")","2","2","1"'));
});
