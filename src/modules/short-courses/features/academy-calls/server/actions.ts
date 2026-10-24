"use server";

import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { ACADEMY_CALL_META, ACADEMY_CALL_OUTCOMES, centsOf, euro, paymentFor } from "@/modules/short-courses/shared/academy-rules";
import { courseFor, refresh } from "@/modules/short-courses/shared/academy-server";
import { chose, copiedFrom, keepBooked, resolveSwimmer, swimmerChoiceSchema } from "@/modules/short-courses/shared/swimmers";
import { members } from "@/modules/contributions";

/** Academy writes for phoning people who held a place online. Every write is audited. */

/* ---------- Phoning people who held a place online ---------- */

const callSchema = z.object({
  outcome: z.enum(ACADEMY_CALL_OUTCOMES as [string, ...string[]], { message: "Choose how the call went." }),
  amount: z.string().trim().default(""),
  receipt: z.string().trim().max(60).default(""),
  note: z.string().trim().max(300).default(""),
  /** Paid: who it is on the swimmer records, when the place is not linked yet (owner request,
   *  21 October 2026: confirming a place held online picks or adds the swimmer). */
  swimmer: swimmerChoiceSchema.default({ swimmerId: "", newSwimmer: null }),
});
export type CallInput = z.input<typeof callSchema>;

/** Record a call to someone who held a place online (owner decision, 8 October 2026: anyone with
 *  Academy access at the course's site). Paid records the amount (the full price is paid, less a
 *  deposit) and secures the place; not going ahead withdraws them and frees it; the others stay
 *  on the list to call. */
export async function logCall(candidateId: string, input: CallInput): Promise<ActionResult> {
  const parsed = callSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  const c = await prisma.academyCandidate.findFirst({ where: { id: candidateId }, select: { courseId: true, name: true, status: true, payment: true, paidCents: true, userId: true, swimmerId: true, dateOfBirth: true, source: true, email: true, phone: true, course: { select: { priceCents: true } } } });
  if (!c) return fail("That booking is no longer on the course.");
  const at = await courseFor(c.courseId, "academy.read");
  if (!at.ok) return fail(at.error);
  if (c.status !== "booked") return fail(`${c.name} is no longer booked on the course.`);
  const amountCents = d.outcome === "paid" ? centsOf(d.amount) : null;
  if (d.outcome === "paid" && (amountCents === null || (amountCents === 0 && c.course.priceCents > 0))) return fail("Give the amount taken, like 350 or 350.00.");
  const paidCents = c.paidCents + (amountCents ?? 0);
  // Taking payment confirms the place, so the person is matched to the swimmer records first.
  let link: (ReturnType<typeof copiedFrom> & { added: boolean }) | null = null;
  if (d.outcome === "paid" && !c.userId && !c.swimmerId && (await members())) {
    if (!chose(d.swimmer)) return fail("Find them on the swimmer records, or add them as a new swimmer, before recording the payment.");
    if (d.swimmer.swimmerId && await prisma.academyCandidate.findFirst({ where: { courseId: c.courseId, swimmerId: d.swimmer.swimmerId, status: { not: "withdrawn" }, id: { not: candidateId } }, select: { id: true } })) {
      return fail("That swimmer is already on this course.");
    }
    const found = await resolveSwimmer(d.swimmer, { siteId: at.site.id, by: at.actor, via: "the Academy" });
    if (!found.ok) return fail(found.error);
    link = { ...keepBooked(copiedFrom(found.swimmer), c), added: found.added };
  }
  const label = ACADEMY_CALL_META[d.outcome as keyof typeof ACADEMY_CALL_META].label.toLowerCase();
  await prisma.$transaction(async (tx) => {
    const call = await tx.academyCall.create({ data: { candidateId, outcome: d.outcome, amountCents, receipt: d.receipt, note: d.note, byId: at.actor.id, byName: at.actor.name } });
    if (d.outcome === "paid") {
      const swimmer = link && { swimmerId: link.swimmerId, name: link.name, email: link.email, phone: link.phone, dateOfBirth: link.dateOfBirth ?? c.dateOfBirth };
      await tx.academyCandidate.update({ where: { id: candidateId }, data: { paidCents, payment: paymentFor(paidCents, c.course.priceCents), ...swimmer } });
    }
    if (d.outcome === "not-going-ahead") await tx.academyCandidate.update({ where: { id: candidateId }, data: { status: "withdrawn" } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "create", entity: "AcademyCall", entityId: call.id, clubId: at.site.id,
      summary: `Phoned ${c.name} about the ${at.course.type.name} course: ${label}${amountCents !== null ? `, ${euro(amountCents)} taken${d.receipt ? ` (receipt ${d.receipt})` : ""}` : ""}${d.outcome === "not-going-ahead" ? "; the place is free again" : ""}${link ? `; linked to the swimmer record of ${link.name}${link.added ? " (added)" : ""}` : ""}` }, tx);
  });
  refresh(c.courseId);
  return ok();
}
