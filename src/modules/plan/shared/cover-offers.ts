import "server-only";
import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { appOn } from "@/lib/apps/switches";
import { logAudit } from "@/lib/audit";
import { activeStaffAmong } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import type { CoverAnswer } from "@/modules/plan/shared/cover";
import { clock } from "@/modules/plan/shared/rules";

/** One person's answer to a cover request (D31): "I can cover" or "Can't", their latest one kept.
 *
 *  Not a server action, on purpose: nobody is signed in to Turnfin when this runs. The caller has
 *  already proved who is answering (Google Chat's signed request names the person, matched to
 *  their Turnfin account by email), so it must never be reachable from a browser. The audit row
 *  is the person's own. An error here is one sentence for the person who answered. */
export async function recordCoverAnswer(input: { requestId: string; userId: string; answer: CoverAnswer; via: "chat" }): Promise<ActionResult> {
  const request = await prisma.planCoverRequest.findUnique({ where: { id: input.requestId } });
  if (!request || !(await appOn("plan", { siteId: request.siteId, orgId: request.orgId }))) return fail("That request is no longer there.");
  if (request.closedAt) return fail(request.outcome === "filled" ? "This is already covered. Thank you for answering." : "Nobody is being asked for this any more.");
  const [person] = await activeStaffAmong(request.orgId, [input.userId]);
  if (!person) return fail("We couldn't find your Turnfin account. Ask your manager to check your email address in Turnfin.");
  const what = `${request.title}, ${request.date} ${clock(request.startMinutes)} to ${clock(request.endMinutes)}`;
  const result = await prisma.$transaction(async (tx) => {
    // Asked again inside the transaction: it may have been filled while they were answering.
    const open = await tx.planCoverRequest.findFirst({ where: { id: request.id, closedAt: null }, select: { id: true } });
    if (!open) return fail("This is already covered. Thank you for answering.");
    const before = await tx.planCoverOffer.findUnique({ where: { requestId_userId: { requestId: request.id, userId: person.id } } });
    if (before?.answer === input.answer) return ok();
    const row = before
      ? await tx.planCoverOffer.update({ where: { id: before.id }, data: { answer: input.answer, via: input.via } })
      : await tx.planCoverOffer.create({ data: { orgId: request.orgId, requestId: request.id, userId: person.id, answer: input.answer, via: input.via } });
    await logAudit({ actorId: person.id, actorName: person.name, action: before ? "update" : "create", entity: "PlanCoverOffer", entityId: row.id, clubId: request.siteId,
      summary: `${input.answer === "yes" ? "Offered to cover" : "Said they can't cover"} ${what}` }, tx);
    return ok();
  });
  if (!result.ok) return result;
  revalidatePath("/plan", "layout");
  return ok();
}
