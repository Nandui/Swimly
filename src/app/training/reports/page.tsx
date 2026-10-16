import type { Metadata } from "next";
import { PageHeader } from "@/components/ui-kit/page-header";
import { InsightFilterForm, readFilters, ReportView, trainingReport } from "@/modules/training/features/insight";

export const metadata: Metadata = { title: "Training reports" };

/** Where training stands for the people this person covers: overdue by site and by manager,
 *  everything overdue, and each course's numbers, with downloads for Excel. */
export default async function TrainingReportsPage({ searchParams }: { searchParams: Promise<{ site?: string; department?: string }> }) {
  const filters = readFilters(await searchParams);
  const report = await trainingReport({ site: filters.site, department: filters.department });
  return (
    <>
      <PageHeader title="Reports" description="Where training stands for everyone you cover, and who is late." />
      <InsightFilterForm action="/training/reports" label="Filter the reports" filters={report.filters} sites={report.sites} departments={report.departments} />
      <ReportView report={report} />
    </>
  );
}
