import "server-only";
import { z } from "zod";
import { activeStaffByEmail } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import { chatConfig, fromGoogleChat } from "@/modules/plan/shared/chat";
import { COVER_ANSWER_FUNCTION } from "@/modules/plan/shared/cover-card";
import { coverCardOf } from "@/modules/plan/shared/cover-chat";
import { recordCoverAnswer } from "@/modules/plan/shared/cover-offers";

/** What Google Chat tells Plan (test)'s Chat app (D31), at `/api/plan/chat`: the app was added
 *  to a space, or someone pressed a button on a cover request's card. Nobody is signed in to
 *  Turnfin here. Google's signature on the request proves it is Chat speaking, and Chat names
 *  the person, who is matched to their Turnfin account by email. A click changes one thing only:
 *  that person's own answer to that request. */

const MAX_BYTES = 256 * 1024;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

const eventSchema = z.object({
  type: z.string().optional(),
  user: z.object({ name: z.string().optional(), email: z.string().optional(), type: z.string().optional() }).optional(),
  message: z.object({ name: z.string().optional() }).optional(),
  action: z.object({ actionMethodName: z.string().optional(), parameters: z.array(z.object({ key: z.string(), value: z.string().optional() })).optional() }).optional(),
  common: z.object({ invokedFunction: z.string().optional(), parameters: z.record(z.string(), z.string()).optional() }).optional(),
});
type ChatEvent = z.infer<typeof eventSchema>;

/** Only the person who pressed the button sees this. */
const onlyTo = (event: ChatEvent, text: string) => json({
  actionResponse: { type: "NEW_MESSAGE" }, text, ...(event.user?.name ? { privateMessageViewer: { name: event.user.name } } : {}),
});

async function answerClicked(event: ChatEvent): Promise<Response> {
  const params = { ...Object.fromEntries((event.action?.parameters ?? []).map((p) => [p.key, p.value ?? ""])), ...(event.common?.parameters ?? {}) };
  const answer = params.answer === "yes" || params.answer === "no" ? params.answer : null;
  const request = params.request ? await prisma.planCoverRequest.findUnique({ where: { id: params.request }, select: { id: true, orgId: true, chatMessage: true } }) : null;
  // The button has to be on that request's own card: nothing else can answer for it.
  if (!answer || !request || !request.chatMessage || request.chatMessage !== event.message?.name) return json({});
  if (event.user?.type && event.user.type !== "HUMAN") return json({});
  const person = event.user?.email ? await activeStaffByEmail(request.orgId, event.user.email) : null;
  if (!person) return onlyTo(event, "We couldn't find your Turnfin account. Ask your manager to check that your email address in Turnfin is your work one.");
  const result = await recordCoverAnswer({ requestId: request.id, userId: person.id, answer, via: "chat" });
  const card = await coverCardOf(request.id);
  if (!result.ok || !card) return onlyTo(event, result.ok ? "That request is no longer there." : result.error);
  return json({ actionResponse: { type: "UPDATE_MESSAGE" }, ...card.message });
}

export async function handleChatEvent(request: Request): Promise<Response> {
  const config = chatConfig();
  if (!config) return json({ error: { code: "NOT_AVAILABLE", message: "That is not available." } }, 404);
  if (!(await fromGoogleChat(request.headers.get("authorization"), config))) return new Response("Unauthorized", { status: 401 });
  const text = await request.text();
  if (text.length > MAX_BYTES) return new Response("Too large", { status: 413 });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return new Response("Bad request", { status: 400 }); }
  const event = eventSchema.safeParse(body);
  if (!event.success) return new Response("Bad request", { status: 400 });
  if (event.data.type === "ADDED_TO_SPACE") {
    return json({ text: "Turnfin is here. A manager can now link this space to a department in Plan, under Set up, and then ask for cover from the Day." });
  }
  if (event.data.type === "CARD_CLICKED" && (event.data.common?.invokedFunction ?? event.data.action?.actionMethodName) === COVER_ANSWER_FUNCTION) {
    return answerClicked(event.data);
  }
  return json({});
}
