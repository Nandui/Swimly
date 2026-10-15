"use client";

import { createContext, useContext } from "react";
import { isNodeSelection, mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type Editor, type JSONContent } from "@tiptap/react";
import { CircleHelp } from "lucide-react";
import { CALLOUT_META, type CalloutTone } from "@/modules/training/shared/lessons";

/** Interactive blocks for lesson text (docs/training.md, e-learning phase 3):
 *  a coloured callout, a tap-to-reveal, flip cards, a step-by-step and a
 *  knowledge check. The editor shows each one open, labelled, so authors can
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

/** The course's questions, so a knowledge check can show which one it asks. */
export const CheckQuestions = createContext<{ id: string; prompt: string }[]>([]);

function CheckView({ node }: { node: { attrs: Record<string, unknown> } }) {
  const questions = useContext(CheckQuestions);
  const question = questions.find((q) => q.id === node.attrs.questionId);
  return (
    <NodeViewWrapper className="tf-check" data-drag-handle="">
      <CircleHelp aria-hidden="true" />
      <span><strong>Knowledge check</strong>{question ? `: ${question.prompt}` : ": this question has been removed. Delete this block or choose another."}</span>
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
];

const para = (text?: string): JSONContent => ({ type: "paragraph", ...(text ? { content: [{ type: "text", text }] } : {}) });
const card = (): JSONContent => ({ type: "flipCard", content: [{ type: "flipFront", content: [para()] }, { type: "flipBack", content: [para()] }] });
const stepItem = (): JSONContent => ({ type: "stepItem", content: [{ type: "heading", attrs: { level: 3 } }, para()] });

export type BlockKind = "callout" | "reveal" | "flipCards" | "stepper";
export const BLOCK_META: Record<BlockKind, { label: string; help: string }> = {
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
  };
  editor.chain().focus().insertContent(content[kind]).run();
}

export const insertCheck = (editor: Editor, questionId: string) =>
  editor.chain().focus().insertContent({ type: "knowledgeCheck", attrs: { questionId } }).run();

/** The interactive block the cursor is in, if any, and where it sits. */
export function blockAt(editor: Editor) {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (["callout", "reveal", "flipCards", "stepper"].includes(node.type.name)) return { kind: node.type.name as BlockKind, pos: $from.before(depth), node };
  }
  const { selection } = editor.state;
  if (isNodeSelection(selection) && selection.node.type.name === "knowledgeCheck") return { kind: "knowledgeCheck" as const, pos: selection.from, node: selection.node };
  return null;
}

/** Adds another card or step to the end of the block the cursor is in. */
export function addToBlock(editor: Editor) {
  const at = blockAt(editor);
  if (!at || (at.kind !== "flipCards" && at.kind !== "stepper")) return;
  const json = at.kind === "flipCards" ? card() : stepItem();
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
