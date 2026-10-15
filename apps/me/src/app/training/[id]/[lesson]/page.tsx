"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, FileText } from "lucide-react";
import { Frame } from "@/components/frame";
import { BookmarkButton, LessonNote, ReadAloud } from "@/components/learner";
import { LessonBody } from "@/components/lesson-body";
import type { LearnerQuestion } from "@/components/question";
import { AudioPlayer, CardDeck, Checklist, ScenarioPlayer, type Card, type Item, type Scene } from "@/components/lesson-kinds";
import { QuizRunner } from "@/components/quiz";
import { LoadError, Loading, Notice, useLoad } from "@/components/ui";
import { ApiError, api, apiFile } from "@/lib/api";

type Lesson = {
  id: string; kind: "READING" | "VIDEO" | "FILE" | "QUIZ" | "SCENARIO" | "FLASHCARDS" | "CHECKLIST" | "AUDIO"; title: string; body: unknown; minutes: number | null;
  video: { embed: string | null; href: string; provider: string } | null;
  file: { id: string; name: string; mime: string; size: number } | null;
  section: string; index: number; total: number; prev: string | null; next: string | null; done: boolean; open: boolean;
  questions: LearnerQuestion[] | null;
  checks: LearnerQuestion[];
  steps: Scene[] | null; cards: Card[] | null; items: Item[] | null;
  bookmarked: boolean; note: string;
};

/** Lessons the learner has to work through before Next opens. */
const WORKED = new Set<Lesson["kind"]>(["QUIZ", "SCENARIO", "FLASHCARDS", "CHECKLIST"]);

/** A lesson's file, fetched with the person's sign-in: images show in place,
 *  PDFs open in a new tab from a local copy. */
function LessonFile({ assignmentId, file }: { assignmentId: string; file: NonNullable<Lesson["file"]> }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let local: string | null = null, live = true;
    apiFile(`training/${assignmentId}/files/${file.id}`)
      .then((blob) => { if (live) { local = URL.createObjectURL(blob); setUrl(local); } })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; if (local) URL.revokeObjectURL(local); };
  }, [assignmentId, file.id]);
  if (failed) return <Notice title="This file didn’t load" tone="warning">Check your connection and open the lesson again.</Notice>;
  if (file.mime.startsWith("image/")) {
    // eslint-disable-next-line @next/next/no-img-element -- a private image from the staff API
    return url ? <img className="lesson-file-image" src={url} alt={file.name} /> : <span className="lesson-image-placeholder" role="img" aria-label="Loading image" />;
  }
  return url
    ? <a href={url} target="_blank" rel="noopener noreferrer" className="button outline block"><FileText aria-hidden="true" />Open {file.name}</a>
    : <span className="button outline block" aria-disabled="true"><FileText aria-hidden="true" />Getting the file…</span>;
}

/** One lesson, one screen: read or watch, then Next. Finishing it is saved on
 *  Turnfin straight away, so the course picks up here next time. */
