import assert from "node:assert/strict";
import { test } from "node:test";
import { CLASSES, initialLesson } from "./fixtures";
import { LessonController } from "./lesson-controller";
import {
  ConnectionError,
  FixtureLessonRepository,
  pause,
  PREFIX,
  type StoragePort,
} from "./persistence";
import type {
  LessonData,
  LessonRepository,
  NetworkMode,
  SavedLesson,
  SaveResult,
} from "./types";

class MemoryStorage implements StoragePort {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}
class DeferredRepository implements LessonRepository {
  saved: SavedLesson = {
    data: initialLesson(CLASSES[0]),
    revision: 0,
    updatedAt: null,
  };
  calls: {
    data: LessonData;
    revision: number;
    resolve: (result: SaveResult) => void;
    reject: (error: Error) => void;
  }[] = [];
  load() {
    return structuredClone(this.saved);
  }
  save(_key: string, data: LessonData, revision: number) {
    return new Promise<SaveResult>((resolve, reject) => {
      this.calls.push({ data, revision, resolve, reject });
    });
  }
  conflict() {
    this.saved.revision++;
    this.saved.data.note = "Another instructor’s note";
  }
  accept(index: number) {
    const call = this.calls[index];
    this.saved = {
      data: structuredClone(call.data),
      revision: this.saved.revision + 1,
      updatedAt: "2026-09-08T14:22:00.000Z",
    };
    call.resolve({ ok: true, saved: this.load() });
  }
}
function setup() {
  const storage = new MemoryStorage();
  const repo = new DeferredRepository();
  const controller = new LessonController(
    "class-1",
    initialLesson(CLASSES[0]),
    repo,
    storage,
    { debounceMs: 1000, retryMs: 1000 },
  );
  return { storage, repo, controller };
}
test("opening or switching a class never writes absent defaults", async () => {
  const { controller, repo, storage } = setup();
  controller.start();
  await controller.flush();
  assert.equal(repo.calls.length, 0);
  assert.equal(storage.values.size, 0);
  assert.equal(controller.getSnapshot().data.attendanceDone, false);
  controller.dispose();
});
test("a late response preserves newer edits and only one request is in flight", async () => {
  const { controller, repo } = setup();
  controller.update((data) => {
    data.attendance["bishopstown-1"] = "PRESENT";
  }, true);
  const first = controller.flush();
  controller.update((data) => {
    data.competencies["bishopstown-1"].travel = "ACHIEVED";
  });
  await controller.flush();
  assert.equal(repo.calls.length, 1);
  repo.accept(0);
  await first;
  assert.equal(controller.getSnapshot().dirty, true);
  assert.equal(
    controller.getSnapshot().data.competencies["bishopstown-1"].travel,
    "ACHIEVED",
  );
  const second = controller.flush();
  assert.equal(repo.calls[1].revision, 1);
  repo.accept(1);
  await second;
  assert.equal(controller.getSnapshot().dirty, false);
  assert.equal(controller.getSnapshot().status, "saved");
  controller.dispose();
});
test("completion waits for marks to save and an explicit Done, then edits reopen it", async () => {
  const { controller, repo } = setup();
  controller.update((data) => {
    data.attendance["bishopstown-1"] = "PRESENT";
  }, true);
  assert.equal(controller.finishAttendance(), false);
  const marks = controller.flush();
  repo.accept(0);
  await marks;
  assert.equal(controller.getSnapshot().data.attendanceDone, false);
  assert.equal(controller.finishAttendance(), true);
  assert.equal(controller.getSnapshot().dirty, true);
  const done = controller.flush();
  repo.accept(1);
  await done;
  assert.equal(
    controller.getSnapshot().data.attendanceDone &&
      !controller.getSnapshot().dirty,
    true,
  );
  controller.update((data) => {
    data.attendance["bishopstown-1"] = "LATE";
  }, true);
  assert.equal(controller.getSnapshot().data.attendanceDone, false);
  controller.dispose();
});
test("reload restores a durable draft and its original revision", () => {
  const { controller, repo, storage } = setup();
  controller.update((data) => {
    data.note = "Keep this draft";
  }, true);
  controller.dispose();
  repo.conflict();
  const restored = new LessonController(
    "class-1",
    initialLesson(CLASSES[0]),
    repo,
    storage,
  );
  assert.equal(restored.getSnapshot().data.note, "Keep this draft");
  assert.equal(restored.getSnapshot().revision, 0);
  assert.equal(restored.getSnapshot().dirty, true);
  restored.dispose();
});
test("connection failure retains the draft; recovery retries the latest generation", async () => {
  const { controller, repo, storage } = setup();
  controller.update((data) => {
    data.note = "First edit";
  }, true);
  const request = controller.flush();
  repo.calls[0].reject(new ConnectionError());
  await request;
  assert.equal(controller.getSnapshot().status, "offline");
  assert.ok(storage.getItem(`${PREFIX}draft:class-1`));
  controller.update((data) => {
    data.note = "Latest offline edit";
  }, true);
  const retry = controller.flush();
  assert.equal(repo.calls[1].data.note, "Latest offline edit");
  repo.accept(1);
  await retry;
  assert.equal(controller.getSnapshot().status, "saved");
  assert.equal(storage.getItem(`${PREFIX}draft:class-1`), null);
  controller.dispose();
});
test("conflicts pause autosave and recheck the revision after an explicit replacement", async () => {
  const { controller, repo } = setup();
  controller.update((data) => {
    data.note = "Mine";
  }, true);
  const request = controller.flush();
  repo.conflict();
  repo.calls[0].resolve({ ok: false, conflict: repo.load() });
  await request;
  await controller.flush();
  assert.equal(repo.calls.length, 1);
  assert.equal(controller.getSnapshot().data.note, "Mine");
  controller.resolveConflict("mine");
  const retry = controller.flush();
  assert.equal(repo.calls[1].revision, 1);
  repo.conflict();
  repo.calls[1].resolve({ ok: false, conflict: repo.load() });
  await retry;
  assert.equal(controller.getSnapshot().status, "conflict");
  controller.resolveConflict("saved");
  assert.equal(controller.getSnapshot().dirty, false);
  assert.equal(controller.getSnapshot().data.note, "Another instructor’s note");
  controller.dispose();
});
test("storage failure is visible and cannot be mistaken for a durable draft", () => {
  const repo = new DeferredRepository();
  const storage: StoragePort = {
    getItem: () => null,
    setItem: () => {
      throw new Error("Quota exceeded");
    },
    removeItem: () => {},
  };
  const controller = new LessonController(
    "blocked",
    initialLesson(CLASSES[0]),
    repo,
    storage,
  );
  controller.update((data) => {
    data.note = "Still in memory";
  });
  assert.equal(controller.getSnapshot().storageWarning, true);
  assert.equal(controller.getSnapshot().data.note, "Still in memory");
  controller.dispose();
});
test("read-only permission prevents new edits, completion and pending dispatch", async () => {
  const { storage, repo } = setup();
  let mayWrite = true;
  const controller = new LessonController(
    "restricted",
    initialLesson(CLASSES[0]),
    repo,
    storage,
    { canWrite: () => mayWrite },
  );
  controller.update((data) => {
    data.note = "Queued before restriction";
  });
  mayWrite = false;
  assert.equal(
    controller.update((data) => {
      data.note = "Forbidden";
    }),
    false,
  );
  assert.equal(controller.finishAttendance(), false);
  await controller.flush();
  assert.equal(repo.calls.length, 0);
  assert.equal(controller.getSnapshot().data.note, "Queued before restriction");
  controller.dispose();
});
test("fixture repository rejects stale writes and identical retries do not increment the revision", async () => {
  const storage = new MemoryStorage();
  let mode: NetworkMode = "normal";
  const repo = new FixtureLessonRepository(storage, () => mode, 0);
  const data = initialLesson(CLASSES[0]);
  data.note = "Saved note";
  const first = await repo.save("fixture", data, 0);
  assert.equal(first.ok, true);
  const retry = await repo.save("fixture", data, 0);
  assert.equal(retry.ok && retry.saved.revision, 1);
  repo.conflict("fixture", data);
  const stale = await repo.save("fixture", { ...data, note: "Stale" }, 1);
  assert.equal(stale.ok, false);
  mode = "offline";
  await assert.rejects(repo.save("fixture", data, 2), ConnectionError);
});
test("autosave batches a burst of edits into one request", async () => {
  const storage = new MemoryStorage();
  const repo = new DeferredRepository();
  const controller = new LessonController(
    "debounce",
    initialLesson(CLASSES[0]),
    repo,
    storage,
    { debounceMs: 15 },
  );
  controller.update((data) => {
    data.note = "A";
  });
  controller.update((data) => {
    data.note = "AB";
  });
  controller.update((data) => {
    data.note = "ABC";
  });
  await pause(40);
  assert.equal(repo.calls.length, 1);
  assert.equal(repo.calls[0].data.note, "ABC");
  repo.accept(0);
  await pause(0);
  controller.dispose();
});

