"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronRight, GraduationCap, Plus, Star } from "lucide-react";
import { Frame } from "@/components/frame";
import { CourseImage } from "@/components/question";
import { EmptyRows, LoadError, Loading, Notice, useLoad } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { Button } from "@/components/shadcn/button";
import { PageShell } from "@/components/ui-kit/page-shell";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Input } from "@/components/ui/input";

type Course = {
  id: string; title: string; summary: string; category: string; tags: string[]; hasCover: boolean; requiresSignoff: boolean; grants: string | null;
  lessons: number; minutes: number; exam: boolean; rating: { average: number; count: number } | null;
  mine: { assignmentId: string; state: "open" | "completed" } | null;
};

/** The course catalogue (Training e-learning phase 6): courses open to
 *  everyone, to take whenever suits, with no deadline. */
export default function CataloguePage() {
  const router = useRouter();
  const { data, error, reload } = useLoad<{ items: Course[] }>("training/catalogue");
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  async function enrol(course: Course) {
    setBusy(course.id); setFailure(null);
    try {
      const { assignmentId } = await api<{ assignmentId: string }>(`training/catalogue/${course.id}/enrol`, { method: "POST" });
      router.push(`/training/${assignmentId}`);
    } catch (caught) { setFailure(caught instanceof ApiError ? caught.message : "That didn't work. Try again."); setBusy(null); }
  }
  const words = filter.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = (data?.items ?? []).filter((c) => words.every((w) => [c.title, c.summary, c.category, ...c.tags].join(" ").toLowerCase().includes(w)));
  const groups = [...new Set(shown.map((c) => c.category))].map((category) => ({ category, courses: shown.filter((c) => c.category === category) }));
  return (
    <Frame title="Find a course">
      <PageShell header={<PageHeader back={{ href: "/training", label: "My training" }} title="Find a course" description="Courses open to everyone. Enrol to take one when it suits you; there is no deadline." />}>
        {failure ? <Notice title={failure} tone="error" live /> : null}
        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : data.items.length === 0 ? (
          <section className="pc-panel"><EmptyRows>No courses are open to everyone yet.</EmptyRows></section>
        ) : (
          <>
            {data.items.length > 4 ? (
              <Input id="catalogue-filter" type="search" aria-label="Filter courses" value={filter} onChange={setFilter} placeholder="Filter by name, category or tag" maxLength={60} />
            ) : null}
            {shown.length === 0 ? <p className="text-ui-muted-foreground" role="status">No course matches “{filter}”.</p> : null}
            {groups.map((group) => (
              <section key={group.category || "other"} className="pc-panel" aria-label={group.category || "Other courses"}>
                {group.category ? <h2>{group.category}</h2> : null}
                <ul className="pc-rows">{group.courses.map((c) => (
                  <li key={c.id} className="pc-row">
                    {c.hasCover ? <CourseImage assignmentId="" fileId={c.id} path={`training/catalogue/${c.id}/cover`} alt="" className="course-thumb" /> : <span className="pc-tile-icon"><GraduationCap aria-hidden="true" /></span>}
                    <span className="pc-row-body">
                      <span className="pc-row-title">{c.title}</span>
                      {c.summary ? <span className="pc-row-hint">{c.summary}</span> : null}
                      <span className="pc-row-hint">
                        {c.rating ? <span className="stars-read" aria-label={`Rated ${c.rating.average} of 5 by ${c.rating.count} people`}><Star aria-hidden="true" data-on /></span> : null}
                        {[c.rating ? `${c.rating.average} (${c.rating.count})` : null, `${c.lessons} ${c.lessons === 1 ? "lesson" : "lessons"}`, c.minutes ? `about ${c.minutes} min` : null,
                          c.exam ? "final exam" : null, c.requiresSignoff ? "trainer sign-off" : null, c.grants ? `records ${c.grants}` : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="pc-row-trail">
                      {c.mine?.state === "open" ? (
                        <Button asChild variant="outline"><Link href={`/training/${c.mine.assignmentId}`}>Continue<ChevronRight aria-hidden="true" /></Link></Button>
                      ) : (
                        <Button type="button" onClick={() => enrol(c)} disabled={!!busy} aria-label={`${c.mine ? "Take again" : "Enrol on"} ${c.title}`}>
                          <Plus aria-hidden="true" />{busy === c.id ? "Enrolling…" : c.mine ? "Take again" : "Enrol"}
                        </Button>
                      )}
                    </span>
                  </li>
                ))}</ul>
              </section>
            ))}
          </>
        )}
      </PageShell>
    </Frame>
  );
}
