import { TEMPLATE_MARK, type DocNode, type LessonData, type LessonKind } from "@/modules/training/shared/lessons";
import type { ExamSettings } from "@/modules/training/shared/questions";

/** Course templates (e-learning phase 3): ready-made outlines
 *  an author starts from instead of a blank course. Text an author must replace
 *  starts with ✎, and a course can't be published while any is left. Pure and
 *  client-safe. Generic on purpose: no real people, sites or procedures. */

type TemplateLesson = { kind: LessonKind; title: string; body?: DocNode; data?: LessonData; minutes?: number };
export type CourseTemplate = {
  key: string; title: string; help: string;
  requiresSignoff: boolean; exam: ExamSettings | null;
  sections: { title: string; lessons: TemplateLesson[] }[];
};

const p = (text: string): DocNode => ({ type: "paragraph", content: [{ type: "text", text }] });
const h = (text: string): DocNode => ({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] });
const bullets = (...items: string[]): DocNode => ({ type: "bulletList", content: items.map((t) => ({ type: "listItem", content: [p(t)] })) });
const callout = (tone: string, text: string): DocNode => ({ type: "callout", attrs: { tone }, content: [p(text)] });
const doc = (...content: DocNode[]): DocNode => ({ type: "doc", content });
const step = (title: string, text: string): DocNode => ({ type: "stepItem", content: [{ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: title }] }, p(text)] });
const M = TEMPLATE_MARK;

