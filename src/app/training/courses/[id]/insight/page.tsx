import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { courseInsight, CourseInsightView, filterQuery, InsightFilterForm, readFilters } from "@/modules/training/features/insight";

export const metadata: Metadata = { title: "Course insight" };

/** How one course is going for the people this person covers: how far they get, where they
 *  stop, how long it takes, the exam and each site, with a download and the audit pack. */
export default async function CourseInsightPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ site?: string; period?: string }> }) {
  const [{ id }, input] = await Promise.all([params, searchParams]);
  const filters = readFilters(input);
  const data = await courseInsight(id, { site: filters.site, period: filters.period });
  if (!data) notFound();
  const q = filterQuery(data.filters);
  return (
    <PageShell header={<PageHeader
        back={{ href: `/training/courses/${id}`, label: "The course" }}
        title={data.course.title}
        description="How it is going for the people you cover."
        actions={
          <>
            {data.learners.length ? <Button asChild variant="outline" className="min-h-11"><a href={`/training/courses/${id}/insight/export${q}`} download><Download aria-hidden="true" />Download for Excel</a></Button> : null}
            <Button asChild variant="outline" className="min-h-11"><Link href={`/training/courses/${id}/audit${q}`}><FileText aria-hidden="true" />Audit pack</Link></Button>
          </>
        }
      />}>
      <InsightFilterForm action={`/training/courses/${id}/insight`} label="Filter this course's numbers" filters={data.filters} sites={data.sites} period />
      <CourseInsightView data={data} />
    </PageShell>
  );
}
