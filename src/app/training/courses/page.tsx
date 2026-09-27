import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
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
    <div className="space-y-6">
      <div className="module-heading">
        <div className="space-y-2">
          <h1>{archived ? "Retired courses" : "Courses"}</h1>
          <p className="text-sm">
            {archived ? "Courses that can no longer be assigned. Training already done on them is kept." : "What people can be assigned. Practical courses need a trainer's sign-off."}{" "}
            <Link href={archived ? "/training/courses" : "/training/courses?view=retired"} className="underline underline-offset-4">{archived ? "Show current courses" : "Show retired courses"}</Link>
          </p>
        </div>
        {who.manage && !archived ? <CourseDialog qualificationTypes={types} /> : null}
      </div>
      {courses.length === 0 ? (
        <div className="module-empty"><BookOpen aria-hidden="true" /><h2 className="font-semibold">{archived ? "No retired courses" : "No courses yet"}</h2><p className="mt-2 text-sm text-ui-muted-foreground">{who.manage && !archived ? "Add the first course people should complete." : "Ask whoever builds the training catalogue to add one."}</p></div>
      ) : (
        <ul className="module-list">
          {courses.map((course) => (
            <li key={course.id} className="flex flex-wrap items-start justify-between gap-4 p-4 sm:px-5">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="module-row-title">{course.title}</h2>
                  {course.archivedAt ? <Tag color={ARCHIVAL_STATUS_META.archived.color}>{ARCHIVAL_STATUS_META.archived.label}</Tag> : null}
                </div>
                {course.summary ? <p className="text-sm">{course.summary}</p> : null}
                <p className="text-xs text-ui-muted-foreground">
                  {[course.requiresSignoff ? "Trainer sign-off" : "Self-completed", course.grantsType ? `records ${course.grantsType.name}${course.grantsType.validityMonths ? `, valid ${course.grantsType.validityMonths} months` : ""}` : null].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {who.assign && !archived && people.length > 0 ? <AssignTraining courses={[course]} people={people} courseId={course.id} label="Assign" variant="outline" /> : null}
                {who.manage && !archived ? <CourseDialog course={course} qualificationTypes={types} /> : null}
                {who.manage ? <ArchiveCourse id={course.id} title={course.title} archived={!!course.archivedAt} /> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
