import { test } from "node:test";
import assert from "node:assert/strict";
import { rowsOf, type DayTimelineBlock } from "@/components/ui-kit/day-timeline";

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
