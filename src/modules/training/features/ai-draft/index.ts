/** Drafting a course from a document with AI (AI drafting).
 *  Entry for the module and its routes. */
export { DraftFromDocument } from "@/modules/training/features/ai-draft/components/draft-from-document";
export { aiDraftingOn, MAX_DOCUMENT_BYTES } from "@/modules/training/features/ai-draft/server/claude";
export { draftCourse } from "@/modules/training/features/ai-draft/server/create";
