import assert from "node:assert/strict";
import { test } from "node:test";
import { STOCK_CATEGORY_TONE_META, STOCK_CHANGE_META, STOCK_TAKE_META } from "@/modules/stock";
import { categoryTone, compareCounts, compareTotals, groupByCategory, parseCount, stockTakeState, STOCK_CATEGORY_TONES, type CompareProduct } from "./rules";

/** Stock's pure rules: what a typed count means, how two counts compare product by product, and
 *  the order the sheet reads in. Counted none (0) is never mixed up with not counted (no line). */
const drinks = { id: "c-drinks", name: "Drinks", tone: "blue", sortOrder: 1 };
const snacks = { id: "c-snacks", name: "Snacks", tone: "orange", sortOrder: 2 };
const product = (id: string, name: string, category = drinks): CompareProduct => ({ id, name, unitLabel: "each", category });
const water = product("p-water", "Water"), cola = product("p-cola", "Cola"), crisps = product("p-crisps", "Crisps", snacks), bar = product("p-bar", "Bar", snacks), gum = product("p-gum", "Gum", snacks);

test("a typed count is a whole number, empty is not counted, and anything else is refused", () => {
  assert.equal(parseCount(""), null);
  assert.equal(parseCount("   "), null);
  assert.equal(parseCount("0"), 0, "none on the shelf is a count");
  assert.equal(parseCount(" 12 "), 12);
  assert.equal(parseCount("999999"), 999999);
  for (const typed of ["-1", "1.5", "1e3", "abc", "1000000", "12 cans"]) assert.equal(parseCount(typed), undefined, typed);
});

test("two counts compare product by product: down is quiet, up is flagged, missing from either is kept apart", () => {
  const before = new Map([["p-water", 10], ["p-cola", 5], ["p-crisps", 8], ["p-bar", 0]]);
  const after = new Map([["p-water", 6], ["p-cola", 9], ["p-crisps", 8], ["p-gum", 4]]);
  const rows = compareCounts([gum, bar, crisps, cola, water, product("p-never", "Never counted")], before, after);
  assert.deepEqual(rows.map((r) => [r.name, r.before, r.after, r.change, r.delta]), [
    ["Cola", 5, 9, "up", 4],
    ["Water", 10, 6, "down", -4],
    ["Bar", 0, null, "uncounted", 0],
    ["Crisps", 8, 8, "same", 0],
    ["Gum", null, 4, "uncounted", 0],
  ], "category order then name; a product on neither count is left out");
  assert.deepEqual(compareTotals(rows), { counted: 3, changed: 2, up: 1, uncounted: 2, out: 4 }, "only products counted both times reach the totals");
  assert.equal(STOCK_CHANGE_META.up.color, "red", "more than before needs attention");
  assert.equal(STOCK_CHANGE_META.down.color, "gray", "selling is the normal case");
});

test("counted none both times is no change, and counted none after a count is a real fall", () => {
  const rows = compareCounts([water, cola], new Map([["p-water", 0], ["p-cola", 3]]), new Map([["p-water", 0], ["p-cola", 0]]));
  assert.deepEqual(rows.map((r) => [r.name, r.change, r.delta]), [["Cola", "down", -3], ["Water", "same", 0]]);
  assert.deepEqual(compareTotals(rows), { counted: 2, changed: 1, up: 0, uncounted: 0, out: 3 });
  assert.deepEqual(compareTotals([]), { counted: 0, changed: 0, up: 0, uncounted: 0, out: 0 });
});

test("the sheet groups products under their categories, in category order, each sorted by name", () => {
  const sameOrder = { id: "c-ices", name: "Ices", tone: "purple", sortOrder: 1 };
  const groups = groupByCategory([crisps, water, product("p-cone", "Cone", sameOrder), bar, cola]);
  assert.deepEqual(groups.map((g) => [g.name, g.products.map((p) => p.name)]), [
    ["Drinks", ["Cola", "Water"]],
    ["Ices", ["Cone"]],
    ["Snacks", ["Bar", "Crisps"]],
  ], "a tie on order falls back to the category's name");
  assert.deepEqual(groupByCategory([]), []);
});

test("a count is open until submitted; a category's tone is one of five, never red, and an unknown one is grey", () => {
  assert.equal(stockTakeState(null), "open");
  assert.equal(stockTakeState(new Date()), "submitted");
  assert.equal(stockTakeState("2026-10-21T10:00:00Z"), "submitted");
  assert.deepEqual(Object.keys(STOCK_TAKE_META), ["open", "submitted"]);
  assert.deepEqual(Object.keys(STOCK_CATEGORY_TONE_META), [...STOCK_CATEGORY_TONES]);
  assert.ok(!(STOCK_CATEGORY_TONES as readonly string[]).includes("red"), "red is kept for what needs attention");
  assert.equal(categoryTone("green"), STOCK_CATEGORY_TONE_META.green);
  assert.equal(categoryTone("red"), STOCK_CATEGORY_TONE_META.gray);
  assert.equal(categoryTone(""), STOCK_CATEGORY_TONE_META.gray);
});
