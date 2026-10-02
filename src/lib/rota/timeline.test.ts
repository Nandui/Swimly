import assert from "node:assert/strict";
import { test } from "node:test";
import { segmentProblem } from "./constants";
import { buildTimeline, coverGaps, dayRange, fitsFor, type TimelineShift } from "./timeline";

/** Invented people; the shape the day loads. */
const h = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const shift = (id: string, who: string | null, a: string, b: string, segments: [string, string, string, string?][] = [], extra: Partial<TimelineShift> = {}): TimelineShift => ({
  id, kind: "shift", startMinutes: h(a), endMinutes: h(b), role: "Lifeguard", userId: who ? `u_${who}` : null, rotaPersonId: null, importId: null,
  user: who ? { name: who } : null, rotaPerson: null, warnings: who ? [] : ["open"],
  segments: segments.map(([s, e, label, kind], i) => ({ id: `${id}${i}`, startMinutes: h(s), endMinutes: h(e), label, kind: kind ?? "activity" })), ...extra,
});

test("a row per person, their activities and breaks inside the shift, hours without breaks", () => {
  const { rows } = buildTimeline([
    shift("a", "Sam", "09:30", "18:00", [["09:30", "13:00", "25m pool lifeguard"], ["13:00", "13:30", "Break", "break"], ["13:30", "18:00", "25m pool lifeguard"]]),
    shift("b", "Amy", "06:30", "14:00"),
    shift("c", "Amy", "15:10", "18:00", [], { bookingId: "bk", bookingNeed: { role: "Rookie" } }),
    shift("d", null, "10:00", "18:00"),
  ], [{ userId: "u_Sam", startMinutes: h("15:10"), endMinutes: h("15:40"), label: "Level 2" }]);
  assert.deepEqual(rows.map((r) => r.name), ["Amy", "Sam", null], "by start, unfilled last");
  const sam = rows[1];
  assert.equal(sam.minutes, 8 * 60, "8.5 hours less a 30 minute break");
  assert.equal(sam.breaks, 30);
  assert.equal(sam.teaching.length, 1, "the swim class they teach shows on their row");
  assert.equal(rows[0].shifts.length, 2);
  assert.equal(rows[0].roles, "Lifeguard, Rookie");
});

test("each activity's cover shows who and the gaps", () => {
  const { cover } = buildTimeline([
    shift("a", "Sam", "09:30", "18:00", [["09:30", "13:00", "25m pool lifeguard"], ["13:00", "13:30", "Break", "break"], ["13:30", "18:00", "25m pool lifeguard"]]),
    shift("b", "Ben", "18:00", "21:30", [["18:00", "21:30", "25m pool lifeguard"]]),
  ]);
  assert.deepEqual(cover.map((c) => [c.label, c.spans.map((s) => s.who), c.gaps]), [["25m pool lifeguard", ["Sam", "Sam", "Ben"], [{ start: h("13:00"), end: h("13:30"), short: 1 }]]]);
});

test("segments stay inside the shift, one at a time", () => {
  const s = { startMinutes: h("09:00"), endMinutes: h("17:00") };
  assert.equal(segmentProblem(s, [{ startMinutes: h("09:00"), endMinutes: h("12:00"), kind: "activity", label: "Reception" }]), null);
  assert.match(segmentProblem(s, [{ startMinutes: h("08:00"), endMinutes: h("10:00"), kind: "activity", label: "Reception" }])!, /inside the shift/);
  assert.match(segmentProblem(s, [{ startMinutes: h("09:00"), endMinutes: h("12:00"), kind: "activity", label: "A" + "b" }, { startMinutes: h("11:00"), endMinutes: h("12:30"), kind: "break", label: "Break" }])!, /overlap/);
  assert.match(segmentProblem(s, [{ startMinutes: h("09:00"), endMinutes: h("10:00"), kind: "activity", label: "" }])!, /Say what/);
  assert.deepEqual(dayRange([{ startMinutes: h("05:45"), endMinutes: h("22:30") }]), { from: h("05:00"), to: h("23:00") });
});

test("a planned activity shows when fewer than it needs are on it", () => {
  const { cover } = buildTimeline([
    shift("a", "Sam", "09:00", "17:00", [["09:00", "12:00", "Poolside"]]),
    shift("b", "Ben", "09:00", "17:00", [["10:00", "17:00", "Poolside"]]),
  ], [], [{ id: "p", label: "poolside", startMinutes: h("08:00"), endMinutes: h("18:00"), people: 2, requiredTypeId: null, requiredType: null, note: "" }]);
  assert.equal(cover.length, 1, "matched by name, whatever the case");
  assert.deepEqual(cover[0].gaps.map((g) => [g.start / 60, g.end / 60, g.short]), [[8, 9, 2], [9, 10, 1], [12, 17, 1], [17, 18, 2]]);
  assert.deepEqual(coverGaps({ start: 0, end: 60, people: 1 }, [{ start: 0, end: 60 }]), []);
});

test("who can cover: free and qualified first, then part of it, then busy with why", () => {
  const people = [
    { shiftId: "1", name: "Busy", start: h("09:00"), end: h("17:00"), busy: [{ start: h("09:00"), end: h("17:00"), label: "Reception" }], absent: false, types: ["nplq"] },
    { shiftId: "2", name: "Part", start: h("09:00"), end: h("17:00"), busy: [{ start: h("13:00"), end: h("13:30"), label: "Break" }], absent: false, types: ["nplq"] },
    { shiftId: "3", name: "Free", start: h("06:30"), end: h("21:30"), busy: [], absent: false, types: ["nplq"] },
    { shiftId: "4", name: "Unqualified", start: h("06:30"), end: h("21:30"), busy: [], absent: false, types: [] },
    { shiftId: "5", name: "Off", start: h("06:30"), end: h("21:30"), busy: [], absent: true, types: ["nplq"] },
  ];
  const fits = fitsFor({ start: h("12:00"), end: h("14:00"), requiredTypeId: "nplq" }, people);
  assert.deepEqual(fits.map((f) => [f.candidate.name, f.status, f.qualified]), [["Free", "free", true], ["Unqualified", "free", false], ["Part", "part", true], ["Busy", "busy", true], ["Off", "busy", true]]);
  assert.equal(fits[2].reason, "Free 12:00–13:00");
  assert.equal(fits[3].reason, "Reception 09:00–17:00");
});
