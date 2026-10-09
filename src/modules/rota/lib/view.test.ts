import assert from "node:assert/strict";
import { test } from "node:test";
import { MIN_SPAN, panView, sameView, tickStep, ticks, zoomView } from "./view";

const day = { from: 7 * 60, to: 22 * 60 };

test("zooming keeps the minute under the pointer in place", () => {
  const v = zoomView(day, day, 12 * 60, 0.5);
  assert.equal(v.to - v.from, 450, "half the day");
  assert.equal((12 * 60 - v.from) / (v.to - v.from), (12 * 60 - day.from) / (day.to - day.from), "noon stays at the same place across");
});

test("zoom stops at an hour and at the whole day, and never leaves the day", () => {
  let v = day;
  for (let i = 0; i < 40; i++) v = zoomView(v, day, 20 * 60, 0.8);
  assert.equal(v.to - v.from, MIN_SPAN);
  assert.ok(v.from >= day.from && v.to <= day.to);
  assert.ok(sameView(zoomView(day, day, 12 * 60, 1.25), day), "already the whole day");
  const edge = zoomView({ from: 21 * 60, to: 22 * 60 }, day, 21 * 60 + 59, 3);
  assert.equal(edge.to, day.to, "zooming out at the end stays inside the day");
});

test("moving stops at the day's ends", () => {
  const v = { from: 9 * 60, to: 12 * 60 };
  assert.deepEqual(panView(v, day, 60), { from: 10 * 60, to: 13 * 60 });
  assert.deepEqual(panView(v, day, -600), { from: 7 * 60, to: 10 * 60 });
  assert.deepEqual(panView(v, day, 900), { from: 19 * 60, to: 22 * 60 });
  assert.ok(sameView(panView(day, day, 120), day), "the whole day cannot move");
});

test("labels get finer as you zoom in, on the step", () => {
  assert.deepEqual([tickStep(900), tickStep(300), tickStep(120), tickStep(60)], [120, 60, 30, 15]);
  assert.deepEqual(ticks({ from: 610, to: 700 }), [615, 630, 645, 660, 675, 690]);
  assert.deepEqual(ticks({ from: 7 * 60, to: 22 * 60 }).slice(0, 3), [420, 540, 660], "a day from 07:00 reads 07:00, 09:00, 11:00");
});
