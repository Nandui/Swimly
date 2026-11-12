import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ABSENCE_REASON_META, ABSENCE_REASONS, BOOKING_KIND_META, BOOKING_KINDS, clock, daysOff, needsFitNote, nextWeekday, parseClock, RETURN_FIT_META, RETURN_FITS, ROTA_CHANGE_REASON_META,
  ROTA_CHANGE_REASONS, SELF_CERTIFIED_DAYS, WEEKDAY_LABELS,
} from "@/modules/rota/shared/constants";
import { areaAssignmentRow, areaNeedName, areaNeedOf, areaTypeId } from "@/modules/rota/shared/day";
import { ACTIVITY_NEED, areaActivityTypeId, lessOff } from "@/modules/rota/shared/area-needs";
import { qualificationShort } from "@/modules/rota/shared/meta";

/** Rota's small rules: the days and times staff type, and how an area's needs are named. The
 *  rota end to end is in __tests__/rota.test.ts. 5 October 2026 is a Monday. */

test("the next of a booking's weekdays: the day itself when it is one, Monday counted as 0", () => {
  assert.equal(nextWeekday("2026-10-05", [0]), "2026-10-05", "a Monday is its own next Monday");
  assert.equal(nextWeekday("2026-10-06", [0]), "2026-10-12");
  assert.equal(nextWeekday("2026-10-10", [6, 2]), "2026-10-11", "Saturday to Sunday");
  assert.equal(nextWeekday("2026-10-06", []), "2026-10-06", "no weekdays chosen: the day given");
  assert.equal(WEEKDAY_LABELS[0], "Monday");
  assert.equal(WEEKDAY_LABELS.length, 7);
});

test("days off count both the first and the last day; sickness past a week needs a fit note", () => {
  assert.equal(daysOff("2026-10-05", "2026-10-05"), 1);
  assert.equal(daysOff("2026-10-05", "2026-10-11"), 7);
  assert.equal(daysOff("2026-10-24", "2026-10-26"), 3, "the clocks going back change nothing");
  assert.equal(SELF_CERTIFIED_DAYS, 7);
  assert.equal(needsFitNote({ reason: "sickness", firstDay: "2026-10-05", lastDay: "2026-10-11" }), false, "seven days are self-certified");
  assert.equal(needsFitNote({ reason: "sickness", firstDay: "2026-10-05", lastDay: "2026-10-12" }), true);
});

test("times are typed as hours and minutes, up to 24:00 for the end of the day", () => {
  assert.equal(parseClock("07:30"), 450);
  assert.equal(parseClock(" 00:00 "), 0);
  assert.equal(parseClock("24:00"), 1440);
  for (const typed of ["24:05", "7:30", "07:60", "0730", "", "seven"]) assert.equal(parseClock(typed), null, typed);
  assert.equal(clock(parseClock("21:45")!), "21:45", "read back as typed");
});

test("every reason, kind and fit has a label and its own icon, and each list is its tags in order", () => {
  const lists: [readonly string[], Record<string, { label: string; icon: unknown }>][] = [
    [ABSENCE_REASONS, ABSENCE_REASON_META], [ROTA_CHANGE_REASONS, ROTA_CHANGE_REASON_META], [BOOKING_KINDS, BOOKING_KIND_META], [RETURN_FITS, RETURN_FIT_META],
  ];
  for (const [keys, meta] of lists) {
    assert.deepEqual(keys, Object.keys(meta));
    assert.equal(new Set(keys.map((k) => meta[k].icon)).size, keys.length, "colour is never the only signal");
    for (const k of keys) assert.ok(meta[k].label.length > 1, k);
  }
});

test("an area's need is named by its area, its type of staff or activity, and the date, and read back the same", () => {
  assert.equal(areaTypeId("hall", "nplq"), "area:hall:nplq");
  assert.equal(areaTypeId("hall", null), "area:hall:*", "anyone");
  assert.equal(areaActivityTypeId("desk", "serving"), `area:desk:${ACTIVITY_NEED}serving`);
  assert.deepEqual(areaNeedOf(`${areaTypeId("hall", "nplq")}:2026-10-23`), { areaId: "hall", typeId: "nplq", activityTypeId: null, date: "2026-10-23" });
  assert.deepEqual(areaNeedOf(`${areaTypeId("hall", null)}:2026-10-23`), { areaId: "hall", typeId: null, activityTypeId: null, date: "2026-10-23" });
  assert.deepEqual(areaNeedOf(`${areaActivityTypeId("desk", "serving")}:2026-10-23`), { areaId: "desk", typeId: null, activityTypeId: "serving", date: "2026-10-23" });
  assert.equal(areaNeedOf("need-1"), null, "an activity's own need is not an area's");
  assert.equal(areaAssignmentRow("area:row-7"), "row-7");
  assert.equal(areaAssignmentRow("row-7"), null);
  assert.equal(areaNeedName("Lifeguard"), "Lifeguard on duty");
  assert.equal(areaNeedName(null), "Staff on duty");
});

test("a place not needed for a stretch is left out of that place's time only", () => {
  const h = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const shift = { start: h("07:00"), end: h("21:00") };
  const off = [{ place: 2, start: h("09:00"), end: h("12:00") }];
  assert.deepEqual(lessOff(shift, 2, off), [{ start: h("07:00"), end: h("09:00") }, { start: h("12:00"), end: h("21:00") }]);
  assert.deepEqual(lessOff(shift, 1, off), [shift], "the other place is still needed");
  assert.deepEqual(lessOff(shift, null, off), [shift], "no place, nothing taken off");
  assert.deepEqual(lessOff(shift, 2, undefined), [shift]);
});

test("a qualification is shown by the short name in its brackets, or its whole name", () => {
  assert.equal(qualificationShort("National Pool Lifeguard Qualification (NPLQ)"), "NPLQ");
  assert.equal(qualificationShort("First aid"), "First aid");
  assert.equal(qualificationShort("Synthetic award ( )"), "Synthetic award ( )", "empty brackets are not a name");
});
