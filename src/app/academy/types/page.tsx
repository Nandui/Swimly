import type { Metadata } from "next";
import { Pencil } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { ACADEMY_CHECKS, ACADEMY_KIND_META, type AcademyCheck, type AcademyKind, ArchiveCourseType, CourseTypeDialog, courseTypes } from "@/modules/academy/features/course-types";
import { plural } from "@/lib/format";
import { ARCHIVAL_STATUS_META } from "@/lib/status";

export const metadata: Metadata = { title: "Course list" };

/** The courses we deliver (Manage keeps the list): who awards each, what a candidate needs
 *  before assessment, and the qualification a staff member gets when they pass. */
export default async function CourseTypesPage() {
  const { who, types, qualifications } = await courseTypes();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Course list" description="The courses we deliver, and what each asks of a candidate."
        actions={who.manage ? <CourseTypeDialog qualifications={qualifications} /> : undefined} />
      <section className="pc-panel" aria-label="Courses we deliver">
        {types.length === 0 ? <EmptyState compact icon="award" title="No courses yet" hint={who.manage ? "Add the first, such as the National Pool Lifeguard Qualification." : "Whoever manages the Academy adds them."} /> : (
          <ul className="pc-rows">
            {types.map((t) => {
              const kind = ACADEMY_KIND_META[t.kind as AcademyKind] ?? ACADEMY_KIND_META.other;
              const Icon = kind.icon;
              return (
                <li key={t.id} className="pc-row" {...(t.archivedAt ? { "data-muted": "" } : {})}>
                  <span className="pc-tile-icon" aria-hidden="true"><Icon /></span>
                  <span className="pc-row-body">
                    <span className="pc-row-title">{t.name}</span>
                    <span className="pc-row-hint">{[t.awardingBody || null, t.minAge ? `${t.minAge}+` : null, t.minHours ? `${t.minHours} hours to attend` : null,
                      t.checks.length ? `checks: ${t.checks.map((c) => ACADEMY_CHECKS[c as AcademyCheck] ?? c).join(", ").toLowerCase()}` : "no checks",
                      t.qualificationType ? `gives staff ${t.qualificationType.name}` : null, plural(t._count.courses, "course")].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="pc-row-trail">
                    <Tag meta={t.archivedAt ? ARCHIVAL_STATUS_META.archived : kind} />
                    {who.manage ? <>
                      <CourseTypeDialog type={t} qualifications={qualifications} trigger={<Button variant="outline" size="icon" aria-label={`Change ${t.name}`}><Pencil aria-hidden="true" /></Button>} />
                      <ArchiveCourseType id={t.id} name={t.name} archived={!!t.archivedAt} />
                    </> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
