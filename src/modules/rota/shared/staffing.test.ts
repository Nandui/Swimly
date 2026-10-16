import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDay, type DayType } from "@/modules/rota/shared/day";
import { inUse, minimumWords, shortOf, staffingSpans, type AreaMinimum } from "@/modules/rota/shared/staffing";

/** Invented site and people. */
const h = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const guards = new Set(["aoife", "ciara", "dara"]);
const holds = (userId: string, typeId: string) => typeId === "nplq" && guards.has(userId);
const rule: AreaMinimum[] = [{ count: 2, typeId: "nplq", typeName: "NPLQ" }, { count: 1, typeId: null, typeName: null }];

test("a qualified place takes only someone holding it; anyone takes whoever is left", () => {
  assert.deepEqual(shortOf(rule, ["aoife", "ciara", "eoin"], holds), { have: 3, short: [] });
  assert.deepEqual(shortOf(rule, ["eoin", "aoife"], holds).short, [{ count: 1, typeId: "nplq", typeName: "NPLQ" }], "Eoin fills anyone, not a lifeguard place");
  // A greedy fill would spend Aoife on anyone first; the matching moves her to a lifeguard place.
  assert.deepEqual(shortOf([{ count: 1, typeId: null, typeName: null }, { count: 1, typeId: "nplq", typeName: "NPLQ" }], ["aoife", "eoin"], holds), { have: 2, short: [] });
  assert.equal(minimumWords(rule), "2 NPLQ, 1 anyone");
});

test("in use while anything is on in it, and through its opening hours", () => {
  assert.deepEqual(inUse({ openFrom: null, openUntil: null }, [{ start: h("09:00"), end: h("10:00") }, { start: h("10:00"), end: h("11:00") }]), [{ start: h("09:00"), end: h("11:00") }]);
  assert.deepEqual(inUse({ openFrom: h("07:00"), openUntil: h("22:00") }, [{ start: h("21:00"), end: h("22:30") }]), [{ start: h("07:00"), end: h("22:30") }]);
});

test("stretches short of the minimum, and of what", () => {
  const spans = staffingSpans(rule, [{ start: h("07:00"), end: h("12:00") }],
    [{ userId: "aoife", start: h("07:00"), end: h("12:00") }, { userId: "ciara", start: h("07:00"), end: h("10:00") }, { userId: "eoin", start: h("07:00"), end: h("12:00") }], holds);
  assert.deepEqual(spans.map((s) => [s.start, s.end, s.have, s.short.map((m) => `${m.count} ${m.typeName ?? "anyone"}`)]), [
    [h("07:00"), h("10:00"), 3, []],
    [h("10:00"), h("12:00"), 2, ["1 NPLQ"]],
  ]);
});

const types: DayType[] = [{ id: "guard", name: "Lifeguarding", icon: "lifeguard", departmentId: "pool", requiredTypeId: "nplq", requiredName: "NPLQ", fromClasses: false }];
const names = new Map([["aoife", "Aoife"], ["ciara", "Ciara"], ["dara", "Dara"]]);
const held = [...guards].map((userId) => ({ userId, typeId: "nplq", issuedOn: null, expiresOn: null, revoked: false }));
const twoGuards = [{ name: "Main pool", lanes: 0, minimums: [{ count: 2, typeId: "nplq", typeName: "NPLQ" }] }];
const guarding = (people: string[], pinned?: Map<string, { start: number; minutes: number; paid: boolean }[]>, areas: typeof twoGuards = twoGuards) => buildDay({
  date: "2026-10-23", types, names, held, areas, pinned,
  needs: [{ id: "main", typeId: "guard", place: "Main pool", startMinutes: h("07:00"), endMinutes: h("14:00"), places: people.length, note: "", repeatTitle: null }],
  assignments: people.map((userId, i) => ({ id: `a${i}`, needId: "main", place: i + 1, userId, startMinutes: h("07:00"), endMinutes: h("14:00") })),
  classes: [],
});

test("with a spare lifeguard, breaks owed with no free time are suggested so the pool keeps its minimum", () => {
  const day = guarding(["aoife", "ciara", "dara"]);
  const breaks = day.people.flatMap((p) => p.shift.parts.flatMap((x) => x.breaks.map((b) => ({ userId: p.userId, ...b }))));
  assert.equal(breaks.length, 6, "two breaks each, none left unplaced");
  assert.ok(day.people.every((p) => p.shift.parts.every((x) => !x.unplaced.length)));
  assert.equal(day.staffing[0].shortCount, 0, "never two away at once");
  assert.ok(day.people.every((p) => p.breakClashes.every((c) => c.covered)), "no cover needed");
});

test("with no spare, the break still goes in and the pool shows short, needing cover", () => {
  const day = guarding(["aoife", "ciara"]);
  assert.ok(day.staffing[0].shortCount > 0);
  assert.deepEqual(day.staffing[0].spans.find((s) => s.short.length)!.short, [{ count: 1, typeId: "nplq", typeName: "NPLQ" }]);
  assert.ok(day.people.some((p) => p.breakClashes.some((c) => !c.covered)));
});

test("a placed break that leaves the pool short shows as a gap", () => {
  const day = guarding(["aoife", "ciara", "dara"], new Map([["aoife", [{ start: h("10:00"), minutes: 30, paid: false }]], ["ciara", [{ start: h("10:15"), minutes: 30, paid: false }]]]));
  const short = day.staffing[0].spans.filter((s) => s.short.length).map((s) => [s.start, s.end]);
  assert.deepEqual(short, [[h("10:15"), h("10:30")]], "Aoife and Ciara both away 10:15 to 10:30");
});

test("an area with no minimum keeps the old rule: a break never takes someone off an activity", () => {
  const day = guarding(["aoife", "ciara", "dara"], undefined, [{ name: "Main pool", lanes: 0, minimums: [] }]);
  assert.equal(day.staffing.length, 0);
  assert.ok(day.people.every((p) => p.shift.parts.every((x) => x.unplaced.length === 2 && !x.breaks.length)));
});

test("a swim class's teacher counts toward the area they teach in", () => {
  const day = buildDay({ date: "2026-10-23", types, names, held, needs: [], assignments: [],
    areas: [{ name: "Learner pool", lanes: 0, minimums: [{ count: 1, typeId: null, typeName: null }] }],
    classes: [{ ref: "c1", userId: "aoife", startMinutes: h("16:00"), endMinutes: h("16:30"), title: "Stage 3", place: "Learner pool, lane 3", planned: false },
      { ref: "c2", userId: null, startMinutes: h("16:30"), endMinutes: h("17:00"), title: "Stage 4", place: "Learner pool, lane 2", planned: false }] });
  assert.deepEqual(day.staffing[0].spans.map((s) => [s.start, s.end, s.have]), [[h("16:00"), h("16:30"), 1], [h("16:30"), h("17:00"), 0]], "nobody teaches the second class");
});
