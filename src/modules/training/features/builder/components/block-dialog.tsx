"use client";

import { createContext, useContext, useState } from "react";
import Link from "next/link";
import { FileText, Headphones, ListChecks, MonitorPlay, type LucideIcon } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Field } from "@/components/form-dialog";
import { FileField } from "@/components/ui/file-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Notice } from "@/components/ui-kit/notice";
import {
  EMBED_SOURCES, embedFor, fileSrc, LESSON_KIND_META, startingLessonData, type ActivityBlockKind, type LessonData,
} from "@/modules/training/shared/lessons";
import { CardsEditor, ChecklistEditor, ExploreEditor, HandInEditor, id as newId, ScenarioEditor, SortingEditor } from "@/modules/training/features/builder/components/lesson-kinds";
import { uploadCourseFile, type UploadedFile } from "@/modules/training/features/builder/components/upload";

/** Several things in one lesson (owner decision, 29 October 2026): a recording,
 *  slides, a PDF or picture, or an activity placed in the lesson text. Each one
 *  is set up here, in a dialog, with the same editors its lesson kind uses; the
 *  server cleans it again on save (`cleanDoc`). */

export type MediaBlockType = "audioBlock" | "slidesBlock" | "fileView";
export type BlockValue =
  | { type: "audioBlock"; fileId: string; transcript: string }
  | { type: "slidesBlock"; url: string }
  | { type: "fileView"; fileId: string }
  | { type: "activity"; id: string; kind: ActivityBlockKind; fileId: string; data: LessonData | null };

export const MEDIA_BLOCK_META: Record<MediaBlockType, { label: string; help: string; icon: LucideIcon }> = {
  audioBlock: { label: "Audio", help: "A recording that keeps playing while learners read or click through slides.", icon: Headphones },
  slidesBlock: { label: "Slides or interactive", help: `Google Slides, Canva, Genially and more, shown right here in the text.`, icon: MonitorPlay },
  fileView: { label: "PDF or picture", help: "A PDF or picture shown in the lesson, not just a download.", icon: FileText },
};

/** The course, its files and where new uploads go, for the block editors in the text. */
export type BlockSetupValue = {
  courseId: string; files: UploadedFile[]; onUploaded?: (file: UploadedFile) => void;
  /** The lesson's section, for a Practice quiz: how many questions, and where to edit them. */
  section?: { id: string; count: number; href: string };
};
export const BlockSetup = createContext<BlockSetupValue>({ courseId: "", files: [] });

export function newBlock(type: MediaBlockType | "activity", kind: ActivityBlockKind = "CHECKLIST"): BlockValue {
  if (type === "audioBlock") return { type, fileId: "", transcript: "" };
  if (type === "slidesBlock") return { type, url: "" };
  if (type === "fileView") return { type, fileId: "" };
  return { type: "activity", id: newId(), kind, fileId: "", data: startingLessonData(kind, newId) };
}

/** A block as the editor node keeps it, and back. */
export function blockFromNode(type: string, attrs: Record<string, unknown>): BlockValue | null {
  const text = (v: unknown) => typeof v === "string" ? v : "";
  if (type === "audioBlock") return { type, fileId: text(attrs.fileId), transcript: text(attrs.transcript) };
  if (type === "slidesBlock") return { type, url: text(attrs.url) };
  if (type === "fileView") return { type, fileId: text(attrs.fileId) };
  if (type === "activity" && typeof attrs.kind === "string" && attrs.kind in LESSON_KIND_META) {
    return { type, id: text(attrs.id) || newId(), kind: attrs.kind as ActivityBlockKind, fileId: text(attrs.fileId), data: (attrs.data ?? null) as LessonData | null };
  }
  return null;
}
export function nodeAttrs(value: BlockValue): Record<string, unknown> {
  const attrs: Record<string, unknown> = { ...value };
  delete attrs.type;
  return "fileId" in attrs ? { ...attrs, fileId: attrs.fileId || null } : attrs;
}

export const blockLabel = (value: BlockValue) => value.type === "activity"
  ? (value.kind === "QUIZ" ? "Practice quiz" : LESSON_KIND_META[value.kind].label) : MEDIA_BLOCK_META[value.type].label;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** One line under the block in the editor: what it holds. */
