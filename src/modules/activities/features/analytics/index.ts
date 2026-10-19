/** Swim school analytics: three dashboards (business, reception and pool deck) and the pages behind them (every class,
 *  swimmers, level by level, each teacher and receptionist, registers and multiple enrolments). Entry for the module and its routes. */
export { InstructorReport } from "@/modules/activities/features/analytics/components/instructor-report";
export { MultiplePlacesReport } from "@/modules/activities/features/analytics/components/multiple-places-report";
export { getInstructorAnalytics, getMultiplePlacesAnalytics } from "@/modules/activities/features/analytics/server/report-data";
export { BusinessReport } from "@/modules/activities/features/analytics/components/insights/business";
export { PoolDeckReport } from "@/modules/activities/features/analytics/components/insights/pool-deck";
export { ClassesReport } from "@/modules/activities/features/analytics/components/insights/classes";
export { ClassDetailReport } from "@/modules/activities/features/analytics/components/insights/class-detail";
export { SwimmersReport } from "@/modules/activities/features/analytics/components/insights/swimmers";
export { ProgressionReport } from "@/modules/activities/features/analytics/components/insights/progression";
export { DeskReport } from "@/modules/activities/features/analytics/components/insights/desk";
export { DeskPersonReport } from "@/modules/activities/features/analytics/components/insights/desk-person";
export { getDeskInsights, getDeskPersonInsights } from "@/modules/activities/features/analytics/server/desk-data";
export { TeacherDetailReport } from "@/modules/activities/features/analytics/components/insights/teacher-detail";
export {
  getBusinessInsights, getClassesInsights, getClassInsights, getOneTeacherInsights, getPoolDeckInsights, getProgressionInsights, getSwimmerInsights,
} from "@/modules/activities/features/analytics/server/insights-data";
