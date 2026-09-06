import type { TagColor } from "@/components/ui-kit/tag";
import type { AttendanceStatus } from "@/generated/prisma/client";
import type { StatusMeta } from "@/lib/status";

export const ATTENDANCE_RECORD_META = {
  taken: { label: "Attendance taken", color: "green" },
  notTaken: { label: "Attendance not taken", color: "yellow" },
  covered: { label: "Covered", color: "purple" },
  leftClass: { label: "No longer in this class", color: "gray" },
} as const satisfies Record<string, StatusMeta>;

/** The one place in the app where red is right: a swimmer who was expected in
 *  the water and is not there. */
export const ATTENDANCE_STATUS_META: Record<
  AttendanceStatus,
  { label: string; short: string; color: TagColor }
> = {
  PRESENT: { label: "Present", short: "In", color: "green" },
  LATE: { label: "Late", short: "Late", color: "orange" },
  ABSENT: { label: "Absent", short: "Out", color: "red" },
};

/** The order they appear on the register: the common answer first, then the
 *  exceptions in ascending seriousness. */
export const ATTENDANCE_ORDER = ["PRESENT", "LATE", "ABSENT"] as const;

/** How many consecutive absences before somebody should ring home. */
export const DROP_OFF_STREAK = 3;
