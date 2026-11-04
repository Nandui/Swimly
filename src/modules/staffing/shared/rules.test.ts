import assert from "node:assert/strict";
import test from "node:test";
import { dublinInstant } from "@/lib/format";
import {
  ackState, attendanceStrike, blockState, examOutcome, fitWarnings, hoursAgainstContract, judgeCallOff, mondayOf, nextBlockStart, placesFor, rankFits,
  publishDeadline, readSettings, semesterOf, STAFFING_DEFAULTS as S, strikeCounted, strikeDue, strikeStage, swapAllowed, swapExpired, type FitPerson,
} from "@/modules/staffing/shared/rules";

/** Staffing's rules, including the spec's acceptance criteria (section 12). Invented people only. */
const at = (date: string, hhmm: string) => dublinInstant(date, Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)))!;

test("settings fall back to the defaults, value by value", () => {
  const s = readSettings({ weeklyCapHours: 35, restHours: "not a number", lateShiftFrom: "13:00" });
  assert.equal(s.weeklyCapHours, 35);
  assert.equal(s.restHours, 11);
  assert.equal(s.lateShiftFrom, "13:00");
  assert.equal(readSettings(null).strikeCountingFrom, "2027-01-25");
});

test("semesters start in September, January and May", () => {
  assert.equal(semesterOf("2026-11-04").key, "2026-09");
  assert.equal(semesterOf("2027-01-20").key, "2027-01");
  assert.equal(semesterOf("2027-04-30").key, "2027-01");
  assert.equal(semesterOf("2027-05-01").key, "2027-05");
});

test("a block is published the Friday four weeks and three days before its Monday, at 17:00", () => {
  assert.equal(mondayOf("2026-11-04"), "2026-11-02");
  const deadline = publishDeadline("2026-12-07", S);
  assert.equal(deadline.toISOString(), at("2026-11-06", "17:00").toISOString());
  assert.equal(blockState(null, deadline, at("2026-11-06", "16:00")), "draft");
  assert.equal(blockState(null, deadline, at("2026-11-06", "17:01")), "overdue");
  assert.equal(nextBlockStart("2026-12-07", "2026-11-04", S, new Date()), "2026-12-21");
  assert.equal(nextBlockStart(null, "2026-11-04", S, at("2026-11-04", "12:00")), "2026-12-07");
});

test("a swap is blocked under 48 hours and an open one expires then (BR-5.2, 5.8)", () => {
  const start = at("2026-12-03", "10:15"); // a Thursday
  assert.equal(swapAllowed(start, at("2026-12-01", "11:00"), S), false, "Tuesday 11:00 is under 48 hours");
  assert.equal(swapAllowed(start, at("2026-12-01", "10:00"), S), true);
  assert.equal(swapExpired("open", start, at("2026-12-01", "11:00"), S), true);
  assert.equal(swapExpired("accepted", start, at("2026-12-01", "11:00"), S), false, "accepted ones wait for the supervisor");
});

test("a late shift's call-off is on time by 09:30; late is a strike, on-time sickness is not (BR-6.3, 6.4, 6.6)", () => {
  const late = { date: "2026-11-04", startMin: 16 * 60 };
  const early = judgeCallOff(late, at("2026-11-04", "09:15"), "phone", false, S);
  assert.equal(early.onTime, true);
  assert.equal(attendanceStrike({ kind: "call_off", reason: "sick", onTime: early.onTime }, S), null);
  const after = judgeCallOff(late, at("2026-11-04", "10:05"), "phone", false, S);
  assert.equal(after.onTime, false);
  assert.equal(attendanceStrike({ kind: "call_off", reason: "sick", onTime: after.onTime }, S), "late_call_off");
  assert.equal(judgeCallOff(late, at("2026-11-04", "08:00"), "text", false, S).onTime, false, "a text never counts");
  assert.equal(attendanceStrike({ kind: "call_off", reason: "other", onTime: true }, S), "short_notice");
});

