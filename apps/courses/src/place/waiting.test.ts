import assert from "node:assert/strict";
import { test } from "node:test";
import { hasEarnedPlace, sharedRoots, waitingQueue, type Place, type Reason, type WaitingInput, type WaitingListEntry } from "./waiting";

const day = (d: number) => new Date(Date.UTC(2026, 10, d));
const same = (id: string) => id;
const none: ReadonlySet<string> = new Set();

function reason(over: Partial<Reason> = {}): Reason {
  return { id: "r1", studentId: "ava", siteId: "site-a", programmeId: "swim", levelId: "otters", queuedOn: day(10), order: [0, 0], places: [], ...over };
}
function place(over: Partial<Place> = {}): Place {
  return { id: "p1", programmeId: "swim", status: "ACTIVE", startedOn: day(12), endedOn: null, ...over };
}
function listed(over: Partial<WaitingListEntry> = {}): WaitingListEntry {
  return { id: "w1", studentId: "finn", programmeId: "swim", createdAt: day(8), ...over };
}
function queue(over: Partial<WaitingInput>) {
  return waitingQueue({ reasons: [], waitingLists: [], siteIds: null, programmeOf: same, beganAsWaitingList: none, everAPlace: none, ...over });
}
const count = (over: Partial<WaitingInput>) => queue(over).length;

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
  const withdrawn = place({ id: "x1", status: "WITHDRAWN", startedOn: day(11) });
  assert.equal(count({ reasons: [reason({ places: [withdrawn] })], beganAsWaitingList: new Set(["x1"]) }), 1);
  assert.equal(count({ reasons: [reason({ places: [withdrawn] })], beganAsWaitingList: new Set(["x1"]), everAPlace: new Set(["x1"]) }), 0);
});

test("the latest reason for a swimmer and programme is the one that counts, at its own site", () => {
  const older = reason({ id: "old", siteId: "site-a", queuedOn: day(3) });
  const newer = reason({ id: "new", siteId: "site-b", queuedOn: day(9) });
  assert.equal(count({ reasons: [older, newer], siteIds: new Set(["site-a"]) }), 0);
  assert.equal(count({ reasons: [older, newer], siteIds: new Set(["site-b"]) }), 1);
  assert.equal(queue({ reasons: [older, newer] })[0]?.id, "new");
});

test("a programme shared between sites is one programme", () => {
  const programmeOf = sharedRoots([{ id: "swim", sharedWithId: null }, { id: "swim-copy", sharedWithId: "swim" }]);
  assert.equal(programmeOf("swim-copy"), "swim");
  assert.equal(count({ reasons: [reason({ places: [place({ programmeId: "swim-copy" })] })], programmeOf }), 0);
  assert.equal(count({ reasons: [reason(), reason({ id: "r2", programmeId: "swim-copy", queuedOn: day(11) })], programmeOf }), 1);
});

test("someone on a class's waiting list is waiting, once per programme", () => {
  assert.equal(count({ waitingLists: [listed(), listed({ id: "w2", createdAt: day(9) })] }), 1);
  const both = queue({ reasons: [reason()], waitingLists: [listed({ studentId: "ava", createdAt: day(4) }), listed({ id: "w2" })] });
  assert.equal(both.length, 2);
  const ava = both.find((w) => w.studentId === "ava")!;
  assert.equal(ava.onWaitingList, true);
  assert.equal(ava.reason?.id, "r1");
  assert.deepEqual(ava.since, day(4));
});

test("the queue runs longest wait first", () => {
  const order = queue({ reasons: [reason({ id: "late", studentId: "cara", queuedOn: day(20) }), reason({ id: "early", studentId: "ava", queuedOn: day(2) })], waitingLists: [listed({ createdAt: day(8) })] });
  assert.deepEqual(order.map((w) => w.studentId), ["ava", "finn", "cara"]);
});

test("a circular or broken shared link is refused", () => {
  assert.throws(() => sharedRoots([{ id: "a", sharedWithId: "b" }, { id: "b", sharedWithId: "a" }]), /circular/);
  assert.throws(() => sharedRoots([{ id: "a", sharedWithId: "gone" }]), /missing/);
});

const levels = [{ id: "starfish" }, { id: "otters" }, { id: "seals" }];
const earned = (targetLevelId: string, over: { completed?: string[]; active?: string[]; assessed?: string[] } = {}) =>
  hasEarnedPlace({ targetLevelId, orderedLevels: levels, completedLevelIds: new Set(over.completed), activeLevelIds: new Set(over.active), assessedLevelIds: new Set(over.assessed) });

test("the first level is earned by turning up; the next needs the one before", () => {
  assert.equal(earned("starfish"), true);
  assert.equal(earned("otters"), false);
  assert.equal(earned("otters", { completed: ["starfish"] }), true);
  assert.equal(earned("seals", { completed: ["starfish"] }), false);
});

test("an assessment earns its level and every level below it", () => {
  assert.equal(earned("otters", { assessed: ["otters"] }), true);
  assert.equal(earned("otters", { assessed: ["seals"] }), true);
  assert.equal(earned("seals", { assessed: ["otters"] }), false);
});

test("a level they are in or have done is earned; an unknown level is not blocked", () => {
  assert.equal(earned("seals", { active: ["seals"] }), true);
  assert.equal(earned("seals", { completed: ["seals"] }), true);
  assert.equal(earned("squad"), true);
});
