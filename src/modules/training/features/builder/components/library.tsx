"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Check, ClipboardPaste, Copy, CopyPlus, ImageIcon, MessageSquare, Rocket, Send } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { RadioGroup } from "@/components/shadcn/radio-group";
import { Field, FormDialog } from "@/components/form-dialog";
import { ChoiceRow } from "@/components/ui/choice-row";
import { FileField } from "@/components/ui/file-field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { Notice } from "@/components/ui-kit/notice";
import { THEME } from "@/modules/training/shared/components/dialog-kit";
import { IMPORT_COLUMNS, parseQuestions } from "@/modules/training/shared/import";
import { fileSrc, LESSON_KIND_META, type LessonKind } from "@/modules/training/shared/lessons";
import { QUESTION_KIND_META } from "@/modules/training/shared/questions";
import { COURSE_TEMPLATES } from "@/modules/training/shared/templates";
import { publishCourse } from "@/modules/training/features/builder/server/actions";
import {
  addReviewComment, copyIntoSection, courseToCopyFrom, createFromTemplate, duplicateCourse, importQuestions, resolveReviewComment, setCourseCover,
} from "@/modules/training/features/builder/server/library";
import { uploadCourseFile, type UploadedFile } from "@/modules/training/features/builder/components/rich-text";

/** The builder's library tools (docs/training.md, e-learning phase 3): start
 *  from a template or a copy, copy lessons and questions in, paste questions
 *  from a spreadsheet, a cover picture, review comments, and publishing with a
 *  note of what changed. */

export type ReviewComment = { id: string; lessonId: string | null; body: string; authorName: string; createdAt: Date; resolvedAt: Date | null; resolvedByName: string | null };
export type VersionNote = { id: string; number: number; publishedAt: Date; publishedByName: string; lessonCount: number; changeNote: string; retake: boolean };

