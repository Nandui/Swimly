import assert from "node:assert/strict";
import { test } from "node:test";
import { LessonDraft, type DraftStorage } from "./draft";
import {
  rebaseDraft,
  type LessonData,
  type LessonSaveResult,
  type SavedLesson,
} from "./schema";
const initial = (): SavedLesson => ({
  revision: "1".repeat(64),
  complete: false,
  data: {
    attendance: {
      one: { status: null, note: "" },
      two: { status: null, note: "" },
    },
    competencies: { one: { skill: null }, two: { skill: null } },
    note: "",
  },
});
function memory(): DraftStorage {
  const entries = new Map<string, string>();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
    removeItem: (key) => {
      entries.delete(key);
    },
  };
}
function successful(
  data: LessonData,
  revision = "2",
  complete = false,
): LessonSaveResult {
  return {
    ok: true,
    saved: {
      data: structuredClone(data),
      revision: revision.repeat(64),
      complete,
    },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const present = (data: LessonData) => {
  for (const mark of Object.values(data.attendance)) mark.status = "PRESENT";
};

test("opening a lesson never writes unmarked/default attendance", async (t) => {
  let calls = 0;
  const draft = new LessonDraft(
    "test",
    initial(),
    async (data) => {
      calls++;
      return successful(data);
    },
    memory(),
    { debounceMs: 1 },
  );
  t.after(() => draft.dispose());
  draft.start();
  await delay(8);
  await draft.flush();
  assert.equal(calls, 0);
  assert.equal(draft.getSnapshot().data.attendance.one.status, null);
  assert.equal(draft.finishAttendance(), false);
});
test("one request in flight retains rapid edits and sends them against the acknowledged revision", async (t) => {
  const gate = deferred<LessonSaveResult>();
  const requests: { data: LessonData; revision: string }[] = [];
  const draft = new LessonDraft(
    "test",
    initial(),
    async (data, revision) => {
      requests.push({ data, revision });
      return requests.length === 1 ? gate.promise : successful(data, "3");
    },
    memory(),
    { debounceMs: 50000 },
  );
  t.after(() => draft.dispose());
  draft.start();
  draft.update((data) => {
    data.attendance.one.status = "PRESENT";
  }, true);
  const first = draft.flush();
  draft.update((data) => {
    data.attendance.one.status = "LATE";
    data.competencies.two.skill = "ACHIEVED";
  }, true);
  await draft.flush();
  assert.equal(requests.length, 1);
  assert.equal(draft.finishAttendance(), false);
  gate.resolve(successful(requests[0].data));
  await first;
  await draft.flush();
  assert.equal(requests.length, 2);
  assert.equal(requests[1].revision, "2".repeat(64));
  assert.equal(requests[1].data.attendance.one.status, "LATE");
  assert.equal(draft.getSnapshot().data.competencies.two.skill, "ACHIEVED");
  assert.equal(draft.getSnapshot().dirty, false);
});
test("a reload restores pending work and pauses when another record version exists", (t) => {
  const storage = memory();
  const draft = new LessonDraft(
    "test",
    initial(),
    async (data) => successful(data),
    storage,
  );
  t.after(() => draft.dispose());
  draft.update((data) => {
    data.attendance.one.status = "PRESENT";
  }, true);
  const reloaded = new LessonDraft(
    "test",
    initial(),
    async (data) => successful(data),
    storage,
  );
  t.after(() => reloaded.dispose());
  assert.equal(reloaded.getSnapshot().dirty, true);
  assert.equal(reloaded.getSnapshot().data.attendance.one.status, "PRESENT");
  const changed = initial();
  changed.revision = "3".repeat(64);
  changed.data.attendance.two.status = "ABSENT";
  const conflict = new LessonDraft(
    "test",
    changed,
    async (data) => successful(data),
    storage,
  );
  t.after(() => conflict.dispose());
  assert.equal(conflict.getSnapshot().status, "conflict");
  assert.equal(conflict.getSnapshot().data.attendance.one.status, "PRESENT");
  conflict.resolveConflict("mine");
  assert.equal(conflict.getSnapshot().data.attendance.two.status, "ABSENT");
  assert.equal(conflict.getSnapshot().data.attendance.one.status, "PRESENT");
});
test("conflict review preserves local changes and newly enrolled swimmers", () => {
  const base = initial().data;
  const mine = structuredClone(base);
  mine.attendance.one.status = "PRESENT";
  const saved = structuredClone(base);
  saved.attendance.two.status = "ABSENT";
  saved.attendance.new = { status: null, note: "" };
  saved.competencies.new = { skill: null };
  const merged = rebaseDraft(base, mine, saved);
  assert.equal(merged.attendance.one.status, "PRESENT");
  assert.equal(merged.attendance.two.status, "ABSENT");
  assert.equal(merged.attendance.new.status, null);
});
test("Done requires all marks saved, and completion stays false until confirmation succeeds", async (t) => {
  const gate = deferred<LessonSaveResult>();
  let calls = 0;
  const draft = new LessonDraft(
    "test",
    initial(),
    async (data, _revision, complete) => {
      calls++;
      return complete ? gate.promise : successful(data);
    },
    memory(),
    { debounceMs: 50000 },
  );
  t.after(() => draft.dispose());
  draft.start();
  draft.update(present, true);
  assert.equal(draft.finishAttendance(), false);
  await draft.flush();
  assert.equal(draft.getSnapshot().complete, false);
  assert.equal(draft.finishAttendance(), true);
  const confirm = draft.flush();
  assert.equal(draft.getSnapshot().complete, false);
  gate.resolve(successful(draft.getSnapshot().data, "3", true));
  await confirm;
  assert.equal(draft.getSnapshot().complete, true);
  assert.equal(calls, 2);
  draft.update((data) => {
    data.attendance.one.status = "ABSENT";
  }, true);
  assert.equal(draft.getSnapshot().complete, false);
});
test("attendance edits during completion stay pending and are never acknowledged by the older response", async (t) => {
  const record = initial();
  present(record.data);
  const gate = deferred<LessonSaveResult>();
  const draft = new LessonDraft(
    "test",
    record,
    async () => gate.promise,
    memory(),
    { debounceMs: 50000 },
  );
  t.after(() => draft.dispose());
  draft.start();
  draft.finishAttendance();
  const request = draft.flush();
  draft.update((data) => {
    data.attendance.one.status = "LATE";
  }, true);
  gate.resolve(successful(record.data, "2", true));
  await request;
  assert.equal(draft.getSnapshot().complete, false);
  assert.equal(draft.getSnapshot().dirty, true);
  assert.equal(draft.getSnapshot().data.attendance.one.status, "LATE");
});
test("temporary failures retry, preserve the draft, and only report saved after acknowledgment", async (t) => {
  let calls = 0;
  const storage = memory();
  const draft = new LessonDraft(
    "test",
    initial(),
    async (data) =>
      ++calls === 1
        ? { ok: false, error: "Temporary connection failure", retry: true }
        : successful(data),
    storage,
    { debounceMs: 50000, retryMs: 2 },
  );
  t.after(() => draft.dispose());
  draft.start();
  draft.update(present, true);
  await draft.flush();
  assert.equal(draft.getSnapshot().status, "offline");
  assert.ok(storage.getItem("test"));
  await delay(20);
  assert.equal(calls, 2);
  assert.equal(draft.getSnapshot().status, "saved");
  assert.equal(storage.getItem("test"), null);
});
test("validation failures do not retry or discard a draft", async (t) => {
  let calls = 0;
  const draft = new LessonDraft(
    "test",
    initial(),
    async () => {
      calls++;
      return { ok: false, error: "Permission changed" };
    },
    memory(),
    { debounceMs: 50000, retryMs: 1 },
  );
  t.after(() => draft.dispose());
  draft.start();
  draft.update(present, true);
  await draft.flush();
  await delay(10);
  assert.equal(calls, 1);
  assert.equal(draft.getSnapshot().dirty, true);
  assert.equal(draft.getSnapshot().status, "error");
});
test("read-only workspaces cannot save restored drafts or confirm attendance", async (t) => {
  const storage = memory();
  const editable = new LessonDraft(
    "test",
    initial(),
    async (data) => successful(data),
    storage,
  );
  editable.update(present, true);
  editable.dispose();
  let calls = 0;
  const readonly = new LessonDraft(
    "test",
    initial(),
    async (data) => {
      calls++;
      return successful(data);
    },
    storage,
    { canWrite: () => false },
  );
  t.after(() => readonly.dispose());
  readonly.start();
  await readonly.flush();
  assert.equal(calls, 0);
  assert.equal(
    readonly.update((data) => {
      data.note = "changed";
    }),
    false,
  );
  assert.equal(readonly.finishAttendance(), false);
  assert.ok(storage.getItem("test"));
});
test("storage errors are surfaced without blocking an online save", async (t) => {
  const storage: DraftStorage = {
    getItem: () => null,
    setItem: () => {
      throw Error("quota");
    },
    removeItem: () => {},
  };
  const draft = new LessonDraft(
    "test",
    initial(),
    async (data) => successful(data),
    storage,
    { debounceMs: 50000 },
  );
  t.after(() => draft.dispose());
  draft.start();
  draft.update(present, true);
  assert.equal(draft.getSnapshot().storageWarning, true);
  await draft.flush();
  assert.equal(draft.getSnapshot().status, "saved");
  assert.equal(draft.getSnapshot().storageWarning, false);
});
test("a failed request that committed can be retried without replaying completion", async (t) => {
  const saved = initial();
  present(saved.data);
  saved.complete = true;
  saved.revision = "2".repeat(64);
  const storage = memory();
  storage.setItem(
    "test",
    JSON.stringify({
      format: 1,
      base: initial().data,
      data: saved.data,
      revision: "1".repeat(64),
      completing: true,
    }),
  );
  const draft = new LessonDraft(
    "test",
    saved,
    async () => ({ ok: true, saved }),
    storage,
    { debounceMs: 50000 },
  );
  t.after(() => draft.dispose());
  draft.start();
  await draft.flush();
  assert.equal(draft.getSnapshot().complete, true);
  assert.equal(draft.getSnapshot().dirty, false);
});
