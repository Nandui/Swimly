import type { AttendanceStatus } from "@/generated/prisma/client";

/** A swimmer's mark on the register before it is saved: unmarked until someone taps. */
export type Marking = AttendanceStatus | null;

/** The register pattern (DESIGN.md, The pool deck): one tap marks a swimmer here, a second marks
 *  them away, a third marks them late, and a fourth starts again at here. */
const NEXT: Record<AttendanceStatus | "none", AttendanceStatus> = { none: "PRESENT", PRESENT: "ABSENT", ABSENT: "LATE", LATE: "PRESENT" };
export function nextMark(current: Marking): AttendanceStatus {
  return NEXT[current ?? "none"];
}

/** Where the register stands: who is here (present or late), how many are marked, how many are
 *  still to mark, and how many there are. */
export function registerCount(marks: Iterable<Marking>) {
  let here = 0, marked = 0, total = 0;
  for (const mark of marks) {
    total += 1;
    if (mark) marked += 1;
    if (mark === "PRESENT" || mark === "LATE") here += 1;
  }
  return { here, marked, toMark: total - marked, total };
}
