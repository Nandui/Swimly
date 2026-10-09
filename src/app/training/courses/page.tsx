import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { Tag } from "@/components/ui-kit/tag";
import { ARCHIVAL_STATUS_META } from "@/lib/status";
import { ArchiveCourse, assignablePeople, CourseDialog, listCourses, listQualificationTypeOptions } from "@/modules/training/features/courses";
import { AssignTraining } from "@/modules/training/features/assignments";

export const metadata: Metadata = { title: "Courses" };

/** The organisation's catalogue. Everyone in Training reads it; changing it
 *  needs `training.manage`; assigning needs `training.assign`. */
export default async function TrainingCoursesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const archived = view === "retired";
  const [{ who, courses }, types] = await Promise.all([listCourses({ archived }), listQualificationTypeOptions()]);
  const people = who.assign && !archived ? await assignablePeople() : [];
  return (
    <>
      <PageHeader
        title="Courses"
        description={archived ? "Courses that can no longer be assigned. Training already done on them is kept." : "What people can be assigned. Practical courses need a trainer’s sign-off."}
        actions={
          <>
            <SegmentedLinks label="Courses" items={[
              { href: "/training/courses", label: "Current", current: !archived },
              { href: "/training/courses?view=retired", label: "Retired", current: archived },
            ]} />
            {who.manage && !archived ? <CourseDialog qualificationTypes={types} /> : null}
          </>
        }
      />
      {courses.length === 0 ? (
        <EmptyState as="h2" icon="book" {...(archived
          ? { title: "No course has been retired", hint: "Retired courses appear here. Training already done on them is kept." }
          : { title: "No courses yet", hint: who.manage ? "Add the first course people should complete." : "Ask whoever builds the training catalogue to add one." })} />
      ) : (
        <section className="pc-panel" aria-label={archived ? "Retired courses" : "Current courses"}>
          <ul className="pc-rows">
            {courses.map((course) => (
              <li key={course.id} className="pc-row">
                <span className="pc-tile-icon"><GraduationCap aria-hidden="true" /></span>
                <div className="pc-row-body">
                  <h2 className="pc-row-title text-[length:var(--pc-text-body)] leading-[var(--pc-leading-body)]">{course.title}</h2>
                  <p className="pc-row-hint">
                    {[course.summary.trim().replace(/\.$/, "") || null, course.requiresSignoff ? "Trainer sign-off" : "Self-completed", course.grantsType ? `records ${course.grantsType.name}${course.grantsType.validityMonths ? `, valid ${course.grantsType.validityMonths} months` : ""}` : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="pc-row-trail">
                  {course.archivedAt ? <Tag meta={ARCHIVAL_STATUS_META.archived} /> : null}
                  {who.assign && !archived && people.length > 0 ? <AssignTraining courses={[course]} people={people} courseId={course.id} label="Assign" variant="outline" rowFor={course.title} /> : null}
                  {who.manage && !archived ? <CourseDialog course={course} qualificationTypes={types} /> : null}
                  {who.manage ? <ArchiveCourse id={course.id} title={course.title} archived={!!course.archivedAt} /> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
