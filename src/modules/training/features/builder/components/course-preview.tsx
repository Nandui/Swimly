import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleCheck, ExternalLink, FileText, Flag, MapPin } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Progress } from "@/components/shadcn/progress";
import { Notice } from "@/components/ui-kit/notice";
import { cn } from "@/lib/utils";
import { LessonBody } from "@/modules/training/shared/components/lesson-body";
import { embedFor, fileSrc, LESSON_KIND_META, lessonMinutes, lessonPlace, outlineLessons, videoFor, type Outline } from "@/modules/training/shared/lessons";
import { blankedPrompt, paperSize, QUESTION_KIND_META, type Question } from "@/modules/training/shared/questions";
import type { LessonData } from "@/modules/training/shared/lessons";

/** Every question with its right answer, for the author. Learners get one at a time and never the key. */
function QuestionsPreview({ questions }: { questions: Question[] }) {
  if (!questions.length) return <Notice tone="warning" title="This section has no questions yet" />;
  return (
    <ol className="pc-rows">
      {questions.map((q, i) => (
        <li key={q.id} className="pc-row items-start">
          <span className="pc-row-body gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-ui-muted-foreground">{i + 1} · {QUESTION_KIND_META[q.kind].label}</span>
            <span className="pc-row-title">{q.kind === "FILL_BLANK" ? blankedPrompt(q.prompt) : q.prompt}</span>
            {q.kind === "HOTSPOT" && q.imageId ? (
              <span className="tf-spot-frame is-static">
                {/* eslint-disable-next-line @next/next/no-img-element -- a private file served by this app */}
                <img src={fileSrc(q.imageId)} alt="" loading="lazy" />
                {q.options.map((o, n) => o.area ? <span key={o.id} className="tf-spot-area" style={{ left: `${o.area.x}%`, top: `${o.area.y}%`, width: `${o.area.w}%`, height: `${o.area.h}%` }}><span className="tf-spot-number">{n + 1}</span></span> : null)}
              </span>
            /* eslint-disable-next-line @next/next/no-img-element -- a private file served by this app */
            ) : q.imageId ? <img src={fileSrc(q.imageId)} alt="" loading="lazy" className="max-h-48 w-fit rounded-[var(--pc-radius-card)]" /> : null}
            {q.kind === "NUMBER" ? <span className="text-sm font-semibold">Right: {q.options[0]?.text}{q.options[0]?.unit ? ` ${q.options[0].unit}` : ""}{Number(q.options[0]?.match) ? `, give or take ${q.options[0].match}` : ""}</span> : null}
            {q.kind === "HOTSPOT" || q.kind === "NUMBER" ? null : <ul className="flex flex-col gap-1 text-sm">
              {q.options.map((o, n) => (
                <li key={o.id} className={cn("flex items-center gap-2", o.correct && "font-semibold")}>
                  {o.correct ? <CircleCheck aria-label="Right answer" className="size-4 text-ui-primary" /> : <span className="size-4" aria-hidden="true" />}
                  {q.kind === "ORDER" ? `${n + 1}. ${o.text}` : q.kind === "MATCH" ? `${o.text} → ${o.match}` : q.kind === "FILL_BLANK" ? `Blank ${n + 1}: ${o.text}` : o.text || "A picture"}
                </li>
              ))}
            </ul>}
            {q.explanation ? <span className="pc-row-hint">Why: {q.explanation}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** A Scenario, Flashcards or Checklist lesson laid out for its author: every
 *  scene with where each choice leads, every card front and back, every item. */
function DataPreview({ kind, data, fileId }: { kind: string; data: LessonData | null; fileId: string | null }) {
  if (kind === "SCENARIO") {
    const steps = data?.steps ?? [];
    return (
      <div className="flex flex-col gap-3">
        <Notice title="Learners play this one scene at a time">They choose, see what happened, and carry on until they reach the best outcome. Here you see the whole map.</Notice>
        <ol className="flex flex-col gap-3">
          {steps.map((step, i) => (
            <li key={step.id} className="rounded-[var(--pc-radius-card)] bg-ui-muted p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ui-muted-foreground">Scene {i + 1}{i === 0 ? " · start" : ""}</p>
              <p className="whitespace-pre-line">{step.text}</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- a private file served by this app */}
              {step.imageId ? <img src={fileSrc(step.imageId)} alt="" loading="lazy" className="mt-2 max-h-48 w-fit rounded-[var(--pc-radius-card)]" /> : null}
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {step.choices.map((c) => {
                  const to = c.next ? steps.findIndex((s) => s.id === c.next) + 1 : 0;
                  return (
                    <li key={c.id} className="flex items-start gap-2">
                      {c.next ? <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : <Flag aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
                      <span><strong>{c.text}</strong> → {c.next ? `scene ${to}` : c.best ? "ends: best outcome" : "ends: try again"}{c.feedback ? `. ${c.feedback}` : ""}</span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    );
  }
  if (kind === "FLASHCARDS") {
    return (
      <ul className="tf-flip-cards">
        {(data?.cards ?? []).map((c) => (
          <li key={c.id} className="tf-flip-card">
            <div className="tf-flip-front">
              {/* eslint-disable-next-line @next/next/no-img-element -- a private file served by this app */}
              {c.imageId ? <img src={fileSrc(c.imageId)} alt="" loading="lazy" /> : null}
              <p>{c.front}</p>
            </div>
            <div className="tf-flip-back"><p>{c.back}</p></div>
          </li>
        ))}
      </ul>
    );
  }
  if (kind === "SORTING") {
    const groups = data?.groups ?? [], sorts = data?.sorts ?? [];
    return (
      <div className="flex flex-col gap-3">
        <Notice title="Learners get these shuffled">They put each one in a group and check. Here you see where each one belongs.</Notice>
        <div className="tf-sort-groups">
          {groups.map((g) => (
            <section key={g.id} className="flex flex-col gap-2 rounded-[var(--pc-radius-card)] bg-ui-muted p-4" aria-label={g.name}>
              <h3 className="font-semibold">{g.name}</h3>
              <ul className="flex flex-col gap-1 text-sm">{sorts.filter((i) => i.group === g.id).map((i) => <li key={i.id}>{i.text}</li>)}</ul>
            </section>
          ))}
        </div>
      </div>
    );
  }
  if (kind === "EXPLORE") {
    const spots = data?.spots ?? [];
    return (
      <div className="flex flex-col gap-3">
        {fileId ? (
          <span className="tf-spot-frame is-static">
            {/* eslint-disable-next-line @next/next/no-img-element -- a private file served by this app */}
            <img src={fileSrc(fileId)} alt="The picture to explore" loading="lazy" />
            {spots.map((sp, i) => <span key={sp.id} className="tf-explore-marker" style={{ left: `${sp.x}%`, top: `${sp.y}%` }} aria-hidden="true">{i + 1}</span>)}
          </span>
        ) : null}
        <Notice title="Learners tap each numbered spot to open it">They finish once they have opened them all. Here every spot is open.</Notice>
        <ol className="pc-rows">
          {spots.map((sp, i) => <li key={sp.id} className="pc-row items-start"><span className="pc-row-body"><span className="pc-row-title">{i + 1}. {sp.title}</span><span className="text-sm whitespace-pre-line">{sp.text}</span></span></li>)}
        </ol>
      </div>
    );
  }
  if (kind === "ASSIGNMENT") {
    const h = data?.handIn;
    const part = (p: string | undefined, what: string) => p === "required" ? `must add ${what}` : p === "optional" ? `may add ${what}` : null;
    const asks = [part(h?.text, "a written answer"), part(h?.photo, "a photo or PDF")].filter(Boolean).join(" and ");
    return <Notice title="Learners hand this in from their phone">{`They ${asks || "hand it in"}. ${h?.review ? "A trainer then accepts it under Sign-off, or sends it back with what to change." : "The lesson is done as soon as they hand it in."}`}</Notice>;
  }
  if (kind === "CHECKLIST") {
    return (
      <ul className="pc-rows">
        {(data?.items ?? []).map((item) => <li key={item.id} className="pc-row"><span className="tf-check-box" aria-hidden="true" /><span className="pc-row-title">{item.text}</span></li>)}
      </ul>
    );
  }
  return null;
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
        {lesson.kind === "AUDIO" && lesson.fileId ? <audio controls preload="metadata" src={`/training/files/${lesson.fileId}`} className="w-full"><track kind="captions" /></audio> : null}
        {lesson.kind === "EMBED" && embedFor(lesson.videoUrl) ? (
          <div className="tf-embed"><iframe src={embedFor(lesson.videoUrl)!.src} title={`${embedFor(lesson.videoUrl)!.provider}: ${lesson.title}`} loading="lazy" allow="fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>
        ) : null}
        <DataPreview kind={lesson.kind} data={lesson.data} fileId={lesson.fileId} />
        {lesson.kind === "FILE" && lesson.fileId ? (
          <Button asChild variant="outline" className="min-h-11 self-start"><a href={`/training/files/${lesson.fileId}`} target="_blank" rel="noopener noreferrer"><FileText aria-hidden="true" />Open the file</a></Button>
        ) : null}
        <LessonBody body={lesson.body} questions={outline.questions} />
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
