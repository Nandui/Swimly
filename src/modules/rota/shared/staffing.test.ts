import assert from "node:assert/strict";
import { test } from "node:test";
import { hoursOn, lineLabel, roleFor, staffingWords } from "@/lib/setup/area-staffing";
import { ANY_DEPARTMENT, areaNeedOf, buildDay, dayGaps, isAreaNeed, type DayAreaAssignment, type DayType } from "@/modules/rota/shared/day";
import { needRows } from "@/modules/rota/shared/plan-rows";
import { shortOf, staffingSpans, type AreaMinimum } from "@/modules/rota/shared/staffing";

/** Invented site and people. 23 October 2026 is a Friday, the 24th a Saturday. */
const h = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const guards = new Set(["aoife", "ciara", "dara"]);
const holds = (userId: string, typeId: string) => typeId === "nplq" && guards.has(userId);
const rule: AreaMinimum[] = [{ count: 2, typeId: "nplq", typeName: "NPLQ" }, { count: 1, typeId: null, typeName: null }];

test("a qualified place takes only someone holding it; anyone takes whoever is left", () => {
  assert.deepEqual(shortOf(rule, ["aoife", "ciara", "eoin"], holds), { have: 3, short: [] });
  assert.deepEqual(shortOf(rule, ["eoin", "aoife"], holds).short, [{ count: 1, typeId: "nplq", typeName: "NPLQ" }], "Eoin fills anyone, not a lifeguard place");
  // A greedy fill would spend Aoife on anyone first; the matching moves her to a lifeguard place.
  assert.deepEqual(shortOf([{ count: 1, typeId: null, typeName: null }, { count: 1, typeId: "nplq", typeName: "NPLQ" }], ["aoife", "eoin"], holds), { have: 2, short: [] });
});

test("stretches short of what the area needs, and of what", () => {
  const spans = staffingSpans(rule, [{ start: h("07:00"), end: h("12:00") }],
    [{ userId: "aoife", start: h("07:00"), end: h("12:00") }, { userId: "ciara", start: h("07:00"), end: h("10:00") }, { userId: "eoin", start: h("07:00"), end: h("12:00") }], holds);
  assert.deepEqual(spans.map((s) => [s.start, s.end, s.have, s.short.map((m) => `${m.count} ${m.typeName ?? "anyone"}`)]), [
    [h("07:00"), h("10:00"), 3, []],
    [h("10:00"), h("12:00"), 2, ["1 NPLQ"]],
  ]);
});

const pool = { id: "pool25", name: "25m pool", lanes: 0, openFrom: h("07:00"), openUntil: h("14:00"),
  weekHours: [{ day: 5, from: h("09:00"), until: h("13:00") }, { day: 6, from: null, until: null }], minimums: [{ count: 2, typeId: "nplq", typeName: "NPLQ" }] };

test("an area's hours: its own on a weekday, closed on another, every day's otherwise", () => {
  assert.deepEqual(hoursOn(pool, "2026-10-23"), { start: h("07:00"), end: h("14:00") }, "Friday keeps every day's hours");
  assert.deepEqual(hoursOn(pool, "2026-10-24"), { start: h("09:00"), end: h("13:00") }, "Saturday has its own");
  assert.equal(hoursOn(pool, "2026-10-25"), null, "closed on Sunday");
  assert.equal(staffingWords(pool), "Needs 2 × NPLQ · open 07:00 to 14:00, Saturday 09:00 to 13:00, Sunday closed");
});

const types: DayType[] = [{ id: "guard", name: "Lifeguarding", icon: "lifeguard", departmentId: "pool", requiredTypeId: "nplq", requiredName: "NPLQ", fromClasses: false }];
const names = new Map([["aoife", "Aoife"], ["ciara", "Ciara"], ["dara", "Dara"], ["eoin", "Eoin"]]);
const held = [...guards].map((userId) => ({ userId, typeId: "nplq", issuedOn: null, expiresOn: null, revoked: false }));
const onPool = (people: string[]): DayAreaAssignment[] => people.map((userId, i) => ({ id: `r${i}`, areaId: "pool25", typeId: "nplq", place: i + 1, userId, startMinutes: h("07:00"), endMinutes: h("14:00") }));
const day = (date: string, areaAssignments: DayAreaAssignment[], extra: Partial<Parameters<typeof buildDay>[0]> = {}) =>
  buildDay({ date, types, names, held, areas: [pool], needs: [], assignments: [], classes: [], areaAssignments, ...extra });

test("an area's need is on the Plan in its own right, with a place for each staff it needs while open", () => {
  const d = day("2026-10-23", []);
  const g = d.groups.find((x) => isAreaNeed(x.typeId))!;
  assert.equal(g.name, "NPLQ on duty");
  assert.equal(g.departmentId, ANY_DEPARTMENT, "on every department's plan");
  assert.equal(g.requiredTypeId, "nplq");
  assert.deepEqual(g.needs.map((n) => [n.startMinutes, n.endMinutes, n.places]), [[h("07:00"), h("14:00"), 2]]);
  assert.deepEqual(areaNeedOf(g.needs[0].id), { areaId: "pool25", typeId: "nplq", activityTypeId: null, date: "2026-10-23" });
  assert.deepEqual(areaNeedOf("area:rec:act-serve:2026-10-23"), { areaId: "rec", typeId: null, activityTypeId: "serve", date: "2026-10-23" }, "an activity line names its activity");
  assert.equal(g.gapCount, 2, "both places to fill");
  assert.equal(needRows(d.groups)[0].kind, "area");
  assert.equal(day("2026-10-25", []).groups.length, 0, "nothing while it is closed");
  assert.deepEqual(day("2026-10-24", []).groups[0].needs.map((n) => [n.startMinutes, n.endMinutes]), [[h("09:00"), h("13:00")]]);
});

