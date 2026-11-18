import assert from "node:assert/strict";
import { test } from "node:test";
import { ANY_WEEK, minutesThatFit, outsideUsualWeek, usualDayText, usualWeekOf, usualWeekSchema, usualWeekText, type UsualDay } from "./usual-week";

/** The times a person says they can usually work (D34, D35). */
const h = (hours: number) => hours * 60;
const any: UsualDay = { mode: "any", start: null, end: null }, none: UsualDay = { mode: "none", start: null, end: null };
// Thursdays 16:00 to 21:00, never Fridays, any time otherwise.
const week: UsualDay[] = [any, any, any, { mode: "between", start: h(16), end: h(21) }, none, any, any];
const THU = "2026-11-05";

test("a usual week says something for all seven days, and only a part day keeps times", () => {
  const days = ANY_WEEK.map((d) => ({ ...d }));
  assert.equal(usualWeekSchema.safeParse({ days }).success, true);
  assert.equal(usualWeekSchema.safeParse({ days: days.slice(0, 6) }).success, false, "six days");
  const part = (start: number | null, end: number | null) => usualWeekSchema.safeParse({ days: [{ mode: "between", start, end }, ...days.slice(1)] });
  assert.equal(part(h(16), h(21)).success, true);
  assert.equal(part(h(16), null).success, false, "a part day needs both times");
  assert.equal(part(h(21), h(16)).success, false, "the end comes after the start");
  assert.equal(part(h(16) + 3, h(21)).success, false, "5-minute steps");
  const off = usualWeekSchema.parse({ days: [{ mode: "none", start: 60, end: 120 }, ...days.slice(1)] });
  assert.deepEqual(off.days[0], { mode: "none", start: null, end: null }, "a day off keeps no times");
  assert.equal(usualWeekSchema.safeParse({ days: [{ mode: "maybe" }, ...days.slice(1)] }).success, false);
});

test("a planner reads a usual day and week in plain words", () => {
  assert.equal(usualDayText(any), null);
  assert.equal(usualDayText(undefined), null);
  assert.equal(usualDayText(none), "Can't work");
  assert.equal(usualDayText(week[3]), "Can work 16:00 to 21:00");
  assert.equal(usualWeekText(week), "Thursday: can work 16:00 to 21:00; Friday: can't work");
  assert.equal(usualWeekText(ANY_WEEK), "any time, every day");
});

test("a stored week that does not read right is any time that day", () => {
  const read = usualWeekOf({ modes: ["between", "between", "none", "odd"], starts: [h(9), h(12), 0, 0], ends: [h(17), h(9), 0, 0] });
  assert.deepEqual(read.map((d) => d.mode), ["between", "any", "none", "any", "any", "any", "any"]);
});

test("a shift outside the times its person gave is named, and nothing else is", () => {
  assert.equal(outsideUsualWeek(undefined, THU, h(7), h(15)), null, "they have not said");
  assert.equal(outsideUsualWeek(week, "2026-11-04", h(7), h(15)), null, "any time on Wednesdays");
  assert.equal(outsideUsualWeek(week, THU, h(16), h(21)), null, "inside their times");
  assert.equal(outsideUsualWeek(week, THU, h(15), h(19)), "Outside the times they gave: Thursdays 16:00–21:00.");
  assert.equal(outsideUsualWeek(week, "2026-11-06", h(9), h(12)), "Outside the times they gave: they can't work Fridays.");
});

test("the minutes that fit count only places wholly inside their times, and overlapping places once", () => {
  const places = [
    { weekday: 1, startMin: h(9), endMin: h(12) }, { weekday: 1, startMin: h(10), endMin: h(13) }, // Monday, overlapping: 09:00 to 13:00
    { weekday: 4, startMin: h(15), endMin: h(18) }, // Thursday, starts before 16:00: does not fit
    { weekday: 4, startMin: h(17), endMin: h(20) }, // Thursday, inside
    { weekday: 5, startMin: h(9), endMin: h(12) }, // Friday: can't work
  ];
  assert.equal(minutesThatFit(week, places), h(4) + h(3));
  assert.equal(minutesThatFit(ANY_WEEK, places), h(4) + h(5) + h(3), "any time: every place, Thursday's two as 15:00 to 20:00");
});
