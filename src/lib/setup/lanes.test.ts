import assert from "node:assert/strict";
import { test } from "node:test";
import { laneDetail, lanesInDetail, lanesInPlace, lanesLabel } from "./lanes";

/** A pool's lanes kept in one location text (owner request, 19 October 2026). */

test("lanes chosen on a form are saved after the area as words, and read back the same", () => {
  for (const lanes of [[3], [1, 2, 3], [1, 3, 5], [2, 3, 6]]) {
    const place = `Main pool, ${laneDetail(lanes, 6)}`;
    assert.deepEqual(lanesInPlace(place), lanes, place);
  }
  assert.equal(laneDetail([1, 3, 5], 6), "lanes 1, 3 and 5");
  assert.equal(laneDetail([], 6), "", "the whole pool adds nothing");
  assert.equal(laneDetail([1, 2, 3, 4, 5, 6], 6), "", "every lane is the whole pool");
  assert.equal(laneDetail([2], 6, "shallow end"), "lane 2, shallow end");
});

test("other words in the detail stay as they were", () => {
  assert.deepEqual(lanesInDetail("lanes 1 to 3, shallow end"), { lanes: [1, 2, 3], rest: "shallow end" });
  assert.deepEqual(lanesInDetail("shallow end"), { lanes: [], rest: "shallow end" });
  assert.deepEqual(lanesInDetail("Lane 4"), { lanes: [4], rest: "" });
  assert.equal(lanesLabel([4], 6), "Lane 4");
});
