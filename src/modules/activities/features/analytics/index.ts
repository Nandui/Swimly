/** Swim school analytics: the dashboard and the reception, instructor and
 *  multiple-places reports. Entry for the module and its routes. */
export { AnalyticsDashboard } from "@/modules/activities/features/analytics/components/dashboard";
export { InstructorReport } from "@/modules/activities/features/analytics/components/instructor-report";
export { MultiplePlacesReport } from "@/modules/activities/features/analytics/components/multiple-places-report";
export { ReceptionReport } from "@/modules/activities/features/analytics/components/reception-report";
export { getAnalytics } from "@/modules/activities/features/analytics/server/data";
export { getInstructorAnalytics, getMultiplePlacesAnalytics, getReceptionAnalytics } from "@/modules/activities/features/analytics/server/report-data";
export { OverviewReport } from "@/modules/activities/features/analytics/components/insights/overview";
export { ClassesReport } from "@/modules/activities/features/analytics/components/insights/classes";
export { ClassDetailReport } from "@/modules/activities/features/analytics/components/insights/class-detail";
export { SwimmersReport } from "@/modules/activities/features/analytics/components/insights/swimmers";
export { ProgressionReport } from "@/modules/activities/features/analytics/components/insights/progression";
export { TeachersReport } from "@/modules/activities/features/analytics/components/insights/teachers";
export { TeacherDetailReport } from "@/modules/activities/features/analytics/components/insights/teacher-detail";
export {
  getClassesInsights, getClassInsights, getOneTeacherInsights, getOverviewInsights, getProgressionInsights, getSwimmerInsights, getTeacherInsights,
} from "@/modules/activities/features/analytics/server/insights-data";
