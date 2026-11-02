"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { mayFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { requirePaymentsActor, type PaymentsActor } from "@/modules/payments/shared/access";
import { closeChange, closeSchema, contactChange, contactSchema, PaymentError, problemOf, reopenChange, reopenSchema, type CloseInput, type ContactInput, type ReopenInput } from "@/modules/payments/shared/rules";
import { alreadyDone, failureLabel, guardVersion, lockFailure, recordStep } from "@/modules/payments/shared/service";
import { nonSwimmerPlan } from "@/modules/payments/features/failures/server/non-swimmers";
import { METHOD_LABEL, RESULT_LABEL, type PaymentAction, type PaymentResult, type PaymentStatus } from "@/modules/payments/shared/types";
import type { PaymentFailure } from "@/generated/prisma/client";

/** The steps on one failure, at its site: authorize, validate, then under the failure's lock check
 *  the version and replay, write, and record the history and audit rows together. */
type Change = { data: Record<string, unknown>; extra?: { method?: string; result?: string; note?: string; words?: string } };

async function step(id: string, operationId: string, version: number, action: PaymentAction, needs: "payments.follow" | "payments.manage", change: (row: PaymentFailure, who: PaymentsActor) => Change): Promise<PaymentResult> {
  const who = await requirePaymentsActor();
  try {
    const at = await prisma.paymentFailure.findFirst({ where: { id, orgId: who.orgId ?? undefined }, select: { siteId: true } });
    if (!at || !(await mayFor("payments.read", { siteId: at.siteId, orgId: who.orgId }))) throw new PaymentError("This payment is not available.");
    if (!(await mayFor(needs, { siteId: at.siteId, orgId: who.orgId }))) throw new PaymentError(needs === "payments.manage" ? "Opening a payment again needs Payments: Manage at this site." : "Following up payments needs Payments: Use at this site.");
    await prisma.$transaction(async (tx) => {
      await lockFailure(tx, id);
      if (await alreadyDone(tx, id, operationId, who, action)) return;
      const row = await tx.paymentFailure.findUniqueOrThrow({ where: { id } });
      guardVersion(row, version);
      const { data, extra } = change(row, who);
      const saved = await tx.paymentFailure.update({ where: { id }, data: { ...data, version: { increment: 1 } } });
      await recordStep(tx, saved, who, action, operationId, extra);
    });
  } catch (error) {
    if (error instanceof PaymentError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath("/payments", "layout");
  revalidatePath("/students/[id]", "page");
  return { ok: true, id };
}

/** One contact with the member: how, what happened and a note. It counts as an attempt and the
 *  payment waits on them. */
export async function logContact(input: ContactInput): Promise<PaymentResult> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: problemOf(parsed.error) };
  const { id, operationId, version, method, result, note } = parsed.data;
  return step(id, operationId, version, "contact", "payments.follow", (row) => ({
    data: contactChange(row.status as PaymentStatus, new Date()),
    extra: { method, result, note, words: `${METHOD_LABEL[method]}, ${RESULT_LABEL[result].toLowerCase()}` },
  }));
}

/** How it ended: paid at the desk, a new mandate set up, or the place cancelled. */
export async function closeFailure(input: CloseInput): Promise<PaymentResult> {
  const parsed = closeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: problemOf(parsed.error) };
  const { id, operationId, version, outcome, note } = parsed.data;
  return step(id, operationId, version, outcome, "payments.follow", (row, who) => ({ data: closeChange(row.status as PaymentStatus, outcome, note, who, new Date()), extra: { note } }));
}

/** Open a closed payment again, with the reason (Manage). */
export async function reopenFailure(input: ReopenInput): Promise<PaymentResult> {
  const parsed = reopenSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: problemOf(parsed.error) };
  const { id, operationId, version, note } = parsed.data;
  return step(id, operationId, version, "reopen", "payments.manage", (row) => ({ data: reopenChange(row.status as PaymentStatus, row.attempts), extra: { note } }));
}

/** Manage takes the payments with no swimmer behind them off the list, at the sites they manage:
 *  those whose member number is a swimmer's now are linked to them instead. Each removal takes its
 *  history with it and leaves an audit row, all in one transaction. */
export async function removeNonSwimmers(): Promise<ActionResult> {
  const who = await requirePaymentsActor();
  if (!who.manage) return fail("Removing payments needs Payments: Manage.");
  // Swimmers are looked up through the swim school first; inside the transaction only the payments
  // still unlinked are changed, so anything another person changed since is left as it is.
  const planned = await nonSwimmerPlan(who.orgId);
  if (!planned) return fail("Swimmers can’t be checked while the Swim school app is switched off.");
  await prisma.$transaction(async (tx) => {
    const still = new Set((await tx.paymentFailure.findMany({ where: { id: { in: [...planned.link, ...planned.remove].map((f) => f.id) }, memberId: null }, select: { id: true } })).map((f) => f.id));
    const plan = { link: planned.link.filter((f) => still.has(f.id)), remove: planned.remove.filter((f) => still.has(f.id)) };
    for (const f of plan.link) {
      await tx.paymentFailure.update({ where: { id: f.id }, data: { memberId: f.memberId, version: { increment: 1 } } });
      await logAudit({ actorId: who.id, actorName: who.name, action: "update", entity: "PaymentFailure", entityId: f.id, clubId: f.siteId,
        summary: `${failureLabel(f)}. Linked to the swimmer with member number ${f.memberNumber}` }, tx);
    }
    for (const f of plan.remove) {
      await tx.paymentFailureEvent.deleteMany({ where: { failureId: f.id } });
      await tx.paymentFailure.delete({ where: { id: f.id } });
      await logAudit({ actorId: who.id, actorName: who.name, action: "delete", entity: "PaymentFailure", entityId: f.id, clubId: f.siteId,
        summary: `${failureLabel(f)}. Removed: member number ${f.memberNumber || "none"} is not a swimmer on Turnfin` }, tx);
    }
    return plan;
  }, { timeout: 120_000 });
  revalidatePath("/payments", "layout");
  revalidatePath("/students/[id]", "page");
  return ok();
}
