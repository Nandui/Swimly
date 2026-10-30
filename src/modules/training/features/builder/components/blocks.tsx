"use client";

import { createContext, useContext, useState } from "react";
import { isNodeSelection, mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type Editor, type JSONContent, type NodeViewProps } from "@tiptap/react";
import { ArrowDown, ArrowUp, CircleHelp, FileDown, Pencil, PlayCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { CALLOUT_META, LESSON_KIND_META, videoFor, type CalloutTone } from "@/modules/training/shared/lessons";
import {
  BlockDialog, blockFromNode, blockLabel, BlockSetup, blockSummary, MEDIA_BLOCK_META, nodeAttrs, type BlockValue,
} from "@/modules/training/features/builder/components/block-dialog";

/** Interactive blocks for lesson text (e-learning phases 3
 *  and 8): a coloured callout, a tap-to-reveal, flip cards, a step-by-step, a
 *  knowledge check, tabs, a video and a file to download. The editor shows each one open, labelled, so authors can
 *  write in it; learners get the interactive version in Turnfin Me. The
 *  node names and shapes match `cleanDoc` in shared/lessons.ts. */

const block = (name: string, content: string, attrs: Record<string, string>, tag = "div", group?: string) => Node.create({
  name, content, defining: true, ...(group ? { group } : {}),
  parseHTML() { return [{ tag: `${tag}[data-${name}]` }]; },
  renderHTML({ HTMLAttributes }) { return [tag, mergeAttributes(HTMLAttributes, { [`data-${name}`]: "", ...attrs }), 0]; },
});

const Callout = Node.create({
  name: "callout", group: "block", content: "block+", defining: true,
  addAttributes() { return { tone: { default: "note", parseHTML: (el) => el.getAttribute("data-tone"), renderHTML: (a) => ({ "data-tone": a.tone, "data-label": CALLOUT_META[a.tone as CalloutTone]?.label ?? "Note" }) } }; },
  parseHTML() { return [{ tag: "div[data-callout]" }]; },
  renderHTML({ HTMLAttributes }) { return ["div", mergeAttributes(HTMLAttributes, { "data-callout": "", class: "tf-callout" }), 0]; },
});

/** Moves the block at `pos` one place up or down among its neighbours. */
export function moveBlock(editor: Editor, pos: number, by: -1 | 1) {
  const { state } = editor;
  const $pos = state.doc.resolve(pos);
  const index = $pos.index(), node = $pos.parent.child(index), target = index + by;
  if (target < 0 || target >= $pos.parent.childCount) return;
  const sibling = $pos.parent.child(target);
  const tr = state.tr.delete(pos, pos + node.nodeSize);
  tr.insert(by === 1 ? pos + sibling.nodeSize : pos - sibling.nodeSize, node);
  editor.view.dispatch(tr.scrollIntoView());
}

/** Move up and Move down for a block card, for keyboards and tablets where dragging is fiddly. */
function MoveButtons({ editor, getPos, label }: Pick<NodeViewProps, "editor" | "getPos"> & { label: string }) {
  const pos = getPos();
  if (!editor.isEditable || typeof pos !== "number") return null;
  const $pos = editor.state.doc.resolve(pos);
  const index = $pos.index(), count = $pos.parent.childCount;
  return (
    <span className="flex shrink-0 gap-1" contentEditable={false}>
      <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => { const at = getPos(); if (typeof at === "number") moveBlock(editor, at, -1); }}><ArrowUp aria-hidden="true" /></Button>
      <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Move ${label} down`} disabled={index >= count - 1} onClick={() => { const at = getPos(); if (typeof at === "number") moveBlock(editor, at, 1); }}><ArrowDown aria-hidden="true" /></Button>
    </span>
  );
}

/** The course's questions, so a knowledge check can show which one it asks. */
export const CheckQuestions = createContext<{ id: string; prompt: string }[]>([]);

function CheckView({ node, editor, getPos }: NodeViewProps) {
  const questions = useContext(CheckQuestions);
  const question = questions.find((q) => q.id === node.attrs.questionId);
  return (
    <NodeViewWrapper className="tf-check" data-drag-handle="">
      <CircleHelp aria-hidden="true" />
      <span className="min-w-0 flex-1"><strong>Knowledge check</strong>{question ? `: ${question.prompt}` : ": this question has been removed. Delete this block or choose another."}</span>
      <MoveButtons editor={editor} getPos={getPos} label="knowledge check" />
    </NodeViewWrapper>
  );
}

const KnowledgeCheck = Node.create({
  name: "knowledgeCheck", group: "block", atom: true, selectable: true, draggable: true,
  addAttributes() { return { questionId: { default: null, parseHTML: (el) => el.getAttribute("data-question"), renderHTML: (a) => ({ "data-question": a.questionId }) } }; },
  parseHTML() { return [{ tag: "div[data-knowledge-check]" }]; },
  renderHTML({ HTMLAttributes }) { return ["div", mergeAttributes(HTMLAttributes, { "data-knowledge-check": "" })]; },
  addNodeView() { return ReactNodeViewRenderer(CheckView); },
});

/** The course's files, so a file button can show which one it offers. */
export const CourseFiles = createContext<{ id: string; name: string }[]>([]);

function VideoView({ node, editor, getPos }: NodeViewProps) {
  const video = videoFor(String(node.attrs.url ?? ""));
  return (
    <NodeViewWrapper className="tf-media-block" data-drag-handle="">
      <PlayCircle aria-hidden="true" />
      <span className="min-w-0 flex-1"><strong>Video</strong>: {video ? `${video.provider}, plays here in Turnfin Me` : "this link can't be played. Delete this block."}</span>
      <MoveButtons editor={editor} getPos={getPos} label="video" />
    </NodeViewWrapper>
  );
}

function FileView({ node, editor, getPos }: NodeViewProps) {
  const files = useContext(CourseFiles);
  const file = files.find((f) => f.id === node.attrs.fileId);
  return (
    <NodeViewWrapper className="tf-media-block" data-drag-handle="">
      <FileDown aria-hidden="true" />
      <span className="min-w-0 flex-1"><strong>{String(node.attrs.label || "Download")}</strong>{file ? `: ${file.name}` : ""}</span>
      <MoveButtons editor={editor} getPos={getPos} label="file button" />
    </NodeViewWrapper>
  );
}

const atomBlock = (name: string, attrs: string[], view: Parameters<typeof ReactNodeViewRenderer>[0], group = "block") => Node.create({
  name, group, atom: true, selectable: true, draggable: true,
  addAttributes() { return Object.fromEntries(attrs.map((a) => [a, { default: null, parseHTML: (el: HTMLElement) => el.getAttribute(`data-${a}`), renderHTML: (v: Record<string, unknown>) => ({ [`data-${a}`]: v[a] }) }])); },
  parseHTML() { return [{ tag: `div[data-${name}]` }]; },
  renderHTML({ HTMLAttributes }) { return ["div", mergeAttributes(HTMLAttributes, { [`data-${name}`]: "" })]; },
  addNodeView() { return ReactNodeViewRenderer(view); },
});

/** A recording, slides, a file shown in place or an activity in the text: a card
 *  saying what it holds, with Edit to set it up again in its dialog. */
function SetupView({ node, editor, getPos, updateAttributes, deleteNode }: NodeViewProps) {
  const setup = useContext(BlockSetup);
  const [editing, setEditing] = useState(false);
  const value = blockFromNode(node.type.name, node.attrs);
  if (!value) return <NodeViewWrapper />;
  const Icon = value.type === "activity" ? LESSON_KIND_META[value.kind].icon : MEDIA_BLOCK_META[value.type].icon;
  return (
    <NodeViewWrapper className="tf-media-block tf-setup-block" data-drag-handle="" data-activity={value.type === "activity" || undefined}>
      <Icon aria-hidden="true" />
      <span className="min-w-0 flex-1"><strong>{blockLabel(value)}</strong>{value.type === "activity" ? " · activity" : ""}: {blockSummary(value, setup)}</span>
      <MoveButtons editor={editor} getPos={getPos} label={blockLabel(value).toLowerCase()} />
      {editor.isEditable ? (
        <span className="flex shrink-0 gap-1" contentEditable={false}>
          <Button type="button" variant="ghost" className="min-h-11" onClick={() => setEditing(true)}><Pencil aria-hidden="true" />Edit</Button>
          <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Remove ${blockLabel(value).toLowerCase()}`} onClick={deleteNode}><Trash2 aria-hidden="true" /></Button>
        </span>
      ) : null}
      {editing ? <BlockDialog value={value} isNew={false} onClose={() => setEditing(false)} onSave={(next) => { updateAttributes(nodeAttrs(next)); setEditing(false); }} /> : null}
    </NodeViewWrapper>
  );
}

