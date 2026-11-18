import assert from "node:assert/strict";
import test from "node:test";
import { dublinInstant } from "@/lib/format";
import type { UsualDay } from "@/lib/people/usual-week";
import {
  ackState, attendanceStrike, blockState, changeInCheck, checkOpen, contractCovers, contractFit, preferenceChecks, examOutcome, fitWarnings, hoursAgainstContract, judgeCallOff, mondayOf, nextBlockStart, placesFor, rankFits,
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

test("warnings: a lifeguard-only contract guards and floats, and is warned off teaching", () => {
  const s = { ...S, lifeguardTypeId: "nplq", teachingTypeId: "swim", vettingTypeId: null };
  const guard: FitPerson = { contract: "lifeguard", dateOfBirth: "2000-01-01", quals: [{ typeId: "nplq", expiresOn: null }], shifts: [] };
  const both: FitPerson = { ...guard, contract: "swim_teacher_lifeguard", quals: [{ typeId: "nplq", expiresOn: null }, { typeId: "swim", expiresOn: null }] };
  const kinds = (role: string, p: FitPerson) => fitWarnings({ date: "2026-12-01", startMin: 600, endMin: 780, role }, p, s).map((w) => w.kind);
  assert.deepEqual(kinds("lifeguard", guard), []);
  assert.deepEqual(kinds("float", guard), [], "a lifeguard's float needs their lifeguard qualification");
  assert.deepEqual(kinds("teaching", guard), ["contract", "qualification"]);
  for (const role of ["lifeguard", "teaching", "float"]) assert.deepEqual(kinds(role, both), [], role);
  assert.equal(contractCovers("swim_teacher", "float"), true);
});

test("a block copies the people from the same slot and day of the block before, leaving leavers out", () => {
  const slots = [{ id: "am", weekday: 2, role: "teaching", name: "School morning", startMin: 615, endMin: 795, needed: 2 }];
  const first = placesFor("2026-11-23", slots, null, () => true);
  assert.equal(first.length, 4, "two Tuesdays, two people each");
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

/* ---------- The times staff gave, and the preference check (D35) ---------- */

const anyTime: UsualDay = { mode: "any", start: null, end: null }, cantWork: UsualDay = { mode: "none", start: null, end: null };

test("the preference check opens every four weeks from 7 December and closes on the Wednesday at 17:00", () => {
  const before = preferenceChecks("2026-12-06", S);
  assert.equal(before.current, null, "nothing has opened yet");
  assert.equal(before.next.opensOn, "2026-12-07");
  const first = preferenceChecks("2026-12-08", S).current!;
  assert.deepEqual([first.opensOn, first.closesOn], ["2026-12-07", "2026-12-09"]);
  assert.equal(first.closesAt.toISOString(), at("2026-12-09", "17:00").toISOString());
  // The owner's dates (email of 18 November 2026).
  const opens: string[] = [];
  for (let day = "2026-12-07"; opens.length < 7; day = preferenceChecks(day, S).next.opensOn) opens.push(preferenceChecks(day, S).current!.opensOn);
  assert.deepEqual(opens, ["2026-12-07", "2027-01-04", "2027-02-01", "2027-03-01", "2027-03-29", "2027-04-26", "2027-05-24"]);
  assert.equal(preferenceChecks("2027-01-03", S).current!.opensOn, "2026-12-07", "the day before the next check still belongs to the last");
  assert.equal(checkOpen(first, at("2026-12-09", "17:00")), true);
  assert.equal(checkOpen(first, at("2026-12-09", "17:05")), false);
});

test("a change counts in the check it was sent in; after the deadline it is marked, and before it opened it is old news", () => {
  const check = preferenceChecks("2026-12-08", S).current;
  assert.equal(changeInCheck(null, check), null, "they have not said");
  assert.equal(changeInCheck(at("2026-12-06", "12:00"), check), null);
  assert.equal(changeInCheck(at("2026-12-08", "09:00"), check), "in_check");
  assert.equal(changeInCheck(at("2026-12-10", "09:00"), check), "after_check");
  assert.equal(changeInCheck(at("2026-12-08", "09:00"), null), null, "no check has opened");
});

test("a shift outside the times they gave is warned about, and never pushes a name down as a serious warning does", () => {
  // 10 December 2026 is a Thursday: they can work Thursdays from 16:00 to 21:00.
  const usual: UsualDay[] = [anyTime, anyTime, anyTime, { mode: "between", start: 16 * 60, end: 21 * 60 }, cantWork, anyTime, anyTime];
  const person: FitPerson = { contract: "swim_teacher", dateOfBirth: null, quals: [], shifts: [], usual };
  const morning = { date: "2026-12-10", startMin: 9 * 60, endMin: 12 * 60, role: "teaching" };
  assert.deepEqual(fitWarnings(morning, person, S).map((w) => [w.kind, w.text]), [["usual", "Outside the times they gave: Thursdays 16:00\u201321:00."]]);
  assert.deepEqual(fitWarnings({ ...morning, startMin: 17 * 60, endMin: 20 * 60 }, person, S), [], "inside their times");
  assert.deepEqual(fitWarnings(morning, { ...person, usual: null }, S), [], "they have not said");
  const ranked = rankFits(morning, [{ id: "a", name: "Ann", contract: "swim_teacher", dateOfBirth: null, quals: [], contractMinutes: null, wantsMore: false, strikes: 0, usual }], [], S);
  assert.equal(ranked[0].serious, false, "a guide, never a limit");
});

test("contracted hours against the times they gave: only places their contract covers, wholly inside their times", () => {
  const usual: UsualDay[] = [anyTime, cantWork, anyTime, anyTime, anyTime, anyTime, anyTime];
  const slots = [
    { weekday: 2, role: "teaching", startMin: 615, endMin: 795 }, // Tuesday: they can't work
    { weekday: 3, role: "teaching", startMin: 615, endMin: 795 }, // Wednesday: 3 hours
    { weekday: 3, role: "lifeguard", startMin: 14 * 60, endMin: 18 * 60 }, // Wednesday: 4 hours, lifeguards only
  ];
  assert.deepEqual(contractFit(usual, "swim_teacher", 600, slots), { fits: 180, short: 420 });
  assert.deepEqual(contractFit(usual, "swim_teacher_lifeguard", 600, slots), { fits: 420, short: 180 });
  assert.deepEqual(contractFit(usual, "swim_teacher", 180, slots), { fits: 180, short: 0 });
  assert.equal(contractFit(null, "swim_teacher", 600, slots), null, "they have not said");
  assert.equal(contractFit(usual, "swim_teacher", null, slots), null, "no contracted hours on their Staff page");
});