export function blockSummary(value: BlockValue, { files, section }: Pick<BlockSetupValue, "files" | "section">): string {
  const name = (fid: string) => files.find((f) => f.id === fid)?.name ?? "";
  if (value.type === "audioBlock") return [name(value.fileId) || "No recording yet", value.transcript.trim() ? "with a transcript" : ""].filter(Boolean).join(", ");
  if (value.type === "slidesBlock") return embedFor(value.url)?.provider ?? "No link yet";
  if (value.type === "fileView") return name(value.fileId) || "No file yet";
  const d = value.data;
  if (value.kind === "CHECKLIST") return count(d?.items?.filter((i) => i.text).length ?? 0, "thing to tick off", "things to tick off");
  if (value.kind === "FLASHCARDS") return count(d?.cards?.filter((c) => c.front || c.back).length ?? 0, "card", "cards");
  if (value.kind === "SORTING") return count(d?.sorts?.filter((s) => s.text).length ?? 0, "thing to sort", "things to sort");
  if (value.kind === "SCENARIO") return count(d?.steps?.length ?? 0, "scene", "scenes");
  if (value.kind === "QUIZ") return section ? `practises the ${count(section.count, "question", "questions")} in this section` : "practises this section's questions";
  if (value.kind === "ASSIGNMENT") {
    const h = d?.handIn, parts = [h?.text !== "off" ? "a written answer" : "", h?.photo !== "off" ? "a photo or PDF" : ""].filter(Boolean).join(" or ");
    return `learners hand in ${parts || "nothing yet"}${h?.review === false ? "" : ", checked by a trainer"}`;
  }
  return count(d?.spots?.length ?? 0, "spot", "spots");
}

const AUDIO_TYPES = "audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,audio/wav,.mp3,.m4a,.ogg,.wav";
const FILE_TYPES = "application/pdf,image/png,image/jpeg,image/webp";
const IMAGE_TYPES = "image/png,image/jpeg,image/webp";

