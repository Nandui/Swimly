import assert from "node:assert/strict";
import test from "node:test";
import { ACTIONS, actionMeta } from "@/lib/activity/constants";
import { CLUB_STATUS_META } from "@/lib/clubs/constants";
import { DEVICE_STATUS_META } from "@/lib/devices/meta";
import { DOC_STATUS_META, RISK_BAND_TONE_META, UNCLASSIFIED_RISK_META, riskBandMeta } from "@/modules/docs/lib/types";
import { HOME_ITEM_META, HOME_SESSION_META } from "@/lib/home-meta";
import { NOTE_VISIBILITY_META, REVIEW_STATUS_META } from "@/modules/hr/lib/constants";
import { PERSON_STATUS_META, QUALIFICATION_STATE_META } from "@/lib/people/constants";
import { refundStatuses } from "@/modules/refunds";
import * as rota from "@/modules/rota/lib/constants";
import * as rotaMeta from "@/modules/rota/lib/meta";
import { REACH_META, STAFF_STATUS_META } from "@/lib/staff/constants";
import { ARCHIVAL_STATUS_META, type StatusMeta } from "@/lib/status";
import { CERTIFICATE_STATUS_META, TRAINING_STATUS_META } from "@/modules/training/shared/constants";

const TONES = new Set(["green", "blue", "orange", "red", "purple", "gray"]);

const MAPS: Record<string, Record<string, StatusMeta>> = {
  ACTIONS, CLUB_STATUS_META, DEVICE_STATUS_META, DOC_STATUS_META, RISK_BAND_TONE_META, HOME_ITEM_META, HOME_SESSION_META,
  NOTE_VISIBILITY_META, REVIEW_STATUS_META, PERSON_STATUS_META, QUALIFICATION_STATE_META, refundStatuses,
  ABSENCE_REASON_META: rota.ABSENCE_REASON_META, ROTA_CHANGE_REASON_META: rota.ROTA_CHANGE_REASON_META, BOOKING_KIND_META: rota.BOOKING_KIND_META,
  RETURN_FIT_META: rota.RETURN_FIT_META, ROTA_DAY_META: rotaMeta.ROTA_DAY_META, ROTA_WEEK_META: rotaMeta.ROTA_WEEK_META, ROTA_FIT_META: rotaMeta.ROTA_FIT_META,
  ROTA_SHIFT_NOTE_META: rotaMeta.ROTA_SHIFT_NOTE_META, ROTA_TIMEPOINT_META: rotaMeta.ROTA_TIMEPOINT_META, ROTA_CLASS_META: rotaMeta.ROTA_CLASS_META,
  REACH_META, STAFF_STATUS_META, ARCHIVAL_STATUS_META, CERTIFICATE_STATUS_META, TRAINING_STATUS_META,
};

test("every status meta has a label, one of the six tones and an icon", () => {
  for (const [name, map] of Object.entries(MAPS)) {
    for (const [key, meta] of Object.entries(map)) {
      assert.ok(meta.label, `${name}.${key} has a label`);
      assert.ok(TONES.has(meta.color), `${name}.${key} uses one of the six tones, not ${meta.color}`);
      assert.ok(meta.icon, `${name}.${key} has an icon`);
    }
  }
});

test("within a map, two entries of the same tone never share an icon", () => {
  for (const [name, map] of Object.entries(MAPS)) {
    const seen = new Map<string, string>();
    for (const [key, meta] of Object.entries(map)) {
      const slot = `${meta.color}:${meta.icon.displayName ?? String(meta.icon)}`;
      assert.equal(seen.get(slot), undefined, `${name}.${key} repeats the ${meta.color} icon of ${name}.${seen.get(slot)}`);
      seen.set(slot, key);
    }
  }
});

test("actionMeta knows the verbs the modules write and falls back to a sentence-case gray meta", () => {
  for (const verb of ["submit", "save", "email_result", "sign-off", "register-device", "convert-to-levels", "pay"]) {
    assert.ok(ACTIONS[verb], `${verb} has a meta`);
    assert.equal(actionMeta(verb), ACTIONS[verb]);
  }
  const unknown = actionMeta("frobnicate_the-widget");
  assert.equal(unknown.label, "Frobnicate the widget");
  assert.equal(unknown.color, "gray");
  assert.ok(unknown.icon);
});

test("riskBandMeta maps stored band colours and reads anything else as unclassified", () => {
  assert.equal(riskBandMeta({ color: "amber" }), RISK_BAND_TONE_META.amber);
  assert.equal(riskBandMeta({ color: "amber" }).color, "orange");
  assert.equal(riskBandMeta({ color: "red" }).color, "red");
  assert.equal(riskBandMeta({ color: "neutral" }), UNCLASSIFIED_RISK_META);
  assert.equal(riskBandMeta(null), UNCLASSIFIED_RISK_META);
  assert.equal(riskBandMeta(undefined), UNCLASSIFIED_RISK_META);
});
