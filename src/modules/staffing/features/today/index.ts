/** Today: the duty manager's page reads and dialogs. */
export { todayPage } from "@/modules/staffing/features/today/server/data";
export { CoverPlace, LogAttendance } from "@/modules/staffing/features/today/components/today-dialogs";

// What its pages show, from the module's shared rules and screen kit.
export { RoleTag } from "@/modules/staffing/shared/components/kit";
export { ATTENDANCE_META, SHIFT_STATUS_META, STRIKE_CAUSE_META, STRIKE_STAGE_META } from "@/modules/staffing/shared/rules";
export type { ShiftStatus, StrikeCause } from "@/modules/staffing/shared/rules";
