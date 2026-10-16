/** Running today: who is on, the gaps left, the day's note and timepoints.
 *  Entry for the module and its routes. */
export { DayNote } from "@/modules/rota/features/today/components/day-note";
export { TimepointDone, type TodayGap, TodayGaps } from "@/modules/rota/features/today/components/today-parts";
export { todayAt } from "@/modules/rota/features/today/server/data";
export { NeedDialog } from "@/modules/rota/shared/components/plan-dialogs";
export { ABSENCE_REASON_META, type AbsenceReason, clock, ROTA_CHANGE_REASON_META, type RotaChangeReason } from "@/modules/rota/shared/constants";
export { fitsFor } from "@/modules/rota/shared/data";
export { dayGaps } from "@/modules/rota/shared/day";
export { activityIcon, ROTA_DAY_META, ROTA_TIMEPOINT_META } from "@/modules/rota/shared/meta";
export { duration } from "@/modules/rota/shared/shifts";
