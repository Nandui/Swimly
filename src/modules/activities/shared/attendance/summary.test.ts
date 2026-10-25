import assert from "node:assert/strict";
import { test } from "node:test";
import type { AttendanceStatus } from "@/generated/prisma/client";
import { claimState } from "./claim-state";
import { ATTENDANCE_ORDER, ATTENDANCE_STATUS_META } from "./constants";
import { isIsoDate, mostRecentOccurrence, shiftWeeks, weekdayOfIso } from "./dates";
import { describeRegister } from "./summary";

/** The register's rules: the one audit line it writes, who started a class, and which day a
 *  register opens on. Invented swimmers. 12 October 2026 is a Monday. */
const names = new Map([["ava", "Ava"], ["tom", "Tom"], ["niamh", "Niamh"], ["oisin", "Oisín"], ["cara", "Cara"], ["leo", "Leo"], ["mia", "Mia"], ["finn", "Finn"]]);
const describe = (before: [string, AttendanceStatus][], after: [string, AttendanceStatus][]) => describeRegister({
  classLabel: "Turtles · Mon 16:30", dateLabel: "12 Oct", before: new Map(before), after: after.map(([studentId, status]) => ({ studentId, status })), nameOf: (id) => names.get(id) ?? id,
});

test("a first register says the shape of the class and names the exceptions", () => {
  assert.deepEqual(describe([], [["ava", "PRESENT"], ["tom", "ABSENT"], ["niamh", "LATE"], ["oisin", "PRESENT"]]), {
    action: "attendance", amended: false, summary: "Marked the register for Turtles · Mon 16:30 on 12 Oct — 2 present, 1 late (Niamh), 1 absent (Tom)",
  });
  const allOut = [...names.keys()].map((id): [string, AttendanceStatus] => [id, "ABSENT"]);
  assert.match(describe([], allOut)!.summary, /8 absent \(Ava, Tom, Niamh, Oisín, Cara, Leo and 2 others\)$/, "names are capped to fit one row");
});

test("saving the same register again writes nothing; an amendment says what moved", () => {
  const marked: [string, AttendanceStatus][] = [["ava", "PRESENT"], ["tom", "ABSENT"]];
  assert.equal(describe(marked, marked), null);
  assert.deepEqual(describe(marked, [["ava", "PRESENT"], ["tom", "LATE"], ["niamh", "PRESENT"]]), {
    action: "attendance", amended: true, summary: "Amended the register for Turtles · Mon 16:30 on 12 Oct — Tom absent → late, Niamh present",
  });
});

test("the register lists present first, then the exceptions from least to most serious, and only absent is red", () => {
  assert.deepEqual([...ATTENDANCE_ORDER], ["PRESENT", "LATE", "ABSENT"]);
  assert.deepEqual(Object.entries(ATTENDANCE_STATUS_META).filter(([, m]) => m.color === "red").map(([k]) => k), ["ABSENT"]);
});

test("starting a class records who began it and never shuts another instructor out", () => {
  assert.equal(claimState(null, "aoife"), "available");
  assert.equal(claimState(undefined, "aoife"), "available");
  assert.equal(claimState({ coverById: "aoife", coverByName: "Aoife" }, "aoife"), "mine");
  assert.equal(claimState({ coverById: "ciara", coverByName: "Ciara" }, "aoife"), "shared");
  assert.equal(claimState({ coverById: null, coverByName: "Someone" }, "aoife"), "shared");
});

test("a register opens on the class's last day, on or before today, and steps a week at a time", () => {
  assert.equal(mostRecentOccurrence("MONDAY", "2026-10-12"), "2026-10-12", "today, when it is the class's day");
  assert.equal(mostRecentOccurrence("MONDAY", "2026-10-13"), "2026-10-12", "Monday's register opened on a Tuesday lands on yesterday");
  assert.equal(mostRecentOccurrence("SUNDAY", "2026-10-12"), "2026-10-11");
  assert.equal(mostRecentOccurrence("TUESDAY", "2026-10-12"), "2026-10-06");
  assert.equal(shiftWeeks("2026-10-12", 1), "2026-10-19");
  assert.equal(shiftWeeks("2026-10-26", -1), "2026-10-19", "across the clock change");
  assert.equal(weekdayOfIso(shiftWeeks("2026-10-12", 7)), "MONDAY", "a whole number of weeks keeps the day");
  assert.equal(isIsoDate("2026-10-12"), true);
  for (const value of ["2026-13-01", "12/10/2026", "", null, 20261012]) assert.equal(isIsoDate(value), false, String(value));
});
