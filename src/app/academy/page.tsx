import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { CourseDialog } from "@/components/academy/forms";
import { formatDate, plural } from "@/lib/format";
import { academyHome, newCourseOptions, type CourseRow } from "@/lib/academy/data";
import { ACADEMY_COURSE_META, ACADEMY_KIND_META, hoursLabel, type AcademyKind } from "@/lib/academy/rules";

export const metadata: Metadata = { title: "Academy courses" };

/** The Academy's first page (owner decision, 8 October 2026): the lifeguard and swim teacher
 *  courses coming up and running at the sites this person covers, and those finished lately. */
export default async function AcademyPage() {
  const { who, current, past, types } = await academyHome();
  const options = who.manage ? await newCourseOptions() : null;
  const canPutOn = !!options && options.sites.length > 0 && options.types.length > 0;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Academy courses"
        description="The lifeguard and swim teacher courses we deliver: candidates, pre-course checks, registers and results. Sessions show on the Rota for their tutor."
        actions={canPutOn ? <CourseDialog sites={options.sites} types={options.types} staff={options.staff} /> : who.manage ? <Button asChild><Link href="/academy/types">Add a course to the list</Link></Button> : undefined} />
      <Panel id="ac-current" title="Coming up and running" courses={current}
        empty={types ? { title: "No courses on", hint: who.manage ? "Put a course on, then add its sessions and candidates." : "Whoever manages the Academy puts courses on." }
          : { title: "No courses on the list yet", hint: "Whoever manages the Academy adds the courses we deliver first, such as NPLQ." }} />
      {past.length ? <Panel id="ac-past" title="Finished in the last 90 days" courses={past} /> : null}
    </div>
  );
}

function Panel({ id, title, courses, empty }: { id: string; title: string; courses: CourseRow[]; empty?: { title: string; hint?: string } }) {
  return (
    <section aria-labelledby={`${id}-h`} id={id} className="pc-panel">
      <div className="pc-panel-head"><h2 id={`${id}-h`}>{title}</h2></div>
      {courses.length === 0 ? <EmptyState compact icon="award" title={empty?.title ?? "None"} hint={empty?.hint} /> : (
        <ul className="pc-rows">
          {courses.map((c) => {
            const kind = ACADEMY_KIND_META[c.kind as AcademyKind] ?? ACADEMY_KIND_META.other;
            const Icon = kind.icon;
            return (
              <li key={c.id}>
                <Link href={`/academy/${c.id}`} className="pc-row">
                  <span className="pc-tile-icon" aria-hidden="true"><Icon /></span>
                  <span className="pc-row-body">
                    <span className="pc-row-title">{c.name}</span>
                    <span className="pc-row-hint">
                      {[c.site, c.first ? (c.last && c.last !== c.first ? `${formatDate(new Date(`${c.first}T00:00:00Z`))} to ${formatDate(new Date(`${c.last}T00:00:00Z`))}` : formatDate(new Date(`${c.first}T00:00:00Z`))) : "No sessions yet",
                        c.sessions ? `${plural(c.sessions, "session")}, ${hoursLabel(c.hours)}` : null, `tutor ${c.tutor}`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="pc-row-trail">
                    <span className="text-sm tabular-nums">{c.taken} of {c.capacity}</span>
                    <Tag meta={ACADEMY_COURSE_META[c.state]} />
                    <ChevronRight aria-hidden="true" className="pc-row-chevron" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