test("an early shift's call-off is due by 18:00 the day before, or an hour before in exceptional circumstances", () => {
  const morning = { date: "2026-11-05", startMin: 10 * 60 + 15 };
  assert.equal(judgeCallOff(morning, at("2026-11-04", "17:59"), "phone", false, S).onTime, true);
  assert.equal(judgeCallOff(morning, at("2026-11-05", "07:00"), "phone", false, S).onTime, false);
  assert.equal(judgeCallOff(morning, at("2026-11-05", "07:00"), "phone", true, S).onTime, true);
  assert.equal(judgeCallOff(morning, at("2026-11-05", "09:45"), "phone", true, S).onTime, false);
});

test("late arrivals over an hour and no-shows are strikes; a no-show goes straight to referral", () => {
  assert.equal(attendanceStrike({ kind: "late", minutesLate: 45 }, S), null);
  assert.equal(attendanceStrike({ kind: "late", minutesLate: 61 }, S), "late_arrival");
  assert.equal(attendanceStrike({ kind: "no_show" }, S), "no_show");
  assert.equal(attendanceStrike({ kind: "no_show", swapTaken: true }, S), "swap_no_show");
  assert.equal(strikeStage(1, "no_show", true), "serious_misconduct_referral");
});

test("the ladder: 1 informal, 2 signed note, 3 formal; before 25 January 2027 nothing counts (BR-8.3, 8.5)", () => {
  assert.equal(strikeCounted("2027-01-20", S), false);
  assert.equal(strikeCounted("2027-01-25", S), true);
  assert.equal(strikeStage(1, "late_call_off", false), "not_counted");
  assert.equal(strikeStage(1, "late_call_off", true), "informal_1");
  assert.equal(strikeStage(2, "late_call_off", true), "informal_2");
  assert.equal(strikeStage(4, "late_call_off", true), "formal_referral");
  assert.equal(strikeDue("informal_1", "2027-02-01", "2027-02-03", S), "2027-02-03");
  assert.equal(strikeDue("informal_2", "2027-02-01", "2027-02-03", S), "2027-02-08");
});

test("exam absences follow the outcome table (BR-7.4)", () => {
  const shift = { date: "2026-12-08", startMin: 10 * 60 + 15 };
  const ask = (requestedOn: string, noticeSentOn: string | null) =>
    examOutcome({ requestedAt: at(requestedOn, "12:00"), requestedOn, shift, seasonStartsOn: "2026-12-07", noticeSentOn }, S);
  assert.equal(ask("2026-11-20", "2026-11-06"), "late_notice", "the spec's example: after 16 Nov, notice sent 6 Nov");
  assert.equal(ask("2026-11-16", "2026-11-06"), "on_time");
  assert.equal(ask("2026-12-07", "2026-11-06"), "short_notice");
  assert.equal(ask("2026-11-25", "2026-11-24"), "college_short_notice");
  assert.equal(ask("2026-11-10", null), "no_notice");
});

test("acknowledgements: a reminder at 24 hours, a phone call at 48 (BR-4.2)", () => {
  const published = at("2026-11-06", "17:00");
  assert.equal(ackState(published, null, at("2026-11-07", "16:00"), S), "waiting");
  assert.equal(ackState(published, null, at("2026-11-07", "18:00"), S), "remind");
  assert.equal(ackState(published, null, at("2026-11-08", "18:00"), S), "phone");
  assert.equal(ackState(published, published, at("2026-11-09", "18:00"), S), "acknowledged");
});

