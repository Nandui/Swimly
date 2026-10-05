import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Tag } from "@/components/ui-kit/tag";
import { LinkPagination } from "@/components/ui-kit/link-pagination";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Item, ItemGroup, ItemContent, ItemTitle } from "@/components/shadcn/item";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { AddClass } from "./add-class";
import { CourseFilters } from "./course-filters";
import { CAPACITY_META, COURSE_STATUS_META, capacityTone, classTimes, courseName, DAY_META, placesLeft } from "@/modules/activities/lib/courses/constants";
import { CLASS_PAGE_SIZE, classBrowserHref, classBrowserModel, classDetailsHref } from "@/modules/activities/lib/courses/browse";
import { activeFilterCount, courseFilterDimensions, hasPlace } from "@/modules/activities/lib/courses/filters";
import type { CourseRow, InstructorOption } from "@/modules/activities/lib/courses/data/courses";
import type { LevelOption } from "@/modules/activities/lib/curriculum/data/curriculum";
import { ARCHIVAL_STATUS_META } from "@/lib/status";
import { plural } from "@/lib/format";
import styles from "./class-browser.module.css";

/** A directory of weekly classes. Rosters are loaded only after opening a class. */
export function ClassBrowser({ courses, params, todayDay, levels, instructors, canManage, workingSite }: {
  courses: CourseRow[];
  params: Record<string, string | string[] | undefined>;
  todayDay: CourseRow["dayOfWeek"];
  levels: LevelOption[];
  instructors: InstructorOption[];
  canManage: boolean;
  workingSite: string;
}) {
  const model = classBrowserModel(courses, params);
  const { filters, state, collection, rows, matches, page, returnTo } = model;
  const active = activeFilterCount(filters);
  const openCount = courses.filter(c => !c.archivedAt && hasPlace(c)).length;
  const lenses = [
    { key: "all", label: "All classes", count: model.activeCount, state: null, places: null },
    { key: "open", label: "Spaces available", count: openCount, state: null, places: "open" },
    { key: "full", label: "Full", count: model.activeCount - openCount, state: null, places: "full" },
    { key: "archived", label: "Archived", count: model.archivedCount, state: "archived", places: null },
  ];
  const selected = state === "archived" ? "archived" : filters.places === "open" || filters.places === "full" ? filters.places : "all";
  const pages = Math.max(1, Math.ceil(matches.length / CLASS_PAGE_SIZE));
  const resetHref = state === "archived" ? "/courses?state=archived" : "/courses";
  return <div className="min-w-0 flex flex-col gap-6" data-class-browser>
    <PageHeader title="Classes" description="Find a weekly class across all sites and see where there’s room."
      actions={canManage ? <AddClass levels={levels} instructors={instructors} workingSite={workingSite} /> : undefined} />
    <section className="pc-panel" aria-label="Classes">
      <CourseFilters dimensions={courseFilterDimensions(collection, filters)} q={filters.q} active={active} state={state} todayDay={todayDay}
        showing={{ first: (page - 1) * CLASS_PAGE_SIZE + 1, last: Math.min(page * CLASS_PAGE_SIZE, matches.length), total: matches.length }}
        views={lenses} selectedView={selected} />
      {rows.length ? <div className={styles.directory}>
        <div className={styles.columns} aria-hidden="true"><span>Class</span><span>Weekly schedule</span><span className={styles.site}>Site and pool</span><span className={styles.instructor}>Instructor</span><span>Availability</span><span /></div>
        <ItemGroup aria-label="Weekly classes">{rows.map(course => <div key={course.id} role="listitem">
          <Item asChild className={styles.row}><Link href={classDetailsHref(course.id, returnTo)} prefetch={false} data-motion="link">
            <ItemContent className={styles.identity}>
              <ItemTitle className={styles.name}>{courseName(course)}</ItemTitle>
              <p className={styles.secondary}>{course.level.programme.name} · {course.level.name}</p>
              <p className={`${styles.secondary} ${styles.mobileSite}`}>{course.club.name}{course.location ? ` · ${course.location}` : ""}</p>
            </ItemContent>
            <div className={styles.schedule}><p>{DAY_META[course.dayOfWeek].label}</p><p className={`${styles.secondary} tabular-nums`}>{classTimes(course)}</p></div>
            <div className={styles.site}><p>{course.club.name}</p><p className={styles.secondary}>{course.location || "Pool area not recorded"}</p></div>
            <div className={styles.instructor}>{course.instructor?.name ?? <Tag meta={COURSE_STATUS_META.unassigned} />}</div>
            <div className={styles.availability}><ClassAvailabilityTag course={course} /></div>
            <span className={styles.arrow} data-motion="direction" aria-hidden="true"><ChevronRight className="size-full" /></span><span className="sr-only">View class</span>
          </Link></Item>
        </div>)}</ItemGroup>
      </div> : <EmptyState
        as="h2"
        icon={active ? "searchX" : "waves"}
        title={active ? "No classes match" : state === "archived" ? "No archived classes" : "No classes yet"}
        hint={active ? "Try another level, day or site. You can clear the filters to see all classes." : state === "archived" ? "Archived classes will appear here with their history kept on record." : canManage ? "Add a weekly class to start filling the timetable." : "No weekly classes are available yet."}
        action={active ? <Button asChild variant="outline"><Link href={resetHref}>{state === "archived" ? "Show archived classes" : "Show all classes"}</Link></Button> : undefined}
      />}
      <LinkPagination label="Class pages" page={page} pageCount={pages} pathname="/courses" query={Object.fromEntries(new URLSearchParams(classBrowserHref(params, { page: null }).split("?")[1] ?? ""))} />
    </section>
  </div>;
}

/** Availability as one tag (archived, full, over or places left) over the enrolment caption. The
 *  same metas colour the class page and the Schedule. */
function ClassAvailabilityTag({ course }: { course: CourseRow }) {
  if (course.archivedAt) return <Tag meta={ARCHIVAL_STATUS_META.archived} />;
  const enrolled = course._count.enrolments;
  const tone = capacityTone(enrolled, course.capacity);
  const remaining = placesLeft(enrolled, course.capacity);
  return <div className="flex flex-col items-start gap-1">
    {tone ? <Tag meta={tone} /> : <Tag meta={CAPACITY_META.open} label={remaining === null ? "Available" : `${plural(remaining, "place")} left`} />}
    <p className={`${styles.secondary} tabular-nums`}>{course.capacity === null ? `${enrolled} enrolled · No limit` : `${enrolled} of ${course.capacity} enrolled`}</p>
  </div>;
}
