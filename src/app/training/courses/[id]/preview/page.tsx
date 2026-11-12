import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { CoursePreview, draftForPreview } from "@/modules/training/features/builder";

export const metadata: Metadata = { title: "Course preview" };

/** The draft, played as a learner would in Turnfin Me. Records nothing. */
export default async function CoursePreviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lesson?: string }> }) {
  const [{ id }, { lesson }] = await Promise.all([params, searchParams]);
  const data = await draftForPreview(id);
  if (!data) notFound();
  return (
    <PageShell header={<PageHeader
        back={{ href: `/training/courses/${id}`, label: "Builder" }}
        title={`Preview: ${data.course.title}`}
        description="The draft as learners will see it once you publish. Nothing here counts as done."
        actions={<Button asChild variant="outline" className="min-h-11"><Link href={`/training/courses/${id}${lesson ? `?lesson=${lesson}` : ""}`}><Pencil aria-hidden="true" />Edit this lesson</Link></Button>}
      />}>
      <CoursePreview courseId={id} outline={data.outline} lessonId={lesson ?? null} requiresSignoff={data.course.requiresSignoff} />
    </PageShell>
  );
}
