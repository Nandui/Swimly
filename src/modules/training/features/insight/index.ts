/** Training insight (docs/training.md, e-learning phase 7): course analytics, the reports page,
 *  downloads for Excel and audit packs for a person or a course. Entry for the module and its routes. */
export { courseInsight, courseAuditPack, coursesCsv, learnerCsv, overdueCsv, personAuditPack, trainingReport } from "@/modules/training/features/insight/server/data";
export { CourseInsightView } from "@/modules/training/features/insight/components/course-insight";
export { ReportView } from "@/modules/training/features/insight/components/report";
export { CourseAuditPackView, PersonAuditPackView } from "@/modules/training/features/insight/components/audit-pack";
export { PrintButton } from "@/modules/training/features/insight/components/print-button";
export { filterQuery, InsightFilterForm, readFilters } from "@/modules/training/features/insight/components/parts";
export { csvRows } from "@/modules/training/shared/rules";