export const COURSE_TEMPLATES: CourseTemplate[] = [
  {
    key: "policy",
    title: "Policy to read and understand",
    help: "A policy in plain words, a short practice quiz and a final check. For handbooks, codes of practice and new rules.",
    requiresSignoff: false,
    exam: { passMark: 80, attempts: 3, draw: null, timeLimit: null, testOut: false },
    sections: [
      { title: "The policy", lessons: [
        { kind: "READING", title: "Why this policy matters", body: doc(
          p(`${M} Say in two or three sentences what the policy is for and who it protects.`),
          callout("tip", `${M} The one thing everyone must remember, in a sentence.`),
        ) },
        { kind: "READING", title: "What you must do", body: doc(
          h("Every shift"), bullets(`${M} First thing staff must do`, `${M} Second thing`, `${M} Third thing`),
          h("If something goes wrong"), p(`${M} Who to tell, and how quickly.`),
          callout("warning", `${M} Anything staff must never do.`),
        ) },
      ] },
      { title: "Check you understand", lessons: [
        { kind: "QUIZ", title: "Practice questions", body: doc(p("A few quick questions. They aren't marked, so have a go.")) },
      ] },
    ],
  },
  {
    key: "practical",
    title: "Practical skill with sign-off",
    help: "Why it matters, how to do it step by step, a checklist to practise with, then a trainer watches them do it.",
    requiresSignoff: true,
    exam: null,
    sections: [
      { title: "Before you start", lessons: [
        { kind: "READING", title: "Why it matters", body: doc(p(`${M} What this skill is, when staff use it, and what happens if it's done wrong.`)) },
        { kind: "CHECKLIST", title: "Find the equipment", body: doc(p("Go to where the equipment is kept and tick each one off as you find it.")),
          data: { items: [{ id: "i1", text: `${M} First piece of equipment and where it lives` }, { id: "i2", text: `${M} Second piece of equipment` }, { id: "i3", text: `${M} Where to report a fault` }] } },
      ] },
      { title: "How to do it", lessons: [
        { kind: "READING", title: "Step by step", body: doc(
          p("Work through each step in order."),
          { type: "stepper", content: [step("Get ready", `${M} What to check first.`), step("Do it", `${M} The main steps.`), step("Finish off", `${M} How to put everything back and record it.`)] },
        ) },
        { kind: "VIDEO", title: "Watch it done", body: doc(p(`${M} Say what to look out for in the video.`)) },
      ] },
    ],
  },
  {
    key: "emergency",
    title: "Emergency procedure",
    help: "The procedure, a 'what would you do?' scenario, practice questions, a final exam and a trainer sign-off. For EAPs and NOPs.",
    requiresSignoff: true,
    exam: { passMark: 80, attempts: 3, draw: null, timeLimit: null, testOut: false },
    sections: [
      { title: "The procedure", lessons: [
        { kind: "READING", title: "When it applies", body: doc(
          p(`${M} Describe the emergency and how staff will know it's happening.`),
          callout("danger", `${M} The first action, which must never be skipped.`),
        ) },
        { kind: "READING", title: "What to do", body: doc(
          { type: "stepper", content: [step("Raise the alarm", `${M} How, and who hears it.`), step("Make it safe", `${M} Clear the pool, stop the plant, or whatever comes next.`), step("Hand over", `${M} Who takes charge and what to tell them.`)] },
        ) },
      ] },
      { title: "Put it into practice", lessons: [
        { kind: "SCENARIO", title: "What would you do?", data: { steps: [
          { id: "s1", text: `${M} Set the scene: what the staff member sees and hears.`, imageId: null, choices: [
            { id: "c1", text: `${M} The right first action`, feedback: `${M} Why this is right.`, next: "s2", best: false },
            { id: "c2", text: `${M} A tempting wrong action`, feedback: `${M} Why this goes wrong.`, next: null, best: false },
          ] },
          { id: "s2", text: `${M} What happens next.`, imageId: null, choices: [
            { id: "c3", text: `${M} The right next step`, feedback: `${M} Well done: why this ends well.`, next: null, best: true },
            { id: "c4", text: `${M} A mistake people often make`, feedback: `${M} What goes wrong.`, next: null, best: false },
          ] },
        ] } },
        { kind: "QUIZ", title: "Practice questions" },
      ] },
    ],
  },
  {
    key: "refresher",
    title: "Annual refresher",
    help: "What's changed, flashcards to recap the key facts and a final exam. People who already know it can test out.",
    requiresSignoff: false,
    exam: { passMark: 80, attempts: 3, draw: null, timeLimit: null, testOut: true },
    sections: [
      { title: "Refresh", lessons: [
        { kind: "READING", title: "What's changed this year", body: doc(p(`${M} Anything new since last year. If nothing has changed, say so.`)) },
        { kind: "FLASHCARDS", title: "Key facts", data: { cards: [
          { id: "f1", front: `${M} A term or number to remember`, back: `${M} What it means`, imageId: null },
          { id: "f2", front: `${M} Another one`, back: `${M} What it means`, imageId: null },
          { id: "f3", front: `${M} And another`, back: `${M} What it means`, imageId: null },
        ] } },
        { kind: "QUIZ", title: "Practice questions" },
      ] },
    ],
  },
  {
    key: "induction",
    title: "New starter induction",
    help: "Welcome, a walk round the site with a checklist, the safety basics and who to ask. For someone's first week.",
    requiresSignoff: true,
    exam: null,
    sections: [
      { title: "Welcome", lessons: [
        { kind: "READING", title: "Welcome to the team", body: doc(p(`${M} A short welcome: what the centre does and what their role is for.`)) },
      ] },
      { title: "Your site", lessons: [
        { kind: "CHECKLIST", title: "Walk round the site", body: doc(p("Walk round with your supervisor and tick each place off once you've seen it.")),
          data: { items: [{ id: "i1", text: "Fire exits and the assembly point" }, { id: "i2", text: "First aid kit and defibrillator" }, { id: "i3", text: "Where to sign in and find the rota" }, { id: "i4", text: `${M} Anything else they must see` }] } },
      ] },
      { title: "Safety basics", lessons: [
        { kind: "READING", title: "Keeping everyone safe", body: doc(
          bullets(`${M} Safety rule one`, `${M} Safety rule two`),
          callout("warning", "If you see something unsafe, tell the duty manager straight away."),
        ) },
        { kind: "READING", title: "Who to ask", body: doc(p(`${M} Names of roles (not people) to ask about the rota, pay, training and safety.`)) },
      ] },
    ],
  },
];

export const templateByKey = (key: string) => COURSE_TEMPLATES.find((t) => t.key === key) ?? null;
