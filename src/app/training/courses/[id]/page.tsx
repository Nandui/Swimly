import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { ARCHIVAL_STATUS_META } from "@/lib/status";
import { COURSE_DRAFT_META, CourseBuilder, courseForBuilder, PublishCourse } from "@/modules/training/features/builder";
import { CourseDialog, listQualificationTypeOptions } from "@/modules/training/features/courses";

export const metadata: Metadata = { title: "Course builder" };

/** One course: its outline and lessons, preview and publishing. Anyone in
 *  Training may look; building needs the Author level (`training.manage`). */
export default async function CourseBuilderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lesson?: string; questions?: string; exam?: string }> }) {
  const [{ id }, { lesson, questions, exam }] = await Promise.all([params, searchParams]);
  const [data, types] = await Promise.all([courseForBuilder(id), listQualificationTypeOptions()]);
  if (!data) notFound();
  const { who, course, draft, files, published, changed, openAssignments, report } = data;
  const canEdit = who.manage && !course.archivedAt;
  const state = !published ? "draft" : changed ? "changed" : "published";
  return (
    <>
      <PageHeader
        back={{ href: "/training/courses", label: "Courses" }}
        title={course.title}
        description={published
          ? `Version ${published.number}, published ${published.publishedAt.toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" })} by ${published.publishedByName}.${openAssignments ? ` ${openAssignments} ${openAssignments === 1 ? "person has" : "people have"} it open.` : ""}`
          : "Not published yet. Learners see it once you publish."}
        status={course.archivedAt ? <Tag meta={ARCHIVAL_STATUS_META.archived} /> : <Tag meta={COURSE_DRAFT_META[state]} />}
        actions={
          <>
            {who.manage ? <CourseDialog course={course} qualificationTypes={types} /> : null}
            <Button asChild variant="outline" className="min-h-11"><Link href={`/training/courses/${course.id}/preview`}><Eye aria-hidden="true" />Preview</Link></Button>
            {canEdit ? <PublishCourse courseId={course.id} title={course.title} changed={changed} published={published} openAssignments={openAssignments} /> : null}
          </>
        }
      />
      <CourseBuilder courseId={course.id} title={course.title} hasOldText={!!course.content.trim()} draft={draft} files={files} selected={lesson ?? null}
        panel={exam ? "exam" : questions ?? null} report={report} canEdit={canEdit} changed={changed} />
    </>
  );
}
