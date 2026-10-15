"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, CircleCheck, FileText, PlayCircle, Send } from "lucide-react";
import { Frame } from "@/components/frame";
import { LoadError, Loading, Notice, Tag, useLoad } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { date, day } from "@/lib/format";
import { TRAINING_META } from "@/lib/meta";

const KIND_LABEL = { READING: "Reading", VIDEO: "Video", FILE: "Document" } as const;
type Lesson = { id: string; kind: "READING" | "VIDEO" | "FILE"; title: string; minutes: number | null; done: boolean };
type Detail = {
  id: string; title: string; summary: string; content: string; state: string; requiresSignoff: boolean; grants: string | null;
  dueOn: string | null; assignedBy: string; assignedAt: string; completedAt: string | null; signedOffBy: string | null; trainerNote: string;
  progress: { done: number; total: number; nextLessonId: string | null } | null;
  sections: { id: string; title: string; lessons: Lesson[] }[] | null;
};

const KIND_ICON = { READING: BookOpen, VIDEO: PlayCircle, FILE: FileText };

/** One course: where you are, the lessons, and finishing it. A course from
 *  before lessons shows its text and "Mark as done", as it always did. */
export default function TrainingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, setData, error, reload } = useLoad<Detail>(`training/${id}`);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // The outcome Notice is announced only when this visit just produced it.
  const [justDone, setJustDone] = useState(false);
  async function complete() {
    setBusy(true); setFailure(null);
    try { setData(await api<Detail>(`training/${id}/complete`, { method: "POST", body: { note } })); setJustDone(true); }
    catch (caught) { setFailure(caught instanceof ApiError ? caught.message : "That didn't save. Try again."); }
    finally { setBusy(false); }
  }
  const open = data?.state === "assigned" || data?.state === "overdue";
  const lessons = data?.sections?.flatMap((s) => s.lessons) ?? [];
  const next = lessons.find((l) => l.id === data?.progress?.nextLessonId) ?? null;
  const allDone = !data?.sections || !next;
  const minutesLeft = lessons.filter((l) => !l.done).reduce((n, l) => n + (l.minutes ?? 0), 0);
  return (
    <Frame title="My training">
      <div className="stack">
        <Link href="/training" className="button ghost back-link"><ChevronLeft aria-hidden="true" />My training</Link>
        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : (
          <>
            <div className="stack-sm">
              <div className="row"><h1>{data.title}</h1><Tag meta={TRAINING_META[data.state]} /></div>
              {data.summary ? <p className="muted">{data.summary}</p> : null}
              <p className="caption">
                {[`Assigned by ${data.assignedBy} on ${date(data.assignedAt)}`, data.dueOn ? `due ${day(data.dueOn)}` : null,
                  data.requiresSignoff ? "a trainer signs this off in person" : null, data.grants ? `records your ${data.grants}` : null].filter(Boolean).join(" · ")}
              </p>
            </div>
            {data.state === "submitted" ? <Notice title="Waiting for sign-off" live={justDone}>A trainer will watch you do it and sign it off.</Notice> : null}
            {data.state === "completed" ? <Notice title={`Completed ${date(data.completedAt)}`} live={justDone}>{data.signedOffBy ? `Signed off by ${data.signedOffBy}.${data.trainerNote ? ` ${data.trainerNote}` : ""}` : "Well done."}</Notice> : null}
            {open && data.trainerNote ? <Notice title={`Not signed off yet${data.signedOffBy ? ` by ${data.signedOffBy}` : ""}`} tone="warning">{data.trainerNote}</Notice> : null}

            {data.sections && data.progress ? (
              <>
                {open && next ? (
                  <section className="pc-panel course-hero" aria-labelledby="continue-title">
                    <div className="stack-sm">
                      <h2 id="continue-title">{data.progress.done === 0 ? "Ready when you are" : "Pick up where you left off"}</h2>
                      <p className="muted tabular">{data.progress.done} of {data.progress.total} lessons done{minutesLeft ? ` · about ${minutesLeft} min left` : ""}</p>
                      <progress className="course-progress" max={data.progress.total} value={data.progress.done} aria-label="Lessons done" />
                    </div>
                    <Link href={`/training/${data.id}/${next.id}`} className="button block">
                      {data.progress.done === 0 ? "Start" : "Continue"}: {next.title}<ChevronRight aria-hidden="true" />
                    </Link>
                  </section>
                ) : null}
                {data.sections.map((section, si) => (
                  <section key={section.id} className="pc-panel" aria-labelledby={`section-${section.id}`}>
                    <div className="pc-panel-head"><h2 id={`section-${section.id}`}><span className="muted tabular">{si + 1}.</span> {section.title}</h2></div>
                    <ol className="pc-rows">
                      {section.lessons.map((lesson) => {
                        const Icon = lesson.done ? CircleCheck : KIND_ICON[lesson.kind];
                        return (
                          <li key={lesson.id}><Link href={`/training/${data.id}/${lesson.id}`} className="pc-row lesson-row" data-done={lesson.done || undefined}>
                            <span className="pc-tile-icon"><Icon aria-hidden="true" /></span>
                            <span className="pc-row-body"><span className="pc-row-title">{lesson.title}</span>
                              <span className="pc-row-hint">{[lesson.done ? "Done" : null, lesson.minutes ? `${lesson.minutes} min` : null].filter(Boolean).join(" · ") || KIND_LABEL[lesson.kind]}</span></span>
                            <ChevronRight className="pc-row-chevron" aria-hidden="true" />
                          </Link></li>
                        );
                      })}
                    </ol>
                  </section>
                ))}
              </>
            ) : (
              <section className="pc-panel" aria-labelledby="material">
                <h2 id="material">What to do</h2>
                {data.content ? <p className="pre">{data.content}</p> : <p className="muted">Your trainer will go through this with you.</p>}
              </section>
            )}

            {open && allDone ? (
              <section className="pc-panel" aria-labelledby="done-title">
                <h2 id="done-title">{data.sections ? (data.requiresSignoff ? "All lessons done. Ready to show your trainer?" : "All lessons done") : data.requiresSignoff ? "Ready for sign-off?" : "Done it?"}</h2>
                <div className="field">
                  <label htmlFor="note">{data.requiresSignoff ? "Note for your trainer (optional)" : "Note (optional)"}</label>
                  <textarea id="note" className="input" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
                  {data.requiresSignoff ? <span className="hint">For example, when you are next on shift to show it.</span> : null}
                </div>
                {failure ? <Notice title={failure} tone="error" live /> : null}
                <button type="button" className="button block" onClick={complete} disabled={busy}>
                  {data.requiresSignoff ? <><Send aria-hidden="true" />Ask for sign-off</> : <><CircleCheck aria-hidden="true" />{data.sections ? "Finish the course" : "Mark as done"}</>}
                </button>
              </section>
            ) : null}
          </>
        )}
      </div>
    </Frame>
  );
}
