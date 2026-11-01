import assert from "node:assert/strict";
import { test } from "node:test";
import { HOLDS_A_PLACE, isPast, sessionSpan } from "@/modules/activities/shared/assessments/constants";
import { CANCELLED_SESSION_ERROR } from "@/modules/activities/shared/cancellations/constants";
import { cancellationError } from "@/modules/activities/shared/cancellations/guard";
import { capacityLabel, courseLabel, courseLabelWithSite, DAY_META, DAYS_IN_ORDER, formatSessionTime, formatSlot, formatSlotShort, parseTime } from "./constants";

/** How a class's times are typed and read, and what holds a place. Invented classes. */
const turtles = { name: null, dayOfWeek: "SUNDAY" as const, startMinutes: 960, durationMinutes: 30, level: { name: "Turtles" } };

test("class times are typed as hours and minutes of the day", () => {
  assert.equal(parseTime("16:30"), 990);
  assert.equal(parseTime(" 00:00 "), 0);
  assert.equal(parseTime("23:59"), 1439);
  for (const typed of ["24:00", "9:30", "16:60", "1630", ""]) assert.equal(parseTime(typed), null, typed);
});

test("a class reads the same everywhere: its days, one session, the compact form and its label", () => {
  assert.deepEqual(DAYS_IN_ORDER, ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]);
  assert.equal(DAY_META.SUNDAY.short, "Sun");
  assert.equal(formatSlot(turtles), "Sundays, 16:00 to 16:30");
  assert.equal(formatSessionTime(turtles), "Sun 16:00 to 16:30");
  assert.equal(formatSlotShort(turtles), "Sun 16:00");
  assert.equal(courseLabel(turtles), "Turtles · Sun 16:00");
  assert.equal(courseLabel({ ...turtles, name: "Adult improvers" }), "Adult improvers · Sun 16:00");
  assert.equal(courseLabelWithSite({ ...turtles, club: { name: "Example Centre" } }), "Turtles · Sun 16:00 · Example Centre");
  assert.equal(courseLabelWithSite(turtles), "Turtles · Sun 16:00");
});

test("a class's places read as taken of capacity, or just the headcount when uncapped", () => {
  assert.equal(capacityLabel(12, 16), "12 of 16");
  assert.equal(capacityLabel(12, null), "12 enrolled");
});

test("an assessment booking holds a place while booked or attended; a session is past once its day has ended", () => {
  assert.deepEqual(HOLDS_A_PLACE, ["BOOKED", "ATTENDED"]);
  const session = { date: new Date("2026-10-12T00:00:00Z"), startMinutes: 810, durationMinutes: 30 };
  assert.equal(isPast(session, "2026-10-13"), true);
  assert.equal(isPast(session, "2026-10-12"), false, "today is still upcoming until it is run");
  assert.equal(sessionSpan(session), "13:30 to 14:00");
});

test("a cancelled session refuses any more teaching records", async () => {
  const tx = (found: boolean) => ({ classCancellation: { findUnique: async () => (found ? { id: "c1" } : null) } }) as never;
  assert.equal(await cancellationError(tx(true), "course-1", new Date("2026-10-12T00:00:00Z")), CANCELLED_SESSION_ERROR);
  assert.equal(await cancellationError(tx(false), "course-1", new Date("2026-10-12T00:00:00Z")), null);
});
