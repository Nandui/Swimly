import assert from "node:assert/strict";
import { test } from "node:test";
import { areaMinimumsOver, areaNeedsOn } from "@/modules/rota/shared/area-needs";
import { buildDay, isAreaNeed } from "@/modules/rota/shared/day";
import { togetherOf } from "@/lib/setup/area-staffing";

/** Invented site: the main hall (main and learner pool) and the 18 m pool behind a door. One
 *  lifeguard by the door covers the 18 m while both are open. 23 October 2026 is a Friday. */
const h = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const nplq = { typeId: "nplq", typeName: "NPLQ" };
const hall = { id: "hall", name: "Main hall", lanes: 0, openFrom: h("07:00"), openUntil: h("21:00"), weekHours: [], minimums: [{ count: 2, ...nplq }] };
const pool18 = { id: "p18", name: "18 m pool", lanes: 0, openFrom: h("09:00"), openUntil: h("22:00"), weekHours: [], minimums: [{ count: 1, ...nplq }],
  together: [{ withAreaId: "hall", count: 2, typeId: "nplq" }] };
const date = "2026-10-23";

test("while both are open the covered area needs nobody and the other its joint number", () => {
  const needs = areaNeedsOn([hall, pool18], date);
  const of = (id: string) => needs.find((n) => n.areaId === id)!;
  assert.deepEqual(of("p18").off, [{ place: 1, start: h("09:00"), end: h("21:00") }], "the 18 m's lifeguard is not needed 09:00–21:00");
  assert.equal(of("p18").together, "Covered from Main hall 09:00–21:00");
  assert.equal(of("hall").places, 2);
  assert.deepEqual(of("hall").off, [], "2 in all is the hall's own number");
  assert.equal(of("hall").together, "Covers 18 m pool 09:00–21:00: 2 in all");
  // The 18 m alone after the hall closes still needs its own lifeguard.
  assert.deepEqual(areaMinimumsOver([of("p18")]).map((s) => [s.start, s.end, s.minimums[0].count]), [[h("21:00"), h("22:00"), 1]]);
});

test("a joint number above the other area's own adds places only while both are open", () => {
  const needs = areaNeedsOn([hall, { ...pool18, together: [{ withAreaId: "hall", count: 3, typeId: "nplq" }] }], date);
  const main = needs.find((n) => n.areaId === "hall")!;
  assert.equal(main.places, 3);
  assert.deepEqual(main.off, [{ place: 3, start: h("07:00"), end: h("09:00") }]);
  assert.deepEqual(areaMinimumsOver([main]).map((s) => [s.start, s.end, s.minimums[0].count]), [[h("07:00"), h("09:00"), 2], [h("09:00"), h("21:00"), 3]]);
});

test("a joint number below the other area's own leaves its extra places off while both are open", () => {
  const needs = areaNeedsOn([{ ...hall, minimums: [{ count: 3, ...nplq }] }, pool18], date);
  assert.deepEqual(needs.find((n) => n.areaId === "hall")!.off, [{ place: 3, start: h("09:00"), end: h("21:00") }]);
});

test("nothing changes on a day the other area is closed", () => {
  const needs = areaNeedsOn([{ ...hall, weekHours: [{ day: 4, from: null, until: null }] }, pool18], date);
  assert.deepEqual(needs.map((n) => [n.areaId, n.off.length, n.together]), [["p18", 0, null]]);
});

test("on the Plan the covered area shows no gaps while both are open, and the hall's places as usual", () => {
  const d = buildDay({ date, types: [], needs: [], assignments: [], classes: [], names: new Map([["aoife", "Aoife"]]), areas: [hall, pool18],
    areaAssignments: [{ id: "r1", areaId: "hall", typeId: "nplq", place: 1, userId: "aoife", startMinutes: h("07:00"), endMinutes: h("15:00") }] });
  const g18 = d.groups.find((g) => isAreaNeed(g.typeId) && g.place === "18 m pool")!;
  assert.deepEqual(g18.lanes.flat().map((b) => [b.kind, b.start, b.end]), [["gap", h("21:00"), h("22:00")]]);
  assert.equal(g18.needs[0].together, "Covered from Main hall 09:00–21:00");
  const hallGroup = d.groups.find((g) => isAreaNeed(g.typeId) && g.place === "Main hall")!;
  assert.equal(hallGroup.lanes.length, 2);
  assert.ok(hallGroup.gapCount >= 2, "place 2 all day and place 1 after Aoife");
});

test("the stored setting keeps only what makes sense", () => {
  assert.deepEqual(togetherOf([{ withAreaId: "hall", count: 2, typeId: "nplq" }, { withAreaId: "", count: 1 }, { withAreaId: "x", count: 0 }, "nope", { withAreaId: "y", count: 1, typeId: "" }]),
    [{ withAreaId: "hall", count: 2, typeId: "nplq" }, { withAreaId: "y", count: 1, typeId: null }]);
  assert.deepEqual(togetherOf(null), []);
});
