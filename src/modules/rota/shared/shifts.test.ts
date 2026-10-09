import assert from "node:assert/strict";
import { test } from "node:test";
import { youngRest } from "@/modules/rota/shared/constants";
import { dayShift } from "@/modules/rota/shared/shifts";

/** Planned shifts, the manager's breaks, and under-18 rest (owner decision, 8 October 2026). */
const h = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const work = (a: string, b: string, label = "Lifeguarding") => ({ start: h(a), end: h(b), label });

test("a planned shift is the shift, whatever its activities; work outside it makes one of its own", () => {
  const shift = dayShift([work("08:00", "10:00"), work("19:00", "21:00")], null, { planned: [{ start: h("07:00"), end: h("15:00") }] })!;
  assert.deepEqual(shift.parts.map((p) => [p.start, p.end, p.planned]), [[h("07:00"), h("15:00"), true], [h("19:00"), h("21:00"), false]]);
  const empty = dayShift([], null, { planned: [{ start: h("15:00"), end: h("21:00") }] })!;
  assert.equal(empty.parts[0].breaks.length, 2, "6 hours: a paid 15 and an unpaid 30, suggested in the free shift");
  assert.equal(empty.paidMinutes, 6 * 60 - 30);
});

test("the manager's breaks are kept where they put them, even during an activity; the rest are suggested", () => {
  const shift = dayShift([work("07:00", "15:00")], null, { planned: [{ start: h("07:00"), end: h("15:00") }], pinned: [{ start: h("11:00"), minutes: 30, paid: false }] })!;
  const [part] = shift.parts;
  assert.deepEqual(part.breaks.filter((b) => b.pinned).map((b) => [b.start, b.paid]), [[h("11:00"), false]]);
  assert.equal(part.unplaced.length, 2, "the two paid 15s find no free time");
  // A placed break that no longer matches what is owed (another length) is left out.
  const other = dayShift([work("07:00", "15:00")], null, { planned: [{ start: h("07:00"), end: h("15:00") }], pinned: [{ start: h("11:00"), minutes: 45, paid: false }] })!;
  assert.equal(other.parts[0].breaks.some((b) => b.pinned), false);
});

test("under-18 rest: 12 hours between shifts (14 under 16) and two days off a week, as warnings", () => {
  const days = new Map([["2026-10-21", { start: h("14:00"), end: h("22:00") }], ["2026-10-22", { start: h("08:00"), end: h("14:00") }]]);
  const [w] = youngRest("under18", "2026-10-22", days);
  assert.match(w, /Finished at 22:00 .* 12 hours off, so not before 10:00/);
  assert.equal(youngRest(null, "2026-10-22", days).length, 0, "adults: nothing");
  assert.match(youngRest("under16", "2026-10-21", days)[0], /finishing by 18:00/);
  const week = new Map(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"].map((d) => [d, { start: h("09:00"), end: h("13:00") }]));
  assert.deepEqual(youngRest("under18", "2026-10-24", week), ["On 6 days this week: under-18s need two days off."]);
});
