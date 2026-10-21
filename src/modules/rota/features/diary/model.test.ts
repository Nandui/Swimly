import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDiary, candidates, coverActivities, nextChange, stepsOf, whoIsWhere, type DiaryInput } from "@/modules/rota/features/diary/model";

/** The day's diary (owner, 20 October 2026). Invented site and people. */
const h = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const DATE = "2026-10-21";
const NPLQ = "nplq";
const AREA_NEED = `area:main:${NPLQ}:${DATE}`;

const base: DiaryInput = {
  date: DATE,
  departmentId: "aquatics",
  areas: [{ id: "main", name: "Main pool", openFrom: h("07:00"), openUntil: h("15:00"), minimums: [{ count: 2, typeId: NPLQ, typeName: "Lifeguard" }] }],
  types: [
    { id: "aqua", name: "Aqua-fit", departmentId: "aquatics", requiredTypeId: null, requiredName: null, fromClasses: false },
    { id: "host", name: "Party host", departmentId: "aquatics", requiredTypeId: null, requiredName: null, fromClasses: false },
    { id: "desk", name: "Reception", departmentId: "front", requiredTypeId: null, requiredName: null, fromClasses: false },
    { id: "teach", name: "Teaching", departmentId: "aquatics", requiredTypeId: null, requiredName: null, fromClasses: true },
  ],
  needs: [
    { id: "n-aqua", typeId: "aqua", place: "Main pool", start: h("10:30"), end: h("11:30"), places: 1, note: "", bookingTitle: null },
    { id: "n-party", typeId: "host", place: "Main pool", start: h("13:00"), end: h("15:00"), places: 1, note: "", bookingTitle: "Party: Murphy" },
    { id: "n-desk", typeId: "desk", place: "Front desk", start: h("07:00"), end: h("15:00"), places: 1, note: "", bookingTitle: null },
  ],
  assignments: [{ id: "a1", needId: "n-aqua", place: 1, userId: "aoife", start: h("10:30"), end: h("11:30") }],
  areaAssignments: [
    { id: "r1", needId: AREA_NEED, place: 1, userId: "aoife", start: h("07:00"), end: h("10:30") },
    { id: "r2", needId: AREA_NEED, place: 1, userId: "aoife", start: h("11:30"), end: h("15:00") },
    { id: "r3", needId: AREA_NEED, place: 2, userId: "liam", start: h("07:00"), end: h("15:00") },
  ],
  classes: [
    { ref: "c1", title: "Sharks 1", place: "Main pool, lanes 1 and 2", start: h("15:10"), end: h("15:40"), userId: "sean" },
    { ref: "c2", title: "Sharks 2", place: "Main pool, lanes 1 and 2", start: h("15:45"), end: h("16:15"), userId: "sean" },
  ],
  shifts: [{ id: "s1", userId: "niamh", departmentId: "aquatics", start: h("09:00"), end: h("17:00") }],
  breaks: [{ userId: "liam", start: h("12:00"), minutes: 30, paid: false }],
  staff: [
    { userId: "aoife", name: "Aoife Murphy", departmentIds: ["aquatics"], young: null },
    { userId: "liam", name: "Liam Farrell", departmentIds: ["aquatics"], young: null },
    { userId: "niamh", name: "Niamh Kelly", departmentIds: ["aquatics"], young: null },
    { userId: "sean", name: "Seán O'Brien", departmentIds: ["aquatics"], young: null },
    { userId: "ciara", name: "Ciara Walsh", departmentIds: ["front"], young: null },
  ],
  held: ["aoife", "liam", "niamh"].map((userId) => ({ userId, typeId: NPLQ, issuedOn: null, expiresOn: null, revoked: false })),
  off: new Set(),
  elsewhere: new Map(),
};

test("an area's own need and the activities in it are separate needs that add up", () => {
  const d = buildDiary(base);
  assert.deepEqual(d.needs.filter((n) => n.area === "Main pool").map((n) => [n.kind, n.title]), [
    ["area", "Lifeguard on duty"], ["activity", "Aqua-fit"], ["booking", "Party: Murphy"], ["class", "Sharks 1"], ["class", "Sharks 2"],
  ]);
  // Aoife on aqua-fit is not one of the pool's two lifeguards then.
  const lifeguardHoles = d.holes.filter((h) => h.needKey === AREA_NEED);
  assert.ok(lifeguardHoles.some((x) => x.start === h("10:30") && x.end === h("11:30") && x.short === 1));
});

test("a break during someone's work is a hole, and says so", () => {
  const d = buildDiary(base);
  const brk = d.holes.find((x) => x.needKey === AREA_NEED && x.start === h("12:00"))!;
  assert.deepEqual([brk.end, brk.short, brk.why], [h("12:30"), 1, "Liam is on a break"]);
});

