"use client";

import { useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { Bold, CirclePlus, CircleHelp, FileDown, Footprints, GalleryHorizontal, PanelsTopLeft, PlayCircle, Heading2, Heading3, ImagePlus, Italic, Link as LinkIcon, List, ListOrdered, ListPlus, Megaphone, Minus, PanelTopOpen, Quote, Redo2, Table2, Trash2, Type, Undo2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import { FileField } from "@/components/ui/file-field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui-kit/notice";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Field } from "@/components/form-dialog";
import { ACTIVITY_BLOCK_KINDS, CALLOUT_META, CALLOUT_TONES, fileSrc, LESSON_KIND_META, MAX_ACTIVITY_BLOCKS, ONCE_PER_LESSON, safeHref, videoFor, type ActivityBlockKind, type CalloutTone } from "@/modules/training/shared/lessons";
import {
  activityKinds, addToBlock, BLOCK_META, blockAt, blockExtensions, CheckQuestions, CourseFiles, insertBlock, insertCheck, insertFileButton, insertSetupBlock, insertVideo, removeBlock, setTone,
} from "@/modules/training/features/builder/components/blocks";
import { BlockDialog, BlockSetup, MEDIA_BLOCK_META, newBlock, type BlockValue, type MediaBlockType } from "@/modules/training/features/builder/components/block-dialog";
import { uploadCourseFile, type UploadedFile } from "@/modules/training/features/builder/components/upload";

/** The lesson text editor: what a creator needs and nothing more. Headings,
 *  emphasis, lists, a key-point quote, links, images, tables and a divider.
 *  Saved as Tiptap JSON and cleaned on the server (`cleanDoc`). */

function extensions() {
  return [
    StarterKit.configure({ document: false, heading: { levels: [2, 3] }, code: false, codeBlock: false, link: { openOnClick: false, protocols: ["http", "https", "mailto"] } }),
    Image, Table.configure({ resizable: false }), TableRow, TableHeader, TableCell,
    ...blockExtensions(),
  ];
}

function Tool({ label, icon: Icon, onClick, active, disabled }: { label: string; icon: LucideIcon; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={label} aria-pressed={active} disabled={disabled}
          onMouseDown={(event) => event.preventDefault()} onClick={onClick}><Icon aria-hidden="true" /></Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const ATOM_LABEL = { knowledgeCheck: "Knowledge check", videoEmbed: "Video", fileButton: "File to download" } as const;

function Toolbar({ editor, disabled, openLink, openImage, openCheck, openVideo, openFile, openBlock }: {
  editor: Editor | null; disabled: boolean; openLink: () => void; openImage: () => void; openCheck: (() => void) | null; openVideo: () => void; openFile: () => void;
  openBlock: (block: BlockValue) => void;
}) {
  const state = useEditorState({ editor, selector: ({ editor: e }) => ({
    h2: e?.isActive("heading", { level: 2 }), h3: e?.isActive("heading", { level: 3 }), bold: e?.isActive("bold"), italic: e?.isActive("italic"),
    bullets: e?.isActive("bulletList"), numbers: e?.isActive("orderedList"), quote: e?.isActive("blockquote"), link: e?.isActive("link"),
    table: e?.isActive("table"), undo: e?.can().undo(), redo: e?.can().redo(),
    block: e ? blockAt(e)?.kind ?? null : null, kinds: e ? activityKinds(e).join(",") : "", tone: e ? (blockAt(e)?.node.attrs.tone as CalloutTone | undefined) ?? null : null,
  }) });
  const off = disabled || !editor;
  const run = (fn: (e: Editor) => void) => () => { if (editor && !off) fn(editor); };
  return (
    <div role="toolbar" aria-label="Formatting" className="tf-editor-toolbar">
      <Tool label="Heading" icon={Heading2} active={state?.h2} disabled={off} onClick={run((e) => e.chain().focus().toggleHeading({ level: 2 }).run())} />
      <Tool label="Subheading" icon={Heading3} active={state?.h3} disabled={off} onClick={run((e) => e.chain().focus().toggleHeading({ level: 3 }).run())} />
      <Tool label="Bold" icon={Bold} active={state?.bold} disabled={off} onClick={run((e) => e.chain().focus().toggleBold().run())} />
      <Tool label="Italic" icon={Italic} active={state?.italic} disabled={off} onClick={run((e) => e.chain().focus().toggleItalic().run())} />
      <span className="tf-editor-divider" aria-hidden="true" />
      <Tool label="Bullet list" icon={List} active={state?.bullets} disabled={off} onClick={run((e) => e.chain().focus().toggleBulletList().run())} />
      <Tool label="Numbered steps" icon={ListOrdered} active={state?.numbers} disabled={off} onClick={run((e) => e.chain().focus().toggleOrderedList().run())} />
      <Tool label="Key point" icon={Quote} active={state?.quote} disabled={off} onClick={run((e) => e.chain().focus().toggleBlockquote().run())} />
      <span className="tf-editor-divider" aria-hidden="true" />
      <Tool label="Link" icon={LinkIcon} active={state?.link} disabled={off} onClick={openLink} />
      <Tool label="Image" icon={ImagePlus} disabled={off} onClick={openImage} />
      <Tool label="Table" icon={Table2} disabled={off || state?.table} onClick={run((e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())} />
      <Tool label="Divider" icon={Minus} disabled={off} onClick={run((e) => e.chain().focus().setHorizontalRule().run())} />
      <span className="tf-editor-divider" aria-hidden="true" />
      <Tool label={`${BLOCK_META.callout.label}: ${BLOCK_META.callout.help}`} icon={Megaphone} disabled={off || !!state?.block} onClick={run((e) => insertBlock(e, "callout", "tip"))} />
      <Tool label={`${BLOCK_META.reveal.label}: ${BLOCK_META.reveal.help}`} icon={PanelTopOpen} disabled={off || !!state?.block} onClick={run((e) => insertBlock(e, "reveal"))} />
      <Tool label={`${BLOCK_META.flipCards.label}: ${BLOCK_META.flipCards.help}`} icon={GalleryHorizontal} disabled={off || !!state?.block} onClick={run((e) => insertBlock(e, "flipCards"))} />
      <Tool label={`${BLOCK_META.stepper.label}: ${BLOCK_META.stepper.help}`} icon={Footprints} disabled={off || !!state?.block} onClick={run((e) => insertBlock(e, "stepper"))} />
      <Tool label={`${BLOCK_META.tabs.label}: ${BLOCK_META.tabs.help}`} icon={PanelsTopLeft} disabled={off || !!state?.block} onClick={run((e) => insertBlock(e, "tabs"))} />
      <Tool label="Video: a YouTube or Vimeo video played right here in the text" icon={PlayCircle} disabled={off || !!state?.block} onClick={openVideo} />
      <Tool label="File to download: a button to open a PDF or picture, such as a form or a poster" icon={FileDown} disabled={off || !!state?.block} onClick={openFile} />
      {openCheck ? <Tool label="Knowledge check: one of this course's questions, answered right here" icon={CircleHelp} disabled={off || !!state?.block} onClick={openCheck} /> : null}
      <AddMenu disabled={off} choices={addChoices(state?.kinds ? state.kinds.split(",") : [])} pick={(choice) => choice.video ? openVideo() : choice.make && openBlock(choice.make())} />
      <span className="tf-editor-divider" aria-hidden="true" />
      <Tool label="Undo" icon={Undo2} disabled={off || !state?.undo} onClick={run((e) => e.chain().focus().undo().run())} />
      <Tool label="Redo" icon={Redo2} disabled={off || !state?.redo} onClick={run((e) => e.chain().focus().redo().run())} />
      {state?.block ? (
        <div className="tf-editor-context" role="group" aria-label="This block">
          <span className="text-xs font-semibold text-ui-muted-foreground">{state.block in ATOM_LABEL ? ATOM_LABEL[state.block as keyof typeof ATOM_LABEL] : BLOCK_META[state.block as keyof typeof BLOCK_META].label}</span>
          {state.block === "callout" ? (
            <NativeSelect aria-label="Kind of callout" value={state.tone ?? "note"} disabled={off} onChange={(event) => editor && setTone(editor, event.target.value as CalloutTone)} className="min-h-11">
              {CALLOUT_TONES.map((t) => <NativeSelectOption key={t} value={t}>{CALLOUT_META[t].label}</NativeSelectOption>)}
            </NativeSelect>
          ) : null}
          {state.block === "flipCards" || state.block === "stepper" || state.block === "tabs" ? (
            <Button type="button" variant="ghost" className="min-h-11" disabled={off} onMouseDown={(event) => event.preventDefault()} onClick={run(addToBlock)}>
              <ListPlus aria-hidden="true" />{state.block === "flipCards" ? "Add a card" : state.block === "tabs" ? "Add a tab" : "Add a step"}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" className="min-h-11" disabled={off} onMouseDown={(event) => event.preventDefault()} onClick={run(removeBlock)}><Trash2 aria-hidden="true" />Remove block</Button>
        </div>
      ) : null}
    </div>
  );
}

/** One thing Add can put in a lesson: media, or an activity learners finish. */
type AddChoice = { key: string; group: "Media" | "Activities"; label: string; help: string; icon: LucideIcon; disabled: boolean; video?: true; make?: () => BlockValue };

/** Everything a lesson can hold, for the Add menu and an empty lesson's start grid
 *  (D18: Add is the only way to put content in a lesson). `kinds`: the activities already there. */
function addChoices(kinds: string[]): AddChoice[] {
  const full = kinds.length >= MAX_ACTIVITY_BLOCKS;
  return [
    { key: "video", group: "Media", label: "Video", help: "A YouTube or Vimeo video, played right here.", icon: PlayCircle, disabled: false, video: true },
    ...(Object.keys(MEDIA_BLOCK_META) as MediaBlockType[]).map((type): AddChoice => ({ key: type, group: "Media", ...MEDIA_BLOCK_META[type], disabled: false, make: () => newBlock(type) })),
    ...ACTIVITY_BLOCK_KINDS.map((kind: ActivityBlockKind): AddChoice => ({
      key: kind, group: "Activities", label: kind === "QUIZ" ? "Practice quiz" : LESSON_KIND_META[kind].label, help: LESSON_KIND_META[kind].help, icon: LESSON_KIND_META[kind].icon,
      disabled: full || (ONCE_PER_LESSON.includes(kind) && kinds.includes(kind)), make: () => newBlock("activity", kind),
    })),
  ];
}

function AddMenu({ disabled, choices, pick }: { disabled: boolean; choices: AddChoice[]; pick: (choice: AddChoice) => void }) {
  const full = choices.filter((c) => c.group === "Activities").every((c) => c.disabled);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" className="min-h-11" disabled={disabled} onMouseDown={(event) => event.preventDefault()}><CirclePlus aria-hidden="true" />Add</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        {(["Media", "Activities"] as const).map((group, gi) => (
          <DropdownMenuGroup key={group}>
            {gi ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel>{group === "Media" ? "Media" : full ? `Activities (this lesson has the most it can hold: ${MAX_ACTIVITY_BLOCKS})` : "Activities: learners finish each one to move on"}</DropdownMenuLabel>
            {choices.filter((c) => c.group === group).map((c) => {
              const Icon = c.icon;
              return <DropdownMenuItem key={c.key} className="min-h-11 items-start" disabled={c.disabled} onSelect={() => pick(c)}><Icon aria-hidden="true" /><span><span className="block font-semibold">{c.label}</span><span className="block text-xs text-ui-muted-foreground">{c.help}</span></span></DropdownMenuItem>;
            })}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** An empty lesson: what it can hold, as tiles to start from. Once it has
 *  something, the same choices sit in the Add button. */
function StartGrid({ choices, pick, startText }: { choices: AddChoice[]; pick: (choice: AddChoice) => void; startText: () => void }) {
  const tile = (key: string, label: string, help: string, Icon: LucideIcon, onClick: () => void) => (
    <li key={key}><Button type="button" variant="outline" className="tf-start-tile" onClick={onClick}>
      <Icon aria-hidden="true" /><span className="flex min-w-0 flex-col items-start text-left"><span className="font-semibold">{label}</span><span className="text-xs font-normal text-ui-muted-foreground whitespace-normal">{help}</span></span>
    </Button></li>
  );
  return (
    <section className="tf-start-grid" aria-labelledby="start-grid-heading">
      <h3 id="start-grid-heading" className="text-sm font-semibold">Start this lesson with</h3>
      <ul>
        {tile("text", "Text", "Write it out, with headings, lists, pictures and tables.", Type, startText)}
        {choices.map((c) => tile(c.key, c.label, c.help, c.icon, () => pick(c)))}
      </ul>
    </section>
  );
}

export function RichText({ id, label, value, onChange, courseId, disabled = false, onUploaded, questions, files = [], section }: {
  id: string; label: string; value: JSONContent | null; onChange: (value: JSONContent) => void; courseId: string; disabled?: boolean;
  onUploaded?: (file: UploadedFile) => void;
  /** The course's files, to offer one to download. */
  files?: UploadedFile[];
  /** The course's questions, for knowledge checks. Leave out where checks don't belong. */
  questions?: { id: string; prompt: string }[];
  /** The lesson's section, for a Practice quiz. */
  section?: { id: string; count: number; href: string };
}) {
  const [panel, setPanel] = useState<"link" | "image" | "check" | "video" | "file" | null>(null);
  const [adding, setAdding] = useState<BlockValue | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [fileId, setFileId] = useState("");
  const [fileLabel, setFileLabel] = useState("");
  const [questionId, setQuestionId] = useState("");
  const [href, setHref] = useState("");
  const [alt, setAlt] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: extensions(),
    content: value ?? "",
    editable: !disabled,
    onUpdate: ({ editor: e }) => onChange(e.getJSON()),
    editorProps: { attributes: { id, class: "tf-lesson tf-editor-prose", role: "textbox", "aria-multiline": "true", "aria-labelledby": `${id}-label` } },
  });
  // Re-render as the text fills or empties; read straight from the editor so the
  // first render after it is created already knows.
  useEditorState({ editor, selector: ({ editor: e }) => !!e?.isEmpty });
  const empty = !!editor?.isEmpty;
  const close = () => { setPanel(null); setError(""); };
  const pick = (choice: AddChoice) => { setError(""); if (choice.video) setPanel("video"); else if (choice.make) { setPanel(null); setAdding(choice.make()); } };
  async function insert() {
    if (!editor) return;
    setError("");
    if (panel === "link") {
      if (!href.trim()) { editor.chain().focus().extendMarkRange("link").unsetLink().run(); close(); return; }
      const safe = safeHref(href);
      if (!safe) { setError("Use a link that starts https://, http:// or mailto:."); return; }
      editor.chain().focus().extendMarkRange("link").setLink({ href: safe }).run();
      close();
      return;
    }
    if (panel === "video") {
      const video = videoFor(videoUrl);
      if (!video) { setError("Use a video link that starts https://."); return; }
      insertVideo(editor, video.href);
      setVideoUrl(""); close();
      return;
    }
    if (panel === "file") {
      let chosen = fileId;
      if (!chosen && image) {
        setBusy(true);
        try { const added = await uploadCourseFile(courseId, image); onUploaded?.(added); chosen = added.id; }
        catch (caught) { setError((caught as Error).message); setBusy(false); return; }
        setBusy(false);
      }
      if (!chosen) { setError("Choose a file, or add a new one."); return; }
      insertFileButton(editor, chosen, fileLabel.trim() || "Download");
      setFileId(""); setFileLabel(""); setImage(null); close();
      return;
    }
    if (panel === "check") {
      if (!questionId) { setError("Choose a question."); return; }
      insertCheck(editor, questionId);
      setQuestionId(""); close();
      return;
    }
    if (!image) { setError("Choose an image."); return; }
    if (!alt.trim()) { setError("Describe the image for someone who can't see it."); return; }
    if (!image.type.startsWith("image/")) { setError("Use a JPEG, PNG or WebP image."); return; }
    setBusy(true);
    try {
      const file = await uploadCourseFile(courseId, image);
      onUploaded?.(file);
      editor.chain().focus().setImage({ src: fileSrc(file.id), alt: alt.trim().slice(0, 300) }).run();
      setAlt(""); setImage(null); close();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-label`} className="text-sm font-semibold">{label}</span>
      <div className="tf-editor" data-disabled={disabled || undefined}>
        <Toolbar editor={editor} disabled={disabled || busy}
          openLink={() => { setHref(editor?.getAttributes("link").href ?? ""); setPanel("link"); setError(""); }}
          openImage={() => { setPanel("image"); setError(""); }}
          openCheck={questions ? () => { setPanel("check"); setError(""); } : null}
          openVideo={() => { setPanel("video"); setError(""); }}
          openFile={() => { setPanel("file"); setError(""); }}
          openBlock={(block) => { setPanel(null); setError(""); setAdding(block); }} />
        {panel ? (
          <div className="tf-editor-panel">
            {panel === "link" ? (
              <Input id={`${id}-href`} label="Link" type="url" value={href} onChange={setHref} placeholder="https://" autoFocus description="Leave it empty to remove the link." />
            ) : panel === "video" ? (
              <Input id={`${id}-video`} label="Video link" type="url" value={videoUrl} onChange={setVideoUrl} placeholder="https://www.youtube.com/watch?v=…" autoFocus
                description="YouTube and Vimeo play inside the text. Any other https link becomes a Watch button." />
            ) : panel === "file" ? (
              <>
                <Input id={`${id}-file-label`} label="Button text" value={fileLabel} onChange={setFileLabel} maxLength={120} placeholder="Download the daily pool test sheet" />
                <Field label="File" htmlFor={`${id}-file`} hint="Learners open it from the lesson.">
                  <NativeSelect id={`${id}-file`} value={fileId} onChange={(event) => setFileId(event.target.value)} className="min-h-11 w-full">
                    <NativeSelectOption value="">{files.length ? "Choose a file" : "No files yet: add one below"}</NativeSelectOption>
                    {files.filter((f) => !f.mime.startsWith("audio/")).map((f) => <NativeSelectOption key={f.id} value={f.id}>{f.name}</NativeSelectOption>)}
                  </NativeSelect>
                </Field>
                {fileId ? null : <FileField label="Or add a new file" description="PDF, JPEG, PNG or WebP, up to 4 MB." accept="application/pdf,image/png,image/jpeg,image/webp" pending={busy} onChange={(event) => setImage(event.target.files?.[0] ?? null)} />}
              </>
            ) : panel === "check" ? (
              questions?.length ? (
                <Field label="Question to ask" htmlFor={`${id}-check`} hint="Learners answer it right here and see straight away if they're right. It isn't marked.">
                  <NativeSelect id={`${id}-check`} value={questionId} onChange={(event) => setQuestionId(event.target.value)} className="min-h-11 w-full">
                    <NativeSelectOption value="">Choose a question</NativeSelectOption>
                    {questions.map((q) => <NativeSelectOption key={q.id} value={q.id}>{q.prompt.slice(0, 120)}</NativeSelectOption>)}
                  </NativeSelect>
                </Field>
              ) : <Notice tone="info" title="This course has no questions yet">Add questions to a section first, then ask one here.</Notice>
            ) : (
              <>
                <FileField label="Image" description="JPEG, PNG or WebP, up to 4 MB." accept="image/png,image/jpeg,image/webp" pending={busy} onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
                <Input id={`${id}-alt`} label="Describe the image" value={alt} onChange={setAlt} maxLength={300} description="Read out to anyone using a screen reader, for example: Chlorine test kit with the three vials filled." />
              </>
            )}
            {error ? <Notice tone="error" live="alert" title={error} /> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={close}>Cancel</Button>
              <Button type="button" className="min-h-11" disabled={busy} onClick={insert}>{busy ? "Uploading…" : panel === "link" ? "Save link" : panel === "check" ? "Insert question" : panel === "video" ? "Insert video" : panel === "file" ? "Insert button" : "Insert image"}</Button>
            </div>
          </div>
        ) : null}
        <BlockSetup.Provider value={{ courseId, files, onUploaded, section }}>
          {empty && !disabled && !panel ? <StartGrid choices={addChoices([])} pick={pick} startText={() => editor?.commands.focus()} /> : null}
          <CheckQuestions.Provider value={questions ?? []}>
            <CourseFiles.Provider value={files}>
              <EditorContent editor={editor} />
            </CourseFiles.Provider>
          </CheckQuestions.Provider>
          {adding ? <BlockDialog value={adding} isNew onClose={() => setAdding(null)} onSave={(block) => { if (editor) insertSetupBlock(editor, block); setAdding(null); }} /> : null}
        </BlockSetup.Provider>
      </div>
    </div>
  );
}