test("an updated roster reopens completion on reload without saving absent defaults", async () => {
  const { storage, repo } = setup();
  repo.saved.revision = 1;
  repo.saved.data.attendanceDone = true;
  const initial = initialLesson({
    ...CLASSES[0],
    swimmerIds: [...CLASSES[0].swimmerIds, "bishopstown-11"],
  });
  const controller = new LessonController("class-1", initial, repo, storage);
  controller.start();
  await controller.flush();
  assert.equal(controller.getSnapshot().data.attendanceDone, false);
  assert.equal(
    controller.getSnapshot().data.attendance["bishopstown-11"],
    "ABSENT",
  );
  assert.equal(controller.getSnapshot().dirty, false);
  assert.equal(repo.calls.length, 0);
  controller.dispose();
});

test("a roster change during a save cannot acknowledge an outdated completed roster", async () => {
  const { controller, repo } = setup();
  controller.finishAttendance();
  const first = controller.flush();
  controller.reconcileRoster([...CLASSES[0].swimmerIds, "bishopstown-11"]);
  repo.accept(0);
  await first;
  assert.equal(controller.getSnapshot().dirty, true);
  assert.equal(controller.getSnapshot().data.attendanceDone, false);
  assert.equal(
    controller.getSnapshot().data.attendance["bishopstown-11"],
    "ABSENT",
  );
  controller.dispose();
});