test("a department's plan shows its own work and the needs its people can do, not other departments' work", () => {
  const d = buildDiary(base);
  assert.equal(d.needs.some((n) => n.title === "Reception"), false);
  const front = buildDiary({ ...base, departmentId: "front" });
  assert.deepEqual(front.needs.map((n) => n.title), ["Reception"], "nobody on the front desk holds a lifeguard qualification; classes are the pool's");
});

test("needs first, shifts follow: someone's day is what they are on, with their planned shift", () => {
  const d = buildDiary(base);
  const aoife = d.people.find((p) => p.userId === "aoife")!;
  assert.deepEqual(aoife.parts, [{ start: h("07:00"), end: h("15:00") }]);
  assert.ok(aoife.warnings.some((w) => w.kind === "unplaced"), "an 8-hour day owes breaks nobody placed");
  const niamh = d.people.find((p) => p.userId === "niamh")!;
  assert.deepEqual(niamh.free, [{ start: h("09:00"), end: h("17:00") }], "a shift with nothing given yet is all free");
  assert.equal(d.done, false);
});

test("someone's day reads top to bottom, with back-to-back classes as one line", () => {
  const d = buildDiary(base);
  const sean = d.people.find((p) => p.userId === "sean")!;
  const steps = stepsOf(sean);
  assert.deepEqual(steps.map((s) => s.kind), ["work", "finish"]);
  assert.equal(steps[0].kind === "work" && steps[0].count, 2);
  const liam = stepsOf(d.people.find((p) => p.userId === "liam")!);
  assert.deepEqual(liam.map((s) => s.kind), ["work", "break", "finish"]);
});

test("who's where at a moment, and the next change", () => {
  const d = buildDiary(base);
  const at11 = whoIsWhere(d, h("11:00"));
  assert.deepEqual(at11.find((x) => x.need.kind === "area")!.names, ["Liam Farrell"]);
  assert.equal(at11.find((x) => x.need.kind === "area")!.short, 1);
  assert.deepEqual(at11.find((x) => x.need.title === "Aqua-fit")!.names, ["Aoife Murphy"]);
  const next = nextChange(d, h("11:00"))!;
  assert.equal(next.at, h("11:30"));
  assert.deepEqual(next.moves, [{ name: "Aoife Murphy", to: "Main pool" }]);
});

test("who could fill a hole: free and qualified first, own department before others, on shift before a longer day", () => {
  const d = buildDiary(base);
  const party = d.needs.find((n) => n.title === "Party: Murphy")!;
  const list = candidates(d, base, party, { start: h("13:00"), end: h("15:00") }, new Map());
  assert.equal(list[0].userId, "niamh", "on shift then and free");
  assert.equal(list[0].effect, "On shift then");
  const ciara = list.find((c) => c.userId === "ciara")!;
  assert.equal(ciara.own, false, "another department's person can be picked straight away");
  assert.ok(list.indexOf(ciara) > list.findIndex((c) => c.userId === "sean"), "own people first");
  assert.equal(list.find((c) => c.userId === "aoife")!.why, "Busy: Main pool 11:30–15:00");
  const guard = d.needs.find((n) => n.kind === "area")!;
  assert.equal(candidates(d, base, guard, { start: h("12:00"), end: h("12:30") }, new Map()).find((c) => c.userId === "ciara")!.why, "Needs Lifeguard");
});

test("a day is done when every need is filled", () => {
  const filled = buildDiary({
    ...base,
    needs: base.needs.filter((n) => n.id === "n-aqua"),
    areaAssignments: [...base.areaAssignments, { id: "r4", needId: AREA_NEED, place: 3, userId: "niamh", start: h("10:30"), end: h("11:30") }, { id: "r5", needId: AREA_NEED, place: 3, userId: "niamh", start: h("12:00"), end: h("12:30") }],
  });
  assert.deepEqual(filled.holes, []);
  assert.equal(filled.done, true);
});

test("an area belongs to a department, and a sub-area reads with the area it is part of", () => {
  const areas = [
    { id: "pool", name: "Pool", departmentId: "aquatics", parentName: null },
    { id: "main", name: "Main pool", openFrom: h("07:00"), openUntil: h("15:00"), minimums: [{ count: 2, typeId: NPLQ, typeName: "Lifeguard" }], departmentId: "aquatics", parentName: "Pool" },
    { id: "desk", name: "Front desk", openFrom: h("07:00"), openUntil: h("15:00"), minimums: [{ count: 1, typeId: null, typeName: null }], departmentId: "front", parentName: null },
  ];
  const d = buildDiary({ ...base, areas });
  const guard = d.needs.find((n) => n.kind === "area")!;
  assert.deepEqual([guard.area, guard.group, guard.departmentId], ["Main pool", "Pool", "aquatics"]);
  assert.equal(d.needs.find((n) => n.title === "Aqua-fit")!.group, "Pool", "an activity in a sub-area reads with its parent");
  assert.equal(d.needs.some((n) => n.area === "Front desk" && n.kind === "area"), false, "another department's area stays on its plan, though anyone could do it");
  const front = buildDiary({ ...base, areas, departmentId: "front" });
  assert.ok(front.needs.some((n) => n.area === "Front desk" && n.kind === "area"));
});

