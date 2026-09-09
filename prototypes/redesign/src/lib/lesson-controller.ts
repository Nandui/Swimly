import {
  ConnectionError,
  isLesson,
  PREFIX,
  type StoragePort,
} from "./persistence";
import type { LessonData, LessonRepository, LessonSnapshot } from "./types";

interface Options {
  debounceMs?: number;
  retryMs?: number;
  canWrite?: () => boolean;
}
type Draft = { version: 1; data: LessonData; revision: number };

/** Framework-independent autosave state machine; the React layer only
 * subscribes. Its lifetime is the workspace, never the current tab or route. */
export class LessonController {
  private snapshot: LessonSnapshot;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight = false;
  private disposed = false;
  private retryCount = 0;
  private readonly draftKey: string;
  constructor(
    readonly key: string,
    initial: LessonData,
    private repository: LessonRepository,
    private storage: StoragePort,
    private options: Options = {},
  ) {
    this.draftKey = `${PREFIX}draft:${key}`;
    let warning = false;
    let saved = {
      data: structuredClone(initial),
      revision: 0,
      updatedAt: null as string | null,
    };
    try {
      saved = repository.load(key, initial);
    } catch {
      warning = true;
    }
    this.snapshot = {
      ...saved,
      generation: 0,
      savedAt: saved.updatedAt,
      dirty: false,
      status: saved.revision ? "saved" : "idle",
      conflict: null,
      storageWarning: warning,
    };
    try {
      const raw = storage.getItem(this.draftKey);
      if (raw) {
        const draft: Draft = JSON.parse(raw);
        if (
          draft.version === 1 &&
          isLesson(draft.data) &&
          Number.isInteger(draft.revision) &&
          draft.revision >= 0
        ) {
          this.snapshot = {
            ...this.snapshot,
            data: draft.data,
            revision: draft.revision,
            dirty: true,
            status: "queued",
            generation: 1,
          };
        } else this.snapshot.storageWarning = true;
      }
    } catch {
      this.snapshot.storageWarning = true;
    }
    this.reconcileRoster(Object.keys(initial.attendance));
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(patch: Partial<LessonSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private persist() {
    try {
      if (this.snapshot.dirty)
        this.storage.setItem(
          this.draftKey,
          JSON.stringify({
            version: 1,
            data: this.snapshot.data,
            revision: this.snapshot.revision,
          } satisfies Draft),
        );
      else this.storage.removeItem(this.draftKey);
      if (this.snapshot.storageWarning) this.publish({ storageWarning: false });
    } catch {
      this.publish({ storageWarning: true });
    }
  }
  private schedule(delay = this.options.debounceMs ?? 650) {
    clearTimeout(this.timer);
    if (!this.disposed) this.timer = setTimeout(() => void this.flush(), delay);
  }
  start() {
    this.disposed = false;
    if (this.snapshot.dirty) this.schedule();
  }
  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
  }
  update(change: (draft: LessonData) => void, attendanceChange = false) {
    if (this.options.canWrite && !this.options.canWrite()) return false;
    const data = structuredClone(this.snapshot.data);
    change(data);
    if (JSON.stringify(data) === JSON.stringify(this.snapshot.data))
      return false;
    if (attendanceChange) data.attendanceDone = false;
    this.publish({
      data,
      dirty: true,
      generation: this.snapshot.generation + 1,
      status: this.snapshot.conflict
        ? "conflict"
        : this.inFlight
          ? "saving"
          : "queued",
    });
    this.persist();
    if (!this.snapshot.conflict) this.schedule();
    return true;
  }
  finishAttendance() {
    if (this.snapshot.dirty || this.inFlight || this.snapshot.conflict)
      return false;
    return this.update((data) => {
      data.attendanceDone = true;
    });
  }
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    if (
      this.disposed ||
      this.inFlight ||
      !this.snapshot.dirty ||
      this.snapshot.conflict
    )
      return;
    if (this.options.canWrite && !this.options.canWrite()) {
      this.publish({ status: "error" });
      return;
    }
    this.inFlight = true;
    const { data, revision, generation } = this.snapshot;
    this.publish({ status: "saving" });
    try {
      const result = await this.repository.save(
        this.key,
        structuredClone(data),
        revision,
      );
      if (this.disposed) return;
      if (!result.ok) {
        this.publish({ status: "conflict", conflict: result.conflict });
        return;
      }
      this.retryCount = 0;
      const dirty = generation !== this.snapshot.generation;
      this.publish({
        revision: result.saved.revision,
        savedAt: result.saved.updatedAt,
        dirty,
        status: dirty ? "queued" : "saved",
      });
      // Keep the latest local data. The response belongs to a potentially
      // older generation and is only authoritative about its revision.
      this.persist();
      if (dirty) this.schedule(0);
    } catch (error) {
      if (this.disposed) return;
      this.publish({
        status: error instanceof ConnectionError ? "offline" : "error",
      });
      this.persist();
      const backoff = Math.min(
        (this.options.retryMs ?? 2000) * 2 ** this.retryCount++,
        15000,
      );
      this.schedule(backoff);
    } finally {
      this.inFlight = false;
    }
  }
  resolveConflict(choice: "saved" | "mine") {
    const conflict = this.snapshot.conflict;
    if (
      !conflict ||
      (this.options.canWrite && !this.options.canWrite() && choice === "mine")
    )
      return;
    if (choice === "saved") {
      const rosterIds = Object.keys(this.snapshot.data.attendance);
      this.publish({
        data: structuredClone(conflict.data),
        revision: conflict.revision,
        dirty: false,
        savedAt: conflict.updatedAt,
        status: "saved",
        conflict: null,
      });
      this.reconcileRoster(rosterIds);
      this.persist();
    } else {
      this.publish({
        revision: conflict.revision,
        conflict: null,
        status: "queued",
      });
      this.persist();
      this.schedule(0);
    }
  }
  /** Fixture enrolments can alter the roster during the review. Reconcile
   * identities, keeping existing marks, without saving absent defaults. */
  reconcileRoster(ids: string[]) {
    const currentIds = Object.keys(this.snapshot.data.attendance).sort().join();
    if (currentIds === [...ids].sort().join()) return;
    const data = structuredClone(this.snapshot.data);
    data.attendance = Object.fromEntries(
      ids.map((id) => [id, data.attendance[id] ?? "ABSENT"]),
    );
    data.competencies = Object.fromEntries(
      ids.map((id) => [id, data.competencies[id] ?? {}]),
    );
    data.attendanceDone = false;
    data.completedSwimmers = data.completedSwimmers.filter((id) =>
      ids.includes(id),
    );
    // Roster changes are not attendance marks. Opening an updated roster must
    // not save its absent defaults, but a pending response must not acknowledge
    // the newly composed draft or reinstate a completed, outdated roster.
    this.publish({
      data,
      generation: this.snapshot.generation + 1,
      status: this.snapshot.dirty ? this.snapshot.status : "idle",
    });
    if (this.snapshot.dirty) this.persist();
  }
}
