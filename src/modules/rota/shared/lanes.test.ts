import assert from "node:assert/strict";
import { test } from "node:test";
import { laneClash, lanesFrom, lanesInPlace, lanesLabel, lanesMeet, lanesProblem, lanesTaken } from "@/modules/rota/shared/lanes";

/** Pools with lanes (owner request, 13 October 2026). */

test("lanes chosen on a form are whole numbers, sorted, without repeats; none is the whole area", () => {
  assert.deepEqual(lanesFrom(["3", "1", "3", "x", "0", "21"]), [1, 3]);
  assert.deepEqual(lanesFrom([]), []);
});

test("lanes must exist in the area", () => {
  assert.equal(lanesProblem([], 0, "Gym"), null);
  assert.match(lanesProblem([1], 0, "Gym")!, /no lanes/);
  assert.match(lanesProblem([5, 7], 6, "Main pool")!, /no lane 7/);
  assert.equal(lanesProblem([1, 6], 6, "Main pool"), null);
});

test("naming no lanes takes them all; lanes that no longer exist are dropped", () => {
  assert.deepEqual(lanesTaken([], 4), [1, 2, 3, 4]);
  assert.deepEqual(lanesTaken([2, 9], 4), [2]);
  assert.ok(lanesMeet([], [3], 6), "the whole pool meets any lane");
  assert.ok(!lanesMeet([1, 2], [3, 4], 6));
  assert.ok(lanesMeet([2, 3], [3, 4], 6));
});

test("labels read as words", () => {
  assert.equal(lanesLabel([], 6), "Whole pool");
  assert.equal(lanesLabel([1, 2, 3, 4, 5, 6], 6), "Whole pool");
  assert.equal(lanesLabel([3], 6), "Lane 3");
  assert.equal(lanesLabel([1, 2, 3], 6), "Lanes 1 to 3");
  assert.equal(lanesLabel([1, 3, 5], 6), "Lanes 1, 3 and 5");
});

test("a swim class's location can name its lanes after the area", () => {
  assert.deepEqual(lanesInPlace("Main pool, lane 3"), [3]);
  assert.deepEqual(lanesInPlace("Main pool, Lanes 3-4"), [3, 4]);
  assert.deepEqual(lanesInPlace("Main pool, lanes 2 to 4"), [2, 3, 4]);
  assert.deepEqual(lanesInPlace("Learner pool"), []);
  assert.deepEqual(lanesInPlace("Learner pool, shallow end"), []);
});

test("two bookings can't hold the same lane at the same time on a day they both run", () => {
  const h = (n: number) => n * 60;
  const school = { id: "a", title: "St Joseph's NS", place: "Main pool", lanes: [3, 4], start: h(9), end: h(11), dates: ["2026-10-19", "2026-10-26"] };
  const lanes = (l: number[], dates = ["2026-10-19"], start = h(10), end = h(12)) => ({ title: "Masters", place: "main pool", lanes: l, start, end, dates });
  assert.equal(laneClash(lanes([1, 2]), [school], 6), null, "other lanes are free");
  assert.equal(laneClash(lanes([4]), [school], 6)?.date, "2026-10-19");
  assert.ok(laneClash(lanes([]), [school], 6), "the whole pool takes lane 3 too");
  assert.equal(laneClash(lanes([4], ["2026-10-20"]), [school], 6), null, "a different day");
  assert.equal(laneClash(lanes([4], undefined, h(11), h(12)), [school], 6), null, "back to back is fine");
  assert.equal(laneClash({ ...school }, [school], 6), null, "a booking never clashes with itself");
  assert.equal(laneClash(lanes([]), [school], 0), null, "areas without lanes are not checked");
});

test("a location names a set of lanes, in any of the ways people write them (owner request, 19 October 2026)", () => {
  assert.deepEqual(lanesInPlace("Main pool, lanes 1, 3 and 5"), [1, 3, 5]);
  assert.deepEqual(lanesInPlace("Main pool, lanes 1 to 2 and 5"), [1, 2, 5]);
  assert.deepEqual(lanesInPlace("Main pool, lanes 1, 3 and 5, shallow end"), [1, 3, 5]);
});
