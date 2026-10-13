import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { clock, CourseDialog, type CourseRow, newCourseOptions, SHORT_COURSE_AREA_META, SHORT_COURSE_META, type ShortCourseArea, shortCoursesHome } from "@/modules/short-courses/features/courses";
import { formatDate, plural } from "@/lib/format";

export const metadata: Metadata = { title: "Short courses" };

const day = (iso: string) => formatDate(new Date(`${iso}T00:00:00Z`));

/** The courses page (owner decision, 13 October 2026): short courses coming up and running at
 *  the sites this person covers, and those finished lately. */
export default async function ShortCoursesPage() {
  const { who, current, past, types } = await shortCoursesHome();
  const options = who.manage ? await newCourseOptions() : null;
  const canPutOn = !!options && options.sites.length > 0 && options.types.length > 0;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Short courses"
        description="Six and eight week courses at the pool, the gym or the studio: who is booked, who is waiting, payment and registers. Sessions show on the Rota for their instructor."
        actions={canPutOn ? <CourseDialog sites={options.sites} types={options.types} perSite={options.perSite} today={options.today} />
          : who.manage ? <Button asChild><Link href="/short-courses/types">Add a course to the list</Link></Button> : undefined} />
      <Panel id="sc-current" title="Coming up and running" courses={current}
        empty={types ? { title: "No courses on", hint: who.manage ? "Put a course on; its weekly sessions are made for you." : "Whoever manages Short courses puts them on." }
          : { title: "No courses on the list yet", hint: "Whoever manages Short courses adds what we offer first, such as Couch to 5k." }} />
      {past.length ? <Panel id="sc-past" title="Finished in the last 90 days" courses={past} /> : null}
    </div>
  );
}

function Panel({ id, title, courses, empty }: { id: string; title: string; courses: CourseRow[]; empty?: { title: string; hint?: string } }) {
  return (
    <section aria-labelledby={`${id}-h`} id={id} className="pc-panel">
      <div className="pc-panel-head"><h2 id={`${id}-h`}>{title}</h2></div>
      {courses.length === 0 ? <EmptyState compact icon="calendarRange" title={empty?.title ?? "None"} hint={empty?.hint} /> : (
        <ul className="pc-rows">
          {courses.map((c) => {
            const area = SHORT_COURSE_AREA_META[c.area as ShortCourseArea] ?? SHORT_COURSE_AREA_META.other;
            const Icon = area.icon;
            const dates = c.first ? (c.last && c.last !== c.first ? `${day(c.first)} to ${day(c.last)}` : day(c.first)) : "No sessions yet";
            return (
              <li key={c.id}>
                <Link href={`/short-courses/${c.id}`} className="pc-row">
                  <span className="pc-tile-icon" aria-hidden="true"><Icon /></span>
                  <span className="pc-row-body">
                    <span className="pc-row-title">{c.name}</span>
                    <span className="pc-row-hint">
                      {[c.site, dates, c.sessions ? plural(c.sessions, "session") : null,
                        c.next && c.state !== "finished" && c.state !== "cancelled" ? `next ${day(c.next.date)} ${clock(c.next.startMinutes)}` : null, c.instructor].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="pc-row-trail">
                    <span className="text-sm tabular-nums">{c.taken} of {c.capacity}{c.waiting ? `, ${c.waiting} waiting` : ""}</span>
                    <Tag meta={SHORT_COURSE_META[c.state]} />
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
