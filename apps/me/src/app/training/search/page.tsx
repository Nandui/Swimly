"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { BookOpen, ChevronLeft, ChevronRight, GraduationCap, Search } from "lucide-react";
import { Frame } from "@/components/frame";
import { EmptyRows, LoadError, Loading, useLoad } from "@/components/ui";

type Results = {
  courses: { assignmentId: string; title: string; snippet: string }[];
  lessons: { assignmentId: string; lessonId: string; course: string; section: string; title: string; snippet: string }[];
};

/** Search every course and lesson of yours (Training e-learning phase 6). */
function SearchResults() {
  const router = useRouter();
  const params = useSearchParams();
  const q = (params.get("q") ?? "").trim();
  const [text, setText] = useState(q);
  const { data, error, reload } = useLoad<Results>(q.length >= 2 ? `training/search?q=${encodeURIComponent(q)}` : null);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (text.trim().length >= 2) router.replace(`/training/search?q=${encodeURIComponent(text.trim())}`);
  }
  const total = data ? data.courses.length + data.lessons.length : 0;
  return (
    <>
      <form role="search" className="search-row" onSubmit={submit}>
        <label htmlFor="search-q" className="sr-only">Search my training</label>
        <input id="search-q" type="search" className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search my courses and lessons" maxLength={80} />
        <button type="submit" className="button" disabled={text.trim().length < 2}><Search aria-hidden="true" />Search</button>
      </form>
      {q.length < 2 ? <p className="muted">Type at least two letters, such as a chemical, a rescue or a procedure.</p>
        : error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : (
          <>
            <p className="muted" role="status">{total === 0 ? `Nothing in your training mentions “${q}”.` : `${total} ${total === 1 ? "result" : "results"} for “${q}”`}</p>
            {data.courses.length ? (
              <section className="pc-panel" aria-labelledby="found-courses">
                <h2 id="found-courses">Courses</h2>
                <ul className="pc-rows">{data.courses.map((c) => (
                  <li key={c.assignmentId}><Link href={`/training/${c.assignmentId}`} className="pc-row">
                    <span className="pc-tile-icon"><GraduationCap aria-hidden="true" /></span>
                    <span className="pc-row-body"><span className="pc-row-title">{c.title}</span>{c.snippet ? <span className="pc-row-hint">{c.snippet}</span> : null}</span>
                    <ChevronRight className="pc-row-chevron" aria-hidden="true" />
                  </Link></li>
                ))}</ul>
              </section>
            ) : null}
            {data.lessons.length ? (
              <section className="pc-panel" aria-labelledby="found-lessons">
                <h2 id="found-lessons">Lessons</h2>
                <ul className="pc-rows">{data.lessons.map((l) => (
                  <li key={`${l.assignmentId}-${l.lessonId}`}><Link href={`/training/${l.assignmentId}/${l.lessonId}`} className="pc-row">
                    <span className="pc-tile-icon"><BookOpen aria-hidden="true" /></span>
                    <span className="pc-row-body"><span className="caption">{[l.course, l.section].filter(Boolean).join(" › ")}</span><span className="pc-row-title">{l.title}</span>{l.snippet ? <span className="pc-row-hint">{l.snippet}</span> : null}</span>
                    <ChevronRight className="pc-row-chevron" aria-hidden="true" />
                  </Link></li>
                ))}</ul>
              </section>
            ) : null}
            {total === 0 ? <EmptyRows>Try fewer or different words.</EmptyRows> : null}
          </>
        )}
    </>
  );
}

export default function SearchPage() {
  return (
    <Frame title="Search my training">
      <div className="stack">
        <Link href="/training" className="button ghost back-link"><ChevronLeft aria-hidden="true" />My training</Link>
        <h1>Search my training</h1>
        <Suspense fallback={<Loading />}><SearchResults /></Suspense>
      </div>
    </Frame>
  );
}
