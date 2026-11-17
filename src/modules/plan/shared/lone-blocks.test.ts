import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_SKIP_DAYS, planLoneBlocks, type LoneBlock } from "./lone-blocks";
import { shiftIso } from "./model";

/** Where blocks on a kind of work by itself would go (D33). Mondays here: 16, 23 and 30 November
 *  2026. Synthetic names only. */
const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const session = (id: string, title: string, start: number, end: number, needs: string[], more: Partial<{ siteId: string; weekdays: number[]; firstDay: string; lastDay: string; skipDays: string[] }> = {}) => ({
  id, title, siteId: "hill", areaId: null, lanes: [], start, end, weekdays: [0, 1, 2, 3, 4, 5, 6], firstDay: "2026-11-01", lastDay: "2026-12-31", skipDays: [],
  needs: needs.map((dutyId) => ({ dutyId, count: 1 })), days: [], ...more,
});
const block = (id: string, date: string, dutyId: string, start: number, end: number, siteId = "hill"): LoneBlock => ({ id, siteId, date, dutyId, start, end });

test("a block joins an activity at its site that needs its kind of work and covers its times that day", () => {
  const moves = planLoneBlocks([block("b1", "2026-11-17", "guard", h(10), h(12))], [session("open", "Pool open", h(7), h(21), ["guard"])]);
  assert.deepEqual(moves, [{ kind: "join", siteId: "hill", sessionId: "open", title: "Pool open", dutyId: "guard", blockIds: ["b1"], dates: ["2026-11-17"] }]);
});

test("of several that fit, the shortest activity takes it, so a booking wins over the pool being open", () => {
  const moves = planLoneBlocks([block("b1", "2026-11-17", "guard", h(10), h(11))],
    [session("open", "Pool open", h(7), h(21), ["guard"]), session("club", "Swim club", h(10), h(11, 30), ["guard"])]);
  assert.equal(moves.length, 1);
  assert.equal(moves[0].kind === "join" && moves[0].sessionId, "club");
});

test("an activity is no home when it is at another site, needs another kind of work, does not run that day or does not cover the times", () => {
  const b = block("b1", "2026-11-17", "guard", h(10), h(12));
  for (const s of [
    session("a", "Pool open", h(7), h(21), ["guard"], { siteId: "river" }),
    session("b", "Desk open", h(7), h(21), ["desk"]),
    session("c", "Pool open", h(7), h(21), ["guard"], { weekdays: [5, 6] }),
    session("d", "Pool open", h(7), h(21), ["guard"], { skipDays: ["2026-11-17"] }),
    session("e", "Early swim", h(7), h(11), ["guard"]),
  ]) assert.equal(planLoneBlocks([b], [s])[0].kind, "make", s.id);
});

test("blocks with no home become one activity: their weekdays, first to last day, the days missed, and the most people on any day", () => {
  const moves = planLoneBlocks([
    block("m1", "2026-11-16", "clean", h(14), h(15)), block("m2", "2026-11-16", "clean", h(14), h(15)),
    block("w1", "2026-11-18", "clean", h(14), h(15)),
    block("m3", "2026-11-30", "clean", h(14), h(15)),
  ], []);
  assert.deepEqual(moves, [{ kind: "make", siteId: "hill", dutyId: "clean", start: h(14), end: h(15), weekdays: [0, 2], firstDay: "2026-11-16", lastDay: "2026-11-30",
    skipDays: ["2026-11-23", "2026-11-25"], count: 2, blockIds: ["m1", "m2", "w1", "m3"], dates: ["2026-11-16", "2026-11-18", "2026-11-30"] }]);
});

test("other times, another kind of work or another site make their own activities", () => {
  const moves = planLoneBlocks([
    block("a", "2026-11-16", "clean", h(14), h(15)), block("b", "2026-11-16", "clean", h(15), h(16)),
    block("c", "2026-11-16", "checks", h(14), h(15)), block("d", "2026-11-16", "clean", h(14), h(15), "river"),
  ], []);
  assert.equal(moves.length, 4);
  assert.deepEqual(moves.map((m) => m.blockIds), [["a"], ["c"], ["b"], ["d"]]);
});

test("blocks too scattered for one activity become a one-day activity each", () => {
  const first = "2026-11-16";
  const last = shiftIso(first, 7 * (MAX_SKIP_DAYS + 2));
  const moves = planLoneBlocks([block("a", first, "clean", h(14), h(15)), block("b", last, "clean", h(14), h(15))], []);
  assert.deepEqual(moves.map((m) => m.kind === "make" && [m.firstDay, m.lastDay, m.skipDays.length]), [[first, first, 0], [last, last, 0]]);
});

test("every block is placed exactly once", () => {
  const blocks = [block("b1", "2026-11-17", "guard", h(10), h(12)), block("b2", "2026-11-17", "clean", h(14), h(15)), block("b3", "2026-11-18", "guard", h(6), h(7))];
  const moves = planLoneBlocks(blocks, [session("open", "Pool open", h(7), h(21), ["guard"])]);
  assert.deepEqual(moves.flatMap((m) => m.blockIds).sort(), ["b1", "b2", "b3"]);
});
