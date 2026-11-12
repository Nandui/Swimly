import { test } from "node:test";
import assert from "node:assert/strict";
import { partsIn, rowsOf, type DayTimelineBlock } from "@/components/ui-kit/day-timeline";

const block = (key: string, start: number, end: number): DayTimelineBlock =>
  ({ key, lane: "classes", start, end, kind: "next", label: key, ariaLabel: key });

test("blocks at the same time take rows of their own", () => {
  const rows = rowsOf([block("starfish", 900, 930), block("seahorses", 900, 930), block("otters", 900, 945)]);
  assert.deepEqual(rows.map((r) => r.map((b) => b.key)), [["starfish"], ["seahorses"], ["otters"]]);
});

test("a block goes back on the first row that is free by its start", () => {
  const rows = rowsOf([block("b", 930, 960), block("a", 900, 945), block("c", 945, 975), block("d", 960, 990)]);
  assert.deepEqual(rows.map((r) => r.map((b) => b.key)), [["a", "c"], ["b", "d"]]);
});

test("an empty lane keeps one row", () => {
  assert.deepEqual(rowsOf([]), [[]]);
});

test("parts keep inside their block and the name gets the widest free stretch", () => {
  const laid = partsIn({ start: 525, end: 915, parts: [{ start: 780, end: 960, label: "Till 1" }, { start: 500, end: 720, label: "Till 2" }] });
  assert.deepEqual(laid.parts, [{ start: 525, end: 720, label: "Till 2", row: 0 }, { start: 780, end: 915, label: "Till 1", row: 0 }]);
  assert.equal(laid.rows, 1);
  assert.deepEqual(laid.free, { start: 720, end: 780 });
});

test("parts at the same time take rows of their own, and a covered block has no free stretch", () => {
  const laid = partsIn({ start: 525, end: 915, parts: [{ start: 525, end: 915, label: "Till 1" }, { start: 525, end: 700, label: "Till 2" }, { start: 700, end: 915, label: "Float" }] });
  assert.deepEqual(laid.parts.map((p) => [p.label, p.row]), [["Till 2", 0], ["Till 1", 1], ["Float", 0]]);
  assert.equal(laid.rows, 2);
  assert.equal(laid.free, null);
});

test("a block without parts is all free", () => {
  assert.deepEqual(partsIn({ start: 600, end: 660 }), { rows: 1, parts: [], free: { start: 600, end: 660 } });
});
