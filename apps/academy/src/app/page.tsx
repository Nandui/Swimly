"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarDays, Dumbbell, LifeBuoy, MapPin, PhoneCall, Shapes, Ticket, Users, Waves, type LucideIcon } from "lucide-react";
import { api, message, type Course } from "@/lib/api";
import { placesMeta, rhythm, span } from "@/lib/format";
import { Frame, Loading, Notice, Tag } from "@/components/ui";

/** What a course is about, as an icon: qualifications by kind, short courses by where they run. */
const ICONS: Record<string, LucideIcon> = { lifeguard: LifeBuoy, "swim-teacher": Users, pool: Waves, gym: Dumbbell, studio: Users };
const iconOf = (c: Course) => ICONS[c.category] ?? (c.group === "qualification" ? BadgeCheck : Shapes);

/** The filter a course falls under: every qualification together, short courses by where. */
const filterOf = (c: Course) => (c.group === "qualification" ? "qualification" : c.category);
const filterLabel = (c: Course) => (c.group === "qualification" ? "Qualifications" : c.categoryLabel);

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
      <section className="hero" aria-labelledby="hero-h">
        <div className="hero-copy">
          <h1 id="hero-h">Book a course at LeisureWorld</h1>
          <p className="lead">Lifeguard and swim teacher qualifications, and six to eight week courses in the pool, the gym and the studio.</p>
          <a href="#courses" className="button large">See the courses<ArrowRight aria-hidden="true" /></a>
        </div>
        <ol className="how" aria-label="How booking works">
          <li><span className="how-icon" aria-hidden="true"><Ticket /></span><span><strong>Hold your place online</strong><span className="muted">Pick a course and check your email with a code. No account to set up.</span></span></li>
          <li><span className="how-icon" aria-hidden="true"><PhoneCall /></span><span><strong>We phone you within 72 hours</strong><span className="muted">We take payment over the phone, at the time you choose.</span></span></li>
          <li><span className="how-icon" aria-hidden="true"><BadgeCheck /></span><span><strong>You&apos;re booked</strong><span className="muted">See your courses, dates and payments any time under My bookings.</span></span></li>
        </ol>
      </section>

      <section id="courses" className="stack" aria-labelledby="courses-h">
        <div className="section-head">
          <h2 id="courses-h">Open for booking</h2>
          {courses && courses.length ? <p className="muted">{shown.length === all.length ? `${all.length} ${all.length === 1 ? "course" : "courses"}, soonest first.` : `${shown.length} of ${all.length} courses.`}</p> : null}
        </div>
        {filters.length > 1 || sites.length > 1 ? (
          <div className="filters">
            {filters.length > 1 ? (
              <div className="chips" role="group" aria-label="Kind of course">
                {[["", "All"] as const, ...filters].map(([key, label]) => <button key={key} type="button" className="chip" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}
              </div>
            ) : null}
            {sites.length > 1 ? (
              <div className="chips" role="group" aria-label="Centre">
                {["", ...sites].map((s) => <button key={s || "all"} type="button" className="chip" aria-pressed={site === s} onClick={() => setSite(s)}>{s ? <><MapPin aria-hidden="true" />{s}</> : "Every centre"}</button>)}
              </div>
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
                  {c.description ? <span className="muted clamp">{c.description}</span> : c.awardingBody ? <span className="muted">Awarded by {c.awardingBody}</span> : null}
                  <span className="course-facts">
                    <span><CalendarDays aria-hidden="true" /><span>{span(c.firstDay, c.lastDay)}<br /><span className="muted">{rhythm(c)}</span></span></span>
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
    </Frame>
  );
}
