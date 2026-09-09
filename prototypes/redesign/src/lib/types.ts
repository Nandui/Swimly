export type ClubId = "bishopstown" | "churchfield";
export type Attendance = "PRESENT" | "LATE" | "ABSENT";
export type Mark = "ACHIEVED" | "WORKING_ON" | null;
export type NetworkMode = "normal" | "slow" | "offline" | "failure";
export type Permission =
  | "enrolment.manage"
  | "attendance.mark"
  | "progression.assess"
  | "progression.complete";
export type SaveState =
  "idle" | "queued" | "saving" | "saved" | "offline" | "error" | "conflict";

export interface Swimmer {
  id: string;
  clubId: ClubId;
  name: string;
  age: number;
  memberNumber: string;
  contact: string;
  email: string;
  phone: string;
  note?: string;
  level: string;
  active: boolean;
  initials: string;
}
export interface SwimClass {
  id: string;
  clubId: ClubId;
  level: string;
  start: string;
  location: string;
  instructor: string;
  capacity: number;
  swimmerIds: string[];
}
export interface Competency {
  id: string;
  name: string;
  description: string;
}
export interface LessonData {
  attendance: Record<string, Attendance>;
  competencies: Record<string, Record<string, Mark>>;
  note: string;
  attendanceDone: boolean;
  cover: string | null;
  completedSwimmers: string[];
}
export interface SavedLesson {
  data: LessonData;
  revision: number;
  updatedAt: string | null;
}
export interface LessonSnapshot {
  data: LessonData;
  revision: number;
  generation: number;
  dirty: boolean;
  status: SaveState;
  savedAt: string | null;
  conflict: SavedLesson | null;
  storageWarning: boolean;
}
export type SaveResult =
  { ok: true; saved: SavedLesson } | { ok: false; conflict: SavedLesson };
export interface LessonRepository {
  load(key: string, initial: LessonData): SavedLesson;
  save(key: string, data: LessonData, revision: number): Promise<SaveResult>;
  conflict(key: string, initial: LessonData): void;
}
export interface AssessmentSession {
  id: string;
  clubId: ClubId;
  date: string;
  time: string;
  capacity: number;
}
export interface Booking {
  swimmerId: string;
  sessionId: string;
}
export interface ActivityEntry {
  id: string;
  label: string;
  time: string;
}
export interface DeskData {
  classes: SwimClass[];
  bookings: Booking[];
  activity: ActivityEntry[];
}
export type DeskCommand =
  | { type: "enrol"; swimmerId: string; classId: string; reason?: string }
  | {
      type: "move";
      swimmerId: string;
      classId: string;
      fromClassId: string;
      reason?: string;
    }
  | { type: "assessment"; swimmerId: string; sessionId: string };