test("sub-activities on someone's line read in order, at the start, any time, at a time and at the end", () => {
  const d = buildDiary({ ...base, assignments: [{ ...base.assignments[0], subs: [
    { name: "Close the cash till", when: "end", at: null }, { name: "Cash drop", when: "at", at: h("11:00") },
    { name: "Answer the phone", when: "during", at: null }, { name: "Open the cash till", when: "start", at: null },
  ] }] });
  const line = d.people.find((p) => p.userId === "aoife")!.lines.find((l) => l.title === "Aqua-fit")!;
  assert.deepEqual(line.subs.map((x) => [x.name, x.at]), [["Open the cash till", h("10:30")], ["Answer the phone", null], ["Cash drop", h("11:00")], ["Close the cash till", h("11:30")]]);
});

test("a sub-activity done any time reads at the time the Plan placed it, each placing on its own", () => {
  // Owner, 21 October 2026: "the sub activities can be assigned at any time, during that activity, directly on the plan".
  const d = buildDiary({ ...base, assignments: [{ ...base.assignments[0], start: h("10:00"), end: h("17:00"), subs: [
    { id: "s1", name: "Answer the phone", when: "during", at: h("15:00"), times: [h("15:00")] },
    { id: "s2", name: "Answer the phone", when: "during", at: h("12:30"), times: [h("12:30")] },
    { id: "s3", name: "Tidy the desk", when: "during", at: null },
  ] }] });
  const line = d.people.find((p) => p.userId === "aoife")!.lines.find((l) => l.title === "Aqua-fit")!;
  assert.deepEqual(line.subs.map((x) => [x.id, x.at]), [["s3", null], ["s2", h("12:30")], ["s1", h("15:00")]]);
});

test("a sub-activity at several set times reads once for each", () => {
  const d = buildDiary({ ...base, assignments: [{ ...base.assignments[0], start: h("10:00"), end: h("17:00"), subs: [{ name: "Cash drop", when: "at", at: h("12:00"), times: [h("12:00"), h("16:00")] }] }] });
  const line = d.people.find((p) => p.userId === "aoife")!.lines.find((l) => l.title === "Aqua-fit")!;
  assert.deepEqual(line.subs.map((x) => [x.name, x.at]), [["Cash drop", h("12:00")], ["Cash drop", h("16:00")]]);
});

test("an area's activity line counts only people on that activity there, and says when nobody is", () => {
  // Owner, 21 October 2026: Reception needs at least one person on Serving customers 09:00–17:00,
  // and two from 12:00 to 14:00. Ciara is on it in Till 1 (part of Reception) 09:00–12:00; Liam is
  // in Reception on another activity, which does not count.
  const LINE = `area:rec:act-serve:${DATE}`;
  const d = buildDiary({ ...base, departmentId: "front",
    areas: [
      { id: "rec", name: "Reception", openFrom: h("08:00"), openUntil: h("20:00"), departmentId: "front",
        minimums: [{ count: 1, typeId: null, typeName: null, activityTypeId: "serve", activityName: "Serving customers", from: h("09:00"), until: h("17:00") },
          { count: 2, typeId: null, typeName: null, activityTypeId: "serve", activityName: "Serving customers", from: h("12:00"), until: h("14:00") }] },
      { id: "till1", name: "Till 1", parentName: "Reception", departmentId: "front" },
    ],
    types: [...base.types, { id: "serve", name: "Serving customers", departmentId: "front", requiredTypeId: null, requiredName: null, fromClasses: false }],
    needs: [
      { id: "n-serve", typeId: "serve", place: "Till 1", start: h("09:00"), end: h("17:00"), places: 0, note: "", bookingTitle: null },
      { id: "n-desk", typeId: "desk", place: "Reception", start: h("09:00"), end: h("17:00"), places: 0, note: "", bookingTitle: null },
    ],
    assignments: [
      { id: "a-ciara", needId: "n-serve", place: 1, userId: "ciara", start: h("09:00"), end: h("12:00") },
      { id: "a-liam", needId: "n-desk", place: 1, userId: "liam", start: h("09:00"), end: h("17:00") },
    ],
    areaAssignments: [], breaks: [], shifts: [], classes: [] });
  const line = d.needs.find((n) => n.key === LINE)!;
  assert.deepEqual([line.kind, line.title, line.area, line.typeId], ["area", "Serving customers", "Reception", "serve"]);
  assert.deepEqual(d.holes.filter((x) => x.needKey === LINE).map((x) => [x.start, x.end, x.short, x.why]), [
    [h("12:00"), h("14:00"), 2, "Needs 2 on it, nobody yet"], [h("14:00"), h("17:00"), 1, "Nobody on it yet"]]);
  // Who's where at 10:00 reads Ciara under Reception's line, and not again under the record holding her.
  const at10 = whoIsWhere(d, h("10:00"));
  assert.deepEqual(at10.find((w) => w.need.key === LINE)!.names, ["Ciara Walsh"]);
  assert.equal(at10.some((w) => w.need.key === "n-serve"), false);
});

