import {
  lessonDataSchema,
  rebaseDraft,
  same,
  type LessonData,
  type LessonSaveResult,
  type SavedLesson,
  type SaveState,
} from "./schema";
export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export type LessonSnapshot = SavedLesson & {
  dirty: boolean;
  status: SaveState;
  generation: number;
  conflict: SavedLesson | null;
  storageWarning: boolean;
  error: string | null;
  completing: boolean;
};
type Save = (
  data: LessonData,
  revision: string,
  complete: boolean,
) => Promise<LessonSaveResult>;
type Options = {
  debounceMs?: number;
  retryMs?: number;
  canWrite?: () => boolean;
};
/** One queue per workspace. Edits are immutable generations; a response may
 * acknowledge its revision, but never replace edits made while it travelled. */
export class LessonDraft {
  private snapshot: LessonSnapshot;
  readonly serverSnapshot: LessonSnapshot;
  private base: LessonData;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inFlight = false;
  private disposed = true;
  private retries = 0;
  constructor(
    private key: string,
    initial: SavedLesson,
    private save: Save,
    private storage: DraftStorage,
    private options: Options = {},
  ) {
    this.base = structuredClone(initial.data);
    this.snapshot = {
      ...initial,
      dirty: false,
      status: "idle",
      generation: 0,
      conflict: null,
      storageWarning: false,
      error: null,
      completing: false,
    };
    this.serverSnapshot = this.snapshot;
    try {
      const raw = storage.getItem(key);
      if (raw) {
        const draft = JSON.parse(raw);
        if (
          draft.format === 1 &&
          lessonDataSchema.safeParse(draft.data).success &&
          lessonDataSchema.safeParse(draft.base).success &&
          /^[a-f0-9]{64}$/.test(draft.revision)
        ) {
          this.base = draft.base;
          this.snapshot = {
            ...this.snapshot,
            data: draft.data,
            revision: draft.revision,
            dirty: true,
            status: "queued",
            generation: 1,
            complete: false,
            completing: draft.completing === true,
          };
          // Server changes must be reviewed before resuming a restored draft.
          if (
            draft.revision !== initial.revision &&
            !same(draft.data, initial.data)
          )
            this.snapshot = {
              ...this.snapshot,
              status: "conflict",
              conflict: initial,
              completing: false,
            };
        } else
          this.snapshot = {
            ...this.snapshot,
            storageWarning: true,
            error:
              "The stored draft could not be read. It has not been overwritten.",
          };
      }
    } catch {
      this.snapshot = { ...this.snapshot, storageWarning: true };
    }
  }
  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => this.serverSnapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(patch: Partial<LessonSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
  private persist() {
    try {
      if (this.snapshot.dirty)
        this.storage.setItem(
          this.key,
          JSON.stringify({
            format: 1,
            data: this.snapshot.data,
            base: this.base,
            revision: this.snapshot.revision,
            completing: this.snapshot.completing,
          }),
        );
      else this.storage.removeItem(this.key);
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
    if (this.snapshot.dirty && !this.snapshot.conflict) this.schedule();
  }
  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
  }
  update(change: (data: LessonData) => void, attendanceChange = false) {
    if (this.options.canWrite && !this.options.canWrite()) return false;
    const data = structuredClone(this.snapshot.data);
    change(data);
    if (same(data, this.snapshot.data)) return false;
    this.publish({
      data,
      dirty: true,
      generation: this.snapshot.generation + 1,
      complete: attendanceChange ? false : this.snapshot.complete,
      completing: false,
      status: this.snapshot.conflict
        ? "conflict"
        : this.inFlight
          ? "saving"
          : "queued",
      error: null,
    });
    this.persist();
    if (!this.snapshot.conflict) this.schedule();
    return true;
  }
  finishAttendance() {
    if (
      this.snapshot.dirty ||
      this.inFlight ||
      this.snapshot.conflict ||
      this.snapshot.complete ||
      !Object.keys(this.snapshot.data.attendance).length ||
      Object.values(this.snapshot.data.attendance).some(
        (mark) => mark.status === null,
      )
    )
      return false;
    if (this.options.canWrite && !this.options.canWrite()) return false;
    this.publish({
      dirty: true,
      completing: true,
      generation: this.snapshot.generation + 1,
      status: "queued",
    });
    this.persist();
    this.schedule(0);
    return true;
  }
  async flush() {
    clearTimeout(this.timer);
    if (
      this.disposed ||
      this.inFlight ||
      !this.snapshot.dirty ||
      this.snapshot.conflict
    )
      return;
    if (this.options.canWrite && !this.options.canWrite()) {
      this.publish({
        status: "error",
        error:
          "You can read this draft, but your permissions do not allow saving.",
      });
      return;
    }
    this.inFlight = true;
    const { data, revision, generation, completing } = this.snapshot;
    this.publish({ status: "saving", error: null });
    try {
      const result = await this.save(
        structuredClone(data),
        revision,
        completing,
      );
      if (this.disposed) return;
      if (!result.ok) {
        if (result.conflict) {
          this.publish({
            status: "conflict",
            conflict: result.conflict,
            error: result.error,
            completing: false,
            complete: false,
          });
          this.persist();
          return;
        }
        this.publish({
          status: result.retry ? "offline" : "error",
          error: result.error,
        });
        this.persist();
        if (result.retry) this.retry();
        return;
      }
      this.retries = 0;
      const dirty = generation !== this.snapshot.generation;
      this.base = structuredClone(result.saved.data);
      this.publish({
        revision: result.saved.revision,
        data: dirty ? this.snapshot.data : result.saved.data,
        complete: dirty ? this.snapshot.complete : result.saved.complete,
        completing: false,
        dirty,
        status: dirty ? "queued" : "saved",
        error: null,
      });
      this.persist();
      if (dirty) this.schedule(0);
    } catch {
      if (this.disposed) return;
      this.publish({
        status: "offline",
        error: "Connection interrupted. Your changes will retry automatically.",
      });
      this.persist();
      this.retry();
    } finally {
      this.inFlight = false;
    }
  }
  private retry() {
    this.schedule(
      Math.min((this.options.retryMs ?? 2000) * 2 ** this.retries++, 15000),
    );
  }
  resolveConflict(choice: "saved" | "mine") {
    const saved = this.snapshot.conflict;
    if (!saved) return;
    if (choice === "mine" && this.options.canWrite && !this.options.canWrite())
      return;
    const data =
      choice === "saved"
        ? saved.data
        : rebaseDraft(this.base, this.snapshot.data, saved.data);
    this.base = structuredClone(saved.data);
    const dirty = !same(data, saved.data);
    this.publish({
      ...saved,
      data,
      complete: dirty ? false : saved.complete,
      dirty,
      completing: false,
      conflict: null,
      error: null,
      generation: this.snapshot.generation + 1,
      status: dirty ? "queued" : "saved",
    });
    this.persist();
    if (dirty) this.schedule(0);
  }
}