test("fixture permission is checked again after a delayed request", async () => {
  const storage = new MemoryStorage();
  let canWrite = true;
  const repo = new FixtureLessonRepository(
    storage,
    () => "normal",
    10,
    () => canWrite,
  );
  const pending = repo.save("permission", initialLesson(CLASSES[0]), 0);
  canWrite = false;
  await assert.rejects(pending, /permission/);
  assert.equal(storage.values.size, 0);
});

test("temporary failures retry automatically and eventually acknowledge the draft", async () => {
  const storage = new MemoryStorage();
  const backing = new FixtureLessonRepository(storage, () => "normal", 0);
  let attempts = 0;
  const repository: LessonRepository = {
    load: (...args) => backing.load(...args),
    conflict: (...args) => backing.conflict(...args),
    save: (...args) => {
      if (++attempts === 1) return Promise.reject(new ConnectionError());
      return backing.save(...args);
    },
  };
  const controller = new LessonController(
    "automatic-retry",
    initialLesson(CLASSES[0]),
    repository,
    storage,
    { debounceMs: 1, retryMs: 5 },
  );
  controller.update((data) => {
    data.note = "Keep retrying";
  });
  for (let i = 0; i < 50 && controller.getSnapshot().status !== "saved"; i++)
    await pause(10);
  assert.equal(attempts, 2);
  assert.equal(controller.getSnapshot().status, "saved");
  assert.equal(controller.getSnapshot().dirty, false);
  controller.dispose();
});
