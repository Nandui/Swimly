import { z } from "zod";

/** What Claude sends back when it drafts a course from a document
 *  (docs/training.md, AI drafting): the JSON schema the API holds it to, and
 *  the same shape in zod, checked again here before anything is saved. Kept to
 *  the lesson and question kinds a document can honestly fill: readings,
 *  flashcards, checklists, and single, multiple and true-or-false questions. */

export const BLOCK_TYPES = ["heading", "paragraph", "bullets", "numbered", "steps", "tip", "warning", "danger"] as const;

const block = z.object({
  type: z.enum(BLOCK_TYPES),
  text: z.string(),
  items: z.array(z.string()),
  steps: z.array(z.object({ title: z.string(), text: z.string() })),
});
const lesson = z.object({
  kind: z.enum(["READING", "FLASHCARDS", "CHECKLIST"]),
  title: z.string(),
  minutes: z.number(),
  blocks: z.array(block),
  cards: z.array(z.object({ front: z.string(), back: z.string() })),
  items: z.array(z.string()),
});
const question = z.object({
  kind: z.enum(["SINGLE", "MULTIPLE", "TRUE_FALSE"]),
  prompt: z.string(),
  options: z.array(z.object({ text: z.string(), correct: z.boolean() })),
  explanation: z.string(),
});
export const draftSchema = z.object({
  title: z.string(),
  summary: z.string(),
  category: z.string(),
  notes: z.array(z.string()),
  sections: z.array(z.object({ title: z.string(), lessons: z.array(lesson), questions: z.array(question) })),
});
export type Draft = z.infer<typeof draftSchema>;
export type DraftBlock = z.infer<typeof block>;

// The same shape for the API's structured outputs: every object closed, every field required.
const str = { type: "string" } as const;
const strings = { type: "array", items: str } as const;
const object = (properties: Record<string, unknown>, description?: string) =>
  ({ type: "object", ...(description ? { description } : {}), properties, required: Object.keys(properties), additionalProperties: false });

export const DRAFT_JSON_SCHEMA = object({
  title: { type: "string", description: "The course name, under 80 characters, in plain words staff would use." },
  summary: { type: "string", description: "One or two sentences on what the course covers and who it is for." },
  category: { type: "string", description: "One or two words, such as Plant room, First aid, Reception, Health and safety." },
  notes: { ...strings, description: "Things the author must check before publishing: gaps, unclear or conflicting steps, anything you left out or replaced. Empty if none." },
  sections: { type: "array", items: object({
    title: str,
    lessons: { type: "array", items: object({
      kind: { type: "string", enum: ["READING", "FLASHCARDS", "CHECKLIST"] },
      title: str,
      minutes: { type: "integer", description: "Minutes a learner needs, 1 to 15." },
      blocks: { type: "array", description: "The lesson text, in order. Used by every kind: for flashcards and checklists, one or two short paragraphs introducing them.", items: object({
        type: { type: "string", enum: [...BLOCK_TYPES] },
        text: { type: "string", description: "The heading, paragraph or callout text. Empty for bullets, numbered and steps." },
        items: { ...strings, description: "List entries for bullets and numbered. Empty otherwise." },
        steps: { type: "array", description: "For steps only: each step's short title and what to do. Empty otherwise.", items: object({ title: str, text: str }) },
      }) },
      cards: { type: "array", description: "FLASHCARDS only: 3 to 12 cards. Empty otherwise.", items: object({ front: str, back: str }) },
      items: { ...strings, description: "CHECKLIST only: 3 to 12 things to tick off. Empty otherwise." },
    }) },
    questions: { type: "array", description: "Questions on this section, answerable from the document alone.", items: object({
      kind: { type: "string", enum: ["SINGLE", "MULTIPLE", "TRUE_FALSE"] },
      prompt: str,
      options: { type: "array", description: "SINGLE: 3 or 4 options, exactly one correct. MULTIPLE: 4 to 6, two or more correct. TRUE_FALSE: True and False, one correct.", items: object({ text: str, correct: { type: "boolean" } }) },
      explanation: { type: "string", description: "Why the right answer is right, citing the document's rule." },
    }) },
  }) },
});