test("someone on an activity in an area covers its staff needed for that time (owner, 21 October 2026)", () => {
  const RECEPTION = `area:rec:*:${DATE}`;
  const input: DiaryInput = {
    ...base, departmentId: "front",
    areas: [...base.areas,
      { id: "rec", name: "Reception", departmentId: "front", openFrom: h("07:00"), openUntil: h("21:00"), minimums: [{ count: 1, typeId: null, typeName: null }] },
      { id: "till2", name: "Till 2", departmentId: "front", parentName: "Reception" }],
    types: [...base.types, { id: "till", name: "Till", departmentId: "front", requiredTypeId: null, requiredName: null, fromClasses: false }],
    needs: [...base.needs, { id: "n-till", typeId: "till", place: "Till 2", start: h("12:00"), end: h("15:15"), places: 1, note: "", bookingTitle: null }],
    assignments: [...base.assignments, { id: "a-maeve", needId: "n-till", place: 1, userId: "ciara", start: h("12:00"), end: h("15:15") }],
  };
  const d = buildDiary(input);
  assert.deepEqual(d.holes.filter((x) => x.needKey === RECEPTION).map((x) => [x.start, x.end]), [[h("07:00"), h("12:00")], [h("15:15"), h("21:00")]],
    "Ciara on the till, in a part of Reception, covers Reception 12:00–15:15");
  assert.deepEqual(whoIsWhere(d, h("13:00")).find((w) => w.need.key === RECEPTION)?.names, ["Ciara Walsh"]);
  // Without her, the whole day is a gap.
  assert.deepEqual(buildDiary({ ...input, assignments: base.assignments }).holes.filter((x) => x.needKey === RECEPTION).map((x) => [x.start, x.end]), [[h("07:00"), h("21:00")]]);
});

test("an activity with no lifeguard qualification is not one of the pool's lifeguards; one asking for it is", () => {
  const guard = { id: "guard", name: "Pool watch", departmentId: "aquatics", requiredTypeId: NPLQ, requiredName: "Lifeguard", fromClasses: false };
  const input: DiaryInput = { ...base, types: [...base.types, guard],
    needs: [...base.needs, { id: "n-guard", typeId: "guard", place: "Main pool", start: h("10:30"), end: h("11:30"), places: 1, note: "", bookingTitle: null }],
    assignments: [...base.assignments, { id: "a-niamh", needId: "n-guard", place: 1, userId: "niamh", start: h("10:30"), end: h("11:30") }] };
  const d = buildDiary(input);
  assert.equal(d.holes.some((x) => x.needKey === AREA_NEED && x.start < h("11:30") && h("10:30") < x.end), false, "Niamh on Pool watch fills the place Aoife left for aqua-fit");
});

test("choosing someone for an area's gap offers the area's own activities, those on there that day first", () => {
  const input: DiaryInput = {
    ...base, departmentId: "front",
    areas: [{ id: "rec", name: "Reception", departmentId: "front", openFrom: h("07:00"), openUntil: h("21:00"), minimums: [{ count: 1, typeId: null, typeName: null }] }],
    needs: [{ id: "n-serve", typeId: "serve", place: "Reception", start: h("09:00"), end: h("10:00"), places: 1, note: "", bookingTitle: null }],
    types: [...base.types, { id: "serve", name: "Serving customers", departmentId: "front", requiredTypeId: null, requiredName: null, fromClasses: false }],
    assignments: [{ id: "a-s", needId: "n-serve", place: 1, userId: "ciara", start: h("09:00"), end: h("10:00") }], areaAssignments: [], classes: [],
  };
  const d = buildDiary(input);
  const need = d.needs.find((n) => n.key === `area:rec:*:${DATE}`)!;
  const list = [{ id: "desk", departmentId: "front", requiredTypeId: null }, { id: "serve", departmentId: "front", requiredTypeId: null },
    { id: "aqua", departmentId: "aquatics", requiredTypeId: null }];
  assert.deepEqual(coverActivities(need, list, d.people.flatMap((p) => p.lines)).map((a) => a.id), ["serve", "desk"]);
  assert.deepEqual(coverActivities(d.needs.find((n) => n.kind === "activity")!, list, []), []);
});
