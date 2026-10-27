import type { Metadata } from "next";
import { Pencil } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { Tag } from "@/components/ui-kit/tag";
import { ArchiveCourseType, CourseTypeDialog, courseTypes, SHORT_COURSE_AREA_META, type ShortCourseArea } from "@/modules/short-courses/features/course-types";
import { plural } from "@/lib/format";
import { ARCHIVAL_STATUS_META } from "@/lib/status";

export const metadata: Metadata = { title: "Short course list" };

/** The short courses we offer (Manage keeps the list): where each happens, how many weeks and
 *  how long a session, and whether it asks for a health form. */
export default async function ShortCourseTypesPage() {
  const { who, types } = await courseTypes();
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Course list" description="The short courses we offer. A new run starts with these weeks and session length."
        actions={who.manage ? <CourseTypeDialog /> : undefined} />}>
      <section className="flex min-w-0 flex-col" aria-label="Courses we offer">
        {types.length === 0 ? <EmptyState compact icon="calendarRange" title="No courses yet" hint={who.manage ? "Add the first, such as Couch to 5k or Adult swim lessons." : "Whoever manages Short courses adds them."} /> : (
          <ul className="pc-list">
            {types.map((t) => {
              const area = SHORT_COURSE_AREA_META[t.area as ShortCourseArea] ?? SHORT_COURSE_AREA_META.other;
              const Icon = area.icon;
              return (
                <li key={t.id} className="pc-row" {...(t.archivedAt ? { "data-muted": "" } : {})}>
                  <span className="pc-tile-icon" aria-hidden="true"><Icon /></span>
                  <span className="pc-row-body">
                    <span className="pc-row-title">{t.name}</span>
                    <span className="pc-row-hint">{[plural(t.weeks, "week"), `${t.sessionMinutes} minutes a session`, t.minAge ? `${t.minAge}+` : null,
                      t.healthForm ? "health form" : null, plural(t._count.courses, "run")].filter(Boolean).join(" · ")}</span>
                    {t.description ? <span className="pc-row-hint">{t.description}</span> : null}
                  </span>
                  <span className="pc-row-trail">
                    <Tag meta={t.archivedAt ? ARCHIVAL_STATUS_META.archived : area} />
                    {who.manage ? <>
                      <CourseTypeDialog type={t} trigger={<Button variant="outline" size="icon" aria-label={`Change ${t.name}`}><Pencil aria-hidden="true" /></Button>} />
                      <ArchiveCourseType id={t.id} name={t.name} archived={!!t.archivedAt} />
                    </> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
