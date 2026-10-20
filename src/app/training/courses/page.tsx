import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, Hammer } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { SearchField } from "@/components/ui-kit/search-field";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { Tag } from "@/components/ui-kit/tag";
import { ARCHIVAL_STATUS_META } from "@/lib/status";
import { ArchiveCourse, assignablePeople, CourseDialog, listCourses, listQualificationTypeOptions } from "@/modules/training/features/courses";
import { AssignTraining } from "@/modules/training/features/assignments";
import { StartFromTemplate } from "@/modules/training/features/builder";
import { aiDraftingOn, DraftFromDocument } from "@/modules/training/features/ai-draft";

export const metadata: Metadata = { title: "Courses" };

/** The organisation's catalogue. Everyone in Training reads it; changing it
 *  needs `training.manage`; assigning needs `training.assign`. */
export default async function TrainingCoursesPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string }> }) {
  const { view, q } = await searchParams;
  const archived = view === "retired";
  const [{ who, courses: all }, types] = await Promise.all([listCourses({ archived }), listQualificationTypeOptions()]);
  const people = who.assign && !archived ? await assignablePeople() : [];
  const search = (q ?? "").trim().toLowerCase().slice(0, 80);
  const courses = search ? all.filter((c) => [c.title, c.summary, c.category, ...c.tags].some((text) => text.toLowerCase().includes(search))) : all;
  const categories = [...new Set(all.map((c) => c.category).filter(Boolean))].sort();
  // Grouped by category, those without one last.
  const groups = [...categories, ""].map((category) => ({ category, courses: courses.filter((c) => c.category === category) })).filter((g) => g.courses.length);
  return (
    <>
      <PageHeader
        title="Courses"
        description={archived ? "Courses that can no longer be assigned. Training already done on them is kept." : "Build each course from lessons, publish it, then assign it. Staff take it in Turnfin Me."}
        actions={
          <>
            <SegmentedLinks label="Courses" items={[
              { href: "/training/courses", label: "Current", current: !archived },
              { href: "/training/courses?view=retired", label: "Retired", current: archived },
            ]} />
            {who.manage && !archived ? <DraftFromDocument enabled={aiDraftingOn()} /> : null}
            {who.manage && !archived ? <StartFromTemplate courses={all.map((c) => ({ id: c.id, title: c.title, isTemplate: c.isTemplate }))} /> : null}
            {who.manage && !archived ? <CourseDialog qualificationTypes={types} categories={categories} /> : null}
          </>
        }
      />
      {all.length > 6 || search ? (
        <form method="get" role="search" aria-label="Find a course" className="pc-panel">
          {archived ? <input type="hidden" name="view" value="retired" /> : null}
          <SearchField id="course-search" name="q" label="Find a course" placeholder="Name, category or tag" defaultValue={q} maxLength={80}
            clearHref={search ? (archived ? "/training/courses?view=retired" : "/training/courses") : undefined} />
        </form>
      ) : null}
      {courses.length === 0 ? (
        <EmptyState as="h2" icon="book" {...(search
          ? { title: "No course matches", hint: "Try another word, or clear the search." }
          : archived
          ? { title: "No course has been retired", hint: "Retired courses appear here. Training already done on them is kept." }
          : { title: "No courses yet", hint: who.manage ? "Add the first course people should complete, or start from a template." : "Ask whoever builds the training catalogue to add one." })} />
      ) : groups.map((group) => (
        <section key={group.category || "none"} className="pc-panel" aria-label={group.category || (categories.length ? "Other courses" : archived ? "Retired courses" : "Current courses")}>
          {categories.length ? <h2 className="pc-panel-head text-lg">{group.category || "Other"}</h2> : null}
          <ul className="pc-rows">
            {group.courses.map((course) => (
              <li key={course.id} className="pc-row">
                {/* eslint-disable-next-line @next/next/no-img-element -- a private file served by this app */}
                {course.coverId ? <img src={`/training/files/${course.coverId}`} alt="" className="tf-cover-thumb" loading="lazy" /> : <span className="pc-tile-icon"><GraduationCap aria-hidden="true" /></span>}
                <div className="pc-row-body">
                  <h3 className="pc-row-title text-sm">
                    <Link href={`/training/courses/${course.id}`} className="hover:underline focus-visible:underline">{course.title}</Link>
                  </h3>
                  <p className="pc-row-hint">
                    {[course.summary.trim().replace(/\.$/, "") || null, course.published ? `Version ${course.published.number}, ${course.published.lessonCount} ${course.published.lessonCount === 1 ? "lesson" : "lessons"}` : "Not published as lessons yet",
                      course.requiresSignoff ? "Trainer sign-off" : "Self-completed", course.selfEnrol ? "in the catalogue" : null, course.grantsType ? `records ${course.grantsType.name}${course.grantsType.validityMonths ? `, valid ${course.grantsType.validityMonths} months` : ""}` : null].filter(Boolean).join(" · ")}
                  </p>
                  {course.tags.length ? <p className="flex flex-wrap gap-1">{course.tags.map((t) => <span key={t} className="tf-tag">{t}</span>)}</p> : null}
                </div>
                <div className="pc-row-trail">
                  {course.archivedAt ? <Tag meta={ARCHIVAL_STATUS_META.archived} /> : null}
                  {who.assign && !archived && people.length > 0 ? <AssignTraining courses={[course]} people={people} courseId={course.id} label="Assign" variant="outline" rowFor={course.title} /> : null}
                  <Button asChild variant="outline" className="min-h-11"><Link href={`/training/courses/${course.id}`} aria-label={`${who.manage ? "Build" : "Open"} ${course.title}`}><Hammer aria-hidden="true" /><span className="pc-only-wide">{who.manage ? "Build" : "Open"}</span></Link></Button>
                  {who.manage ? <ArchiveCourse id={course.id} title={course.title} archived={!!course.archivedAt} /> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
