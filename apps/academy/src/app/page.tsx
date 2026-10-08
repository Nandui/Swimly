"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, api, type Course } from "@/lib/api";
import { dates, placesMeta } from "@/lib/format";
import { Frame, Loading, Notice, Tag } from "@/components/ui";

const KINDS = [["", "All courses"], ["lifeguard", "Lifeguard"], ["swim-teacher", "Swim teacher"]] as const;

/** The courses open for booking, soonest first. Full ones stay listed, marked full. */
export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState("");
  useEffect(() => {
    let live = true;
    api<{ courses: Course[] }>("courses")
      .then((r) => { if (live) setCourses(r.courses); })
      .catch((e) => { if (live) setError(e instanceof ApiError ? e.message : "Could not load the courses. Try again."); });
    return () => { live = false; };
  }, []);
  const shown = (courses ?? []).filter((c) => !kind || c.kind === kind);
  const kinds = KINDS.filter(([k]) => !k || (courses ?? []).some((c) => c.kind === k));
  return (
    <Frame title="Courses">
      <div className="stack-sm">
        <h1>Lifeguard and swim teacher courses</h1>
        <p className="muted">Book a place online. We phone you within 72 hours to take payment.</p>
      </div>
      {kinds.length > 2 ? (
        <div className="chips" role="group" aria-label="Show">
          {kinds.map(([k, label]) => <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{label}</button>)}
        </div>
      ) : null}
      {error ? <Notice title="Couldn't load the courses" tone="error">{error}</Notice> : null}
      {!courses && !error ? <Loading /> : null}
      {courses && shown.length === 0 ? <Notice title="No courses open for booking right now">New dates are added here as they are set. Check back soon.</Notice> : null}
      <ul className="cards">
        {shown.map((c) => {
          const full = c.placesLeft <= 0;
          const body = (
            <>
              <span className="course-head"><span className="title">{c.name}</span><Tag meta={placesMeta(c.placesLeft)} /></span>
              <span className="muted">{dates(c)} · {c.site}</span>
              <span className="muted">{[c.awardingBody ? `Awarded by ${c.awardingBody}` : null, c.minAge ? `aged ${c.minAge} or over` : null, c.price].filter(Boolean).join(" · ")}</span>
              {!full ? <span className="button block">Book a place</span> : null}
            </>
          );
          return <li key={c.id}>{full ? <div className="course-card">{body}</div> : <Link href={`/courses/${c.id}`} className="course-card">{body}</Link>}</li>;
        })}
      </ul>
    </Frame>
  );
}
