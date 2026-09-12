import Link from "next/link";
import { Archive, ArrowLeft, ArrowRight, ChevronRight, CircleCheck, CircleX, SearchX, Waves } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Badge } from "@/components/shadcn/badge";
import { Item, ItemGroup, ItemContent, ItemTitle } from "@/components/shadcn/item";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/shadcn/empty";
import { AddClass } from "./add-class";
import { CourseFilters } from "./course-filters";
import { courseName, DAY_META, formatTime } from "@/lib/courses/constants";
import { CLASS_PAGE_SIZE, classBrowserHref, classBrowserModel, classDetailsHref } from "@/lib/courses/browse";
import { activeFilterCount, courseFilterDimensions, hasPlace } from "@/lib/courses/filters";
import type { CourseRow, InstructorOption } from "@/lib/courses/data/courses";
import type { LevelOption } from "@/lib/curriculum/data/curriculum";
import { ARCHIVAL_STATUS_META } from "@/lib/status";
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
  return <section className="min-w-0 space-y-5 text-ui-foreground" aria-labelledby="classes-heading" data-class-browser>
    <header className="space-y-2">
      <div className="flex items-center justify-between gap-3"><h1 id="classes-heading" className="text-2xl font-semibold tracking-tight">Classes</h1>{canManage ? <AddClass levels={levels} instructors={instructors} workingSite={workingSite} /> : null}</div>
      <p className="text-sm text-ui-muted-foreground">Find a weekly class across all sites and see where there’s room.</p>
    </header>
    <CourseFilters dimensions={courseFilterDimensions(collection, filters)} q={filters.q} active={active} state={state} todayDay={todayDay}
      showing={{ first: (page - 1) * CLASS_PAGE_SIZE + 1, last: Math.min(page * CLASS_PAGE_SIZE, matches.length), total: matches.length }}
      views={lenses} selectedView={selected} />
    <div className="space-y-3">
      {rows.length ? <div className={styles.directory}>
        <div className={styles.columns} aria-hidden="true"><span>Class</span><span>Weekly schedule</span><span className={styles.site}>Site &amp; pool</span><span className={styles.instructor}>Instructor</span><span>Availability</span><span /></div>
        <ItemGroup aria-label="Weekly classes">{rows.map(course => <div key={course.id} role="listitem" className={styles.listItem}>
          <Item asChild className={styles.row}><Link href={classDetailsHref(course.id, returnTo)} prefetch={false}>
            <ItemContent className={styles.identity}>
              <ItemTitle className={styles.name}>{courseName(course)}</ItemTitle>
              <p className={styles.secondary}>{course.level.programme.name}{course.name && course.name !== course.level.name ? ` · ${course.level.name}` : ""}</p>
              <p className={styles.mobileSite}>{course.club.name}{course.location ? ` · ${course.location}` : ""}</p>
            </ItemContent>
            <div className={styles.schedule}><p className="font-medium">{DAY_META[course.dayOfWeek].label}</p><p className="tabular-nums text-ui-muted-foreground">{formatTime(course.startMinutes)}–{formatTime(course.startMinutes + course.durationMinutes)}</p></div>
            <div className={styles.site}><p>{course.club.name}</p><p className={styles.secondary}>{course.location || "Pool area not recorded"}</p></div>
            <div className={styles.instructor}>{course.instructor?.name ?? "Not assigned"}</div>
            <div className={styles.availability}><ClassAvailability course={course} /></div>
            <ChevronRight className={styles.arrow} aria-hidden="true" /><span className="sr-only">View class</span>
          </Link></Item>
        </div>)}</ItemGroup>
      </div> : <Empty className="border border-ui-border bg-ui-muted/30 py-12">
        <EmptyHeader><EmptyMedia variant="icon">{active ? <SearchX /> : <Waves />}</EmptyMedia><EmptyTitle>{active ? "No classes match" : state === "archived" ? "No archived classes" : "No classes yet"}</EmptyTitle>
          <EmptyDescription>{active ? "Try another level, day or site. You can clear the filters to see all classes." : state === "archived" ? "Archived classes will appear here with their history kept on record." : canManage ? "Add a weekly class to start filling the timetable." : "No weekly classes are available yet."}</EmptyDescription></EmptyHeader>
        <EmptyContent>{active ? <Button asChild variant="outline"><Link href={resetHref}>{state === "archived" ? "Show archived classes" : "Show all classes"}</Link></Button> : null}</EmptyContent>
      </Empty>}
      {pages > 1 ? <nav aria-label="Class pages" className="flex items-center justify-between gap-2 pt-2">
        {page > 1 ? <Button asChild variant="outline"><Link href={classBrowserHref(params, { page: page > 2 ? String(page - 1) : null })}><ArrowLeft aria-hidden="true" />Previous</Link></Button> : <Button variant="outline" disabled><ArrowLeft aria-hidden="true" />Previous</Button>}
        <span className="text-sm text-ui-muted-foreground tabular-nums">{page} / {pages}<span className="sr-only"> pages</span></span>
        {page < pages ? <Button asChild variant="outline"><Link href={classBrowserHref(params, { page: String(page + 1) })}>Next<ArrowRight aria-hidden="true" /></Link></Button> : <Button variant="outline" disabled>Next<ArrowRight aria-hidden="true" /></Button>}
      </nav> : null}
    </div>
  </section>;
}

function ClassAvailability({ course }: { course: CourseRow }) {
  if (course.archivedAt) return <Badge variant="secondary" data-tone={ARCHIVAL_STATUS_META.archived.color}><Archive aria-hidden="true" />{ARCHIVAL_STATUS_META.archived.label}</Badge>;
  const enrolled = course._count.enrolments;
  const open = hasPlace(course);
  const Icon = open ? CircleCheck : CircleX;
  const remaining = course.capacity === null ? null : Math.max(0, course.capacity - enrolled);
  return <div className="space-y-1"><p className="flex items-center gap-2 font-medium"><Icon className="size-4 shrink-0" aria-hidden="true" />{open ? remaining === null ? "Available" : `${remaining} ${remaining === 1 ? "place" : "places"} left` : "Full"}</p>
    <p className={styles.secondary}>{course.capacity === null ? `${enrolled} enrolled · No limit` : `${enrolled} of ${course.capacity} enrolled${enrolled > course.capacity ? ` · ${enrolled - course.capacity} over capacity` : ""}`}</p>
  </div>;
}
