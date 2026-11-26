import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleCheck, ExternalLink, FileText, Flag, GraduationCap, ListChecks, MapPin } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Progress } from "@/components/shadcn/progress";
import { Notice } from "@/components/ui-kit/notice";
import { cn } from "@/lib/utils";
import { FlashcardsPreview } from "@/modules/training/features/builder/components/flashcards-preview";
import { LessonBody } from "@/modules/training/shared/components/lesson-body";
import { embedFor, fileSrc, LESSON_KIND_META, lessonHasQuiz, lessonMinutes, lessonShows, lessonPlace, outlineLessons, videoFor, type Outline } from "@/modules/training/shared/lessons";
import { blankedPrompt, paperSize, QUESTION_KIND_META, type Question } from "@/modules/training/shared/questions";
import type { LessonData, LessonKind } from "@/modules/training/shared/lessons";
import { heightOf, leftOf, topOf, widthOf } from "@/components/ui-kit/scale";

/** Every question with its right answer, for the author. Learners get one at a time and never the key. */
function QuestionsPreview({ questions }: { questions: Question[] }) {
  if (!questions.length) return <Notice tone="warning" title="This section has no questions yet" />;
  return (
    <ol className="pc-rows">
      {questions.map((q, i) => (
        <li key={q.id} className="pc-row items-start">
          <span className="pc-row-body gap-2">
            <span className="text-xs font-semibold text-ui-muted-foreground">{i + 1} · {QUESTION_KIND_META[q.kind].label}</span>
            <span className="pc-row-title">{q.kind === "FILL_BLANK" ? blankedPrompt(q.prompt) : q.prompt}</span>
            {q.kind === "HOTSPOT" && q.imageId ? (
              <span className="tf-spot-frame is-static">
                {/* eslint-disable-next-line @next/next/no-img-element -- a private file served by this app */}
                <img src={fileSrc(q.imageId)} alt="" loading="lazy" />
                {q.options.map((o, n) => o.area ? <span key={o.id} className={`tf-spot-area ${leftOf(o.area.x / 100)} ${topOf(o.area.y / 100)} ${widthOf(o.area.w / 100)} ${heightOf(o.area.h / 100)}`}><span className="tf-spot-number">{n + 1}</span></span> : null)}
              </span>
            /* eslint-disable-next-line @next/next/no-img-element -- a private file served by this app */
            ) : q.imageId ? <img src={fileSrc(q.imageId)} alt="" loading="lazy" className="max-h-48 w-fit rounded-card" /> : null}
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
 *  scene with where each choice leads, the cards to flip through, every item. */
function DataPreview({ kind, data, fileId }: { kind: string; data: LessonData | null; fileId: string | null }) {
  if (kind === "SCENARIO") {
    const steps = data?.steps ?? [];
    return (
      <div className="flex flex-col gap-3">
        <Notice title="Learners play this one scene at a time">They choose, see what happened, and carry on until they reach the best outcome. Here you see the whole map.</Notice>
        <ol className="flex flex-col gap-3">
          {steps.map((step, i) => (
            <li key={step.id} className="rounded-card bg-ui-muted p-4">
              <p className="text-xs font-semibold text-ui-muted-foreground">Scene {i + 1}{i === 0 ? " · start" : ""}</p>
              <p className="whitespace-pre-line">{step.text}</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- a private file served by this app */}
              {step.imageId ? <img src={fileSrc(step.imageId)} alt="" loading="lazy" className="mt-2 max-h-48 w-fit rounded-card" /> : null}
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
  if (kind === "FLASHCARDS") return <FlashcardsPreview cards={data?.cards ?? []} />;
  if (kind === "SORTING") {
    const groups = data?.groups ?? [], sorts = data?.sorts ?? [];
    return (
      <div className="flex flex-col gap-3">
        <Notice title="Learners get these shuffled">They put each one in a group and check. Here you see where each one belongs.</Notice>
        <div className="tf-sort-groups">
          {groups.map((g) => (
            <section key={g.id} className="flex flex-col gap-2 rounded-card bg-ui-muted p-4" aria-label={g.name}>
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
            {spots.map((sp, i) => <span key={sp.id} className={`tf-explore-marker ${leftOf(sp.x / 100)} ${topOf(sp.y / 100)}`} aria-hidden="true">{i + 1}</span>)}
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
export function CoursePreview({ courseId, outline, lessonId, questionsOf = null, exam = false, requiresSignoff }: {
  courseId: string; outline: Outline; lessonId: string | null; requiresSignoff: boolean;
  /** The section whose questions are shown in place of a lesson. */
  questionsOf?: string | null;
  /** The final exam is shown in place of a lesson. */
  exam?: boolean;
}) {
  const lessons = outlineLessons(outline);
  const base = `/training/courses/${courseId}/preview`;
  const href = (id: string) => `${base}?lesson=${id}`;
  const questionSection = questionsOf ? outline.sections.find((s) => s.id === questionsOf) ?? null : null;
  const examOpen = exam && !!outline.exam && !questionSection;
  const place = questionSection || examOpen ? null : lessonPlace(outline, lessonId ?? lessons[0]?.id ?? "");
  if (!place && !questionSection && !examOpen) return <Notice title="Nothing to preview yet">Add a lesson to the course first.</Notice>;
  return (
    <div className="grid gap-6 lg:grid-cols-main-rail items-start">
      {questionSection ? <SectionQuestions outline={outline} section={questionSection} />
        : examOpen ? <ExamPreview outline={outline} lastLesson={lessons.at(-1)?.id ? href(lessons.at(-1)!.id) : null} requiresSignoff={requiresSignoff} />
        : <LessonPreview courseId={courseId} outline={outline} place={place!} href={href} examHref={`${base}?exam=1`} requiresSignoff={requiresSignoff} />}
      <nav aria-labelledby="preview-outline" className="flex min-w-0 flex-col">
        <div className="pc-section-head"><h2 id="preview-outline">Outline</h2></div>
        <div className="rec-card">
        {outline.sections.map((s) => {
          const count = outline.questions.filter((q) => q.sectionId === s.id).length;
          return (
          <div key={s.id} className="flex flex-col gap-1">
            <h3 className="text-xs font-semibold text-ui-muted-foreground">{s.title}</h3>
            <ol className="flex flex-col gap-1">
              {s.lessons.map((l) => {
                const Icon = l.id === place?.lesson.id ? CircleCheck : LESSON_KIND_META[lessonShows(l)].icon;
                return (
                  <li key={l.id}><Link href={href(l.id)} aria-current={l.id === place?.lesson.id ? "page" : undefined} className={cn("tf-outline-row", l.id === place?.lesson.id && "is-current")}>
                    <Icon aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{l.title}</span>
                  </Link></li>
                );
              })}
              {count ? (
                <li><Link href={`${base}?questions=${s.id}`} aria-current={questionSection?.id === s.id ? "page" : undefined} className={cn("tf-outline-row", questionSection?.id === s.id && "is-current")}>
                  <ListChecks aria-hidden="true" /><span className="min-w-0 flex-1 truncate">Questions</span><span className="text-xs tabular-nums">{count}</span>
                </Link></li>
              ) : null}
            </ol>
          </div>
          );
        })}
        {outline.exam ? (
          <Link href={`${base}?exam=1`} aria-current={examOpen ? "page" : undefined} className={cn("tf-outline-row", examOpen && "is-current")}>
            <GraduationCap aria-hidden="true" /><span className="min-w-0 flex-1 truncate">Final exam</span>
          </Link>
        ) : null}
        </div>
      </nav>
    </div>
  );
}

/** One section's questions with their answers, and where learners meet them. */
function SectionQuestions({ outline, section }: { outline: Outline; section: Outline["sections"][number] }) {
  const questions = outline.questions.filter((q) => q.sectionId === section.id);
  const quiz = section.lessons.find(lessonHasQuiz);
  return (
    <article className="rec-card gap-5" aria-labelledby="preview-questions">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-ui-muted-foreground">{section.title} · {questions.length} {questions.length === 1 ? "question" : "questions"}</p>
        <h2 id="preview-questions" className="text-title-2">Questions</h2>
      </div>
      {quiz || outline.exam ? (
        <Notice title="Where learners get these">
          {quiz ? `In the practice quiz in “${quiz.title}”, one at a time, with the answer straight away.` : ""}{quiz && outline.exam ? " " : ""}{outline.exam ? "In the final exam, which draws from every section's questions." : ""} Here you see every question with its answer.
        </Notice>
      ) : (
        <Notice tone="warning" title="Learners don't get these questions yet">Add a Practice quiz to a lesson in this section, or turn on the final exam. Until then they only show here and in the builder.</Notice>
      )}
      <QuestionsPreview questions={questions} />
    </article>
  );
}

/** The final exam for its author: its rules, then every question it can ask with the answer. */
function ExamPreview({ outline, lastLesson, requiresSignoff }: { outline: Outline; lastLesson: string | null; requiresSignoff: boolean }) {
  const rules = outline.exam!, bank = outline.questions.length, paper = paperSize(rules, bank);
  return (
    <article className="rec-card gap-5" aria-labelledby="preview-exam">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-ui-muted-foreground">After the last lesson</p>
        <h2 id="preview-exam" className="text-title-2">Final exam</h2>
      </div>
      <Notice title={`Learners answer ${paper} ${paper === 1 ? "question" : "questions"} and need ${rules.passMark}% to pass`}>
        {paper < bank ? `Each person gets ${paper} of the ${bank} questions, picked at random. ` : "The questions come in a different order for each person. "}
        {`They have ${rules.attempts} ${rules.attempts === 1 ? "try" : "tries"}${rules.timeLimit ? ` and ${rules.timeLimit} minutes each time` : ""}. `}
        {rules.testOut ? "They may sit it before the lessons to skip them. " : ""}
        {requiresSignoff ? "After passing, they ask a trainer to sign the course off. " : ""}
        Here you see every question with its answer; learners never see the answers.
      </Notice>
      {outline.sections.map((s) => {
        const questions = outline.questions.filter((q) => q.sectionId === s.id);
        return questions.length ? (
          <section key={s.id} className="flex flex-col gap-2" aria-label={`Questions from ${s.title}`}>
            <h3 className="font-semibold">{s.title}</h3>
            <QuestionsPreview questions={questions} />
          </section>
        ) : null;
      })}
      {bank ? null : <Notice tone="warning" title="The exam has no questions yet">Add questions to a section in the builder.</Notice>}
      {lastLesson ? (
        <div className="flex border-t border-ui-border pt-4">
          <Button asChild variant="outline" className="min-h-11"><Link href={lastLesson}><ArrowLeft aria-hidden="true" />Back</Link></Button>
        </div>
      ) : null}
    </article>
  );
}

function LessonPreview({ courseId, outline, place, href, examHref, requiresSignoff }: {
  courseId: string; outline: Outline; place: NonNullable<ReturnType<typeof lessonPlace>>; href: (id: string) => string; examHref: string; requiresSignoff: boolean;
}) {
  const { lesson, section, index, total, prev, next } = place;
  const video = lesson.kind === "VIDEO" ? videoFor(lesson.videoUrl) : null;
  const minutes = lessonMinutes(lesson);
  return (
      <article className="rec-card gap-5" aria-labelledby="preview-lesson">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-ui-muted-foreground">{section.title} · lesson {index + 1} of {total}{minutes ? ` · ${minutes} min` : ""}</p>
          <Progress value={Math.round((index / total) * 100)} aria-label="Through the course" />
          <h2 id="preview-lesson" className="text-title-2">{lesson.title}</h2>
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
        {lesson.kind === "READING" && !lesson.body ? (
          <Notice tone="warning" title="This lesson has nothing in it yet" actions={
            <Button asChild variant="outline" className="min-h-11"><Link href={`/training/courses/${courseId}?lesson=${lesson.id}`}>Open the lesson</Link></Button>
          }>Learners would get an empty screen, so the course can&apos;t be published until it has text, media or an activity.</Notice>
        ) : null}
        <DataPreview kind={lesson.kind} data={lesson.data} fileId={lesson.fileId} />
        {lesson.kind === "FILE" && lesson.fileId ? (
          <Button asChild variant="outline" className="min-h-11 self-start"><a href={`/training/files/${lesson.fileId}`} target="_blank" rel="noopener noreferrer"><FileText aria-hidden="true" />Open the file</a></Button>
        ) : null}
        <LessonBody body={lesson.body} questions={outline.questions} activity={(node) => (
          <>
            <p className="text-xs font-semibold text-ui-muted-foreground">{LESSON_KIND_META[node.attrs?.kind as LessonKind]?.label ?? "Activity"} · learners finish it to move on</p>
            {node.attrs?.kind === "QUIZ"
              ? <QuestionsPreview questions={outline.questions.filter((q) => q.sectionId === section.id)} />
              : <DataPreview kind={String(node.attrs?.kind ?? "")} data={(node.attrs?.data ?? null) as LessonData | null} fileId={(node.attrs?.fileId as string | null) ?? null} />}
          </>
        )} />
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
          ) : outline.exam ? (
            <Button asChild className="min-h-11"><Link href={examHref}>Done, on to the final exam<ArrowRight aria-hidden="true" /></Link></Button>
          ) : (
            <span className="text-sm text-ui-muted-foreground">Last lesson. The learner then {requiresSignoff ? "asks a trainer to sign it off" : "marks the course as done"}.</span>
          )}
        </div>
      </article>
  );
}
