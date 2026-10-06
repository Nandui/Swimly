import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDay, dayGaps, type DayType } from "./day";

/** Invented site, people and classes. */
const h = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const types: DayType[] = [
  { id: "guard", name: "Lifeguarding", icon: "lifeguard", departmentId: "pool", requiredTypeId: "nplq", requiredName: "NPLQ", fromClasses: false },
  { id: "teach", name: "Teaching", icon: "teaching", departmentId: "pool", requiredTypeId: null, requiredName: null, fromClasses: true },
];
const names = new Map([["aoife", "Aoife Byrne"], ["ciara", "Ciara Murphy"], ["lauren", "Lauren Kelly"], ["roisin", "Róisín Kelly"]]);
const need = (id: string, place: string, a: string, b: string, places: number) => ({ id, typeId: "guard", place, startMinutes: h(a), endMinutes: h(b), places, note: "", repeatTitle: null });
const on = (id: string, needId: string, place: number, userId: string, a: string, b: string) => ({ id, needId, place, userId, startMinutes: h(a), endMinutes: h(b) });
const cls = (ref: string, userId: string | null, a: string, b: string) => ({ ref, userId, startMinutes: h(a), endMinutes: h(b), title: "Stage 3", place: "Learner pool", planned: false });

const day = buildDay({
  date: "2026-10-23", types, names,
  needs: [need("main", "Main pool", "07:00", "21:30", 2), need("learner", "Learner pool", "09:00", "15:00", 1)],
  assignments: [on("a1", "main", 1, "aoife", "07:00", "14:00"), on("a2", "main", 2, "ciara", "07:00", "12:00"), on("a3", "learner", 1, "ciara", "11:00", "15:00")],
  classes: [cls("c1", "lauren", "16:00", "16:30"), cls("c2", "roisin", "16:00", "16:30"), cls("c3", null, "16:30", "17:00"), cls("c4", null, "17:00", "17:30")],
  held: [{ userId: "aoife", typeId: "nplq", issuedOn: "2020-01-01", expiresOn: "2026-10-01", revoked: false }],
  off: new Set(["lauren"]),
});

test("groups by activity and place, planned activities before swim classes", () => {
  assert.deepEqual(day.groups.map((g) => [g.name, g.place, g.lanes.length]), [["Lifeguarding", "Learner pool", 1], ["Lifeguarding", "Main pool", 2], ["Teaching", "Learner pool", 2]]);
});

test("each place is a lane of people and gaps", () => {
  const main = day.groups.find((g) => g.place === "Main pool")!;
  assert.deepEqual(main.lanes.map((l) => l.map((b) => [b.kind, b.name, b.start, b.end])), [
    [["on", "Aoife Byrne", h("07:00"), h("14:00")], ["gap", null, h("14:00"), h("21:30")]],
    [["on", "Ciara Murphy", h("07:00"), h("12:00")], ["gap", null, h("12:00"), h("21:30")]],
  ]);
  assert.equal(main.gapCount, 2);
});

test("back-to-back classes nobody teaches count as one gap, with a teacher who is off", () => {
  const teaching = day.groups.find((g) => g.fromClasses)!;
  assert.equal(teaching.gapCount, 1, "Lauren is off at 16:00 and nobody teaches 16:30 to 17:30: one run");
  assert.equal(day.gapCount, 1 + 2 + 1, "learner pool 09:00–11:00, two on the main pool, one run of classes");
  const gaps = dayGaps(day);
  const classGap = gaps.find((g) => g.classRefs.length)!;
  assert.deepEqual([classGap.start, classGap.end, classGap.count, classGap.classRefs, classGap.off?.name], [h("16:00"), h("17:30"), 3, ["c1", "c3", "c4"], "Lauren Kelly"]);
  assert.deepEqual(gaps.map((g) => g.start), [h("09:00"), h("12:00"), h("14:00"), h("16:00")], "soonest first");
});

test("someone off on a planned activity is a gap to cover on their place", () => {
  const offDay = buildDay({ date: "2026-10-23", types, names, needs: [need("main", "Main pool", "07:00", "14:00", 1)],
    assignments: [on("a1", "main", 1, "aoife", "07:00", "14:00")], classes: [], off: new Set(["aoife"]) });
  assert.equal(offDay.gapCount, 1);
  assert.deepEqual(dayGaps(offDay).map((g) => [g.start, g.end, g.off?.assignmentId, g.off?.name]), [[h("07:00"), h("14:00"), "a1", "Aoife Byrne"]]);
});

test("warnings: an expired qualification, someone off, someone on two things at once", () => {
  const blocks = day.groups.flatMap((g) => g.lanes.flat());
  assert.deepEqual(blocks.find((b) => b.assignmentId === "a1")!.warnings, ["expired"]);
  assert.deepEqual(blocks.find((b) => b.assignmentId === "a2")!.warnings, ["missing", "overlap"], "no NPLQ recorded; on the learner pool from 11:00 too");
  assert.deepEqual(blocks.find((b) => b.classRef === "c1")!.warnings, ["off"]);
});

test("each person's shift comes from what they are on, in start order", () => {
  assert.deepEqual(day.people.map((p) => [p.name, p.shift.start, p.shift.end, p.activities]), [
    ["Aoife Byrne", h("07:00"), h("14:00"), ["Lifeguarding"]],
    ["Ciara Murphy", h("07:00"), h("15:00"), ["Lifeguarding"]],
    ["Lauren Kelly", h("16:00"), h("16:30"), ["Teaching"]],
    ["Róisín Kelly", h("16:00"), h("16:30"), ["Teaching"]],
  ]);
  assert.deepEqual(day.people[1].warnings, ["missing", "overlap"]);
});

test("no teaching activity on the list means the classes stay off the rota", () => {
  const bare = buildDay({ date: "2026-10-23", types: [types[0]], names, needs: [], assignments: [], classes: [cls("c1", "lauren", "16:00", "16:30")] });
  assert.deepEqual(bare.groups, []);
});
