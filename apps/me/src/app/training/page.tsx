"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Bookmark, CalendarDays, ChevronRight, FileText, Flame, GraduationCap, LibraryBig, Search } from "lucide-react";
import { Frame } from "@/components/frame";
import { CourseImage } from "@/components/question";
import { Bar, EmptyRows, LoadError, Loading, Section, Tag, useLoad } from "@/components/ui";
import { date, day } from "@/lib/format";
import { TRAINING_META, type Meta } from "@/lib/meta";
import { Input } from "@/components/shadcn/input";
import { Button } from "@/components/shadcn/button";
import { PageShell } from "@/components/ui-kit/page-shell";
import { PageHeader } from "@/components/ui-kit/page-header";

type Item = { id: string; title: string; state: string; dueOn: string | null; completedAt: string | null; progress: { done: number; total: number } | null; coverId: string | null; category: string };

type Plan = {
  paths: { id: string; title: string; summary: string; startsOn: string; done: number; total: number; finishedOn: string | null; overdue: boolean;
    steps: { title: string; assignmentId: string | null; state: string; dueOn: string | null; completedOn: string | null }[] }[];
  sessions: { id: string; title: string; when: string; startsAt: string; upcoming: boolean; course: string | null; site: string | null; location: string; trainer: string; status: string; closed: boolean }[];
  hours: { progress: { qualification: string; hours: number; windowMonths: number; minutes: number; since: string; met: boolean; percent: number }[]; log: { id: string; on: string; minutes: number; topic: string; qualification: string | null }[] };
};

const inWords = (minutes: number) => { const h = Math.floor(minutes / 60), m = minutes % 60; return [h ? `${h} h` : null, m || !h ? `${m} min` : null].filter(Boolean).join(" "); };
const SESSION_META: Record<string, Meta> = {
  BOOKED: { label: "Booked", tone: "blue", icon: CalendarDays },
  ATTENDED: { label: "Attended", tone: "green", icon: CalendarDays },
  ABSENT: { label: "Missed", tone: "gray", icon: CalendarDays },
};

