import assert from "node:assert/strict";
import { test } from "node:test";
import { completionProgress, hasEarnedPlace, hasGraduated, nextLevel, previousLevel } from "./rules";

/** The swim school's progression rules: one answer to "can she move up?" and "has he finished?".
 *  Invented programme. */
const ladder = [
  { id: "starfish", name: "Starfish", sortOrder: 1 },
  { id: "turtles", name: "Turtles", sortOrder: 2 },
  { id: "penguins", name: "Penguins", sortOrder: 3 },
  { id: "dolphins", name: "Dolphins", sortOrder: 4 },
];
const none = new Set<string>();
const earned = (targetLevelId: string, completed: string[] = [], active: string[] = [], assessed?: string[]) =>
  hasEarnedPlace({ targetLevelId, orderedLevels: ladder, completedLevelIds: new Set(completed), activeLevelIds: new Set(active), assessedLevelIds: assessed && new Set(assessed) });

test("a place is earned by finishing the level below, never by skipping one", () => {
  assert.equal(earned("starfish"), true, "the first level is earned by turning up");
  assert.equal(earned("turtles"), false);
  assert.equal(earned("turtles", ["starfish"]), true);
  assert.equal(earned("penguins", ["starfish"]), false, "Turtles is still to do");
  assert.equal(earned("dolphins", ["penguins"]), true, "only the level just below counts, so adding a level underneath un-earns nobody");
});

test("repeating a level, a second class at the same level, or an archived level never blocks", () => {
  assert.equal(earned("penguins", ["penguins"]), true, "repeating");
  assert.equal(earned("penguins", [], ["penguins"]), true, "a second class at the level they are in");
  assert.equal(earned("seahorses"), true, "a level no longer on the ladder");
});

test("an assessment earns the level judged and every level below it", () => {
  assert.equal(earned("penguins", [], [], ["penguins"]), true);
  assert.equal(earned("turtles", [], [], ["penguins"]), true, "placed lower than judged, with no reason needed");
  assert.equal(earned("dolphins", [], [], ["penguins"]), false, "never above it");
  assert.equal(earned("turtles", [], [], []), false, "no assessment, the usual rule");
});

test("the level below and the level above, for the placement sentence and moving up", () => {
  assert.equal(previousLevel("penguins", ladder)?.name, "Turtles");
  assert.equal(previousLevel("starfish", ladder), null);
  assert.equal(previousLevel("seahorses", ladder), null);
  assert.equal(nextLevel("penguins", ladder)?.name, "Dolphins");
  assert.equal(nextLevel("dolphins", ladder), null, "the top of the ladder");
  assert.equal(nextLevel("seahorses", ladder), null);
});

test("a level is complete only with every live skill signed off, and an empty level never is", () => {
  assert.deepEqual(completionProgress(["float", "kick", "glide"], new Set(["float", "kick"])), { achieved: 2, total: 3, eligible: false });
  assert.deepEqual(completionProgress(["float", "kick"], new Set(["float", "kick", "retired-skill"])), { achieved: 2, total: 2, eligible: true }, "a retired skill signed off long ago does not count");
  assert.deepEqual(completionProgress([], none), { achieved: 0, total: 0, eligible: false }, "nobody graduates from a level with no requirements written");
});

test("a swimmer has graduated once every live level of the programme is done", () => {
  assert.equal(hasGraduated(ladder, new Set(ladder.map((l) => l.id))), true);
  assert.equal(hasGraduated(ladder, new Set(["starfish", "turtles", "penguins"])), false);
  assert.equal(hasGraduated([], new Set(["starfish"])), false, "an empty programme graduates nobody");
});
