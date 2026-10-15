"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { JSONContent } from "@tiptap/react";
import { ArrowDown, ArrowUp, CircleCheck, Eye, FilePlus2, FileText, Pencil, Plus, Rocket, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { RadioGroup } from "@/components/shadcn/radio-group";
import { ConfirmAction } from "@/components/confirm-action";
import { Field, FormDialog } from "@/components/form-dialog";
import { ChoiceRow } from "@/components/ui/choice-row";
import { FileField } from "@/components/ui/file-field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { toast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Notice } from "@/components/ui-kit/notice";
import { cn } from "@/lib/utils";
import { THEME } from "@/modules/training/shared/components/dialog-kit";
import { LESSON_KIND_META, LESSON_KINDS, lessonMinutes, publishProblems, videoFor, type LessonKind, type Outline, type OutlineLesson } from "@/modules/training/shared/lessons";
import {
  addLesson, addSection, moveLesson, moveSection, publishCourse, removeLesson, removeSection, renameSection, saveLesson, startFromOldText,
} from "@/modules/training/features/builder/server/actions";
import { RichText, uploadCourseFile, type UploadedFile } from "@/modules/training/features/builder/components/rich-text";

type Props = {
  courseId: string;
  title: string;
  hasOldText: boolean;
  draft: Outline;
  files: UploadedFile[];
  selected: string | null;
  canEdit: boolean;
  /** Whether the draft differs from what learners get (always true before the first publish). */
  changed: boolean;
};

const hrefFor = (courseId: string, lessonId?: string) => `/training/courses/${courseId}${lessonId ? `?lesson=${lessonId}` : ""}`;

/** The builder: the outline on the left, the open lesson on the right. Every
 *  change saves to the draft at once; learners only see it once it is published. */
export function CourseBuilder({ courseId, title, hasOldText, draft, files: initialFiles, selected, canEdit, changed }: Props) {
  const lessons = draft.sections.flatMap((s) => s.lessons);
  const open = lessons.find((l) => l.id === selected) ?? null;
  // Files uploaded since the page loaded, until the refreshed page brings them.
  const [added, setAdded] = useState<UploadedFile[]>([]);
  const files = [...initialFiles, ...added.filter((a) => !initialFiles.some((f) => f.id === a.id))];
  const addFile = (file: UploadedFile) => setAdded((now) => [...now, file]);
  return (
    <div className="grid gap-6 lg:grid-cols-[var(--pc-rail-width)_minmax(0,1fr)] items-start">
      <OutlinePanel courseId={courseId} hasOldText={hasOldText} draft={draft} selected={open?.id ?? null} canEdit={canEdit} />
      {open ? (
        <LessonEditor key={open.id} courseId={courseId} lesson={open} files={files} onUploaded={addFile} canEdit={canEdit}
          position={{ index: lessons.indexOf(open), total: lessons.length }} />
      ) : (
        <StartPanel courseId={courseId} title={title} draft={draft} canEdit={canEdit} changed={changed} />
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

function OutlinePanel({ courseId, hasOldText, draft, selected, canEdit }: { courseId: string; hasOldText: boolean; draft: Outline; selected: string | null; canEdit: boolean }) {
  const { act, pending } = useAct();
  const router = useRouter();
  const lessonCount = draft.sections.reduce((n, s) => n + s.lessons.length, 0);
  return (
    <nav aria-label="Course outline" className="pc-panel flex flex-col gap-4 lg:sticky lg:top-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[length:var(--pc-text-title)] leading-[var(--pc-leading-title)]">Outline</h2>
        <span className="text-sm text-ui-muted-foreground tabular-nums">{lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}</span>
      </div>
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
              <h3 className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-ui-muted-foreground">
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
                const Icon = LESSON_KIND_META[lesson.kind].icon;
                const current = lesson.id === selected;
                return (
                  <li key={lesson.id}>
                    <Link href={hrefFor(courseId, lesson.id)} aria-current={current ? "page" : undefined} className={cn("tf-outline-row", current && "is-current")}>
                      <Icon aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                      {lessonMinutes(lesson) ? <span className="text-xs text-ui-muted-foreground tabular-nums">{lessonMinutes(lesson)} min</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ol>
            {canEdit ? <AddLessonDialog sectionId={section.id} sectionTitle={section.title} onAdded={(id) => router.push(hrefFor(courseId, id))} /> : null}
          </li>
        ))}
      </ol>
      {canEdit ? (
        <div className="flex flex-col gap-2 border-t border-ui-border pt-4">
          <SectionDialog courseId={courseId} />
          {draft.sections.length === 0 && hasOldText ? (
            <Button type="button" variant="outline" className="min-h-11" disabled={pending}
              onClick={() => act(() => startFromOldText(courseId), undefined)}><FilePlus2 aria-hidden="true" />Use the current text as lesson 1</Button>
          ) : null}
        </div>
      ) : null}
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

function AddLessonDialog({ sectionId, sectionTitle, onAdded }: { sectionId: string; sectionTitle: string; onAdded: (id: string) => void }) {
  const [kind, setKind] = useState<LessonKind>("READING");
  return (
    <FormDialog
      portalClassName={THEME}
      trigger={<Button type="button" variant="ghost" className="min-h-11 justify-start text-ui-primary"><Plus aria-hidden="true" />Add a lesson</Button>}
      title={`Add a lesson to ${sectionTitle}`}
      description="Each lesson is one screen in Turnfin Me. Keep it short: one idea, a few minutes."
      submitLabel="Add and open"
      successMessage="Lesson added"
      submit={async (formData) => {
        const result = await addLesson(sectionId, kind, String(formData.get("title") ?? ""));
        if (result.ok) onAdded(result.id);
        return result.ok ? { ok: true } : result;
      }}
    >
      <Input id={`lesson-title-${sectionId}`} name="title" label="Lesson name" required minLength={2} maxLength={120} autoFocus />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Kind of lesson</legend>
        <RadioGroup value={kind} onValueChange={(value) => setKind(value as LessonKind)} className="gap-2">
          {LESSON_KINDS.map((k) => <ChoiceRow key={k} type="radio" value={k} id={`kind-${sectionId}-${k}`} title={LESSON_KIND_META[k].label} hint={LESSON_KIND_META[k].help} />)}
        </RadioGroup>
      </fieldset>
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------
// Course overview (no lesson open)
// ---------------------------------------------------------------------------

function StartPanel({ courseId, title, draft, canEdit, changed }: { courseId: string; title: string; draft: Outline; canEdit: boolean; changed: boolean }) {
  const problems = useMemo(() => publishProblems(draft), [draft]);
  const lessons = draft.sections.flatMap((s) => s.lessons);
  const minutes = lessons.reduce((n, l) => n + (lessonMinutes(l) ?? 0), 0);
  if (!lessons.length) {
    return (
      <section className="pc-panel" aria-label="Get started">
        <EmptyState as="h2" icon="book" title="Build the first lesson"
          hint={canEdit ? "Add a section in the outline, then a lesson inside it. Each lesson is one screen on the learner's phone." : "Nobody has added lessons to this course yet."} />
      </section>
    );
  }
  return (
    <section className="pc-panel flex flex-col gap-4" aria-labelledby="overview-title">
      <h2 id="overview-title" className="text-[length:var(--pc-text-title)] leading-[var(--pc-leading-title)]">{title}</h2>
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(var(--pc-tile-min),1fr))] gap-3">
        {[["Sections", draft.sections.length], ["Lessons", lessons.length], ["About", `${minutes} min`]].map(([label, value]) => (
          <div key={label} className="rounded-[var(--pc-radius-card)] bg-ui-muted p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-ui-muted-foreground">{label}</dt>
            <dd className="text-[length:var(--pc-text-title)] font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {problems.length ? (
        <Notice tone="warning" title="Before you can publish">
          <ul className="list-disc pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </Notice>
      ) : !changed ? (
        <Notice tone="success" title="Learners have this version">Change a lesson and publish again when you want learners to get the change.</Notice>
      ) : (
        <Notice tone="success" title="Ready to publish">Preview it as a learner first, then publish from the top of the page.</Notice>
      )}
      <Button asChild variant="outline" className="min-h-11 self-start"><Link href={`/training/courses/${courseId}/preview`}><Eye aria-hidden="true" />Preview as a learner</Link></Button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// One lesson
// ---------------------------------------------------------------------------

function LessonEditor({ courseId, lesson, files, onUploaded, canEdit, position }: {
  courseId: string; lesson: OutlineLesson; files: UploadedFile[]; onUploaded: (file: UploadedFile) => void; canEdit: boolean; position: { index: number; total: number };
}) {
  const router = useRouter();
  const { act, pending } = useAct();
  const [title, setTitle] = useState(lesson.title);
  const [body, setBody] = useState<JSONContent | null>(lesson.body as JSONContent | null);
  const [videoUrl, setVideoUrl] = useState(lesson.videoUrl);
  const [fileId, setFileId] = useState(lesson.fileId ?? "");
  const [minutes, setMinutes] = useState(lesson.minutes ? String(lesson.minutes) : "");
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState("");
  const change = <T,>(set: (value: T) => void) => (value: T) => { set(value); setDirty(true); };
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const video = lesson.kind === "VIDEO" && videoUrl ? videoFor(videoUrl) : null;
  const meta = LESSON_KIND_META[lesson.kind];
  const Icon = meta.icon;
  const save = () => act(() => saveLesson(lesson.id, {
    title, body: body ? JSON.stringify(body) : null, videoUrl, fileId, minutes: minutes.trim() ? Number(minutes) : null,
  }), () => { setDirty(false); toast.success("Lesson saved"); });
  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true); setFileError("");
    try {
      const added = await uploadCourseFile(courseId, file);
      onUploaded(added);
      setFileId(added.id); setDirty(true);
    } catch (caught) {
      setFileError((caught as Error).message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <section className="pc-panel flex flex-col gap-5" aria-labelledby="lesson-heading">
      <div className="flex flex-wrap items-center gap-3">
        <span className="pc-tile-icon"><Icon aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-ui-muted-foreground">{meta.label} · lesson {position.index + 1} of {position.total}</p>
          <h2 id="lesson-heading" className="truncate text-[length:var(--pc-text-title)] leading-[var(--pc-leading-title)]">{title || "Untitled lesson"}</h2>
        </div>
        {canEdit ? (
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="Move lesson up" disabled={pending || position.index === 0} onClick={() => act(() => moveLesson(lesson.id, "up"))}><ArrowUp aria-hidden="true" /></Button>
            <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="Move lesson down" disabled={pending || position.index === position.total - 1} onClick={() => act(() => moveLesson(lesson.id, "down"))}><ArrowDown aria-hidden="true" /></Button>
          </div>
        ) : null}
      </div>

      <Input id="lesson-title" label="Lesson name" value={title} onChange={change(setTitle)} required maxLength={120} disabled={!canEdit} />

      {lesson.kind === "VIDEO" ? (
        <div className="flex flex-col gap-3">
          <Input id="lesson-video" label="Video link" type="url" value={videoUrl} onChange={change(setVideoUrl)} placeholder="https://www.youtube.com/watch?v=…" disabled={!canEdit}
            description="YouTube and Vimeo play inside the lesson. Upload training videos to YouTube as Unlisted so only people with the link can find them." />
          {video?.embed ? (
            <div className="tf-video"><iframe src={video.embed} title={`Video: ${title}`} allow="encrypted-media; picture-in-picture; fullscreen" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /></div>
          ) : video ? (
            <Notice title={`Opens on ${video.provider}`}>This link opens in a new tab rather than playing inside the lesson.</Notice>
          ) : videoUrl ? <Notice tone="warning" title="Use a link that starts https://" /> : null}
        </div>
      ) : null}

      {lesson.kind === "FILE" ? (
        <div className="flex flex-col gap-3">
          <Field label="File" htmlFor="lesson-file" hint="The PDF or image learners open in this lesson.">
            <NativeSelect id="lesson-file" value={fileId} disabled={!canEdit} onChange={(event) => change(setFileId)(event.target.value)} className="min-h-11 w-full">
              <NativeSelectOption value="">Choose a file</NativeSelectOption>
              {files.map((f) => <NativeSelectOption key={f.id} value={f.id}>{f.name}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          {canEdit ? <FileField label="Or add a new file" description="PDF, JPEG, PNG or WebP, up to 4 MB." accept="application/pdf,image/png,image/jpeg,image/webp" pending={uploading} onChange={(event) => upload(event.target.files?.[0])} error={fileError || undefined} /> : null}
          {fileId ? <Button asChild variant="outline" className="min-h-11 self-start"><a href={`/training/files/${fileId}`} target="_blank" rel="noopener noreferrer"><FileText aria-hidden="true" />Open the file</a></Button> : null}
        </div>
      ) : null}

      <RichText id="lesson-body" label={lesson.kind === "READING" ? "Lesson text" : "Notes under it (optional)"} value={body} onChange={change(setBody)} courseId={courseId} disabled={!canEdit} onUploaded={onUploaded} />

      <Input id="lesson-minutes" label="Minutes it takes" type="number" inputMode="numeric" min={1} max={240} value={minutes} onChange={change(setMinutes)} optional disabled={!canEdit}
        description={lesson.kind === "READING" ? "Leave it empty to use the reading time of the text." : "Shown to learners beside the lesson."} className="max-w-xs" />

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
    </section>
  );
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

export function PublishCourse({ courseId, title, changed, published, openAssignments }: {
  courseId: string; title: string; changed: boolean; published: { number: number } | null; openAssignments: number;
}) {
  const router = useRouter();
  if (!changed) return <Button type="button" className="min-h-11" disabled><Rocket aria-hidden="true" />Published</Button>;
  return (
    <ConfirmAction
      trigger={<Button type="button" className="min-h-11"><Rocket aria-hidden="true" />{published ? `Publish version ${published.number + 1}` : "Publish"}</Button>}
      title={published ? `Publish version ${published.number + 1} of ${title}?` : `Publish ${title}?`}
      description={published
        ? `New assignments get this version, and so does anyone who hasn't started. ${openAssignments ? "People part-way through keep the version they started, so their record shows what they were taught." : ""}`
        : "People you assign it to can take it in Turnfin Me. Anyone already assigned gets it the next time they open it."}
      confirmLabel="Publish"
      successMessage="Published"
      run={async () => { const result = await publishCourse(courseId); if (result.ok) router.refresh(); return result; }}
    />
  );
}