/** The text: blocks, and activities only at the top, never inside a tab or a reveal. */
const LessonDoc = Node.create({ name: "doc", topNode: true, content: "(block | activity)+" });

export const blockExtensions = () => [
  Callout,
  block("reveal", "revealTitle revealContent", { class: "tf-reveal" }, "div", "block"),
  block("revealTitle", "inline*", { class: "tf-reveal-title" }, "p"),
  block("revealContent", "block+", { class: "tf-reveal-content" }),
  block("flipCards", "flipCard+", { class: "tf-flip-cards" }, "div", "block"),
  block("flipCard", "flipFront flipBack", { class: "tf-flip-card" }),
  block("flipFront", "paragraph+", { class: "tf-flip-front" }),
  block("flipBack", "block+", { class: "tf-flip-back" }),
  block("stepper", "stepItem+", { class: "tf-stepper" }, "div", "block"),
  block("stepItem", "block+", { class: "tf-step" }),
  KnowledgeCheck,
  // Phase 8: tabs, a video and a file to download.
  block("tabs", "tab+", { class: "tf-tabs" }, "div", "block"),
  block("tab", "tabTitle tabContent", { class: "tf-tab" }),
  block("tabTitle", "inline*", { class: "tf-tab-title" }, "p"),
  block("tabContent", "block+", { class: "tf-tab-content" }),
  atomBlock("videoEmbed", ["url"], VideoView),
  atomBlock("fileButton", ["fileId", "label"], FileView),
  // Several things in one lesson (29 October 2026).
  LessonDoc,
  atomBlock("audioBlock", ["fileId", "transcript"], SetupView),
  atomBlock("slidesBlock", ["url"], SetupView),
  atomBlock("fileView", ["fileId"], SetupView),
  Node.create({
    name: "activity", group: "activity", atom: true, selectable: true, draggable: true,
    addAttributes() {
      return {
        id: { default: null }, kind: { default: null }, fileId: { default: null },
        data: { default: null, parseHTML: (el) => { try { return JSON.parse(el.getAttribute("data-data") ?? "null"); } catch { return null; } }, renderHTML: (a) => ({ "data-data": JSON.stringify(a.data) }) },
      };
    },
    parseHTML() { return [{ tag: "div[data-activity]" }]; },
    renderHTML({ HTMLAttributes }) { return ["div", mergeAttributes(HTMLAttributes, { "data-activity": "" })]; },
    addNodeView() { return ReactNodeViewRenderer(SetupView); },
  }),
];

