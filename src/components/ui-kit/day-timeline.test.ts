import { test } from "node:test";
import assert from "node:assert/strict";
import { bandsOf, partsIn, type DayTimelineBlock } from "@/components/ui-kit/day-timeline";

const block = (key: string, start: number, end: number, lane = "classes", lanes?: string[]): DayTimelineBlock =>
  ({ key, lane, lanes, start, end, kind: "next", label: key, ariaLabel: key });
const drawn = (band: ReturnType<typeof bandsOf>[number]) => band.pieces.map((p) => `${p.block.key}@${p.row}+${p.span}`).sort();
const pool = [{ key: "pool", label: "Main Pool" }, { key: "l1", label: "Lane 1", under: "pool" }, { key: "l2", label: "Lane 2", under: "pool" }, { key: "l3", label: "Lane 3", under: "pool" }];

test("blocks at the same time take rows of their own", () => {
  const [band] = bandsOf([{ key: "classes", label: "Classes" }], [block("starfish", 900, 930), block("seahorses", 900, 930), block("otters", 900, 945)]);
  assert.equal(band.rows, 3);
  assert.deepEqual(drawn(band), ["otters@3+1", "seahorses@2+1", "starfish@1+1"]);
});

test("a block goes back on the first row that is free", () => {
  const [band] = bandsOf([{ key: "classes", label: "Classes" }], [block("b", 930, 960), block("a", 900, 945), block("c", 945, 975), block("d", 960, 990)]);
  assert.equal(band.rows, 2);
  assert.deepEqual(drawn(band), ["a@1+1", "b@2+1", "c@1+1", "d@2+1"]);
});

test("an empty lane keeps one row, and a lane alone is not a group", () => {
  const [band] = bandsOf([{ key: "classes", label: "Classes" }], []);
  assert.deepEqual([band.rows, band.lanes], [1, [{ key: "classes", label: "Classes", role: "lone", row: 1, span: 1 }]]);
});

test("a block alone in a lane of two rows fills the lane", () => {
  const [band] = bandsOf([{ key: "classes", label: "Classes" }], [block("a", 900, 930), block("b", 900, 930), block("later", 960, 990)]);
  assert.deepEqual(drawn(band), ["a@1+1", "b@2+1", "later@1+2"]);
});

test("a group is its own lane, then its parts beneath", () => {
  const [band, other] = bandsOf([...pool, { key: "gym", label: "Gym" }], []);
  assert.deepEqual(band.lanes.map((l) => `${l.role} ${l.label} ${l.row}`), ["head Main Pool 1", "part Lane 1 2", "part Lane 2 3", "part Lane 3 4"]);
  assert.deepEqual([band.rows, other.key, other.lanes[0].role], [4, "gym", "lone"]);
});

test("a block grows to fill the lanes it takes", () => {
  const [band] = bandsOf(pool, [block("squad", 360, 420, "l1", ["l2", "l3"]), block("adults", 420, 480, "l2", ["l3"]), block("stage 5", 420, 480, "l1")]);
  assert.deepEqual(drawn(band), ["adults@3+2", "squad@2+3", "stage 5@2+1"]);
});

test("lanes that don't sit together are two pieces, read once", () => {
  const [band] = bandsOf(pool, [block("relay", 360, 420, "l1", ["l3"]), block("stage 2", 360, 420, "l2")]);
  assert.deepEqual(drawn(band), ["relay@2+1", "relay@4+1", "stage 2@3+1"]);
  assert.deepEqual(band.pieces.filter((p) => p.block.key === "relay").map((p) => p.first), [true, false]);
});

test("nothing is drawn over a block already in one of its lanes", () => {
  const [band] = bandsOf(pool, [block("stage 1", 360, 420, "l1"), block("squad", 390, 450, "l1", ["l2"])]);
  // Lane 1 holds two rows (2 and 3), lane 2 is row 4: squad takes lane 1's second row down to lane 2.
  assert.deepEqual(drawn(band), ["squad@3+2", "stage 1@2+1"]);
});

test("a lane another group owns is left out", () => {
  const [band] = bandsOf([...pool, { key: "gym", label: "Gym" }], [block("a", 360, 420, "l1", ["gym", "nowhere"])]);
  assert.deepEqual(drawn(band), ["a@2+1"]);
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
