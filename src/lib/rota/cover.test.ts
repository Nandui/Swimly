import assert from "node:assert/strict";
import { test } from "node:test";
import { intoLanes, mergeTouching, needGaps, placeProblem, subtract } from "./cover";
import { dayShift, duration } from "./shifts";
import { qualification, rankFits, type Held } from "./fit";

/** Invented people and times; minutes from "HH:MM". */
const h = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const need = { id: "n1", startMinutes: h("07:00"), endMinutes: h("21:30"), places: 3 };
const on = (id: string, place: number, userId: string, a: string, b: string) => ({ id, needId: "n1", place, userId, startMinutes: h(a), endMinutes: h(b) });

test("a place's gaps are its time less whoever is on it", () => {
  const gaps = needGaps(need, [on("a", 1, "aoife", "07:00", "14:00"), on("b", 1, "conor", "14:00", "21:30"), on("c", 2, "ciara", "07:00", "12:00"), on("d", 2, "dylan", "15:00", "21:30")]);
  assert.deepEqual(gaps.map((g) => [g.place, g.start, g.end]), [[2, h("12:00"), h("15:00")], [3, h("07:00"), h("21:30")]], "place 1 covered; place 3 nobody");
});

test("someone on another activity does not cover this one", () => {
  assert.equal(needGaps(need, [{ ...on("x", 1, "aoife", "07:00", "21:30"), needId: "other" }]).length, 3);
});

test("subtract keeps what is left, in order, ignoring what is outside", () => {
  assert.deepEqual(subtract({ start: 0, end: 100 }, [{ start: 80, end: 120 }, { start: 10, end: 20 }, { start: 15, end: 30 }, { start: 200, end: 300 }]),
    [{ start: 0, end: 10 }, { start: 30, end: 80 }]);
});

test("back-to-back gaps are one gap with a count", () => {
  const runs = mergeTouching([{ start: h("18:00"), end: h("18:30") }, { start: h("17:30"), end: h("18:00") }, { start: h("18:30"), end: h("19:00") }, { start: h("20:00"), end: h("20:30") }]);
  assert.deepEqual(runs.map((r) => [r.start, r.end, r.count]), [[h("17:30"), h("19:00"), 3], [h("20:00"), h("20:30"), 1]]);
});

test("overlapping classes go on separate lanes, each teacher kept on one", () => {
  const lanes = intoLanes([
    { start: h("16:00"), end: h("16:30"), key: "lauren" }, { start: h("16:00"), end: h("16:30"), key: "roisin" },
    { start: h("16:30"), end: h("17:00"), key: "roisin" }, { start: h("16:30"), end: h("17:00"), key: "lauren" },
    { start: h("17:00"), end: h("17:30"), key: null },
  ]);
  assert.equal(lanes.length, 2);
  assert.deepEqual(lanes.map((l) => l.filter((x) => x.key).every((x) => x.key === l[0].key)), [true, true], "a teacher stays on their lane");
});

test("a place takes one person at a time, inside the activity", () => {
  const others = [on("a", 1, "aoife", "07:00", "14:00")];
  assert.match(placeProblem(need, others, on("b", 1, "conor", "13:00", "15:00"))!, /already on that place/);
  assert.equal(placeProblem(need, others, on("b", 1, "conor", "14:00", "21:30")), null);
  assert.match(placeProblem(need, others, on("b", 4, "conor", "14:00", "15:00"))!, /not on this activity/);
  assert.match(placeProblem(need, others, on("b", 2, "conor", "06:00", "15:00"))!, /inside the activity/);
  assert.equal(placeProblem(need, others, { ...on("a", 1, "aoife", "08:00", "14:00") }), null, "moving yourself is not a clash");
});

