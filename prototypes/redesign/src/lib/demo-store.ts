import { CLASSES, initialDesk, initialLesson, lessonKey } from "./fixtures";
import { applyDeskCommand, type DeskResult } from "./desk";
import { LessonController } from "./lesson-controller";
import {
  FixtureLessonRepository,
  pause,
  PREFIX,
  type StoragePort,
} from "./persistence";
import type {
  ClubId,
  DeskCommand,
  DeskData,
  NetworkMode,
  Permission,
  SwimClass,
} from "./types";

export const ALL_PERMISSIONS: Permission[] = [
  "enrolment.manage",
  "attendance.mark",
  "progression.assess",
  "progression.complete",
];
export interface DemoSnapshot {
  desk: DeskData;
  clubId: ClubId;
  selectedId: string | null;
  query: string;
  network: NetworkMode;
  permissions: Permission[];
  storageWarning: boolean;
  revision: number;
  notice: string | null;
}
export class DemoStore {
  private snapshot: DemoSnapshot;
  private listeners = new Set<() => void>();
  private lessons = new Map<string, LessonController>();
  private repository: FixtureLessonRepository;
  private noticeTimer?: ReturnType<typeof setTimeout>;
  private started = false;
  constructor(private storage: StoragePort) {
    let desk = initialDesk();
    let storageWarning = false;
    let network: NetworkMode = "normal";
    let readOnly = false;
    try {
      const preview = JSON.parse(storage.getItem(`${PREFIX}preview`) ?? "null");
      if (
        preview &&
        ["normal", "slow", "offline", "failure"].includes(preview.network)
      )
        network = preview.network;
      readOnly = preview?.readOnly === true;
    } catch {
      storageWarning = true;
    }
    try {
      const raw = storage.getItem(`${PREFIX}desk`);
      if (raw) {
        const candidate = JSON.parse(raw) as DeskData;
        if (
          Array.isArray(candidate.classes) &&
          candidate.classes.length === CLASSES.length &&
          candidate.classes.every(
            (row) =>
              CLASSES.some(
                (course) =>
                  course.id === row.id && course.clubId === row.clubId,
              ) && Array.isArray(row.swimmerIds),
          ) &&
          Array.isArray(candidate.bookings) &&
          Array.isArray(candidate.activity)
        )
          desk = candidate;
        else storageWarning = true;
      }
    } catch {
      storageWarning = true;
    }
    this.snapshot = {
      desk,
      storageWarning,
      clubId: "bishopstown",
      selectedId: "bishopstown-1",
      query: "",
      network,
      permissions: readOnly ? [] : [...ALL_PERMISSIONS],
      revision: 0,
      notice: null,
    };
    this.repository = new FixtureLessonRepository(
      storage,
      () => this.snapshot.network,
      450,
      () => this.can("attendance.mark"),
    );
    desk.classes.forEach((course) => this.lesson(course));
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(patch: Partial<DemoSnapshot> = {}) {
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      revision: this.snapshot.revision + 1,
    };
    this.listeners.forEach((listener) => listener());
  }
  can(permission: Permission) {
    return this.snapshot.permissions.includes(permission);
  }
  start() {
    this.started = true;
    this.lessons.forEach((lesson) => lesson.start());
  }
  dispose() {
    this.started = false;
    this.lessons.forEach((lesson) => lesson.dispose());
    clearTimeout(this.noticeTimer);
  }
  lesson(course: SwimClass) {
    const key = lessonKey(course);
    let controller = this.lessons.get(key);
    if (!controller) {
      controller = new LessonController(
        key,
        initialLesson(course),
        this.repository,
        this.storage,
        { canWrite: () => this.can("attendance.mark") },
      );
      controller.subscribe(() => this.publish());
      this.lessons.set(key, controller);
      if (this.started) controller.start();
    }
    return controller;
  }
  setClub(clubId: ClubId) {
    this.publish({ clubId, selectedId: `${clubId}-1`, query: "" });
  }
  selectSwimmer(selectedId: string | null) {
    this.publish({ selectedId, query: "" });
  }
  setQuery(query: string) {
    this.publish({ query });
  }
  private persistPreview() {
    try {
      this.storage.setItem(
        `${PREFIX}preview`,
        JSON.stringify({
          network: this.snapshot.network,
          readOnly: !this.snapshot.permissions.length,
        }),
      );
    } catch {
      this.publish({ storageWarning: true });
    }
  }
  setNetwork(network: NetworkMode) {
    this.publish({ network });
    this.persistPreview();
    this.lessons.forEach((lesson) => void lesson.flush());
  }
  setReadOnly(readOnly: boolean) {
    this.publish({ permissions: readOnly ? [] : [...ALL_PERMISSIONS] });
    this.persistPreview();
    if (!readOnly) this.lessons.forEach((lesson) => void lesson.flush());
  }
  simulateConflict(course: SwimClass) {
    try {
      this.repository.conflict(lessonKey(course), initialLesson(course));
      this.notify(
        "Another instructor’s change is ready. Edit a mark to review the conflict.",
      );
    } catch {
      this.notify(
        "Browser storage is unavailable. Conflict simulation needs storage.",
      );
    }
  }
  notify(notice: string) {
    clearTimeout(this.noticeTimer);
    this.publish({ notice });
    this.noticeTimer = setTimeout(() => this.publish({ notice: null }), 6500);
  }
  async commit(command: DeskCommand): Promise<DeskResult> {
    const clubId = this.snapshot.clubId;
    await pause(this.snapshot.network === "slow" ? 2800 : 450);
    if (
      this.snapshot.network === "failure" ||
      this.snapshot.network === "offline"
    )
      return {
        ok: false,
        error:
          "We could not save this change. Your choices are still here; check the connection and try again.",
      };
    if (clubId !== this.snapshot.clubId)
      return {
        ok: false,
        error: "The selected club changed. Close this form and check the club.",
      };
    const result = applyDeskCommand(
      this.snapshot.desk,
      command,
      clubId,
      this.can("enrolment.manage"),
    );
    if (result.ok) {
      try {
        this.storage.setItem(`${PREFIX}desk`, JSON.stringify(result.data));
      } catch {
        return {
          ok: false,
          error:
            "Browser storage is unavailable. Your form is still here; allow storage and try again.",
        };
      }
      this.publish({ desk: result.data });
      result.data.classes.forEach((course) =>
        this.lesson(course).reconcileRoster(course.swimmerIds),
      );
      this.notify(result.message);
    }
    return result;
  }
}
