"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Award, BookOpen, ChevronLeft, ChevronRight, CircleCheck, ClipboardCheck, FileText, GitBranch, GraduationCap, Headphones, Layers, ListChecks, ListTodo, PlayCircle, Send } from "lucide-react";
import { Frame } from "@/components/frame";
import { RateCourse } from "@/components/learner";
import { CourseImage, type ExamInfo } from "@/components/question";
import { LoadError, Loading, Notice, Tag, useLoad } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { date, day } from "@/lib/format";
import { EXAM_RESULT_META, TRAINING_META } from "@/lib/meta";

const KIND_LABEL = {
  READING: "Reading", VIDEO: "Video", FILE: "Document", QUIZ: "Practice questions",
  SCENARIO: "Scenario", FLASHCARDS: "Flashcards", CHECKLIST: "Checklist", AUDIO: "Recording",
} as const;
type Lesson = { id: string; kind: keyof typeof KIND_LABEL; title: string; minutes: number | null; done: boolean };
type Detail = {
  id: string; title: string; summary: string; content: string; state: string; requiresSignoff: boolean; grants: string | null;
  dueOn: string | null; assignedBy: string; assignedAt: string; completedAt: string | null; signedOffBy: string | null; trainerNote: string;
  progress: { done: number; total: number; nextLessonId: string | null } | null;
  sections: { id: string; title: string; lessons: Lesson[] }[] | null;
  exam: ExamInfo | null;
  coverId: string | null; category: string;
  whatsNew: { number: number; note: string } | null;
  practical: Practical | null;
  canRate: boolean; feedback: { rating: number; unclear: string } | null;
};
type Practical = {
  steps: { id: string; text: string; critical: boolean }[];
  last: { observedBy: string; observedAt: string; steps: { id: string; text: string; result: "met" | "not-yet" | "na"; note: string }[] } | null;
};

/** What the trainer will watch for at the practical sign-off, and how the
 *  last observation went, so nothing on the day is a surprise. */