test("a shift runs from first start to last finish; an hour off splits it", () => {
  const split = dayShift([{ start: h("09:30"), end: h("11:30"), label: "Teaching" }, { start: h("16:00"), end: h("19:00"), label: "Teaching" }]);
  assert.equal(split!.parts.length, 2);
  const one = dayShift([{ start: h("07:00"), end: h("10:00"), label: "Lifeguarding" }, { start: h("10:30"), end: h("12:00"), label: "Lifeguarding" }]);
  assert.equal(one!.parts.length, 1, "half an hour off stays one shift");
  assert.equal(dayShift([]), null);
});

test("breaks go into free time, and the shift says when there is none", () => {
  const free = dayShift([{ start: h("07:00"), end: h("09:30"), label: "Lifeguarding" }, { start: h("09:45"), end: h("12:00"), label: "Lifeguarding" }]);
  assert.deepEqual(free!.parts[0].breaks, [{ start: h("09:30"), end: h("09:45"), paid: false }], "5 hours: one 15-minute unpaid break, in the free quarter");
  assert.equal(free!.paidMinutes, 5 * 60 - 15);
  const full = dayShift([{ start: h("07:00"), end: h("14:00"), label: "Lifeguarding" }]);
  assert.deepEqual(full!.parts[0].unplaced, [{ minutes: 15, paid: true }, { minutes: 30, paid: false }], "7 hours straight: both breaks have nowhere to go");
  assert.equal(full!.paidMinutes, 7 * 60 - 30, "the unpaid break still comes off the hours");
});

test("an under-18 is owed 30 minutes after four and a half hours", () => {
  const day = dayShift([{ start: h("09:00"), end: h("11:00"), label: "Reception" }, { start: h("11:30"), end: h("14:00"), label: "Reception" }], "under18");
  assert.deepEqual(day!.parts[0].breaks, [{ start: h("11:00"), end: h("11:30"), paid: false }]);
});

test("durations read plainly", () => {
  assert.deepEqual([duration(450), duration(45), duration(480)], ["7h 30m", "45m", "8h"]);
});

const held: Held[] = [
  { userId: "meabh", typeId: "nplq", issuedOn: "2025-01-01", expiresOn: "2027-01-01", revoked: false },
  { userId: "tom", typeId: "nplq", issuedOn: "2023-01-01", expiresOn: "2026-10-02", revoked: false },
  { userId: "sean", typeId: "nplq", issuedOn: "2025-01-01", expiresOn: null, revoked: false },
  { userId: "aoife", typeId: "nplq", issuedOn: "2025-01-01", expiresOn: null, revoked: false },
  { userId: "paula", typeId: "nplq", issuedOn: "2025-01-01", expiresOn: null, revoked: false },
];

test("a qualification counts when held and in date that day", () => {
  assert.equal(qualification(held, "meabh", "nplq", "2026-10-23"), "ok");
  assert.equal(qualification(held, "tom", "nplq", "2026-10-23"), "expired");
  assert.equal(qualification(held, "lauren", "nplq", "2026-10-23"), "missing");
  assert.equal(qualification(held, "lauren", null, "2026-10-23"), "ok");
});

test("best fit first: qualified, free, fewest hours; warnings never drop anyone", () => {
  const fits = rankFits({ date: "2026-10-23", start: h("12:00"), end: h("15:00"), requiredTypeId: "nplq" },
    ["paula", "aoife", "tom", "sean", "meabh"].map((userId) => ({ userId, name: userId })), {
      held,
      work: new Map([
        ["aoife", [{ start: h("07:00"), end: h("14:00"), label: "Lifeguarding" }]],
        ["sean", [{ start: h("06:00"), end: h("11:30"), label: "Gym floor" }]],
      ]),
      off: new Set(["paula"]),
      weekMinutes: new Map([["meabh", 18 * 60], ["sean", 30 * 60], ["tom", 10 * 60]]),
    });
  assert.deepEqual(fits.map((f) => [f.userId, f.issues]), [
    ["meabh", []],
    ["sean", ["long"]],
    ["aoife", ["overlap"]],
    ["tom", ["expired"]],
    ["paula", ["off"]],
  ]);
  assert.equal(fits[1].dayLength, 9 * 60, "06:00 to 15:00 with half an hour off is one 9-hour day");
});
