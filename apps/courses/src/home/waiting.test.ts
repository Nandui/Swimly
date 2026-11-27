import assert from "node:assert/strict";
import { test } from "node:test";
import { sharedRoots, waiting, type Place, type Reason, type WaitingInput } from "./waiting";

const day = (d: number) => new Date(Date.UTC(2026, 10, d));
const same = (id: string) => id;
const none: ReadonlySet<string> = new Set();

function reason(over: Partial<Reason> = {}): Reason {
  return { id: "r1", studentId: "ava", siteId: "site-a", programmeId: "swim", queuedOn: day(10), order: [0, 0], places: [], ...over };
}
function place(over: Partial<Place> = {}): Place {
  return { id: "p1", programmeId: "swim", status: "ACTIVE", startedOn: day(12), endedOn: null, ...over };
}
function count(over: Partial<WaitingInput>): number {
  return waiting({ reasons: [], waitingLists: [], siteIds: null, programmeOf: same, beganAsWaitingList: none, everAPlace: none, ...over }).size;
}

test("an assessed swimmer with no class place is waiting", () => {
  assert.equal(count({ reasons: [reason()] }), 1);
});

test("an active place in that programme ends the wait", () => {
  assert.equal(count({ reasons: [reason({ places: [place()] })] }), 0);
});

test("a place in another programme does not", () => {
  assert.equal(count({ reasons: [reason({ places: [place({ programmeId: "lifesaving" })] })] }), 1);
});

test("a waiting-list entry is not a place", () => {
  assert.equal(count({ reasons: [reason({ places: [place({ status: "WAITLISTED" })] })] }), 1);
});

test("a place that ended before they began waiting does not count; one after does", () => {
  const before = place({ status: "WITHDRAWN", startedOn: day(1), endedOn: day(5) });
  const after = place({ status: "WITHDRAWN", startedOn: day(11), endedOn: day(20) });
  assert.equal(count({ reasons: [reason({ places: [before] })] }), 1);
  assert.equal(count({ reasons: [reason({ places: [after] })] }), 0);
});

test("a withdrawn waiting-list entry that never became a place does not end the wait", () => {
  const withdrawn = place({ id: "w1", status: "WITHDRAWN", startedOn: day(11) });
  assert.equal(count({ reasons: [reason({ places: [withdrawn] })], beganAsWaitingList: new Set(["w1"]) }), 1);
  assert.equal(count({ reasons: [reason({ places: [withdrawn] })], beganAsWaitingList: new Set(["w1"]), everAPlace: new Set(["w1"]) }), 0);
});

test("the latest reason for a swimmer and programme is the one that counts, at its own site", () => {
  const older = reason({ id: "old", siteId: "site-a", queuedOn: day(3) });
  const newer = reason({ id: "new", siteId: "site-b", queuedOn: day(9) });
  assert.equal(count({ reasons: [older, newer], siteIds: new Set(["site-a"]) }), 0);
  assert.equal(count({ reasons: [older, newer], siteIds: new Set(["site-b"]) }), 1);
  assert.equal(count({ reasons: [older, newer] }), 1);
});

test("a programme shared between sites is one programme", () => {
  const programmeOf = sharedRoots([{ id: "swim", sharedWithId: null }, { id: "swim-copy", sharedWithId: "swim" }]);
  assert.equal(programmeOf("swim-copy"), "swim");
  const placedInCopy = reason({ places: [place({ programmeId: "swim-copy" })] });
  assert.equal(count({ reasons: [placedInCopy], programmeOf }), 0);
  assert.equal(count({ reasons: [reason(), reason({ id: "r2", programmeId: "swim-copy", queuedOn: day(11) })], programmeOf }), 1);
});

test("someone on a class's waiting list is waiting, once per programme", () => {
  assert.equal(count({ waitingLists: [{ studentId: "finn", programmeId: "swim" }, { studentId: "finn", programmeId: "swim" }] }), 1);
  assert.equal(count({ reasons: [reason()], waitingLists: [{ studentId: "ava", programmeId: "swim" }, { studentId: "finn", programmeId: "swim" }] }), 2);
});

test("a circular or broken shared link is refused", () => {
  assert.throws(() => sharedRoots([{ id: "a", sharedWithId: "b" }, { id: "b", sharedWithId: "a" }]), /circular/);
  assert.throws(() => sharedRoots([{ id: "a", sharedWithId: "gone" }]), /missing/);
});
