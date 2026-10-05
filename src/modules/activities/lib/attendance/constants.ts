import { CircleCheck, Clock3, LogOut, TriangleAlert, Users, XCircle } from "lucide-react";
import type { AttendanceStatus } from "@/generated/prisma/client";
import type { StatusMeta } from "@/lib/status";

export const ATTENDANCE_RECORD_META = {
  taken: { label: "Attendance taken", color: "green", icon: CircleCheck },
  notTaken: { label: "Attendance not taken", color: "orange", icon: TriangleAlert },
  covered: { label: "Covered", color: "purple", icon: Users },
  leftClass: { label: "No longer in this class", color: "gray", icon: LogOut },
} as const satisfies Record<string, StatusMeta>;

/** The one place in the app where red is right: a swimmer who was expected in
 *  the water and is not there. */
export const ATTENDANCE_STATUS_META: Record<AttendanceStatus, StatusMeta & { short: string }> = {
  PRESENT: { label: "Present", short: "In", color: "green", icon: CircleCheck },
  LATE: { label: "Late", short: "Late", color: "orange", icon: Clock3 },
  ABSENT: { label: "Absent", short: "Out", color: "red", icon: XCircle },
};

/** The order they appear on the register: the common answer first, then the
 *  exceptions in ascending seriousness. */
export const ATTENDANCE_ORDER = ["PRESENT", "LATE", "ABSENT"] as const;