/** Sets up one block. `isNew`: it goes into the text when saved; otherwise the block is updated. */
export function BlockDialog({ value, isNew, onSave, onClose }: { value: BlockValue; isNew: boolean; onSave: (value: BlockValue) => void; onClose: () => void }) {
  const { courseId, files, onUploaded, section } = useContext(BlockSetup);
  const [draft, setDraft] = useState<BlockValue>(value);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const label = blockLabel(draft);
  const set = (patch: Partial<BlockValue>) => setDraft((d) => ({ ...d, ...patch }) as BlockValue);
  const images = files.filter((f) => f.mime.startsWith("image/"));
  const recordings = files.filter((f) => f.mime.startsWith("audio/"));
  const documents = files.filter((f) => !f.mime.startsWith("audio/"));
  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true); setError("");
    try {
      const added = await uploadCourseFile(courseId, file);
      onUploaded?.(added);
      set({ fileId: added.id } as Partial<BlockValue>);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setUploading(false);
    }
  }
  function save() {
    if (draft.type === "audioBlock" && !draft.fileId) { setError("Choose a recording, or add a new one."); return; }
    if (draft.type === "slidesBlock" && !embedFor(draft.url)) { setError(`Use a link from ${EMBED_SOURCES}.`); return; }
    if (draft.type === "fileView" && !draft.fileId) { setError("Choose a file, or add a new one."); return; }
    onSave(draft);
  }
  const embed = draft.type === "slidesBlock" && draft.url ? embedFor(draft.url) : null;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-(--overlay-max-height) flex-col sm:max-w-2xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{isNew ? `Add ${label.toLowerCase()}` : label}</DialogTitle>
          <DialogDescription>{draft.type === "activity" ? (draft.kind === "ASSIGNMENT" ? "The lesson is done once they hand it in, or once a trainer accepts it if you ask for a check." : "Learners finish it before they can move on from this lesson.") : MEDIA_BLOCK_META[draft.type].help}</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          {draft.type === "audioBlock" ? (
            <>
              <Field label="Recording" htmlFor="block-audio" hint="Such as a briefing to listen to while the slides are open.">
                <NativeSelect id="block-audio" value={draft.fileId} onChange={(event) => set({ fileId: event.target.value })} className="min-h-11 w-full">
                  <NativeSelectOption value="">{recordings.length ? "Choose a recording" : "No recordings yet: add one below"}</NativeSelectOption>
                  {recordings.map((f) => <NativeSelectOption key={f.id} value={f.id}>{f.name}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
              <FileField label="Or add a recording" description="MP3, M4A, OGG or WAV, up to 4 MB: about four minutes of speech." accept={AUDIO_TYPES} pending={uploading} onChange={(event) => upload(event.target.files?.[0])} />
              {draft.fileId ? <audio controls preload="metadata" src={fileSrc(draft.fileId)} className="w-full"><track kind="captions" /></audio> : null}
              <Textarea id="block-transcript" label="Transcript" optional rows={6} maxLength={20000} value={draft.transcript} onChange={(event) => set({ transcript: event.target.value })}
                description="What is said, for anyone who can't listen at work. Learners open it under the player." />
            </>
          ) : draft.type === "slidesBlock" ? (
            <>
              <Input id="block-slides" label="Link to the slides or activity" type="url" value={draft.url} onChange={(url) => set({ url })} placeholder="https://docs.google.com/presentation/d/…" autoFocus
                description={`Paste the share or publish link from ${EMBED_SOURCES}. Share it so anyone with the link can view it.`} />
              {embed ? (
                <div className="tf-embed"><iframe src={embed.src} title={`${embed.provider}: preview`} loading="lazy" allow="fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>
              ) : draft.url ? <Notice tone="warning" title="That link can’t be shown in a lesson">Use a link from {EMBED_SOURCES}.</Notice> : null}
            </>
          ) : draft.type === "fileView" ? (
            <>
              <Field label="File" htmlFor="block-file" hint="A picture shows in the text. A PDF shows in the text on bigger screens, with a button to open it.">
                <NativeSelect id="block-file" value={draft.fileId} onChange={(event) => set({ fileId: event.target.value })} className="min-h-11 w-full">
                  <NativeSelectOption value="">{documents.length ? "Choose a file" : "No files yet: add one below"}</NativeSelectOption>
                  {documents.map((f) => <NativeSelectOption key={f.id} value={f.id}>{f.name}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
              <FileField label="Or add a new file" description="PDF, JPEG, PNG or WebP, up to 4 MB." accept={FILE_TYPES} pending={uploading} onChange={(event) => upload(event.target.files?.[0])} />
            </>
          ) : (
            <>
              {draft.kind === "EXPLORE" ? (
                <>
                  <Field label="Picture" htmlFor="block-explore" hint="A clear photo or plan, such as the plant room or the first aid room.">
                    <NativeSelect id="block-explore" value={draft.fileId} onChange={(event) => set({ fileId: event.target.value })} className="min-h-11 w-full">
                      <NativeSelectOption value="">Choose a picture</NativeSelectOption>
                      {images.map((f) => <NativeSelectOption key={f.id} value={f.id}>{f.name}</NativeSelectOption>)}
                    </NativeSelect>
                  </Field>
                  <FileField label="Or add a new picture" description="JPEG, PNG or WebP, up to 4 MB." accept={IMAGE_TYPES} pending={uploading} onChange={(event) => upload(event.target.files?.[0])} />
                  <ExploreEditor imageId={draft.fileId || null} data={draft.data} onChange={(data) => set({ data })} disabled={false} />
                </>
              ) : null}
              {draft.kind === "CHECKLIST" ? <ChecklistEditor data={draft.data} onChange={(data) => set({ data })} disabled={false} /> : null}
              {draft.kind === "FLASHCARDS" ? <CardsEditor data={draft.data} onChange={(data) => set({ data })} images={images} disabled={false} /> : null}
              {draft.kind === "SORTING" ? <SortingEditor title={label} data={draft.data} onChange={(data) => set({ data })} disabled={false} /> : null}
              {draft.kind === "QUIZ" ? (
                <Notice tone={section?.count ? "info" : "warning"} title={section?.count ? `Practises the ${count(section.count, "question", "questions")} in this section` : "This section has no questions yet"}
                  actions={section ? <Button asChild variant="outline" className="min-h-11"><Link href={section.href}><ListChecks aria-hidden="true" />{section.count ? "Edit the questions" : "Add questions"}</Link></Button> : undefined}>
                  Learners answer one question at a time and see straight away whether they got it right. It isn’t marked. A lesson holds one practice quiz.
                </Notice>
              ) : null}
              {draft.kind === "ASSIGNMENT" ? (
                <>
                  <p className="text-sm text-ui-muted-foreground">It goes at the end of the lesson. Write the task in the lesson text above it: what to do and what to hand in.</p>
                  <HandInEditor data={draft.data} onChange={(data) => set({ data })} disabled={false} />
                </>
              ) : null}
              {draft.kind === "SCENARIO" ? <ScenarioEditor title={label} data={draft.data} onChange={(data) => set({ data })} images={images} disabled={false} /> : null}
            </>
          )}
          {error ? <Notice tone="error" live="alert" title={error} /> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>Cancel</Button>
          <Button type="button" className="min-h-11" disabled={uploading} onClick={save}>{uploading ? "Uploading…" : isNew ? "Add to the lesson" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
