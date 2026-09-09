import type {
  LessonData,
  LessonRepository,
  NetworkMode,
  SavedLesson,
  SaveResult,
} from "./types";

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export const PREFIX = "swimly-redesign:v1:";
export const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
export class ConnectionError extends Error {}
export function isLesson(value: unknown): value is LessonData {
  if (!value || typeof value !== "object") return false;
  const data = value as LessonData;
  return (
    typeof data.note === "string" &&
    typeof data.attendanceDone === "boolean" &&
    (data.cover === null || typeof data.cover === "string") &&
    Array.isArray(data.completedSwimmers) &&
    data.completedSwimmers.every((id) => typeof id === "string") &&
    !!data.attendance &&
    typeof data.attendance === "object" &&
    Object.values(data.attendance).every((status) =>
      ["PRESENT", "LATE", "ABSENT"].includes(status),
    ) &&
    !!data.competencies &&
    typeof data.competencies === "object" &&
    Object.values(data.competencies).every(
      (row) =>
        row &&
        typeof row === "object" &&
        Object.values(row).every(
          (mark) =>
            mark === null || mark === "ACHIEVED" || mark === "WORKING_ON",
        ),
    )
  );
}
export function isSavedLesson(value: unknown): value is SavedLesson {
  const saved = value as SavedLesson | null;
  return (
    !!saved &&
    Number.isInteger(saved.revision) &&
    saved.revision >= 0 &&
    isLesson(saved.data) &&
    (saved.updatedAt === null || typeof saved.updatedAt === "string")
  );
}

/** A simulated remote store. It never makes a network request. Separating
 * acknowledged records from drafts lets reloads and stale revisions behave
 * like the eventual server contract. Storage failures reject acknowledgement. */
export class FixtureLessonRepository implements LessonRepository {
  constructor(
    private storage: StoragePort,
    private mode: () => NetworkMode,
    private latency = 450,
    private canWrite = () => true,
  ) {}
  load(key: string, initial: LessonData): SavedLesson {
    const raw = this.storage.getItem(`${PREFIX}server:${key}`);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (!isSavedLesson(parsed)) throw new Error("Invalid saved lesson");
      return structuredClone(parsed);
    }
    return { data: structuredClone(initial), revision: 0, updatedAt: null };
  }
  async save(
    key: string,
    data: LessonData,
    revision: number,
  ): Promise<SaveResult> {
    if (this.mode() === "offline") throw new ConnectionError("Offline");
    await pause(this.mode() === "slow" ? 2800 : this.latency);
    if (!this.canWrite()) throw new Error("Editing permission is required");
    if (this.mode() === "offline") throw new ConnectionError("Offline");
    if (this.mode() === "failure") throw new Error("The save failed");
    const current = this.load(key, data);
    // An acknowledgement can be lost after the write. An identical retry
    // succeeds even if its revision is now old, without another write.
    if (
      current.revision > 0 &&
      JSON.stringify(data) === JSON.stringify(current.data)
    )
      return { ok: true, saved: current };
    if (revision !== current.revision) return { ok: false, conflict: current };
    const saved: SavedLesson = {
      data: structuredClone(data),
      revision: revision + 1,
      updatedAt: new Date().toISOString(),
    };
    this.storage.setItem(`${PREFIX}server:${key}`, JSON.stringify(saved));
    return { ok: true, saved };
  }
  conflict(key: string, initial: LessonData) {
    const current = this.load(key, initial);
    current.data.note =
      "Jordan added: practise a relaxed push and glide next lesson.";
    current.revision++;
    current.updatedAt = new Date().toISOString();
    this.storage.setItem(`${PREFIX}server:${key}`, JSON.stringify(current));
  }
}
