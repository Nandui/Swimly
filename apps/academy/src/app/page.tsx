"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarDays, LifeBuoy, MapPin, PhoneCall, Ticket, Users, type LucideIcon } from "lucide-react";
import { api, message, type Course } from "@/lib/api";
import { placesMeta, rhythm, span } from "@/lib/format";
import { Button } from "@/components/shadcn/button";
import { Frame, Loading, Notice, Tag } from "@/components/ui";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { SegmentedChoice } from "@/components/ui-kit/segmented-links";

/** What a course is about, as an icon, by kind of qualification. */
const ICONS: Record<string, LucideIcon> = { lifeguard: LifeBuoy, "swim-teacher": Users };
const iconOf = (c: Course) => ICONS[c.category] ?? BadgeCheck;

/** The filter a course falls under: its kind (lifeguard, swim teacher, other). */
const filterOf = (c: Course) => c.category;
const filterLabel = (c: Course) => c.categoryLabel;

/** The home page: what we offer, how booking works, and every course open for booking, soonest
 *  first. Full ones stay listed. */
export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [site, setSite] = useState("");
  useEffect(() => {
    let live = true;
    api<{ courses: Course[] }>("courses")
      .then((r) => { if (live) setCourses(r.courses); })
      .catch((e) => { if (live) setError(message(e)); });
    return () => { live = false; };
  }, []);
  const all = useMemo(() => courses ?? [], [courses]);
  const filters = useMemo(() => [...new Map(all.map((c) => [filterOf(c), filterLabel(c)])).entries()], [all]);
  const sites = useMemo(() => [...new Set(all.map((c) => c.site))].sort(), [all]);
  const shown = all.filter((c) => (!filter || filterOf(c) === filter) && (!site || c.site === site));

  return (
    <Frame title="Courses" wide>
      <PageShell spacing="roomy" className="academy-home" header={<PageHeader title="Book a course at LeisureWorld"
        description="Lifeguard and swim teacher qualifications at our centres."
        actions={<Button asChild variant="outline"><a href="#courses">See the courses<ArrowRight aria-hidden="true" /></a></Button>} />}>
      <ol className="how" aria-label="How booking works">
        <li><span className="how-icon" aria-hidden="true"><Ticket /></span><span><strong>Hold your place online</strong><span className="text-ui-muted-foreground">Pick a course and check your email with a code. No account to set up.</span></span></li>
        <li><span className="how-icon" aria-hidden="true"><PhoneCall /></span><span><strong>We phone you within 72 hours</strong><span className="text-ui-muted-foreground">We take payment over the phone, at the time you choose.</span></span></li>
        <li><span className="how-icon" aria-hidden="true"><BadgeCheck /></span><span><strong>You&apos;re booked</strong><span className="text-ui-muted-foreground">See your courses, dates and payments any time under My bookings.</span></span></li>
      </ol>

      <section id="courses" className="flex flex-col gap-4" aria-labelledby="courses-h">
        <div className="section-head">
          <h2 id="courses-h">Open for booking</h2>
          {courses && courses.length ? <p className="text-ui-muted-foreground">{shown.length === all.length ? `${all.length} ${all.length === 1 ? "course" : "courses"}, soonest first.` : `${shown.length} of ${all.length} courses.`}</p> : null}
        </div>
        {filters.length > 1 || sites.length > 1 ? (
          <div className="filters">
            {filters.length > 1 ? (
              <SegmentedChoice aria-label="Kind of course" value={filter} onValueChange={setFilter}
                options={[["", "All"] as const, ...filters].map(([value, label]) => ({ value, label }))} />
            ) : null}
            {sites.length > 1 ? (
              <SegmentedChoice aria-label="Centre" value={site} onValueChange={setSite}
                options={["", ...sites].map((s) => ({ value: s, label: s || "Every centre", icon: s ? MapPin : undefined }))} />
            ) : null}
          </div>
        ) : null}
        {error ? <Notice title="Couldn't load the courses" tone="error">{error}</Notice> : null}
        {!courses && !error ? <Loading rows={3} grid /> : null}
        {courses && all.length === 0 ? <Notice title="No courses open for booking right now">New dates are added here as soon as they are set. Check back soon.</Notice> : null}
        {courses && all.length > 0 && shown.length === 0 ? <Notice title="Nothing matches">Try another kind of course or centre.</Notice> : null}
        <ul className="course-grid">
          {shown.map((c) => {
            const Icon = iconOf(c);
            return (
              <li key={c.id}>
                <Link href={`/courses/${c.id}`} className="course-card">
                  <span className="course-top">
                    <span className="course-icon" aria-hidden="true"><Icon /></span>
                    <span className="caption">{c.group === "qualification" ? `${c.categoryLabel} qualification` : c.categoryLabel}</span>
                  </span>
                  <span className="title">{c.name}</span>
                  {c.description ? <span className="text-ui-muted-foreground line-clamp-2">{c.description}</span> : c.awardingBody ? <span className="text-ui-muted-foreground">Awarded by {c.awardingBody}</span> : null}
                  <span className="course-facts">
                    <span><CalendarDays aria-hidden="true" /><span>{span(c.firstDay, c.lastDay)}<br /><span className="text-ui-muted-foreground">{rhythm(c)}</span></span></span>
                    <span><MapPin aria-hidden="true" />{c.site}</span>
                  </span>
                  <span className="course-foot">
                    <span className="price">{c.price}</span>
                    <Tag meta={placesMeta(c)} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
      </PageShell>
    </Frame>
  );
}