export default function LessonPage() {
  const { id, lesson: lessonId } = useParams<{ id: string; lesson: string }>();
  const router = useRouter();
  const { data, error, reload } = useLoad<Lesson>(`training/${id}/lessons/${lessonId}`);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // A Quiz, Scenario, Flashcards or Checklist lesson counts as done once it has been worked through.
  const [workedOut, setWorkedOut] = useState<string | null>(null);
  // What Read aloud reads: the lesson's title and text.
  const readable = useRef<HTMLDivElement>(null);
  const finished = useCallback(() => { if (data) setWorkedOut(data.id); }, [data]);
  async function next() {
    if (!data) return;
    setFailure(null);
    if (data.done || !data.open) { router.push(data.next ? `/training/${id}/${data.next}` : `/training/${id}`); return; }
    setBusy(true);
    try {
      await api(`training/${id}/lessons/${lessonId}/complete`, { method: "POST" });
      router.push(data.next ? `/training/${id}/${data.next}` : `/training/${id}#done-title`);
    } catch (caught) {
      setFailure(caught instanceof ApiError ? caught.message : "That didn't save. Try again.");
      setBusy(false);
    }
  }
  const hasWork = !!data && ((data.kind === "QUIZ" && !!data.questions?.length) || (data.kind === "SCENARIO" && !!data.steps?.length)
    || (data.kind === "FLASHCARDS" && !!data.cards?.length) || (data.kind === "CHECKLIST" && !!data.items?.length));
  const waiting = !!data && WORKED.has(data.kind) && hasWork && data.open && !data.done && workedOut !== data.id;
  const waitText = !data ? "" : data.kind === "SCENARIO" ? "Reach the best ending to carry on." : data.kind === "FLASHCARDS" ? "Get to know every card to carry on."
    : data.kind === "CHECKLIST" ? "Tick off every item to carry on." : "Work through the questions to carry on.";
  const label = !data ? "" : !data.open || data.done ? (data.next ? "Next lesson" : "Back to the course")
    : data.next ? (data.kind === "VIDEO" ? "Watched it, next" : data.kind === "AUDIO" ? "Listened, next" : "Done, next lesson") : "Done, finish up";
  return (
    <Frame title="My training">
      <div className="stack">
        <Link href={`/training/${id}`} className="button ghost back-link"><ChevronLeft aria-hidden="true" />Course</Link>
        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : (
          <article className="stack" aria-labelledby="lesson-title">
            <div className="stack-sm">
              <p className="caption tabular">{data.section} · Lesson {data.index + 1} of {data.total}{data.minutes ? ` · ${data.minutes} min` : ""}</p>
              <progress className="course-progress" max={data.total} value={data.index + (data.done ? 1 : 0)} aria-label="Through the course" />
              <h1 id="lesson-title">{data.title}</h1>
            </div>
            <div className="lesson-tools">
              <BookmarkButton key={`b-${data.id}`} assignmentId={id} lessonId={data.id} initial={data.bookmarked} />
              {data.body || data.kind === "SCENARIO" || data.kind === "FLASHCARDS" ? <ReadAloud key={`r-${data.id}`} target={readable} /> : null}
            </div>
            {data.video?.embed ? (
              <div className="lesson-video"><iframe src={data.video.embed} title={`Video: ${data.title}`} allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>
            ) : data.video ? (
              <a href={data.video.href} target="_blank" rel="noopener noreferrer" className="button outline block"><ExternalLink aria-hidden="true" />Watch on {data.video.provider}</a>
            ) : null}
            {data.kind === "AUDIO" && data.file ? <AudioPlayer assignmentId={id} fileId={data.file.id} title={data.title} />
              : data.file ? <LessonFile assignmentId={id} file={data.file} /> : null}
            <div ref={readable} className="stack">
            {data.body ? <section className="pc-panel"><LessonBody body={data.body} assignmentId={id} checks={{ lessonId: data.id, questions: data.checks ?? [] }} /></section> : null}
            {data.kind === "QUIZ" ? <QuizRunner assignmentId={id} lessonId={data.id} questions={data.questions ?? []} key={data.id} onFinished={finished} /> : null}
            {data.kind === "SCENARIO" ? <ScenarioPlayer assignmentId={id} steps={data.steps ?? []} key={data.id} onFinished={finished} /> : null}
            {data.kind === "FLASHCARDS" ? <CardDeck assignmentId={id} cards={data.cards ?? []} key={data.id} onFinished={finished} /> : null}
            {data.kind === "CHECKLIST" ? <Checklist storageKey={`me-checklist-${id}-${data.id}`} items={data.items ?? []} key={data.id} onFinished={finished} /> : null}
            </div>
            {failure ? <Notice title={failure} tone="error" live /> : null}
            {waiting ? <p className="caption muted" id="quiz-wait">{waitText}</p> : null}
            <div className="lesson-nav">
              {data.prev ? <Link href={`/training/${id}/${data.prev}`} className="button outline"><ChevronLeft aria-hidden="true" />Back</Link> : <span />}
              <button type="button" className="button" onClick={next} disabled={busy || waiting} aria-describedby={waiting ? "quiz-wait" : undefined}>{busy ? "Saving…" : label}<ChevronRight aria-hidden="true" /></button>
            </div>
            <LessonNote key={`n-${data.id}`} assignmentId={id} lessonId={data.id} initial={data.note} />
          </article>
        )}
      </div>
    </Frame>
  );
}
