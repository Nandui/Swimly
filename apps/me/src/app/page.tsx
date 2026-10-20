"use client";

import Link from "next/link";
import { ChevronRight, Flame, MessageCircle, PlayCircle } from "lucide-react";
import { Frame } from "@/components/frame";
import { EmptyRows, LoadError, Loading, Tag, useLoad } from "@/components/ui";
import { clock, day } from "@/lib/format";
import { QUALIFICATION_META, READING_META, SHIFT_WARNING_META, TRAINING_META } from "@/lib/meta";
import { Button } from "@/components/shadcn/button";
import { PageShell } from "@/components/ui-kit/page-shell";
import { PageHeader } from "@/components/ui-kit/page-header";

type Home = {
  name: string;
  training: { id: string; title: string; state: string; dueOn: string | null; progress: { done: number; total: number; nextLessonId: string | null } | null }[];
  reading: { documentId: string; title: string; dueOn: string | null; overdue: boolean }[];
  qualifications: { id: string; name: string; expiresOn: string | null; state: string }[];
  shifts: { id: string; date: string; startMinutes: number; endMinutes: number; role: string; site: string; warnings: string[] }[];
  reviewsToAcknowledge: number;
  refresher: number;
};

/** What needs you, then your next shifts. Nothing from HR beyond a count. */
export default function HomePage() {
  const { data, error, reload } = useLoad<Home>("home");
  const todo = data ? data.training.filter((t) => t.state !== "submitted").length + data.reading.length + data.reviewsToAcknowledge + data.qualifications.length : 0;
  return (
    <Frame title="Home">
      <PageShell header={<PageHeader title={data ? `Hello, ${data.name.split(" ")[0]}` : "Hello"}
        description={data ? (todo === 0 ? "Nothing needs you right now." : `${todo} ${todo === 1 ? "thing needs" : "things need"} you.`) : undefined} />}>

        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : (
          <>
            {(() => {
              // The course they were part-way through, one tap from the next lesson.
              const going = data.training.find((t) => t.progress && t.progress.done > 0 && t.progress.nextLessonId && t.state !== "submitted");
              return going?.progress ? (
                <Link href={`/training/${going.id}/${going.progress.nextLessonId}`} className="notice first">
                  <PlayCircle aria-hidden="true" />
                  <span className="notice-body"><strong>Continue {going.title}</strong>{going.progress.done} of {going.progress.total} lessons done. Pick up where you left off.</span>
                  <ChevronRight className="pc-row-chevron" aria-hidden="true" />
                </Link>
              ) : null;
            })()}
            {data.refresher > 0 ? (
              <Link href="/training/refresher" className="notice">
                <Flame aria-hidden="true" />
                <span className="notice-body"><strong>Today’s refresher</strong>{data.refresher} {data.refresher === 1 ? "question" : "questions"} from your courses, about two minutes.</span>
                <ChevronRight className="pc-row-chevron" aria-hidden="true" />
              </Link>
            ) : null}
            {data.reviewsToAcknowledge > 0 ? (
              <Link href="/hr" className="notice first">
                <MessageCircle aria-hidden="true" />
                <span className="notice-body"><strong>A review was shared with you</strong>Open HR to read and acknowledge it. You’ll need a fresh code.</span>
                <ChevronRight className="pc-row-chevron" aria-hidden="true" />
              </Link>
            ) : null}

            <section className="pc-panel" aria-labelledby="home-training">
              <div className="pc-panel-head"><h2 id="home-training">Training</h2><Button asChild variant="ghost"><Link href="/training">All training<ChevronRight aria-hidden="true" /></Link></Button></div>
              {data.training.length === 0 ? <EmptyRows>No training to do.</EmptyRows> : (
                <ul className="pc-rows">{data.training.map((t) => (
                  <li key={t.id}><Link href={`/training/${t.id}`} className="pc-row">
                    <span className="pc-row-body"><span className="pc-row-title">{t.title}</span><span className="pc-row-hint">{[t.dueOn ? `Due ${day(t.dueOn)}` : "No deadline", t.progress ? `${t.progress.done} of ${t.progress.total} lessons` : null].filter(Boolean).join(" · ")}</span></span>
                    <span className="pc-row-trail"><Tag meta={TRAINING_META[t.state]} /><ChevronRight className="pc-row-chevron" aria-hidden="true" /></span>
                  </Link></li>
                ))}</ul>
              )}
            </section>

            <section className="pc-panel" aria-labelledby="home-reading">
              <div className="pc-panel-head"><h2 id="home-reading">Required reading</h2><Button asChild variant="ghost"><Link href="/reading">All reading<ChevronRight aria-hidden="true" /></Link></Button></div>
              {data.reading.length === 0 ? <EmptyRows>Nothing to read.</EmptyRows> : (
                <ul className="pc-rows">{data.reading.map((r) => (
                  <li key={r.documentId}><Link href={`/reading/${r.documentId}`} className="pc-row">
                    <span className="pc-row-body"><span className="pc-row-title">{r.title}</span><span className="pc-row-hint">{r.dueOn ? `Due ${day(r.dueOn)}` : "No deadline"}</span></span>
                    <span className="pc-row-trail"><Tag meta={r.overdue ? READING_META.overdue : READING_META.outstanding} /><ChevronRight className="pc-row-chevron" aria-hidden="true" /></span>
                  </Link></li>
                ))}</ul>
              )}
            </section>

            {data.qualifications.length > 0 ? (
              <section className="pc-panel" aria-labelledby="home-quals">
                <div className="pc-panel-head"><h2 id="home-quals">Qualifications</h2><Button asChild variant="ghost"><Link href="/qualifications">All<ChevronRight aria-hidden="true" /></Link></Button></div>
                <ul className="pc-rows">{data.qualifications.map((q) => (
                  <li key={q.id} className="pc-row">
                    <span className="pc-row-body"><span className="pc-row-title">{q.name}</span><span className="pc-row-hint">{q.state === "expired" ? "Expired" : "Expires"} {day(q.expiresOn)}</span></span>
                    <span className="pc-row-trail"><Tag meta={QUALIFICATION_META[q.state]} /></span>
                  </li>
                ))}</ul>
              </section>
            ) : null}

            <section className="pc-panel" aria-labelledby="home-shifts">
              <div className="pc-panel-head"><h2 id="home-shifts">Next shifts</h2><Button asChild variant="ghost"><Link href="/shifts">All shifts<ChevronRight aria-hidden="true" /></Link></Button></div>
              {data.shifts.length === 0 ? <EmptyRows>No shifts in the next week.</EmptyRows> : (
                <ul className="pc-rows">{data.shifts.map((s) => (
                  <li key={s.id} className="pc-row">
                    <span className="pc-row-body"><span className="pc-row-title">{day(s.date)} · {clock(s.startMinutes)} to {clock(s.endMinutes)}</span><span className="pc-row-hint">{s.role} at {s.site}</span></span>
                    {s.warnings.length > 0 ? <span className="pc-row-trail">{s.warnings.map((w) => <Tag key={w} meta={SHIFT_WARNING_META[w]} />)}</span> : null}
                  </li>
                ))}</ul>
              )}
            </section>
          </>
        )}
      </PageShell>
    </Frame>
  );
}