/** Puts a new block into the text. An activity goes after the top-level block the cursor is in. */
export function insertSetupBlock(editor: Editor, value: BlockValue) {
  const content = { type: value.type, attrs: nodeAttrs(value) };
  if (value.type !== "activity") { editor.chain().focus().insertContent(content).run(); return; }
  // Hand in work goes at the end, under the task the text describes.
  if (value.kind === "ASSIGNMENT") { editor.chain().focus().insertContentAt(editor.state.doc.content.size, content).run(); return; }
  const { $from, to } = editor.state.selection;
  editor.chain().focus().insertContentAt($from.depth ? $from.after(1) : to, content).run();
}

/** The activities the text holds, by kind: against MAX_ACTIVITY_BLOCKS and ONCE_PER_LESSON. */
export function activityKinds(editor: Editor) {
  const kinds: string[] = [];
  editor.state.doc.forEach((node) => { if (node.type.name === "activity") kinds.push(String(node.attrs.kind)); });
  return kinds;
}

const para = (text?: string): JSONContent => ({ type: "paragraph", ...(text ? { content: [{ type: "text", text }] } : {}) });
const card = (): JSONContent => ({ type: "flipCard", content: [{ type: "flipFront", content: [para()] }, { type: "flipBack", content: [para()] }] });
const stepItem = (): JSONContent => ({ type: "stepItem", content: [{ type: "heading", attrs: { level: 3 } }, para()] });
const tab = (title = ""): JSONContent => ({ type: "tab", content: [{ type: "tabTitle", ...(title ? { content: [{ type: "text", text: title }] } : {}) }, { type: "tabContent", content: [para()] }] });

