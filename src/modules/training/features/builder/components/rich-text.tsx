"use client";

import { useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { Bold, Heading2, Heading3, ImagePlus, Italic, Link as LinkIcon, List, ListOrdered, Minus, Quote, Redo2, Table2, Undo2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn/tooltip";
import { FileField } from "@/components/ui/file-field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui-kit/notice";
import { fileSrc, safeHref } from "@/modules/training/shared/lessons";

/** The lesson text editor: what a creator needs and nothing more. Headings,
 *  emphasis, lists, a key-point quote, links, images, tables and a divider.
 *  Saved as Tiptap JSON and cleaned on the server (`cleanDoc`). */

export type UploadedFile = { id: string; name: string; mime: string; size: number };

function extensions() {
  return [
    StarterKit.configure({ heading: { levels: [2, 3] }, code: false, codeBlock: false, link: { openOnClick: false, protocols: ["http", "https", "mailto"] } }),
    Image, Table.configure({ resizable: false }), TableRow, TableHeader, TableCell,
  ];
}

/** Sends one file to the course and returns it. Errors are sentences for the author. */
export async function uploadCourseFile(courseId: string, file: File): Promise<UploadedFile> {
  const form = new FormData();
  form.set("courseId", courseId);
  form.set("file", file);
  const response = await fetch("/training/files", { method: "POST", body: form }).catch(() => null);
  const data = await response?.json().catch(() => null);
  if (!response || !data?.ok) throw new Error(data?.error ?? "Could not add the file. Try again.");
  return data.file as UploadedFile;
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

function Toolbar({ editor, disabled, openLink, openImage }: { editor: Editor | null; disabled: boolean; openLink: () => void; openImage: () => void }) {
  const state = useEditorState({ editor, selector: ({ editor: e }) => ({
    h2: e?.isActive("heading", { level: 2 }), h3: e?.isActive("heading", { level: 3 }), bold: e?.isActive("bold"), italic: e?.isActive("italic"),
    bullets: e?.isActive("bulletList"), numbers: e?.isActive("orderedList"), quote: e?.isActive("blockquote"), link: e?.isActive("link"),
    table: e?.isActive("table"), undo: e?.can().undo(), redo: e?.can().redo(),
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
      <Tool label="Undo" icon={Undo2} disabled={off || !state?.undo} onClick={run((e) => e.chain().focus().undo().run())} />
      <Tool label="Redo" icon={Redo2} disabled={off || !state?.redo} onClick={run((e) => e.chain().focus().redo().run())} />
    </div>
  );
}

export function RichText({ id, label, value, onChange, courseId, disabled = false, onUploaded }: {
  id: string; label: string; value: JSONContent | null; onChange: (value: JSONContent) => void; courseId: string; disabled?: boolean;
  onUploaded?: (file: UploadedFile) => void;
}) {
  const [panel, setPanel] = useState<"link" | "image" | null>(null);
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
  const close = () => { setPanel(null); setError(""); };
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
          openImage={() => { setPanel("image"); setError(""); }} />
        {panel ? (
          <div className="tf-editor-panel">
            {panel === "link" ? (
              <Input id={`${id}-href`} label="Link" type="url" value={href} onChange={setHref} placeholder="https://" autoFocus description="Leave it empty to remove the link." />
            ) : (
              <>
                <FileField label="Image" description="JPEG, PNG or WebP, up to 4 MB." accept="image/png,image/jpeg,image/webp" pending={busy} onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
                <Input id={`${id}-alt`} label="Describe the image" value={alt} onChange={setAlt} maxLength={300} description="Read out to anyone using a screen reader, for example: Chlorine test kit with the three vials filled." />
              </>
            )}
            {error ? <Notice tone="error" live="alert" title={error} /> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={close}>Cancel</Button>
              <Button type="button" className="min-h-11" disabled={busy} onClick={insert}>{busy ? "Uploading…" : panel === "link" ? "Save link" : "Insert image"}</Button>
            </div>
          </div>
        ) : null}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
