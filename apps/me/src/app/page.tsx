"use client";

import Link from "next/link";
import { BookOpen, ChevronRight, CircleCheck, Flame, GraduationCap, MessageCircle, PlayCircle, ShieldCheck } from "lucide-react";
import { Frame } from "@/components/frame";
import { LoadError, Loading, Tag, useLoad } from "@/components/ui";
import { clock, day } from "@/lib/format";
import { QUALIFICATION_META, READING_META, SHIFT_WARNING_META, TRAINING_META } from "@/lib/meta";
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

/** Home in the phone frame (DESIGN.md; the approved canvas's phone Home): what needs the person
 *  first, as one grouped list (the course they were part-way through, today's refresher, a review
 *  to acknowledge, training to do, reading due and certificates running out), then their next
 *  shifts. Training waiting for a manager's sign-off needs nothing from them, so it stays in
 *  Training. Nothing from HR beyond a count. */
export default function HomePage() {
  const { data, error, reload } = useLoad<Home>("home");
  const toDo = data ? data.training.filter((t) => t.state !== "submitted") : [];
  const todo = data ? toDo.length + data.reading.length + data.reviewsToAcknowledge + data.qualifications.length : 0;
  // The course they were part-way through, one tap from the next lesson.
  const going = toDo.find((t) => t.progress && t.progress.done > 0 && t.progress.nextLessonId);
  return (
    <Frame title="Home">
      <PageShell spacing="roomy" header={<PageHeader title={data ? `Hello, ${data.name.split(" ")[0]}` : "Hello"}
        description={data ? (todo === 0 ? "Nothing needs you right now." : `${todo} ${todo === 1 ? "thing needs" : "things need"} you.`) : undefined} />}>

        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : (
          <>
            <section aria-labelledby="home-needs" className="flex min-w-0 flex-col">
              <div className="pc-section-head"><h2 id="home-needs">Needs you</h2>{todo ? <p>{todo}</p> : null}</div>
              <ul className="pc-list">
                {going?.progress ? (
                  <li><Link href={`/training/${going.id}/${going.progress.nextLessonId}`} className="pc-row">
                    <span className="pc-tile-icon"><PlayCircle aria-hidden="true" /></span>
                    <span className="pc-row-body"><span className="font-semibold">Continue {going.title}</span><span className="pc-row-hint">{going.progress.done} of {going.progress.total} lessons done</span></span>
                    <ChevronRight className="pc-row-chevron" aria-hidden="true" />
                  </Link></li>
                ) : null}
                {data.refresher > 0 ? (
                  <li><Link href="/training/refresher" className="pc-row">
                    <span className="pc-tile-icon" data-tone="orange"><Flame aria-hidden="true" /></span>
                    <span className="pc-row-body"><span>Today’s refresher</span><span className="pc-row-hint">{data.refresher} {data.refresher === 1 ? "question" : "questions"} from your courses, about two minutes</span></span>
                    <ChevronRight className="pc-row-chevron" aria-hidden="true" />
                  </Link></li>
                ) : null}
                {data.reviewsToAcknowledge > 0 ? (
                  <li><Link href="/hr" className="pc-row">
                    <span className="pc-tile-icon" data-tone="orange"><MessageCircle aria-hidden="true" /></span>
                    <span className="pc-row-body"><span>A review was shared with you</span><span className="pc-row-hint">Read and acknowledge it in HR. You’ll need a fresh code.</span></span>
                    <ChevronRight className="pc-row-chevron" aria-hidden="true" />
                  </Link></li>
                ) : null}
                {toDo.filter((t) => t.id !== going?.id).map((t) => (
                  <li key={t.id}><Link href={`/training/${t.id}`} className="pc-row">
                    <span className="pc-tile-icon" data-tone={t.state === "overdue" ? "red" : undefined}><GraduationCap aria-hidden="true" /></span>
                    <span className="pc-row-body"><span>{t.title}</span><span className="pc-row-hint">{[t.dueOn ? `Due ${day(t.dueOn)}` : "No deadline", t.progress ? `${t.progress.done} of ${t.progress.total} lessons` : null].filter(Boolean).join(" · ")}</span></span>
                    <Tag meta={TRAINING_META[t.state]} />
                    <ChevronRight className="pc-row-chevron" aria-hidden="true" />
                  </Link></li>
                ))}
                {data.reading.map((r) => (
                  <li key={r.documentId}><Link href={`/reading/${r.documentId}`} className="pc-row">
                    <span className="pc-tile-icon" data-tone={r.overdue ? "red" : undefined}><BookOpen aria-hidden="true" /></span>
                    <span className="pc-row-body"><span>{r.title}</span><span className="pc-row-hint">{r.dueOn ? `Due ${day(r.dueOn)}` : "No deadline"}</span></span>
                    <Tag meta={r.overdue ? READING_META.overdue : READING_META.outstanding} />
                    <ChevronRight className="pc-row-chevron" aria-hidden="true" />
                  </Link></li>
                ))}
                {data.qualifications.map((q) => (
                  <li key={q.id}><Link href="/qualifications" className="pc-row">
                    <span className="pc-tile-icon" data-tone={q.state === "expired" ? "red" : "orange"}><ShieldCheck aria-hidden="true" /></span>
                    <span className="pc-row-body"><span>{q.name}</span><span className="pc-row-hint" data-tone={q.state === "expired" ? undefined : "orange"}>{QUALIFICATION_META[q.state].label} · {day(q.expiresOn)}</span></span>
                    <ChevronRight className="pc-row-chevron" aria-hidden="true" />
                  </Link></li>
                ))}
                {todo === 0 && !going && data.refresher === 0 ? (
                  <li><div className="pc-row">
                    <span className="pc-tile-icon" data-tone="green"><CircleCheck aria-hidden="true" /></span>
                    <span className="pc-row-body"><span>Nothing needs you right now</span><span className="pc-row-hint">Training, reading and certificates that need you show here.</span></span>
                  </div></li>
                ) : null}
              </ul>
            </section>

            <section aria-labelledby="home-shifts" className="flex min-w-0 flex-col">
              <div className="pc-section-head"><h2 id="home-shifts">Next shifts</h2><Link href="/shifts" className="text-subheadline text-(--accent)">All shifts</Link></div>
              <ul className="pc-list">
                {data.shifts.length === 0 ? (
                  <li><div className="pc-row"><span className="pc-row-body"><span className="text-(--label-2)">No shifts in the next week.</span></span></div></li>
                ) : data.shifts.map((s) => (
                  <li key={s.id}><div className="pc-row">
                    <span className="me-when"><span className="font-semibold">{day(s.date)}</span><span className="pc-row-hint">{clock(s.startMinutes)} to {clock(s.endMinutes)}</span></span>
                    <span className="pc-row-body"><span>{s.role}</span><span className="pc-row-hint">{s.site}</span></span>
                    {s.warnings.map((w) => <Tag key={w} meta={SHIFT_WARNING_META[w]} />)}
                  </div></li>
                ))}
              </ul>
            </section>
          </>
        )}
      </PageShell>
    </Frame>
  );
}