const when = (date: Date) => date.toLocaleString("en-IE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// ---------------------------------------------------------------------------
// Starting a course
// ---------------------------------------------------------------------------

/** "Start from a template" beside Add a course: one of the built-in outlines, or a copy of a course. */
export function StartFromTemplate({ courses }: { courses: { id: string; title: string }[] }) {
  const router = useRouter();
  const [choice, setChoice] = useState(COURSE_TEMPLATES[0].key);
  const copying = choice.startsWith("copy:");
  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-2xl"
      trigger={<Button variant="outline" className="min-h-11"><CopyPlus aria-hidden="true" />Start from a template</Button>}
      title="Start from a template"
      description="Get a ready-made outline to fill in, or copy a course you already have. Text marked ✎ is for you to replace; the course can't be published until it is."
      submitLabel="Create and build"
      successMessage="Course created"
      submit={async (formData) => {
        const title = String(formData.get("title") ?? "");
        const result = copying ? await duplicateCourse(choice.slice(5), title) : await createFromTemplate(choice, title);
        if (!result.ok) return result;
        router.push(`/training/courses/${result.id}`);
        return { ok: true };
      }}
    >
      <Input id="template-title" name="title" label="Name of the new course" required minLength={3} maxLength={120} autoFocus />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Start from</legend>
        <RadioGroup value={choice} onValueChange={setChoice} className="grid gap-2 sm:grid-cols-2">
          {COURSE_TEMPLATES.map((t) => <ChoiceRow key={t.key} type="radio" value={t.key} id={`template-${t.key}`} title={t.title} hint={t.help} />)}
        </RadioGroup>
      </fieldset>
      {courses.length ? (
        <Field label="Or copy one of your courses" htmlFor="template-copy" optional hint="Everything is copied: lessons, questions, files and the exam. Nobody is assigned to the copy.">
          <NativeSelect id="template-copy" value={copying ? choice : ""} onChange={(event) => setChoice(event.target.value || COURSE_TEMPLATES[0].key)} className="min-h-11 w-full">
            <NativeSelectOption value="">Don’t copy a course</NativeSelectOption>
            {courses.map((c) => <NativeSelectOption key={c.id} value={`copy:${c.id}`}>{c.title}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
      ) : null}
    </FormDialog>
  );
}

/** Copies the whole course under a new name, from its builder. */
export function DuplicateCourse({ courseId, title }: { courseId: string; title: string }) {
  const router = useRouter();
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button variant="outline" className="min-h-11" aria-label={`Make a copy of ${title}`}><Copy aria-hidden="true" /><span className="pc-only-wide">Make a copy</span></Button>}
      title={`Make a copy of ${title}`}
      description="Lessons, questions, files, the exam and the settings are copied into a new, unpublished course. Nobody is assigned to it."
      submitLabel="Make the copy"
      successMessage="Copy made"
      submit={async (formData) => {
        const result = await duplicateCourse(courseId, String(formData.get("title") ?? ""));
        if (!result.ok) return result;
        router.push(`/training/courses/${result.id}`);
        return { ok: true };
      }}
    >
      <Input id="copy-title" name="title" label="Name of the copy" defaultValue={`${title} (copy)`.slice(0, 120)} required minLength={3} maxLength={120} autoFocus />
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------
// Copying lessons and questions in
// ---------------------------------------------------------------------------

type CopySource = NonNullable<Awaited<ReturnType<typeof courseToCopyFrom>>>;

export function CopyIntoSection({ courseId, sectionId, sectionTitle, courses }: { courseId: string; sectionId: string; sectionTitle: string; courses?: { id: string; title: string }[] }) {
  const router = useRouter();
  const [from, setFrom] = useState(courseId);
  const [source, setSource] = useState<CopySource | null>(null);
  const [lessons, setLessons] = useState<Set<string>>(new Set());
  const [questions, setQuestions] = useState<Set<string>>(new Set());
  const [loading, start] = useTransition();
  const load = (id: string) => { setFrom(id); setLessons(new Set()); setQuestions(new Set()); start(async () => setSource(await courseToCopyFrom(id))); };
  const toggle = (set: Set<string>, id: string, on: boolean) => { const next = new Set(set); if (on) next.add(id); else next.delete(id); return next; };
  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-2xl"
      trigger={<Button type="button" variant="ghost" className="min-h-11 justify-start text-ui-primary"><Copy aria-hidden="true" />Copy in lessons or questions</Button>}
      title={`Copy into ${sectionTitle}`}
      description="Copies go to the end of this section, with their pictures and files. Changing a copy never changes the original."
      submitLabel="Copy them in"
      successMessage="Copied in"
      onOpen={() => load(courseId)}
      onSuccess={() => router.refresh()}
      submit={() => copyIntoSection(sectionId, from, [...lessons], [...questions])}
    >
      <Field label="From the course" htmlFor={`copy-from-${sectionId}`}>
        <NativeSelect id={`copy-from-${sectionId}`} value={from} onChange={(event) => load(event.target.value)} className="min-h-11 w-full">
          <NativeSelectOption value={courseId}>This course</NativeSelectOption>
          {(courses ?? []).filter((c) => c.id !== courseId).map((c) => <NativeSelectOption key={c.id} value={c.id}>{c.title}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      {loading || !source ? <p className="text-sm text-ui-muted-foreground" role="status">Getting its lessons…</p> : !source.sections.length ? (
        <Notice title="That course has no lessons yet" />
      ) : (
        <div className="flex max-h-(--pc-overlay-max-height) flex-col gap-4 overflow-y-auto">
          {source.sections.map((s) => (
            <fieldset key={s.id} className="flex flex-col gap-2">
              <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-ui-muted-foreground">{s.title}</legend>
              {s.lessons.map((l) => (
                <ChoiceRow key={l.id} type="checkbox" id={`copy-l-${l.id}`} title={l.title} hint={`${LESSON_KIND_META[l.kind as LessonKind].label} lesson`}
                  checked={lessons.has(l.id)} onCheckedChange={(on) => setLessons((now) => toggle(now, l.id, on === true))} />
              ))}
              {s.questions.map((q) => (
                <ChoiceRow key={q.id} type="checkbox" id={`copy-q-${q.id}`} title={q.prompt} hint="Question"
                  checked={questions.has(q.id)} onCheckedChange={(on) => setQuestions((now) => toggle(now, q.id, on === true))} />
              ))}
            </fieldset>
          ))}
        </div>
      )}
      <p className="text-sm text-ui-muted-foreground tabular-nums" role="status">{lessons.size} {lessons.size === 1 ? "lesson" : "lessons"} and {questions.size} {questions.size === 1 ? "question" : "questions"} chosen.</p>
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------
// Pasting questions from a spreadsheet
// ---------------------------------------------------------------------------

export function ImportQuestions({ sectionId, sectionTitle }: { sectionId: string; sectionTitle: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const found = useMemo(() => text.trim() ? parseQuestions(text, () => "x") : null, [text]);
  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-3xl"
      trigger={<Button type="button" variant="outline" className="min-h-11"><ClipboardPaste aria-hidden="true" />Paste from a spreadsheet</Button>}
      title={`Paste questions into ${sectionTitle}`}
      description="Copy the rows from Excel or Google Sheets and paste them here, one question a row."
      submitLabel={found?.questions.length ? `Add ${found.questions.length} ${found.questions.length === 1 ? "question" : "questions"}` : "Add questions"}
      successMessage="Questions added"
      onOpen={() => setText("")}
      onSuccess={() => router.refresh()}
      submit={async () => {
        const result = await importQuestions(sectionId, text);
        if (!result.ok) return result;
        if (result.skipped) toast.success(`${result.skipped} ${result.skipped === 1 ? "row was" : "rows were"} left out. Fix ${result.skipped === 1 ? "it" : "them"} and paste again.`);
        return { ok: true };
      }}
    >
      <div className="overflow-x-auto rounded-[var(--pc-radius-card)] bg-ui-muted p-3 text-xs">
        <p className="mb-2 font-semibold">Columns, in this order</p>
        <p className="tabular-nums">{IMPORT_COLUMNS.join(" · ")}</p>
        <ul className="mt-2 list-disc pl-5">
          <li><strong>Type</strong>: One, Several, True/false, Order, Match or Blanks.</li>
          <li><strong>Right answer</strong>: the letter of the right option (B), letters for several (A, C), or True or False.</li>
          <li><strong>Order</strong>: list the steps in the right order. <strong>Match</strong>: write each pair as “item = partner”. <strong>Blanks</strong>: put the missing words in [square brackets] in the question.</li>
        </ul>
      </div>
      <Textarea id={`import-${sectionId}`} label="Rows" value={text} onChange={(event) => setText(event.target.value)} rows={8} maxLength={200000}
        placeholder={"One\tWhat is the ideal pH of pool water?\t6.8 to 7.0\t7.2 to 7.6\t8.0 to 8.4\t\t\t\tB\tBelow 7.2 stings eyes; above 7.6 chlorine works less well."} />
      {found ? (
        <div className="flex flex-col gap-2" aria-live="polite">
          {found.questions.length ? (
            <Notice tone="success" title={`${found.questions.length} ${found.questions.length === 1 ? "question" : "questions"} ready`}>
              <ul className="list-disc pl-5">{found.questions.slice(0, 5).map((q, i) => <li key={i}>{QUESTION_KIND_META[q.kind].label}: {q.prompt.slice(0, 80)}</li>)}{found.questions.length > 5 ? <li>and {found.questions.length - 5} more</li> : null}</ul>
            </Notice>
          ) : null}
          {found.problems.length ? (
            <Notice tone="warning" title={`${found.problems.length} ${found.problems.length === 1 ? "row" : "rows"} can't be added`}>
              <ul className="list-disc pl-5">{found.problems.slice(0, 8).map((p) => <li key={p.row}>Row {p.row}: {p.message}</li>)}</ul>
            </Notice>
          ) : null}
        </div>
      ) : null}
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------
// The cover picture
// ---------------------------------------------------------------------------

export function CoverPicker({ courseId, coverId, files, onUploaded, canEdit }: { courseId: string; coverId: string | null; files: UploadedFile[]; onUploaded: (file: UploadedFile) => void; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const images = files.filter((f) => f.mime.startsWith("image/"));
  const set = (fileId: string | null) => start(async () => {
    const result = await setCourseCover(courseId, fileId);
    if (!result.ok) toast.error(result.error); else { toast.success(fileId ? "Cover set" : "Cover taken off"); router.refresh(); }
  });
  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true); setError("");
    try { const added = await uploadCourseFile(courseId, file); onUploaded(added); set(added.id); }
    catch (caught) { setError((caught as Error).message); }
    finally { setUploading(false); }
  }
  return (
    <section className="pc-panel flex flex-col gap-4" aria-labelledby="cover-heading">
      <div className="flex items-center gap-3">
        <span className="pc-tile-icon"><ImageIcon aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h2 id="cover-heading" className="text-[length:var(--pc-text-title)] leading-[var(--pc-leading-title)]">Cover picture</h2>
          <p className="text-sm text-ui-muted-foreground">Shown on the course in Turnfin Me and the course list. A wide photo of the real place or kit works best.</p>
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- a private file served by this app */}
      {coverId ? <img src={fileSrc(coverId)} alt="The course's cover" className="tf-cover" /> : null}
      {canEdit ? (
        <div className="flex flex-col gap-3">
          {images.length ? (
            <Field label="Use a picture from this course" htmlFor="cover-pick">
              <NativeSelect id="cover-pick" value={coverId ?? ""} disabled={pending} onChange={(event) => set(event.target.value || null)} className="min-h-11 w-full">
                <NativeSelectOption value="">No cover</NativeSelectOption>
                {images.map((f) => <NativeSelectOption key={f.id} value={f.id}>{f.name}</NativeSelectOption>)}
              </NativeSelect>
            </Field>
          ) : null}
          <FileField label={images.length ? "Or add a new one" : "Add a picture"} description="JPEG, PNG or WebP, up to 4 MB." accept="image/png,image/jpeg,image/webp" pending={uploading || pending} onChange={(event) => upload(event.target.files?.[0])} error={error || undefined} />
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Review comments
// ---------------------------------------------------------------------------

export function ReviewComments({ courseId, lessonId, comments, canComment, lessons }: {
  courseId: string; lessonId: string | null; comments: ReviewComment[]; canComment: boolean;
  /** On the course overview: every lesson, to say which one a comment is on. */
  lessons?: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const open = comments.filter((c) => !c.resolvedAt), done = comments.filter((c) => c.resolvedAt);
  const lessonName = (id: string | null) => id ? lessons?.find((l) => l.id === id)?.title ?? "A removed lesson" : null;
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => start(async () => {
    const result = await fn();
    if (!result.ok) toast.error(result.error ?? "That didn't save."); else { after?.(); router.refresh(); }
  });
  if (!canComment && !comments.length) return null;
  return (
    <section className="pc-panel flex flex-col gap-4" aria-labelledby={`comments-${lessonId ?? "course"}`}>
      <div className="flex items-center gap-3">
        <span className="pc-tile-icon"><MessageSquare aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h2 id={`comments-${lessonId ?? "course"}`} className="text-[length:var(--pc-text-title)] leading-[var(--pc-leading-title)]">Review comments</h2>
          <p className="text-sm text-ui-muted-foreground">{lessonId ? "Notes on this lesson for whoever builds the course. Learners never see them." : "Every open comment on the course. Learners never see them."}</p>
        </div>
      </div>
      {open.length ? (
        <ol className="pc-rows">
          {open.map((c) => (
            <li key={c.id} className="pc-row items-start">
              <span className="pc-row-body">
                <span className="pc-row-hint">{c.authorName} · {when(c.createdAt)}{!lessonId && c.lessonId ? ` · on ${lessonName(c.lessonId)}` : ""}</span>
                <span className="whitespace-pre-line">{c.body}</span>
              </span>
              {canComment ? <Button type="button" variant="outline" className="min-h-11 shrink-0" disabled={pending} onClick={() => run(() => resolveReviewComment(c.id))}><Check aria-hidden="true" />Done</Button> : null}
            </li>
          ))}
        </ol>
      ) : <p className="text-sm text-ui-muted-foreground">No open comments.</p>}
      {canComment ? (
        <form className="flex flex-col gap-2" onSubmit={(event) => { event.preventDefault(); run(() => addReviewComment(courseId, lessonId, text), () => setText("")); }}>
          <Textarea id={`comment-${lessonId ?? "course"}`} label={lessonId ? "Comment on this lesson" : "Comment on the course"} value={text} onChange={(event) => setText(event.target.value)} rows={2} maxLength={1000} />
          <Button type="submit" variant="outline" className="min-h-11 self-end" disabled={pending || text.trim().length < 2}><Send aria-hidden="true" />Add comment</Button>
        </form>
      ) : null}
      {done.length ? (
        <Collapsible className="text-sm">
          <CollapsibleTrigger asChild><Button type="button" variant="ghost" className="min-h-11 text-ui-muted-foreground">{done.length} done in the last 30 days</Button></CollapsibleTrigger>
          <CollapsibleContent>
            <ol className="flex flex-col gap-2">
              {done.map((c) => <li key={c.id} className="text-ui-muted-foreground"><s>{c.body}</s> · {c.authorName}, done by {c.resolvedByName}</li>)}
            </ol>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

export function PublishCourse({ courseId, title, changed, published, openAssignments, canRetake, finished }: {
  courseId: string; title: string; changed: boolean; published: { number: number } | null; openAssignments: number;
  /** May assign (the Manage level), so may ask people to take it again. */
  canRetake: boolean;
  /** People who have finished an earlier version. */
  finished: number;
}) {
  const router = useRouter();
  const [retake, setRetake] = useState(false);
  if (!changed) return <Button type="button" className="min-h-11" disabled><Rocket aria-hidden="true" />Published</Button>;
  const next = published ? published.number + 1 : 1;
  return (
    <FormDialog
      portalClassName={THEME}
      width="sm:max-w-xl"
      trigger={<Button type="button" className="min-h-11"><Rocket aria-hidden="true" />{published ? `Publish version ${next}` : "Publish"}</Button>}
      title={published ? `Publish version ${next} of ${title}?` : `Publish ${title}?`}
      description={published
        ? `New assignments get this version, and so does anyone who hasn't started.${openAssignments ? " People part-way through keep the version they started, so their record shows what they were taught." : ""}`
        : "People you assign it to can take it in Turnfin Me. Anyone already assigned gets it the next time they open it."}
      submitLabel="Publish"
      successMessage="Published"
      onOpen={() => setRetake(false)}
      onSuccess={() => router.refresh()}
      submit={async (formData) => {
        const result = await publishCourse(courseId, { changeNote: String(formData.get("changeNote") ?? ""), retake, dueOn: String(formData.get("dueOn") ?? "") });
        if (result.ok && result.retakes) toast.success(`${result.retakes} ${result.retakes === 1 ? "person has" : "people have"} been asked to take it again.`);
        return result.ok ? { ok: true } : result;
      }}
    >
      {published ? (
        <>
          <Textarea id="publish-note" name="changeNote" label="What changed" optional rows={3} maxLength={1000}
            description="Learners on an older version see this, and it's kept with the version. For example: New section on the updated evacuation route." />
          {finished ? (
            <>
              <Switch id="publish-retake" label={`Ask the ${finished} ${finished === 1 ? "person" : "people"} who finished it to take it again`}
                description={canRetake ? "For changes everyone must learn. They get the new version, assigned by you. Only people you cover are asked." : "Needs the Manage level in Training, because it assigns the course."}
                checked={retake} onCheckedChange={setRetake} disabled={!canRetake} labelSpacing="spread" />
              {retake ? <Input id="publish-due" name="dueOn" label="Due by" type="date" optional /> : null}
            </>
          ) : null}
        </>
      ) : <p className="text-sm text-ui-muted-foreground">You can publish again whenever you change it.</p>}
    </FormDialog>
  );
}
