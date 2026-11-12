import type { Metadata } from "next";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { courseAuditPack, CourseAuditPackView, filterQuery, PrintButton, readFilters } from "@/modules/training/features/insight";

export const metadata: Metadata = { title: "Course audit pack" };

/** A course's whole record to print or save as a PDF: versions, who must take it, everyone the
 *  reader covers with the version taught and their result, and the audit trail. */
export default async function CourseAuditPackPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ site?: string; period?: string }> }) {
  const [{ id }, input] = await Promise.all([params, searchParams]);
  const data = await courseAuditPack(id, readFilters(input));
  return (
    <PageShell spacing="roomy" header={<PageHeader back={{ href: `/training/courses/${id}/insight${filterQuery(data.filters)}`, label: "Course insight" }} title={`${data.course.title}: audit pack`} actions={<PrintButton />} />}>
      <CourseAuditPackView data={data} />
    </PageShell>
  );
}