export type BlockKind = "callout" | "reveal" | "flipCards" | "stepper" | "tabs";
export const BLOCK_META: Record<BlockKind, { label: string; help: string }> = {
  tabs: { label: "Tabs", help: "Side-by-side tabs learners switch between, such as Indoor pool, Outdoor pool and Spa." },
  callout: { label: "Callout", help: "A coloured box for a note, a tip, a warning or a danger." },
  reveal: { label: "Tap to reveal", help: "A question or heading learners tap to open, such as “What if the alarm sounds?”." },
  flipCards: { label: "Flip cards", help: "Cards with a front and a back, such as a sign and what it means." },
  stepper: { label: "Step by step", help: "A process shown one step at a time, with Next and Back." },
};

export function insertBlock(editor: Editor, kind: BlockKind, tone: CalloutTone = "note") {
  const content: Record<BlockKind, JSONContent> = {
    callout: { type: "callout", attrs: { tone }, content: [para()] },
    reveal: { type: "reveal", content: [{ type: "revealTitle" }, { type: "revealContent", content: [para()] }] },
    flipCards: { type: "flipCards", content: [card(), card()] },
    stepper: { type: "stepper", content: [stepItem(), stepItem()] },
    tabs: { type: "tabs", content: [tab(), tab()] },
  };
  editor.chain().focus().insertContent(content[kind]).run();
}

export const insertCheck = (editor: Editor, questionId: string) =>
  editor.chain().focus().insertContent({ type: "knowledgeCheck", attrs: { questionId } }).run();
export const insertVideo = (editor: Editor, url: string) => editor.chain().focus().insertContent({ type: "videoEmbed", attrs: { url } }).run();
export const insertFileButton = (editor: Editor, fileId: string, label: string) => editor.chain().focus().insertContent({ type: "fileButton", attrs: { fileId, label } }).run();

/** The interactive block the cursor is in, if any, and where it sits. */
export function blockAt(editor: Editor) {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (["callout", "reveal", "flipCards", "stepper", "tabs"].includes(node.type.name)) return { kind: node.type.name as BlockKind, pos: $from.before(depth), node };
  }
  const { selection } = editor.state;
  if (isNodeSelection(selection) && ["knowledgeCheck", "videoEmbed", "fileButton"].includes(selection.node.type.name)) {
    return { kind: selection.node.type.name as "knowledgeCheck" | "videoEmbed" | "fileButton", pos: selection.from, node: selection.node };
  }
  return null;
}

/** Adds another card or step to the end of the block the cursor is in. */
export function addToBlock(editor: Editor) {
  const at = blockAt(editor);
  if (!at || (at.kind !== "flipCards" && at.kind !== "stepper" && at.kind !== "tabs")) return;
  const json = at.kind === "flipCards" ? card() : at.kind === "tabs" ? tab() : stepItem();
  editor.chain().focus().insertContentAt(at.pos + at.node.nodeSize - 1, json).run();
}

export function removeBlock(editor: Editor) {
  const at = blockAt(editor);
  if (!at) return;
  editor.chain().focus().deleteRange({ from: at.pos, to: at.pos + at.node.nodeSize }).run();
}

export function setTone(editor: Editor, tone: CalloutTone) {
  const at = blockAt(editor);
  if (at?.kind === "callout") editor.chain().focus().command(({ tr }) => { tr.setNodeMarkup(at.pos, undefined, { ...at.node.attrs, tone }); return true; }).run();
}
