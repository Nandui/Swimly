import "server-only";
import { staffByIds } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import { chatConfig, postChatMessage, updateChatMessage } from "@/modules/plan/shared/chat";
import { coverCard, type CoverCardInput } from "@/modules/plan/shared/cover-card";

/** A cover request's card in Google Chat (D31): what it says now, posting it to the department's
 *  space, and bringing it up to date as people answer and when it stops. */

/** The card as it should read now, with where it goes and where it already is. */
export async function coverCardOf(requestId: string) {
  const request = await prisma.planCoverRequest.findUnique({ where: { id: requestId }, include: { offers: { where: { answer: "yes" }, orderBy: { updatedAt: "asc" } } } });
  if (!request) return null;
  const [duty, linked, names] = await Promise.all([
    prisma.planDuty.findUnique({ where: { id: request.dutyId }, select: { name: true } }),
    prisma.planChatSpace.findUnique({ where: { siteId_departmentId: { siteId: request.siteId, departmentId: request.departmentId } }, select: { space: true } }),
    staffByIds([...request.offers.map((o) => o.userId), request.chosenUserId]),
  ]);
  const input: CoverCardInput = {
    id: request.id, title: request.title, dutyName: duty?.name ?? "Cover", place: request.place, date: request.date, start: request.startMinutes, end: request.endMinutes,
    note: request.note, askedByName: request.askedByName, canCover: request.offers.map((o) => names.get(o.userId)?.name ?? "Someone"),
    outcome: request.closedAt ? (request.outcome === "filled" ? "filled" : "stopped") : null,
    chosenName: request.chosenUserId ? names.get(request.chosenUserId)?.name ?? null : null,
  };
  return { message: coverCard(input), space: linked?.space ?? null, posted: request.chatMessage };
}

/** Post a new request's card to its department's space and remember where it is. False when it
 *  could not be posted: the caller then takes the request back, because nobody was asked. */
export async function postCoverCard(requestId: string): Promise<boolean> {
  const config = chatConfig();
  const card = await coverCardOf(requestId);
  if (!config || !card?.space) return false;
  try {
    const name = await postChatMessage(config, card.space, card.message);
    await prisma.planCoverRequest.update({ where: { id: requestId }, data: { chatMessage: name } });
    return true;
  } catch (error) {
    console.error("A cover request could not be posted to Google Chat", error);
    return false;
  }
}

/** Bring the card up to date after the request changed (someone chosen, asking stopped). Best
 *  effort: the plan is already right, so a card that can't be changed never fails the change. */
export async function refreshCoverCard(requestId: string): Promise<void> {
  const config = chatConfig();
  if (!config) return;
  try {
    const card = await coverCardOf(requestId);
    if (card?.posted) await updateChatMessage(config, card.posted, card.message);
  } catch (error) {
    console.error("A cover request's card could not be updated in Google Chat", error);
  }
}
