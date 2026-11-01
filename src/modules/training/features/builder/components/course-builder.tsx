"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { JSONContent } from "@tiptap/react";
import { ArrowDown, ArrowUp, ChevronDown, CircleCheck, ClipboardCheck, Eye, FilePlus2, GraduationCap, ListChecks, MessageSquare, Pencil, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Skeleton } from "@/components/shadcn/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { ConfirmAction } from "@/components/confirm-action";
import type { UploadedFile } from "@/modules/training/features/builder/components/upload";
import { FormDialog } from "@/components/form-dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Figure, Figures } from "@/components/ui-kit/figure";
import { Notice } from "@/components/ui-kit/notice";
import { cn } from "@/lib/utils";
import { THEME } from "@/modules/training/shared/components/dialog-kit";
import { frozenOutline, LESSON_KIND_META, lessonMinutes, lessonShows, pageFromLesson, publishProblems, type Outline, type OutlineLesson } from "@/modules/training/shared/lessons";
import { blankedPrompt } from "@/modules/training/shared/questions";
import {
  addLesson, addSection, moveLesson, moveSection, removeLesson, removeSection, renameSection, saveLesson, startFromOldText,
} from "@/modules/training/features/builder/server/actions";
import { ExamPanel, QuestionsPanel, type ExamReport } from "@/modules/training/features/builder/components/question-bank";
import { qualityTips } from "@/modules/training/shared/quality";
import { PracticalPanel } from "@/modules/training/features/builder/components/practical";
import type { ObservationStep } from "@/modules/training/shared/on-the-job";
import { CopyIntoSection, CoverPicker, ReviewComments, type ReviewComment, type VersionNote } from "@/modules/training/features/builder/components/library";

/** The lesson editor is the heaviest part of Training, so it loads with the lesson that shows it:
 *  the Courses list shares this feature's entry and stays light. */
const RichText = dynamic(() => import("@/modules/training/features/builder/components/rich-text").then((m) => m.RichText), {
  loading: () => <Skeleton className="h-64" />,
});

type Props = {
  courseId: string;
  title: string;
  hasOldText: boolean;
  draft: Outline;
  files: UploadedFile[];
  selected: string | null;
  /** The section whose questions are open, or "exam" for the final exam. */
  panel: string | null;
  report: ExamReport;
  canEdit: boolean;
  /** May leave review comments (Trainer level and above). */
  canComment: boolean;
  /** Whether the draft differs from what learners get (always true before the first publish). */
  changed: boolean;
  comments: ReviewComment[];
  coverId: string | null;
  versions: VersionNote[];
  /** The organisation's other courses, to copy lessons and questions from. */
  courses: { id: string; title: string }[];
  /** The practical checklist (phase 5) and whether the course has a sign-off. */
  practical: ObservationStep[];
  requiresSignoff: boolean;
};

const hrefFor = (courseId: string, lessonId?: string) => `/training/courses/${courseId}${lessonId ? `?lesson=${lessonId}` : ""}`;
const questionsHref = (courseId: string, sectionId: string) => `/training/courses/${courseId}?questions=${sectionId}`;
const examHref = (courseId: string) => `/training/courses/${courseId}?exam=1`;
const practicalHref = (courseId: string) => `/training/courses/${courseId}?practical=1`;

/** The builder: the outline on the left, the open lesson on the right. Every
 *  change saves to the draft at once; learners only see it once it is published. */
