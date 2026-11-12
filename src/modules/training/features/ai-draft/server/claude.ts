import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import { draftSchema, DRAFT_JSON_SCHEMA, type Draft } from "@/modules/training/features/ai-draft/server/schema";

/** Asks Claude to turn a document into a course (AI drafting).
 *  The document goes to Anthropic's API and nowhere else; Turnfin keeps only
 *  the draft course. Switched on by ANTHROPIC_API_KEY. */

// Sonnet 5.5 only, with no fallback to another model (owner decision, 20 October 2026).
export const MODEL = "claude-sonnet-5-5";
export const aiDraftingOn = () => !!process.env.ANTHROPIC_API_KEY;

export class DraftError extends Error {}

export const ACCEPTED: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "text/plain": "text", "text/markdown": "text",
  "image/jpeg": "photo", "image/png": "photo", "image/webp": "photo",
};
/** Under Vercel's 4.5 MB request limit, with room for the form around it. */
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
const MAX_TEXT = 400_000;

export type Source = { file: File | null; text: string };
type Block = Anthropic.Beta.Messages.BetaContentBlockParam;

/** The document as content Claude reads: a PDF or photo as itself, a Word file as its text with headings and lists. */
async function documentBlocks({ file, text }: Source): Promise<{ blocks: Block[]; name: string }> {
  const blocks: Block[] = [];
  if (file && file.size) {
    if (file.size > MAX_DOCUMENT_BYTES) throw new DraftError("Documents must be no larger than 4 MB. Try a PDF of just the procedure, or paste its text.");
    const type = file.type || (/\.docx$/i.test(file.name) ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : /\.(md|txt)$/i.test(file.name) ? "text/plain" : "");
    if (!ACCEPTED[type]) throw new DraftError("Choose a PDF, a Word document (.docx), a text file or a photo of the pages.");
    const bytes = Buffer.from(await file.arrayBuffer());
    if (type === "application/pdf") blocks.push({ type: "document", title: file.name.slice(0, 200), source: { type: "base64", media_type: "application/pdf", data: bytes.toString("base64") } });
    else if (type.startsWith("image/")) blocks.push({ type: "image", source: { type: "base64", media_type: type as "image/jpeg" | "image/png" | "image/webp", data: bytes.toString("base64") } });
    else {
      const content = type.startsWith("text/") ? bytes.toString("utf8") : (await mammoth.convertToHtml({ buffer: bytes }).catch(() => { throw new DraftError("That Word document couldn’t be opened. Save it again as .docx or PDF and try again."); })).value;
      if (!content.trim()) throw new DraftError("That document has no text in it. Try a PDF, or paste the text.");
      blocks.push({ type: "document", title: file.name.slice(0, 200), source: { type: "text", media_type: "text/plain", data: content.slice(0, MAX_TEXT) } });
    }
  }
  if (text.trim()) blocks.push({ type: "document", title: "Pasted text", source: { type: "text", media_type: "text/plain", data: text.slice(0, MAX_TEXT) } });
  if (!blocks.length) throw new DraftError("Choose a document or paste its text.");
  return { blocks, name: file?.size ? file.name : "pasted text" };
}

const SYSTEM = `You turn a leisure centre's own documents (standard operating procedures, policies, handbooks, safety notes) into an e-learning course for its staff: lifeguards, swim teachers, reception, gym and plant-room staff, many of them young or new.

Write for them: short sentences, plain words, second person ("you"), Irish/UK spelling. Keep every rule, number, limit, time and step exactly as the document gives it. Never invent a procedure, figure or legal requirement the document does not contain; if something a learner would need is missing or unclear, keep to what is there and say so in notes.

Shape:
- 2 to 6 sections, each one part of the job. Each section has 1 to 4 lessons.
- READING lessons carry the content: headings, short paragraphs, bullets, numbered lists, "steps" for any procedure done in order, and tip, warning or danger callouts for what matters most (danger for anything that could hurt someone).
- Use a FLASHCARDS lesson only where there are facts worth memorising (names, numbers, signals). Use a CHECKLIST lesson only where staff should go and find or check physical things.
- Each section has 3 to 6 questions, answerable from the document alone, testing what staff must do rather than trivia. Prefer scenario questions ("A swimmer… What do you do first?"). Wrong options must be plausible. Every question has an explanation citing the rule.

People: replace any named person, phone number or email address with the role it stands for (for example "the duty manager"), and say in notes that you did.`;

/** Claude's draft of a course, checked against the schema. Errors are sentences for the author. */
export async function draftFromDocument(source: Source, options: { exam: boolean; practice: boolean }): Promise<{ draft: Draft; name: string }> {
  if (!aiDraftingOn()) throw new DraftError("AI drafting isn’t switched on in Turnfin yet.");
  const { blocks, name } = await documentBlocks(source);
  const ask = `Write the course from ${blocks.length > 1 ? "these documents" : "this document"}.${options.exam ? " It will end with a final exam drawn from the questions, so write at least 4 questions for each section." : ""}`;
  const client = new Anthropic({ timeout: 280_000, maxRetries: 1 });
  let message: Anthropic.Beta.Messages.BetaMessage;
  try {
    message = await client.beta.messages.stream({
      model: MODEL,
      max_tokens: 32_000,
      system: SYSTEM,
      output_config: { effort: "medium", format: { type: "json_schema", schema: DRAFT_JSON_SCHEMA } },
      messages: [{ role: "user", content: [...blocks, { type: "text", text: ask }] }],
    }).finalMessage();
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) throw new DraftError("The AI is busy just now. Try again in a minute.");
    if (error instanceof Anthropic.BadRequestError) throw new DraftError("The AI couldn’t read that document. Try a PDF, or paste the text.");
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) throw new DraftError("Turnfin’s AI key isn’t working. Ask your administrator to check it.");
    throw new DraftError("The AI didn’t answer. Try again.");
  }
  if (message.stop_reason === "refusal") throw new DraftError("The AI wouldn’t draft a course from that document.");
  if (message.stop_reason === "max_tokens") throw new DraftError("That document is too long to turn into one course. Try one procedure at a time.");
  const text = message.content.flatMap((b) => b.type === "text" ? [b.text] : []).join("");
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new DraftError("The AI’s answer was incomplete. Try again."); }
  const draft = draftSchema.safeParse(parsed);
  if (!draft.success || !draft.data.sections.length) throw new DraftError("The AI’s answer was incomplete. Try again.");
  return { draft: draft.data, name };
}