test("warnings: a swim-teacher-only contract on a lifeguard shift, overlap, rest and the weekly cap", () => {
  const s = { ...S, lifeguardTypeId: "nplq", teachingTypeId: "swim", vettingTypeId: "vetting" };
  const teacher: FitPerson = { contract: "swim_teacher", dateOfBirth: "2000-01-01", quals: [{ typeId: "swim", expiresOn: null }, { typeId: "vetting", expiresOn: "2027-06-01" }], shifts: [] };
  const kinds = (shift: Parameters<typeof fitWarnings>[0], p: FitPerson, settings = s) => fitWarnings(shift, p, settings).map((w) => w.kind);
  assert.deepEqual(kinds({ date: "2026-12-01", startMin: 600, endMin: 780, role: "lifeguard" }, teacher), ["contract", "qualification"]);
  assert.deepEqual(kinds({ date: "2026-12-01", startMin: 600, endMin: 780, role: "teaching" }, teacher), []);
  assert.deepEqual(kinds({ date: "2027-07-01", startMin: 600, endMin: 780, role: "teaching" }, teacher), ["vetting"]);
  const busy = { ...teacher, shifts: [{ id: "a", date: "2026-12-01", startMin: 700, endMin: 800, role: "teaching" }, { id: "b", date: "2026-11-30", startMin: 1200, endMin: 1400, role: "teaching" }] };
  assert.deepEqual(kinds({ date: "2026-12-01", startMin: 600, endMin: 780, role: "teaching" }, busy), ["overlap", "rest"]);
  const week = { ...teacher, shifts: ["2026-11-30", "2026-12-02", "2026-12-03", "2026-12-04"].map((date, i) => ({ id: `w${i}`, date, startMin: 360, endMin: 960, role: "teaching" })) };
  assert.deepEqual(kinds({ date: "2026-12-05", startMin: 360, endMin: 960, role: "teaching" }, week), ["weekly"]);
  assert.ok(kinds({ date: "2026-12-05", startMin: 600, endMin: 700, role: "teaching" }, { ...teacher, dateOfBirth: "2009-12-31" }).includes("young"));
});

test("a block copies the people from the same slot and day of the block before, leaving leavers out", () => {
  const slots = [{ id: "am", weekday: 2, role: "teaching", name: "School morning", startMin: 615, endMin: 795, needed: 2 }];
  const first = placesFor("2026-11-23", slots, null, () => true);
  assert.equal(first.length, 4, "two Tuesdays, two teachers each");
  assert.ok(first.every((p) => p.userId === null));
  const previous = { startsOn: "2026-11-23", shifts: [{ slotId: "am", date: "2026-11-24", userId: "ann" }, { slotId: "am", date: "2026-11-24", userId: "leaver" }] };
  const next = placesFor("2026-12-07", slots, previous, (id) => id !== "leaver");
  assert.deepEqual(next.filter((p) => p.date === "2026-12-08").map((p) => p.userId), ["ann", null]);
});

test("hours against contract count each week and ignore shifts the person is away from", () => {
  const rows = hoursAgainstContract("2026-12-07", [
    { userId: "ann", date: "2026-12-08", startMin: 600, endMin: 900, status: "scheduled" },
    { userId: "ann", date: "2026-12-15", startMin: 600, endMin: 900, status: "called_off" },
  ], new Map([["ann", 600], ["bea", 300]]));
  const ann = rows.find((r) => r.userId === "ann")!;
  assert.deepEqual(ann.weeks, [300, 0]);
  assert.equal(ann.short, 600);
  assert.equal(rows.find((r) => r.userId === "bea")!.short, 300);
});

test("who could take a shift: below contract first, then extra hours with no strikes, serious warnings last", () => {
  const base = { contract: "swim_teacher" as const, dateOfBirth: null, quals: [], contractMinutes: null, wantsMore: false, strikes: 0 };
  const people = [
    { ...base, id: "busy", name: "Busy" },
    { ...base, id: "more", name: "More", wantsMore: true },
    { ...base, id: "short", name: "Short", contractMinutes: 600 },
    { ...base, id: "struck", name: "Struck", wantsMore: true, strikes: 1 },
  ];
  const shifts = [{ id: "x", userId: "busy", date: "2026-12-08", startMin: 600, endMin: 700, role: "teaching" }];
  const ranked = rankFits({ date: "2026-12-08", startMin: 615, endMin: 795, role: "teaching" }, people, shifts, S);
  assert.deepEqual(ranked.map((r) => r.id), ["short", "more", "struck", "busy"]);
});
