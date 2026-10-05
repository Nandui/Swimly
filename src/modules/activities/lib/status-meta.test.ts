import assert from "node:assert/strict";
import test from "node:test";
import type { StatusMeta } from "@/lib/status";
import { ATTENDANCE_REPORT_META } from "./analytics/reports";
import { BOOKING_STATUS_META, SESSION_STATUS_META } from "./assessments/constants";
import { ATTENDANCE_RECORD_META, ATTENDANCE_STATUS_META } from "./attendance/constants";
import { CANCELLATION_META } from "./cancellations/constants";
import { CAPACITY_META, COURSE_PHASE_META, COURSE_STATUS_META, capacityTone } from "./courses/constants";
import { ENROLMENT_STATUS_META, FOLLOW_UP_META, PLACEMENT_META, WAITLIST_AVAILABILITY_META } from "./enrolment/constants";
import { CONTACT_OUTCOMES } from "./enrolment/follow-up";
import { LEGEND_AGREEMENT_META } from "./enrolment/legend-agreement";
import { ACCESS_REQUEST_META, PARENT_ACCESS_META, PARENT_ACCOUNT_META, PUBLICATION_META } from "./parent/admin-client";
import { COMPETENCY_STATUS_META, COMPLETION_META, LEVEL_PROGRESS_META } from "./progression/constants";
import { MEDICAL_STATUS_META, PARENT_CHANGE_STATUS_META, STUDENT_STATUS_META } from "./students/constants";
import { HISTORY_META } from "./students/history";
import { CALENDAR_PHASE_META } from "./today/calendar";

const TONES = new Set(["green", "blue", "orange", "red", "purple", "gray"]);
const MAPS: Record<string, Record<string, StatusMeta>> = {
  ATTENDANCE_REPORT_META, BOOKING_STATUS_META, SESSION_STATUS_META, ATTENDANCE_RECORD_META, ATTENDANCE_STATUS_META,
  CANCELLATION_META, CAPACITY_META, COURSE_PHASE_META, COURSE_STATUS_META, ENROLMENT_STATUS_META, FOLLOW_UP_META,
  PLACEMENT_META, WAITLIST_AVAILABILITY_META, CONTACT_OUTCOMES, LEGEND_AGREEMENT_META, ACCESS_REQUEST_META,
  PARENT_ACCESS_META, PARENT_ACCOUNT_META, PUBLICATION_META, COMPETENCY_STATUS_META, COMPLETION_META,
  LEVEL_PROGRESS_META, MEDICAL_STATUS_META, PARENT_CHANGE_STATUS_META, STUDENT_STATUS_META, HISTORY_META,
  CALENDAR_PHASE_META,
};

test("every swim school status meta has a label, one of the six tones and an icon of its own", () => {
  for (const [name, map] of Object.entries(MAPS)) {
    const seen = new Map<string, string>();
    for (const [key, meta] of Object.entries(map)) {
      assert.ok(meta.label, `${name}.${key} has a label`);
      assert.ok(TONES.has(meta.color), `${name}.${key} uses one of the six tones, not ${meta.color}`);
      assert.ok(meta.icon, `${name}.${key} has an icon`);
      // FOLLOW_UP_META.waitlisted reuses the enrolment entry on purpose.
      const slot = `${meta.color}:${meta.icon.displayName ?? String(meta.icon)}`;
      assert.equal(seen.get(slot), undefined, `${name}.${key} repeats the ${meta.color} icon of ${name}.${seen.get(slot)}`);
      seen.set(slot, key);
    }
  }
});

test("Not achieved is spelled one way", () => {
  assert.equal(COMPETENCY_STATUS_META.WORKING_ON.label, "Not achieved");
});

test("capacityTone is a meta: full, or counted over capacity", () => {
  assert.equal(capacityTone(10, null), null);
  assert.equal(capacityTone(9, 10), null);
  assert.equal(capacityTone(10, 10), CAPACITY_META.full);
  const over = capacityTone(12, 10);
  assert.equal(over?.label, "2 over");
  assert.equal(over?.color, "red");
  assert.equal(over?.icon, CAPACITY_META.over.icon);
});
