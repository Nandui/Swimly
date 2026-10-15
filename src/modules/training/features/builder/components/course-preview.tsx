import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleCheck, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Progress } from "@/components/shadcn/progress";
import { Notice } from "@/components/ui-kit/notice";
import { cn } from "@/lib/utils";
import { LessonBody } from "@/modules/training/shared/components/lesson-body";
import { fileSrc, LESSON_KIND_META, lessonMinutes, lessonPlace, outlineLessons, videoFor, type Outline } from "@/modules/training/shared/lessons";
import { paperSize, QUESTION_KIND_META, type Question } from "@/modules/training/shared/questions";

/** Every question with its right answer, for the author. Learners get one at a time and never the key. */
function QuestionsPreview({ questions }: { questions: Question[] }) {
  if (!questions.length) return <Notice tone="warning" title="This section has no questions yet" />;
  return (
    <ol className="pc-rows">
      {questions.map((q, i) => (
        <li key={q.id} className="pc-row items-start">
          <span className="pc-row-body gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ui-muted-foreground">{i + 1} · {QUESTION_KIND_META[q.kind].label}</span>
            <span className="pc-row-title">{q.prompt}</span>
            {/* eslint-disable-next-line @next/next/no-img-element -- a private file served by this app */}
            {q.imageId ? <img src={fileSrc(q.imageId)} alt="" loading="lazy" className="max-h-48 w-fit rounded-[var(--pc-radius-card)]" /> : null}
            <ul className="flex flex-col gap-1 text-sm">
              {q.options.map((o, n) => (
                <li key={o.id} className={cn("flex items-center gap-2", o.correct && "font-semibold")}>
                  {o.correct ? <CircleCheck aria-label="Right answer" className="size-4 text-ui-primary" /> : <span className="size-4" aria-hidden="true" />}
                  {q.kind === "ORDER" ? `${n + 1}. ${o.text}` : q.kind === "MATCH" ? `${o.text} → ${o.match}` : o.text || "A picture"}
                </li>
              ))}
            </ul>
            {q.explanation ? <span className="pc-row-hint">Why: {q.explanation}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** The draft as a learner sees it in Turnfin Me: one lesson per screen with
 *  Back and Next, and the outline beside it. Nothing here records progress. */
export function CoursePreview({ courseId, outline, lessonId, requiresSignoff }: { courseId: string; outline: Outline; lessonId: string | null; requiresSignoff: boolean }) {
  const lessons = outlineLessons(outline);
  const place = lessonPlace(outline, lessonId ?? lessons[0]?.id ?? "");
  const href = (id: string) => `/training/courses/${courseId}/preview?lesson=${id}`;
  if (!place) return <Notice title="Nothing to preview yet">Add a lesson to the course first.</Notice>;
  const { lesson, section, index, total, prev, next } = place;
  const video = lesson.kind === "VIDEO" ? videoFor(lesson.videoUrl) : null;
  const minutes = lessonMinutes(lesson);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_var(--pc-rail-width)] items-start">
      <article className="pc-panel flex flex-col gap-5" aria-labelledby="preview-lesson">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ui-muted-foreground">{section.title} · lesson {index + 1} of {total}{minutes ? ` · ${minutes} min` : ""}</p>
          <Progress value={Math.round((index / total) * 100)} aria-label="Through the course" />
          <h2 id="preview-lesson" className="text-[length:var(--pc-text-page)] leading-[var(--pc-leading-page)]">{lesson.title}</h2>
        </div>
        {video?.embed ? (
          <div className="tf-video"><iframe src={video.embed} title={`Video: ${lesson.title}`} allow="encrypted-media; picture-in-picture; fullscreen" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /></div>
        ) : video ? (
          <Button asChild variant="outline" className="min-h-11 self-start"><a href={video.href} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />Watch on {video.provider}</a></Button>
        ) : null}
        {lesson.kind === "FILE" && lesson.fileId ? (
          <Button asChild variant="outline" className="min-h-11 self-start"><a href={`/training/files/${lesson.fileId}`} target="_blank" rel="noopener noreferrer"><FileText aria-hidden="true" />Open the file</a></Button>
        ) : null}
        <LessonBody body={lesson.body} />
        {lesson.kind === "QUIZ" ? (
          <div className="flex flex-col gap-3">
            <Notice title="Learners answer these one at a time">They see straight away whether they got each one right. Here you see every question with its answer.</Notice>
            <QuestionsPreview questions={outline.questions.filter((q) => q.sectionId === section.id)} />
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ui-border pt-4">
          {prev ? <Button asChild variant="outline" className="min-h-11"><Link href={href(prev)}><ArrowLeft aria-hidden="true" />Back</Link></Button> : <span />}
          {next ? (
            <Button asChild className="min-h-11"><Link href={href(next)}>{lesson.kind === "VIDEO" ? "Watched it, next" : "Done, next lesson"}<ArrowRight aria-hidden="true" /></Link></Button>
          ) : (
            <span className="text-sm text-ui-muted-foreground">Last lesson. The learner then {outline.exam
              ? `sits the final exam: ${paperSize(outline.exam, outline.questions.length)} questions, pass mark ${outline.exam.passMark}%${requiresSignoff ? ", then asks a trainer to sign it off" : ""}`
              : requiresSignoff ? "asks a trainer to sign it off" : "marks the course as done"}.</span>
          )}
        </div>
      </article>
      <nav aria-label="Course outline" className="pc-panel flex flex-col gap-4">
        {outline.sections.map((s) => (
          <div key={s.id} className="flex flex-col gap-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ui-muted-foreground">{s.title}</h3>
            <ol className="flex flex-col gap-1">
              {s.lessons.map((l) => {
                const Icon = l.id === lesson.id ? CircleCheck : LESSON_KIND_META[l.kind].icon;
                return (
                  <li key={l.id}><Link href={href(l.id)} aria-current={l.id === lesson.id ? "page" : undefined} className={cn("tf-outline-row", l.id === lesson.id && "is-current")}>
                    <Icon aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{l.title}</span>
                  </Link></li>
                );
              })}
            </ol>
          </div>
        ))}
      </nav>
    </div>
  );
}
