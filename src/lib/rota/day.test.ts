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
const areas = ["Main pool", "Learner pool"];
const need = (id: string, place: string, a: string, b: string, places: number) => ({ id, typeId: "guard", place, startMinutes: h(a), endMinutes: h(b), places, note: "", repeatTitle: null });
const on = (id: string, needId: string, place: number, userId: string, a: string, b: string) => ({ id, needId, place, userId, startMinutes: h(a), endMinutes: h(b) });
const cls = (ref: string, userId: string | null, a: string, b: string) => ({ ref, userId, startMinutes: h(a), endMinutes: h(b), title: "Stage 3", place: "Learner pool, lane 3", planned: false });

const day = buildDay({
  date: "2026-10-23", types, names, areas,
  needs: [need("main", "Main pool", "07:00", "21:30", 2), need("learner", "Learner pool", "09:00", "15:00", 1)],
  assignments: [on("a1", "main", 1, "aoife", "07:00", "14:00"), on("a2", "main", 2, "ciara", "07:00", "12:00"), on("a3", "learner", 1, "ciara", "11:00", "15:00")],
  classes: [cls("c1", "lauren", "16:00", "16:30"), cls("c2", "roisin", "16:00", "16:30"), cls("c3", null, "16:30", "17:00"), cls("c4", null, "17:00", "17:30")],
  held: [{ userId: "aoife", typeId: "nplq", issuedOn: "2020-01-01", expiresOn: "2026-10-01", revoked: false }],
  off: new Set(["lauren"]),
});

test("reads by area in the site's order, each with its activities; classes join the area their location names", () => {
  assert.deepEqual(day.zones.map((z) => [z.name, z.groups.map((g) => [g.name, g.lanes.length])]), [
    ["Main pool", [["Lifeguarding", 2]]],
    ["Learner pool", [["Lifeguarding", 1], ["Teaching", 3]]],
  ], "a lane per teacher, then the classes nobody teaches");
  assert.equal(day.zones[1].gapCount, 1 + 2, "an area's gaps are its activities' gaps");
});

test("a place that is not one of the site's areas shows as its own, flagged, after them", () => {
  const odd = buildDay({ date: "2026-10-23", types, names, areas, needs: [need("n", "main POOL", "07:00", "08:00", 1)], assignments: [],
    classes: [{ ...cls("c9", "lauren", "16:00", "16:30"), place: "Teaching pool, lane 1" }] });
  assert.deepEqual(odd.zones.map((z) => [z.name, z.unmatched]), [["Main pool", false], ["Teaching pool", true]], "matched ignoring case; the detail after a comma ignored");
});

test("each place is a lane of people and gaps", () => {
  const main = day.groups.find((g) => g.place === "Main pool")!;
  assert.deepEqual(main.lanes.map((l) => l.map((b) => [b.kind, b.name, b.start, b.end])), [
    [["on", "Aoife Byrne", h("07:00"), h("14:00")], ["gap", null, h("14:00"), h("21:30")]],
    [["on", "Ciara Murphy", h("07:00"), h("12:00")], ["gap", null, h("12:00"), h("21:30")]],
  ]);
  assert.equal(main.gapCount, 2);
});

test("back-to-back classes nobody teaches count as one gap; a teacher who is off is another", () => {
  const teaching = day.groups.find((g) => g.fromClasses)!;
  assert.equal(teaching.gapCount, 2, "Lauren is off at 16:00; nobody teaches 16:30 to 17:30");
  assert.equal(day.gapCount, 1 + 2 + 2, "learner pool 09:00–11:00, two on the main pool, two in teaching");
  const gaps = dayGaps(day).filter((g) => g.classRefs.length);
  assert.deepEqual(gaps.map((g) => [g.start, g.end, g.count, g.classRefs, g.off?.name ?? null]), [
    [h("16:00"), h("16:30"), 1, ["c1"], "Lauren Kelly"],
    [h("16:30"), h("17:30"), 2, ["c3", "c4"], null],
  ]);
  assert.deepEqual(dayGaps(day).map((g) => g.start), [h("09:00"), h("12:00"), h("14:00"), h("16:00"), h("16:30")], "soonest first");
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

test("someone on a planned shift: the day's gaps inside it they could take, and why not", () => {
  const planned = buildDay({
    date: "2026-10-23", types, names: new Map([...names, ["nia", "Nia Walsh"]]), areas,
    needs: [need("main", "Main pool", "07:00", "21:30", 1)],
    assignments: [on("a1", "main", 1, "aoife", "07:00", "14:00")],
    classes: [],
    held: [{ userId: "nia", typeId: "nplq", issuedOn: "2025-01-01", expiresOn: null, revoked: false }],
    planned: [{ id: "s1", userId: "nia", departmentId: "pool", startMinutes: h("15:00"), endMinutes: h("21:00") }, { id: "s2", userId: "ciara", departmentId: "pool", startMinutes: h("15:00"), endMinutes: h("21:00") }],
    pinned: new Map([["aoife", [{ start: h("10:00"), minutes: 30, paid: false }]]]),
  });
  const nia = planned.people.find((p) => p.userId === "nia")!;
  assert.equal(nia.activities.length, 0, "on the plan with nothing yet");
  const [option] = nia.options;
  assert.equal(option.ok, true);
  assert.equal(option.needId, "main");
  assert.deepEqual([option.start, option.end], [h("15:00"), h("21:00")], "all of their shift: suggested breaks move once it is taken");
  assert.equal(planned.people.find((p) => p.userId === "ciara")!.options[0].why, "Needs NPLQ", "not qualified: offered with the reason");
  const aoife = planned.people.find((p) => p.userId === "aoife")!;
  assert.deepEqual(aoife.breakClashes.map((c) => [c.start, c.end]), [[h("10:00"), h("10:30")]], "a placed break during an activity needs cover");
  assert.ok(aoife.warnings.includes("break"));
});
