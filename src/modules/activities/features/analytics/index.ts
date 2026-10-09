/** Swim school analytics: the dashboard and the reception, instructor and
 *  multiple-places reports. Entry for the module and its routes. */
export { AnalyticsDashboard } from "@/modules/activities/features/analytics/components/dashboard";
export { InstructorReport } from "@/modules/activities/features/analytics/components/instructor-report";
export { MultiplePlacesReport } from "@/modules/activities/features/analytics/components/multiple-places-report";
export { ReceptionReport } from "@/modules/activities/features/analytics/components/reception-report";
export { getAnalytics } from "@/modules/activities/features/analytics/server/data";
export { getInstructorAnalytics, getMultiplePlacesAnalytics, getReceptionAnalytics } from "@/modules/activities/features/analytics/server/report-data";