function PracticalCard({ practical, open }: { practical: Practical; open: boolean }) {
  const last = new Map(practical.last?.steps.map((s) => [s.id, s]) ?? []);
  const toPractise = practical.last?.steps.filter((s) => s.result === "not-yet") ?? [];
  return (
    <section className="pc-panel stack-sm" aria-labelledby="practical-title">
      <div className="row"><span className="pc-tile-icon"><ClipboardCheck aria-hidden="true" /></span><h2 id="practical-title">What the trainer will watch for</h2></div>
      {open && toPractise.length ? <Notice title="To practise from last time" tone="warning">{toPractise.map((s) => `${s.text}${s.note ? ` (${s.note})` : ""}`).join("; ")}</Notice> : null}
      <ol className="pc-rows">
        {practical.steps.map((step, i) => {
          const was = last.get(step.id);
          return (
            <li key={step.id} className="pc-row">
              <span className="pc-tile-icon tabular" aria-hidden="true">{was?.result === "met" ? <CircleCheck /> : i + 1}</span>
              <span className="pc-row-body">
                <span className="pc-row-title">{step.text}</span>
                <span className="pc-row-hint">{[step.critical ? "Must be seen" : null, was ? (was.result === "met" ? "Met last time" : was.result === "not-yet" ? "Not met yet" : "Not needed last time") : null].filter(Boolean).join(" · ") || "Shown on the day"}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {practical.last ? <p className="caption">Last observed by {practical.last.observedBy} on {date(practical.last.observedAt)}.</p> : null}
    </section>
  );
}

const KIND_ICON = {
  READING: BookOpen, VIDEO: PlayCircle, FILE: FileText, QUIZ: ListChecks,
  SCENARIO: GitBranch, FLASHCARDS: Layers, CHECKLIST: ListTodo, AUDIO: Headphones,
};

/** The course's final exam: its rules, the way in, and past attempts. */
function ExamCard({ id, exam, open }: { id: string; exam: ExamInfo; open: boolean }) {
  const facts = [`${exam.questions} questions`, `pass mark ${exam.passMark}%`, exam.timeLimit ? `${exam.timeLimit} minutes` : null,
    open && !exam.passed ? `${exam.attempts.left} ${exam.attempts.left === 1 ? "attempt" : "attempts"} left` : null].filter(Boolean).join(" · ");
  return (
    <section className="pc-panel stack-sm" aria-labelledby="exam-title">
      <div className="row"><span className="pc-tile-icon"><GraduationCap aria-hidden="true" /></span><h2 id="exam-title">Final exam</h2>
        {exam.passed ? <Tag meta={EXAM_RESULT_META.passed} /> : null}</div>
      <p className="muted tabular">{facts}</p>
      {open && !exam.passed ? (
        exam.open ? (
          <Link href={`/training/${id}/exam`} className="button block">Carry on with the exam: {exam.open.answered} of {exam.open.total} answered<ChevronRight aria-hidden="true" /></Link>
        ) : exam.canStart ? (
          <>
            {exam.testOut && !exam.lessonsDone ? <p className="caption">Already know this? Pass the exam now and you can skip the lessons.</p> : null}
            <Link href={`/training/${id}/exam`} className="button block">{exam.attempts.used ? "Try the exam again" : "Start the exam"}<ChevronRight aria-hidden="true" /></Link>
          </>
        ) : <p className="caption">{exam.reason}</p>
      ) : null}
      {exam.history.length ? (
        <ol className="pc-rows">
          {exam.history.map((a) => (
              <li key={a.number}><Link href={`/training/${id}/exam/${a.number}`} className="pc-row">
                <span className="pc-row-body"><span className="pc-row-title tabular">Attempt {a.number}: {a.percent}%</span><span className="pc-row-hint tabular">{a.correct} of {a.total} right · {date(a.submittedAt)}</span></span>
                <Tag meta={EXAM_RESULT_META[a.passed ? "passed" : "failed"]} />
                <ChevronRight className="pc-row-chevron" aria-hidden="true" />
              </Link></li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

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
  const allDone = (!data?.sections || !next) && (!data?.exam || data.exam.passed);
  const examFirst = !!data?.exam && open && (!next || (data.exam.testOut && data.exam.canStart) || !!data.exam.open);
  const minutesLeft = lessons.filter((l) => !l.done).reduce((n, l) => n + (l.minutes ?? 0), 0);
  return (
    <Frame title="My training">
      <div className="stack">
        <Link href="/training" className="button ghost back-link"><ChevronLeft aria-hidden="true" />My training</Link>
        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : (
          <>
            {data.coverId ? <CourseImage assignmentId={data.id} fileId={data.coverId} alt="" className="course-cover" /> : null}
            <div className="stack-sm">
              {data.category ? <p className="caption eyebrow">{data.category}</p> : null}
              <div className="row"><h1>{data.title}</h1><Tag meta={TRAINING_META[data.state]} /></div>
              {data.summary ? <p className="muted">{data.summary}</p> : null}
              <p className="caption">
                {[`Assigned by ${data.assignedBy} on ${date(data.assignedAt)}`, data.dueOn ? `due ${day(data.dueOn)}` : null,
                  data.requiresSignoff ? "a trainer signs this off in person" : null, data.grants ? `records your ${data.grants}` : null].filter(Boolean).join(" · ")}
              </p>
            </div>
            {open && data.whatsNew ? <Notice title={`What’s new in version ${data.whatsNew.number}`}>{data.whatsNew.note}</Notice> : null}
            {data.state === "submitted" ? <Notice title="Waiting for sign-off" live={justDone}>A trainer will watch you do it and sign it off.</Notice> : null}
            {data.state === "completed" ? <Notice title={`Completed ${date(data.completedAt)}`} live={justDone}>{data.signedOffBy ? `Signed off by ${data.signedOffBy}.${data.trainerNote ? ` ${data.trainerNote}` : ""}` : "Well done."}</Notice> : null}
            {data.state === "completed" ? <Link href={`/training/${data.id}/certificate`} className="button outline block"><Award aria-hidden="true" />Your certificate</Link> : null}
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
                {data.exam && examFirst ? <ExamCard id={data.id} exam={data.exam} open={open} /> : null}
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
                {data.exam && !examFirst ? <ExamCard id={data.id} exam={data.exam} open={open} /> : null}
              </>
            ) : (
              <section className="pc-panel" aria-labelledby="material">
                <h2 id="material">What to do</h2>
                {data.content ? <p className="pre">{data.content}</p> : <p className="muted">Your trainer will go through this with you.</p>}
              </section>
            )}

            {data.canRate ? <RateCourse key={data.id} assignmentId={data.id} initial={data.feedback} /> : null}
            {data.practical ? <PracticalCard practical={data.practical} open={open && !data.trainerNote} /> : null}

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