/** Their learning paths, booked sessions and in-service hours (phase 5). Hidden when there are none. */
function OnTheJob({ plan }: { plan: Plan }) {
  const coming = plan.sessions.filter((s) => s.upcoming && s.status === "BOOKED").reverse();
  const past = plan.sessions.filter((s) => !coming.includes(s)).slice(0, 5);
  return (
    <>
      {plan.paths.map((p) => (
        <Section key={p.id} id={`path-${p.id}`} title={p.title} aside={<p>{p.done} of {p.total}</p>}>
          <div className="me-section-note stack-sm">
            {p.summary ? <span>{p.summary}</span> : null}
            <span className="tabular-nums">{p.finishedOn ? `Finished ${date(p.finishedOn)}` : `${p.done} of ${p.total} courses done${p.overdue ? " · something is overdue" : ""}`}</span>
            <Bar max={p.total} value={p.done} label="Courses done on this path" />
          </div>
          <ol className="pc-list">
            {p.steps.map((step, i) => {
              const body = (
                <>
                  <span className="pc-tile-icon tabular-nums" aria-hidden="true">{i + 1}</span>
                  <span className="pc-row-body"><span className="pc-row-title">{step.title}</span>
                    <span className="pc-row-hint">{step.completedOn ? `Completed ${date(step.completedOn)}` : step.dueOn ? `Due ${day(step.dueOn)}` : step.state === "cancelled" ? "Not assigned" : "No deadline"}</span></span>
                  <span className="pc-row-trail"><Tag meta={TRAINING_META[step.state] ?? TRAINING_META.assigned} />{step.assignmentId ? <ChevronRight className="pc-row-chevron" aria-hidden="true" /> : null}</span>
                </>
              );
              return <li key={`${p.id}-${i}`}>{step.assignmentId ? <Link href={`/training/${step.assignmentId}`} className="pc-row">{body}</Link> : <div className="pc-row">{body}</div>}</li>;
            })}
          </ol>
        </Section>
      ))}
      {coming.length || past.length ? (
        <Section id="t-sessions" title="Sessions">
          <ul className="pc-list">
            {[...coming, ...past].map((s) => (
              <li key={s.id} className="pc-row">
                <span className="pc-tile-icon"><CalendarDays aria-hidden="true" /></span>
                <span className="pc-row-body"><span className="pc-row-title">{s.title}</span>
                  <span className="pc-row-hint">{[s.when, [s.site, s.location].filter(Boolean).join(", ") || null, s.trainer ? `with ${s.trainer}` : null].filter(Boolean).join(" · ")}</span>
                  {s.course ? <span className="pc-row-hint">Completes {s.course}</span> : null}</span>
                <span className="pc-row-trail"><Tag meta={SESSION_META[s.status] ?? SESSION_META.BOOKED} /></span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {plan.hours.progress.length || plan.hours.log.length ? (
        <Section id="t-hours" title="In-service hours" className="gap-(--space-3)">
          {plan.hours.progress.length ? (
            <div className="pc-panel">
              {plan.hours.progress.map((h) => (
                <div key={h.qualification} className="stack-sm">
                  <p className="tabular-nums"><strong>{h.qualification}</strong>: {inWords(h.minutes)} of {h.hours} h since {date(h.since)}{h.met ? ", done" : `, ${inWords(h.hours * 60 - h.minutes)} to go`}</p>
                  <Bar max={100} value={h.percent} label={`${h.qualification} hours`} />
                </div>
              ))}
            </div>
          ) : null}
          {plan.hours.log.length ? (
            <ul className="pc-list" aria-label="Hours logged">
              {plan.hours.log.slice(0, 8).map((l) => (
                <li key={l.id} className="pc-row"><span className="pc-row-body"><span className="pc-row-title">{inWords(l.minutes)} · {l.topic}</span><span className="pc-row-hint">{[date(l.on), l.qualification].filter(Boolean).join(" · ")}</span></span></li>
              ))}
            </ul>
          ) : null}
        </Section>
      ) : null}
    </>
  );
}

type Refresher = { goal: number; answered: number; questions: unknown[]; streak: { current: number; today: boolean } };

/** Search, today's refresher and the rest of the learner's own space (phase 6). */
function LearnerTools({ refresher }: { refresher: Refresher | null }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  function search(event: FormEvent) {
    event.preventDefault();
    if (q.trim().length >= 2) router.push(`/training/search?q=${encodeURIComponent(q.trim())}`);
  }
  const waiting = refresher?.questions.length ?? 0;
  const streak = refresher?.streak.current ?? 0;
  const tiles = [
    { href: "/training/refresher", icon: Flame, title: "Today’s refresher",
      hint: !refresher ? "Two minutes of questions" : waiting ? `${waiting} ${waiting === 1 ? "question" : "questions"} waiting${streak ? ` · ${streak}-day streak` : ""}` : `Done for today${streak ? ` · ${streak}-day streak` : ""}` },
    { href: "/training/saved", icon: Bookmark, title: "Saved", hint: "Bookmarks and your notes" },
    { href: "/training/catalogue", icon: LibraryBig, title: "Find a course", hint: "Courses open to everyone" },
    { href: "/training/record", icon: FileText, title: "My record", hint: "Every course, score and certificate" },
  ];
  return (
    <>
      <form role="search" className="search-row" onSubmit={search}>
        <Input id="training-search" type="search" aria-label="Search my training" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search my courses and lessons" maxLength={80} />
        <Button type="submit" size="icon" disabled={q.trim().length < 2}><Search aria-hidden="true" /><span className="sr-only">Search</span></Button>
      </form>
      <nav aria-label="My learning">
        <ul className="learn-tiles">
          {tiles.map(({ href, icon: Icon, title, hint }) => (
            <li key={href}><Link href={href} className="learn-tile"><span className="pc-tile-icon"><Icon aria-hidden="true" /></span><strong>{title}</strong><span className="caption">{hint}</span></Link></li>
          ))}
        </ul>
      </nav>
    </>
  );
}

/** "3 of 8 lessons" for a course built from lessons, while it is open. */
const lessonsHint = (t: Item) => t.progress && t.state !== "completed" ? `${t.progress.done} of ${t.progress.total} lessons` : null;

export default function TrainingPage() {
  const { data, error, reload } = useLoad<{ items: Item[] }>("training");
  const { data: plan } = useLoad<Plan>("training/plan");
  const { data: refresher } = useLoad<Refresher>("training/refresher");
  const open = data?.items.filter((t) => t.state !== "completed" && t.state !== "cancelled") ?? [];
  const done = data?.items.filter((t) => t.state === "completed") ?? [];
  const list = (items: Item[], empty: string) => items.length === 0 ? <EmptyRows>{empty}</EmptyRows> : (
    <ul className="pc-list">{items.map((t) => (
      <li key={t.id}><Link href={`/training/${t.id}`} className="pc-row">
        {t.coverId ? <CourseImage assignmentId={t.id} fileId={t.coverId} alt="" className="course-thumb" /> : <span className="pc-tile-icon"><GraduationCap aria-hidden="true" /></span>}
        <span className="pc-row-body">{t.category ? <span className="caption eyebrow">{t.category}</span> : null}<span className="pc-row-title">{t.title}</span><span className="pc-row-hint">{[t.completedAt ? `Completed ${date(t.completedAt)}` : t.dueOn ? `Due ${day(t.dueOn)}` : "No deadline", lessonsHint(t)].filter(Boolean).join(" · ")}</span></span>
        <span className="pc-row-trail"><Tag meta={TRAINING_META[t.state]} /><ChevronRight className="pc-row-chevron" aria-hidden="true" /></span>
      </Link></li>
    ))}</ul>
  );
  return (
    <Frame title="My training">
      <PageShell spacing="roomy" header={<PageHeader title="My training" description="Courses assigned to you. Open one to work through its lessons; it remembers where you got to." />}>
        <LearnerTools refresher={refresher} />
        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : (
          <>
            <Section id="t-open" title="To do" aside={open.length ? <p>{open.length}</p> : null}>{list(open, "No training to do right now.")}</Section>
            {plan ? <OnTheJob plan={plan} /> : null}
            <Section id="t-done" title="Completed" aside={done.length ? <p>{done.length}</p> : null}>{list(done, "Nothing completed yet.")}</Section>
          </>
        )}
      </PageShell>
    </Frame>
  );
}
