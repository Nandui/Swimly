import type { Metadata } from "next";
import Link from "next/link";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@/components/shadcn/item";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { ARCHIVAL_STATUS_META } from "@/lib/status";
import { ArchiveCourse, AssignTraining, CourseDialog } from "@/components/training/manage-actions";
import { assignablePeople, listCourses, listQualificationTypeOptions } from "@/lib/training/data";

export const metadata: Metadata = { title: "Courses" };

/** The organisation's catalogue. Everyone in Training reads it; changing it
 *  needs `training.manage`; assigning needs `training.assign`. */
export default async function TrainingCoursesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const archived = view === "retired";
  const [{ who, courses }, types] = await Promise.all([listCourses({ archived }), listQualificationTypeOptions()]);
  const people = who.assign && !archived ? await assignablePeople() : [];
  return (
    <div className="min-w-0 flex flex-col gap-6">
      <PageHeader
        title={archived ? "Retired courses" : "Courses"}
        description={<>
          {archived ? "Courses that can no longer be assigned. Training already done on them is kept." : "What people can be assigned. Practical courses need a trainer's sign-off."}{" "}
          <Link href={archived ? "/training/courses" : "/training/courses?view=retired"} className="underline underline-offset-4">{archived ? "Show current courses" : "Show retired courses"}</Link>
        </>}
        actions={who.manage && !archived ? <CourseDialog qualificationTypes={types} /> : null}
      />
      {courses.length === 0 ? (
        <EmptyState icon="bookOpen" title={archived ? "No retired courses" : "No courses yet"} hint={who.manage && !archived ? "Add the first course people should complete." : "Ask whoever builds the training catalogue to add one."} />
      ) : (
        <ItemGroup className="divide-y divide-ui-border rounded-ui-lg border border-ui-border">
          {courses.map((course) => (
            <Item key={course.id} role="listitem" className="items-start rounded-none">
              <ItemContent className="min-w-0 gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <ItemTitle>{course.title}</ItemTitle>
                  {course.archivedAt ? <Tag color={ARCHIVAL_STATUS_META.archived.color}>{ARCHIVAL_STATUS_META.archived.label}</Tag> : null}
                </div>
                {course.summary ? <p className="text-sm">{course.summary}</p> : null}
                <p className="text-xs text-ui-muted-foreground">
                  {[course.requiresSignoff ? "Trainer sign-off" : "Self-completed", course.grantsType ? `records ${course.grantsType.name}${course.grantsType.validityMonths ? `, valid ${course.grantsType.validityMonths} months` : ""}` : null].filter(Boolean).join(" · ")}
                </p>
              </ItemContent>
              <ItemActions className="flex-wrap">
                {who.assign && !archived && people.length > 0 ? <AssignTraining courses={[course]} people={people} courseId={course.id} label="Assign" variant="outline" /> : null}
                {who.manage && !archived ? <CourseDialog course={course} qualificationTypes={types} /> : null}
                {who.manage ? <ArchiveCourse id={course.id} title={course.title} archived={!!course.archivedAt} /> : null}
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}
    </div>
  );
}
