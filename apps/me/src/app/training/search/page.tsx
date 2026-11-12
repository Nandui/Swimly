"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { BookOpen, ChevronRight, GraduationCap, Search } from "lucide-react";
import { Frame } from "@/components/frame";
import { EmptyRows, LoadError, Loading, Section, useLoad } from "@/components/ui";
import { Input } from "@/components/shadcn/input";
import { Button } from "@/components/shadcn/button";
import { PageShell } from "@/components/ui-kit/page-shell";
import { PageHeader } from "@/components/ui-kit/page-header";

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
        <Input id="search-q" type="search" aria-label="Search my training" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search my courses and lessons" maxLength={80} />
        <Button type="submit" disabled={text.trim().length < 2}><Search aria-hidden="true" />Search</Button>
      </form>
      {q.length < 2 ? <p className="text-ui-muted-foreground">Type at least two letters, such as a chemical, a rescue or a procedure.</p>
        : error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : (
          <>
            <p className="text-ui-muted-foreground" role="status">{total === 0 ? `Nothing in your training mentions “${q}”.` : `${total} ${total === 1 ? "result" : "results"} for “${q}”`}</p>
            {data.courses.length ? (
              <Section id="found-courses" title="Courses" aside={<p>{data.courses.length}</p>}>
                <ul className="pc-list">{data.courses.map((c) => (
                  <li key={c.assignmentId}><Link href={`/training/${c.assignmentId}`} className="pc-row">
                    <span className="pc-tile-icon"><GraduationCap aria-hidden="true" /></span>
                    <span className="pc-row-body"><span className="pc-row-title">{c.title}</span>{c.snippet ? <span className="pc-row-hint">{c.snippet}</span> : null}</span>
                    <ChevronRight className="pc-row-chevron" aria-hidden="true" />
                  </Link></li>
                ))}</ul>
              </Section>
            ) : null}
            {data.lessons.length ? (
              <Section id="found-lessons" title="Lessons" aside={<p>{data.lessons.length}</p>}>
                <ul className="pc-list">{data.lessons.map((l) => (
                  <li key={`${l.assignmentId}-${l.lessonId}`}><Link href={`/training/${l.assignmentId}/${l.lessonId}`} className="pc-row">
                    <span className="pc-tile-icon"><BookOpen aria-hidden="true" /></span>
                    <span className="pc-row-body"><span className="caption">{[l.course, l.section].filter(Boolean).join(" › ")}</span><span className="pc-row-title">{l.title}</span>{l.snippet ? <span className="pc-row-hint">{l.snippet}</span> : null}</span>
                    <ChevronRight className="pc-row-chevron" aria-hidden="true" />
                  </Link></li>
                ))}</ul>
              </Section>
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
      <PageShell spacing="roomy" header={<PageHeader back={{ href: "/training", label: "My training" }} title="Search my training" />}>
        <Suspense fallback={<Loading />}><SearchResults /></Suspense>
      </PageShell>
    </Frame>
  );
}