export function CourseBuilder({ courseId, title, hasOldText, draft, files: initialFiles, selected, panel, report, canEdit, canComment, changed, comments, coverId, versions, courses, practical, requiresSignoff }: Props) {
  const lessons = draft.sections.flatMap((s) => s.lessons);
  const open = lessons.find((l) => l.id === selected) ?? null;
  const questionSection = !open ? draft.sections.find((s) => s.id === panel) ?? null : null;
  const examOpen = !open && panel === "exam";
  const practicalOpen = !open && panel === "practical";
  // Files uploaded since the page loaded, until the refreshed page brings them.
  const [added, setAdded] = useState<UploadedFile[]>([]);
  const files = [...initialFiles, ...added.filter((a) => !initialFiles.some((f) => f.id === a.id))];
  const addFile = (file: UploadedFile) => setAdded((now) => [...now, file]);
  return (
    <div className="grid gap-6 lg:grid-cols-rail-main items-start">
      <OutlinePanel courseId={courseId} hasOldText={hasOldText} draft={draft} selected={open?.id ?? (examOpen ? "exam" : practicalOpen ? "practical" : questionSection ? `q:${questionSection.id}` : null)} canEdit={canEdit} comments={comments} courses={courses} practical={practical} requiresSignoff={requiresSignoff} />
      {open ? (
        <div className="flex flex-col gap-6">
        <LessonEditor key={open.id} courseId={courseId} lesson={open} files={files} onUploaded={addFile} canEdit={canEdit}
          position={{ index: lessons.indexOf(open), total: lessons.length }}
          questions={draft.questions.map((q) => ({ id: q.id, prompt: q.kind === "FILL_BLANK" ? blankedPrompt(q.prompt) : q.prompt }))}
          section={sectionOf(draft, open, courseId)} />
        <ReviewComments courseId={courseId} lessonId={open.id} comments={comments.filter((c) => c.lessonId === open.id)} canComment={canComment} />
        </div>
      ) : questionSection ? (
        <QuestionsPanel key={questionSection.id} courseId={courseId} section={questionSection} questions={draft.questions.filter((q) => q.sectionId === questionSection.id)}
          quizzes={questionSection.lessons.filter((l) => l.kind === "QUIZ").map((l) => l.title)} files={files} onUploaded={addFile} canEdit={canEdit} report={report} />
      ) : practicalOpen ? (
        <PracticalPanel courseId={courseId} steps={practical} requiresSignoff={requiresSignoff} canEdit={canEdit} />
      ) : examOpen ? (
        <ExamPanel courseId={courseId} exam={draft.exam} questions={draft.questions} sections={draft.sections} canEdit={canEdit} report={report} />
      ) : (
        <div className="flex flex-col gap-6">
          <StartPanel courseId={courseId} title={title} draft={draft} canEdit={canEdit} changed={changed} comments={comments} />
          <CoverPicker courseId={courseId} coverId={coverId} files={files} onUploaded={addFile} canEdit={canEdit} />
          <ReviewComments courseId={courseId} lessonId={null} comments={comments} canComment={canComment} lessons={lessons} />
          {versions.length ? <VersionHistory versions={versions} /> : null}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Outline
// ---------------------------------------------------------------------------

function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const act = (run: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => start(async () => {
    const result = await run();
    if (!result.ok) toast.error(result.error ?? "That didn't save. Try again.");
    else { after?.(); router.refresh(); }
  });
  return { act, pending };
}

function OutlinePanel({ courseId, hasOldText, draft, selected, canEdit, comments, courses, practical, requiresSignoff }: {
  courseId: string; hasOldText: boolean; draft: Outline; selected: string | null; canEdit: boolean; comments: ReviewComment[]; courses: { id: string; title: string }[];
  practical: ObservationStep[]; requiresSignoff: boolean;
}) {
  const { act, pending } = useAct();
  const router = useRouter();
  const lessonCount = draft.sections.reduce((n, s) => n + s.lessons.length, 0);
  return (
    <nav aria-labelledby="outline-heading" className="flex min-w-0 flex-col lg:sticky lg:top-6">
      <div className="pc-section-head">
        <h2 id="outline-heading">Outline</h2>
        <p>{lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}</p>
      </div>
      <div className="rec-card">
      <Link href={hrefFor(courseId)} aria-current={selected ? undefined : "page"} className={cn("tf-outline-row", !selected && "is-current")}>
        <CircleCheck aria-hidden="true" />Course overview
      </Link>
      {draft.sections.length === 0 ? (
        <p className="text-sm text-ui-muted-foreground">Start with a section, such as “Before you start” or “Chemical safety”. Lessons go inside sections.</p>
      ) : null}
      <ol className="flex flex-col gap-4">
        {draft.sections.map((section, si) => (
          <li key={section.id} className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <h3 className="min-w-0 flex-1 text-xs font-semibold text-ui-muted-foreground">
                <span className="tabular-nums">{si + 1}.</span> {section.title}
              </h3>
              {canEdit ? (
                <>
                  <SectionDialog courseId={courseId} section={section} />
                  <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Move ${section.title} up`} disabled={pending || si === 0} onClick={() => act(() => moveSection(section.id, "up"))}><ArrowUp aria-hidden="true" /></Button>
                  <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Move ${section.title} down`} disabled={pending || si === draft.sections.length - 1} onClick={() => act(() => moveSection(section.id, "down"))}><ArrowDown aria-hidden="true" /></Button>
                </>
              ) : null}
            </div>
            <ol className="flex flex-col gap-1">
              {section.lessons.map((lesson) => {
                const Icon = LESSON_KIND_META[lessonShows(lesson)].icon;
                const current = lesson.id === selected;
                return (
                  <li key={lesson.id}>
                    <Link href={hrefFor(courseId, lesson.id)} aria-current={current ? "page" : undefined} className={cn("tf-outline-row", current && "is-current")}>
                      <Icon aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                      {comments.some((c) => c.lessonId === lesson.id && !c.resolvedAt)
                        ? <span className="flex items-center gap-1 text-xs tabular-nums" aria-label={`${comments.filter((c) => c.lessonId === lesson.id && !c.resolvedAt).length} open comments`}><MessageSquare aria-hidden="true" className="size-3.5" />{comments.filter((c) => c.lessonId === lesson.id && !c.resolvedAt).length}</span>
                        : lessonMinutes(lesson) ? <span className="text-xs text-ui-muted-foreground tabular-nums">{lessonMinutes(lesson)} min</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ol>
            {canEdit ? <AddLessonDialog sectionId={section.id} sectionTitle={section.title} onAdded={(id) => router.push(hrefFor(courseId, id))} /> : null}
            {canEdit ? <CopyIntoSection courseId={courseId} sectionId={section.id} sectionTitle={section.title} courses={courses} /> : null}
            <Link href={questionsHref(courseId, section.id)} aria-current={selected === `q:${section.id}` ? "page" : undefined} className={cn("tf-outline-row", selected === `q:${section.id}` && "is-current")}>
              <ListChecks aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">Questions</span>
              <span className="text-xs text-ui-muted-foreground tabular-nums">{draft.questions.filter((q) => q.sectionId === section.id).length}</span>
            </Link>
          </li>
        ))}
      </ol>
      {draft.sections.length ? (
        <Link href={examHref(courseId)} aria-current={selected === "exam" ? "page" : undefined} className={cn("tf-outline-row", selected === "exam" && "is-current")}>
          <GraduationCap aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">Final exam</span>
          <span className="text-xs text-ui-muted-foreground">{draft.exam ? `Pass ${draft.exam.passMark}%` : "Off"}</span>
        </Link>
      ) : null}
      {requiresSignoff || practical.length ? (
        <Link href={practicalHref(courseId)} aria-current={selected === "practical" ? "page" : undefined} className={cn("tf-outline-row", selected === "practical" && "is-current")}>
          <ClipboardCheck aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">Practical checklist</span>
          <span className="text-xs text-ui-muted-foreground tabular-nums">{practical.length ? `${practical.length} steps` : "None"}</span>
        </Link>
      ) : null}
      {canEdit ? (
        <div className="flex flex-col gap-2 border-t border-ui-border pt-4">
          <SectionDialog courseId={courseId} />
          {draft.sections.length === 0 && hasOldText ? (
            <Button type="button" variant="outline" className="min-h-11" disabled={pending}
              onClick={() => act(() => startFromOldText(courseId), undefined)}><FilePlus2 aria-hidden="true" />Use the current text as lesson 1</Button>
          ) : null}
        </div>
      ) : null}
      </div>
    </nav>
  );
}

function SectionDialog({ courseId, section }: { courseId: string; section?: { id: string; title: string } }) {
  const router = useRouter();
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={section
        ? <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Rename or remove ${section.title}`}><Pencil aria-hidden="true" /></Button>
        : <Button type="button" variant="outline" className="min-h-11"><Plus aria-hidden="true" />Add a section</Button>}
      title={section ? `Section: ${section.title}` : "Add a section"}
      description={section ? "Rename it here. Removing it also removes its lessons from the draft; published versions keep theirs." : "A section groups lessons, such as “Before you start” or “Testing the water”."}
      submitLabel={section ? "Save name" : "Add section"}
      successMessage={section ? "Section saved" : "Section added"}
      onSuccess={() => router.refresh()}
      submit={(formData) => section ? renameSection(section.id, String(formData.get("title") ?? "")) : addSection(courseId, String(formData.get("title") ?? ""))}
    >
      <Input id={`section-title-${section?.id ?? "new"}`} name="title" label="Name" defaultValue={section?.title} required minLength={2} maxLength={120} autoFocus />
      {section ? (
        <ConfirmAction
          trigger={<Button type="button" variant="outline" className="min-h-11 self-start"><Trash2 aria-hidden="true" />Remove section</Button>}
          title={`Remove ${section.title}?`}
          description="Its lessons go with it, from the draft only. People already given a published version keep theirs."
          confirmLabel="Remove section"
          destructive
          successMessage="Section removed"
          run={async () => { const result = await removeSection(section.id); if (result.ok) router.refresh(); return result; }}
        />
      ) : null}
    </FormDialog>
  );
}

/** A lesson starts as an empty page with just its name; Add puts everything in (D18). */
function AddLessonDialog({ sectionId, sectionTitle, onAdded }: { sectionId: string; sectionTitle: string; onAdded: (id: string) => void }) {
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button type="button" variant="ghost" className="min-h-11 justify-start text-ui-primary"><Plus aria-hidden="true" />Add a lesson</Button>}
      title={`Add a lesson to ${sectionTitle}`}
      description="Each lesson is one screen in Turnfin Me. Keep it short: one idea, a few minutes. You add text, media and activities once it opens."
      submitLabel="Add and open"
      successMessage="Lesson added"
      submit={async (formData) => {
        const result = await addLesson(sectionId, "READING", String(formData.get("title") ?? ""));
        if (result.ok) onAdded(result.id);
        return result.ok ? { ok: true } : result;
      }}
    >
      <Input id={`lesson-title-${sectionId}`} name="title" label="Lesson name" required minLength={2} maxLength={120} autoFocus />
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------
// Course overview (no lesson open)
// ---------------------------------------------------------------------------

function StartPanel({ courseId, title, draft, canEdit, changed, comments }: { courseId: string; title: string; draft: Outline; canEdit: boolean; changed: boolean; comments: ReviewComment[] }) {
  const problems = useMemo(() => publishProblems(frozenOutline(draft)), [draft]);
  const tips = useMemo(() => qualityTips(frozenOutline(draft)), [draft]);
  const openComments = comments.filter((c) => !c.resolvedAt).length;
  const lessons = draft.sections.flatMap((s) => s.lessons);
  const minutes = lessons.reduce((n, l) => n + (lessonMinutes(l) ?? 0), 0);
  if (!lessons.length) {
    return (
      <section aria-label="Get started">
        <EmptyState as="h2" icon="book" title="Build the first lesson"
          hint={canEdit ? "Add a section in the outline, then a lesson inside it. Each lesson is one screen on the learner's phone." : "Nobody has added lessons to this course yet."} />
      </section>
    );
  }
  return (
    <section className="flex min-w-0 flex-col gap-(--space-4)" aria-labelledby="overview-title">
      <div className="pc-section-head mb-0"><h2 id="overview-title">Course overview</h2></div>
      <Figures label={`${title} at a glance`} compact>
        {([["Sections", draft.sections.length], ["Lessons", lessons.length], ["Questions", draft.questions.length], ["Final exam", draft.exam ? `Pass ${draft.exam.passMark}%` : "Off"], ["About", `${minutes} min`]] as const).map(([label, value]) => (
          <Figure key={label} label={label} value={value} />
        ))}
      </Figures>
      {problems.length ? (
        <Notice tone="warning" title="Before you can publish">
          <ul className="list-disc pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </Notice>
      ) : !changed ? (
        <Notice tone="success" title="Learners have this version">Change a lesson and publish again when you want learners to get the change.</Notice>
      ) : (
        <Notice tone="success" title="Ready to publish">Preview it as a learner first, then publish from the top of the page.</Notice>
      )}
      {tips.length ? (
        <Collapsible className="rec-card gap-2">
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" className="min-h-11 justify-between self-stretch">
              <span className="flex items-center gap-2"><Sparkles aria-hidden="true" />Make it better: {tips.length} {tips.length === 1 ? "suggestion" : "suggestions"}</span>
              <ChevronDown aria-hidden="true" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="pb-2 text-sm text-ui-muted-foreground">Advice from the quality check. None of it stops you publishing.</p>
            <ul className="pc-rows">
              {tips.map((t) => (
                <li key={t.text} className="pc-row items-start">
                  <span className="pc-row-body">
                    <span className="text-sm">{t.text}</span>
                    {t.lessonId ? <Link href={hrefFor(courseId, t.lessonId)} className="text-sm font-medium text-ui-primary underline-offset-4 hover:underline">Open the lesson</Link>
                      : t.sectionId ? <Link href={questionsHref(courseId, t.sectionId)} className="text-sm font-medium text-ui-primary underline-offset-4 hover:underline">Open its questions</Link> : null}
                  </span>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      ) : lessons.length ? <Notice tone="success" title="The quality check has no suggestions" /> : null}
      {openComments ? <Notice tone="info" title={`${openComments} review ${openComments === 1 ? "comment is" : "comments are"} still open`}>Have a look before you publish. They don&apos;t stop you publishing.</Notice> : null}
      <Button asChild variant="outline" className="min-h-11 self-start"><Link href={`/training/courses/${courseId}/preview`}><Eye aria-hidden="true" />Preview as a learner</Link></Button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// One lesson
// ---------------------------------------------------------------------------


function VersionHistory({ versions }: { versions: VersionNote[] }) {
  return (
    <section className="flex min-w-0 flex-col" aria-labelledby="versions-heading">
      <div className="pc-section-head"><h2 id="versions-heading">Versions</h2><p>{versions.length}</p></div>
      <ol className="pc-list">
        {versions.map((v) => (
          <li key={v.id} className="pc-row items-start">
            <span className="pc-row-body">
              <span className="pc-row-title tabular-nums">Version {v.number}</span>
              <span className="pc-row-hint">{v.publishedAt.toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" })} by {v.publishedByName} · {v.lessonCount} {v.lessonCount === 1 ? "lesson" : "lessons"}{v.retake ? " · everyone took it again" : ""}</span>
              {v.changeNote ? <span className="text-sm">{v.changeNote}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The open lesson's section, for its Practice quiz: how many questions, and where to edit them. */
function sectionOf(draft: Outline, lesson: OutlineLesson, courseId: string) {
  const id = draft.sections.find((s) => s.lessons.includes(lesson))!.id;
  return { id, count: draft.questions.filter((q) => q.sectionId === id).length, href: questionsHref(courseId, id) };
}

function LessonEditor({ courseId, lesson, files, onUploaded, canEdit, position, section, questions }: {
  courseId: string; lesson: OutlineLesson; files: UploadedFile[]; onUploaded: (file: UploadedFile) => void; canEdit: boolean; position: { index: number; total: number };
  questions: { id: string; prompt: string }[];
  /** The lesson's section and how many questions it has, for a Practice quiz. */
  section: { id: string; count: number; href: string };
}) {
  const router = useRouter();
  const { act, pending } = useAct();
  // Every lesson is a page built with Add (D18). An older lesson opens with its
  // main part turned into the first block, and stays that way once saved.
  const converted = lesson.kind !== "READING";
  const [title, setTitle] = useState(lesson.title);
  const [body, setBody] = useState<JSONContent | null>(() => pageFromLesson(lesson) as JSONContent | null);
  const [minutes, setMinutes] = useState(lesson.minutes ? String(lesson.minutes) : "");
  const [dirty, setDirty] = useState(converted);
  const change = <T,>(set: (value: T) => void) => (value: T) => { set(value); setDirty(true); };
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const Icon = LESSON_KIND_META[lessonShows({ kind: "READING", body: body as OutlineLesson["body"] })].icon;
  const save = () => act(() => saveLesson(lesson.id, {
    title, body: body ? JSON.stringify(body) : null, videoUrl: "", fileId: "", minutes: minutes.trim() ? Number(minutes) : null, data: null, page: true,
  }), () => { setDirty(false); toast.success("Lesson saved"); });
  return (
    <section className="flex min-w-0 flex-col" aria-labelledby="lesson-heading">
      <div className="pc-section-head">
        <h2 id="lesson-heading" className="flex min-w-0 items-center gap-2"><Icon aria-hidden="true" className="size-5 shrink-0 text-ui-primary" /><span className="truncate">{title || "Untitled lesson"}</span></h2>
        {canEdit ? (
          <div className="flex shrink-0 gap-1">
            <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="Move lesson up" disabled={pending || position.index === 0} onClick={() => act(() => moveLesson(lesson.id, "up"))}><ArrowUp aria-hidden="true" /></Button>
            <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="Move lesson down" disabled={pending || position.index === position.total - 1} onClick={() => act(() => moveLesson(lesson.id, "down"))}><ArrowDown aria-hidden="true" /></Button>
          </div>
        ) : null}
      </div>
      <p className="pc-section-note">Lesson {position.index + 1} of {position.total}</p>
      <div className="rec-card gap-5">

      <Input id="lesson-title" label="Lesson name" value={title} onChange={change(setTitle)} required maxLength={120} disabled={!canEdit} />

      {converted && canEdit ? (
        <Notice title={`The ${LESSON_KIND_META[lesson.kind].label.toLowerCase()} is now a block in this lesson`}>
          Lessons are built with Add now. Move it, change it or add more around it, then save. Courses already published stay as they are.
        </Notice>
      ) : null}

      <RichText id="lesson-body" label="What's in this lesson" value={body} onChange={change(setBody)} courseId={courseId} disabled={!canEdit} onUploaded={onUploaded} files={files}
        questions={questions} section={section} />

      <Input id="lesson-minutes" label="Minutes it takes" type="number" inputMode="numeric" min={1} max={240} value={minutes} onChange={change(setMinutes)} optional disabled={!canEdit}
        description="Leave it empty to use the reading time of the text. Add time for recordings, videos and activities." className="max-w-xs" />

      {canEdit ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ui-border pt-4">
          <ConfirmAction
            trigger={<Button type="button" variant="outline" className="min-h-11"><Trash2 aria-hidden="true" />Remove lesson</Button>}
            title={`Remove ${lesson.title}?`}
            description="It goes from the draft only. People already given a published version keep it."
            confirmLabel="Remove lesson"
            destructive
            successMessage="Lesson removed"
            run={async () => { const result = await removeLesson(lesson.id); if (result.ok) { setDirty(false); router.push(hrefFor(courseId)); } return result; }}
          />
          <div className="flex items-center gap-3">
            <span className="text-sm text-ui-muted-foreground" role="status">{dirty ? "Unsaved changes" : "Saved to the draft"}</span>
            <Button type="button" className="min-h-11" disabled={pending || !dirty || !title.trim()} onClick={save}><Upload aria-hidden="true" />Save lesson</Button>
          </div>
        </div>
      ) : null}
      </div>
    </section>
  );
}