test("staff on an activity in the area fill its need for that time (owner, 21 October 2026); on a booking they do not", () => {
  const assignments = [{ id: "a1", needId: "lg", place: 1, userId: "aoife", startMinutes: h("07:00"), endMinutes: h("14:00") }, { id: "a2", needId: "lg", place: 2, userId: "ciara", startMinutes: h("07:00"), endMinutes: h("10:00") }];
  const lifeguarding = { id: "lg", typeId: "guard", place: "25m pool", startMinutes: h("07:00"), endMinutes: h("14:00"), places: 2, note: "", repeatTitle: null };
  const d = day("2026-10-23", [], { needs: [lifeguarding], assignments });
  const area = d.groups.find((x) => isAreaNeed(x.typeId))!;
  assert.equal(area.gapCount, 1);
  assert.deepEqual(dayGaps(d).filter((g) => g.group === area).map((g) => [g.start, g.end]), [[h("10:00"), h("14:00")]], "Ciara's place after she leaves");
  const booked = day("2026-10-23", [], { needs: [{ ...lifeguarding, repeatTitle: "Lane hire" }], assignments });
  assert.equal(booked.groups.find((x) => isAreaNeed(x.typeId))!.gapCount, 2);
  // And a break never takes them off the activity (the old rule).
  assert.ok(d.people.every((p) => p.shift.parts.every((x) => !x.breaks.length)));
});

test("someone not holding the qualification shows a warning on the place, never refused", () => {
  const d = day("2026-10-23", [{ id: "r9", areaId: "pool25", typeId: "nplq", place: 1, userId: "eoin", startMinutes: h("07:00"), endMinutes: h("10:00") }]);
  const block = d.groups[0].lanes[0].find((b) => b.kind === "on")!;
  assert.deepEqual(block.warnings, ["missing"]);
  assert.equal(block.assignmentId, "area:r9");
});

test("breaks on the area's need go in one at a time, each a place to fill for its time", () => {
  const d = day("2026-10-23", onPool(["aoife", "ciara"]));
  const g = d.groups[0];
  const breaks = d.people.flatMap((p) => p.shift.parts.flatMap((x) => x.breaks));
  assert.equal(breaks.length, 4, "two breaks each, none left to place");
  const gaps = g.lanes.flat().filter((b) => b.kind === "gap");
  assert.equal(gaps.length, 4);
  assert.equal(g.gapCount, 4);
  for (const x of gaps) assert.ok(gaps.every((y) => x === y || x.end <= y.start || y.end <= x.start), "never both away at once");
  assert.ok(gaps.every((x) => /'s break$/.test(x.detail ?? "")));
  assert.ok(d.people.every((p) => !p.breakClashes.length && !p.warnings.includes("break")), "the gap shows instead of a warning");
  assert.equal(dayGaps(d).length, 4, "on Today's list too");
  // Someone free can take it.
  const eoin = buildDay({ date: "2026-10-23", types, names, held, areas: [pool], needs: [], assignments: [], classes: [], areaAssignments: onPool(["aoife", "ciara"]),
    planned: [{ id: "s1", userId: "dara", departmentId: "pool", startMinutes: h("07:00"), endMinutes: h("14:00") }] });
  assert.ok(eoin.people.find((p) => p.userId === "dara")!.options.some((o) => o.ok && o.needId === g.needs[0].id));
});

const roles = [{ id: "lead", name: "Aquatics lead", typeIds: ["nplq"], holders: 1 }, { id: "guard", name: "Lifeguard", typeIds: ["nplq", "first-aid"], holders: 4 },
  { id: "teacher", name: "Swim teacher", typeIds: ["nplq", "sti"], holders: 4 }, { id: "desk", name: "Receptionist", typeIds: [], holders: 1 }];

test("an area asks for a role; its qualification only says who can fill it", () => {
  assert.deepEqual(roleFor({ typeId: "nplq" }, roles), { id: "guard", name: "Lifeguard" }, "a line from before takes the role needing it that most people hold, Admin's order between equals");
  assert.deepEqual(roleFor({ roleId: "teacher", typeId: "nplq" }, roles), { id: "teacher", name: "Swim teacher" }, "a named role wins");
  assert.equal(roleFor({ typeId: null }, roles), null, "anyone has no role");
  assert.equal(roleFor({ typeId: "nplq" }, [{ ...roles[1], archived: true }]), null, "an archived role is not guessed");
  const named = [{ count: 2, typeId: "nplq", typeName: "NPLQ", roleName: "Lifeguard" }, { count: 1, typeId: null, typeName: null, roleName: "Receptionist" }, { count: 1, typeId: null, typeName: null, roleName: "Duty manager" }];
  assert.equal(lineLabel(named, "nplq"), "Lifeguard");
  assert.equal(lineLabel(named, null), "Receptionist or Duty manager", "roles anyone can fill share a need");
  assert.equal(staffingWords({ ...pool, minimums: named }), "Needs 2 × Lifeguard, 1 × Receptionist and 1 × Duty manager · open 07:00 to 14:00, Saturday 09:00 to 13:00, Sunday closed");
  const d = buildDay({ date: "2026-10-23", types, names, held, areas: [{ ...pool, minimums: [{ ...pool.minimums[0], roleName: "Lifeguard" }] }], needs: [], assignments: [], classes: [], areaAssignments: [] });
  const g = d.groups.find((x) => isAreaNeed(x.typeId))!;
  assert.equal(g.name, "Lifeguard on duty");
  assert.equal(g.requiredName, "NPLQ", "the qualification still decides who can be put on it");
});
