import assert from "node:assert/strict";
import { test } from "node:test";
import { MAINTENANCE_STATUS_META as frontDoorStatuses } from "@/modules/maintenance";
import { cleanFields, MaintenanceError, moveChange, reportSchema, statusFor, urgencyFor } from "./rules";
import { MAINTENANCE_STATUS_META, MAINTENANCE_STATUSES, maintenanceNumber } from "./types";

/** Maintenance's pure rules: urgency follows the risk, the Trackplan answer sets where an open
 *  request is, and each Manage move is allowed only from where it makes sense. Writes are in
 *  __tests__/maintenance.test.ts. */
const who = { id: "mia", name: "Mia" };
const now = new Date("2026-10-26T10:00:00Z");
const row = (status: "reported" | "in_trackplan" | "fixed" | "closed", trackplan: "yes" | "no" | "unsure" = "no") => ({ id: "r1", status, trackplan, trackplanRef: "" });
const none = { note: "", trackplanRef: "", duplicateOfId: "" };

test("could hurt someone is always urgent; otherwise the urgency chosen stands", () => {
  assert.equal(urgencyFor("could_hurt", "low"), "urgent");
  assert.equal(urgencyFor("out_of_use", "low"), "low");
  assert.equal(urgencyFor("none", "normal"), "normal");
});

test("an open request is In Trackplan exactly when the answer is yes; a closed one keeps its status", () => {
  assert.equal(statusFor("reported", "yes"), "in_trackplan");
  assert.equal(statusFor("in_trackplan", "unsure"), "reported");
  assert.equal(statusFor("reported", "no"), "reported");
  assert.equal(statusFor("fixed", "no"), "fixed");
  assert.equal(statusFor("closed", "yes"), "closed");
});

test("a Trackplan reference is kept only with a yes, and risk drives urgency when stored", () => {
  const base = { area: "", place: "", title: "Light out", details: "", urgency: "low" as const, risk: "could_hurt" as const, trackplanRef: "TP-1" };
  assert.deepEqual(cleanFields({ ...base, trackplan: "no" }), { ...base, trackplan: "no", trackplanRef: "", urgency: "urgent" });
  assert.equal(cleanFields({ ...base, trackplan: "yes" }).trackplanRef, "TP-1");
});

test("a report needs a site, a few words on what is broken and the Trackplan answer", () => {
  const ok = { id: crypto.randomUUID(), operationId: crypto.randomUUID(), siteId: "s1", title: "Shower 3 will not turn off", urgency: "normal", risk: "none", trackplan: "unsure" };
  assert.equal(reportSchema.safeParse(ok).success, true);
  assert.equal(reportSchema.safeParse({ ...ok, title: "x" }).success, false);
  assert.equal(reportSchema.safeParse({ ...ok, trackplan: "maybe" }).success, false);
  assert.equal(reportSchema.safeParse({ ...ok, siteId: "" }).success, false);
});

test("putting it in Trackplan is only for a reported request, and keeps a reference", () => {
  assert.deepEqual(moveChange(row("reported"), "trackplan", { ...none, trackplanRef: "TP-42" }, who, now), { status: "in_trackplan", trackplan: "yes", trackplanRef: "TP-42" });
  assert.throws(() => moveChange(row("in_trackplan", "yes"), "trackplan", none, who, now), MaintenanceError);
});

test("fixing or closing is only for an open request; closing needs a reason or the request it repeats", () => {
  const fixed = moveChange(row("in_trackplan", "yes"), "fix", { ...none, note: "Bulb replaced" }, who, now);
  assert.equal(fixed.status, "fixed");
  assert.equal(fixed.outcome, "Bulb replaced");
  assert.equal(fixed.closedByName, "Mia");
  assert.throws(() => moveChange(row("fixed"), "fix", none, who, now), MaintenanceError);
  assert.throws(() => moveChange(row("reported"), "close", none, who, now), /Say why/);
  assert.equal(moveChange(row("reported"), "close", { ...none, note: "No longer needed" }, who, now).status, "closed");
  assert.throws(() => moveChange(row("reported"), "close", { ...none, duplicateOfId: "r2" }, who, now, null), /Choose the request/, "the other request must be found at the site");
  assert.throws(() => moveChange(row("reported"), "close", { ...none, duplicateOfId: "r1" }, who, now, { id: "r1" }), /Choose the request/, "not itself");
  const dup = moveChange(row("reported"), "close", { ...none, duplicateOfId: "r2" }, who, now, { id: "r2" });
  assert.equal(dup.duplicateOfId, "r2");
  assert.equal(dup.outcome, "Reported twice");
});

test("opening again is only for a closed request, back to where its Trackplan answer puts it", () => {
  assert.equal(moveChange(row("fixed", "yes"), "reopen", none, who, now).status, "in_trackplan");
  assert.equal(moveChange(row("closed", "no"), "reopen", none, who, now).status, "reported");
  assert.equal(moveChange(row("closed"), "reopen", none, who, now).closedAt, null);
  assert.throws(() => moveChange(row("reported"), "reopen", none, who, now), MaintenanceError);
});

test("four statuses, the front door shows the same ones, and numbers read M-0042", () => {
  assert.equal(frontDoorStatuses, MAINTENANCE_STATUS_META);
  assert.deepEqual(Object.keys(MAINTENANCE_STATUS_META), [...MAINTENANCE_STATUSES]);
  assert.equal(MAINTENANCE_STATUS_META.reported.color, "orange", "waits for a manager");
  assert.equal(MAINTENANCE_STATUS_META.fixed.color, "green");
  assert.equal(maintenanceNumber(42), "M-0042");
});
