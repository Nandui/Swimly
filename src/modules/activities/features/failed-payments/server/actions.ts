"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requireSession } from "@/lib/authz";
import { formatDay } from "@/lib/format";
import { mayFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { requirePaymentsActor, type PaymentsActor } from "@/modules/activities/shared/payments/access";
import { closeChange, closeSchema, contactChange, contactSchema, PaymentError, problemOf, reopenChange, reopenSchema, type CloseInput, type ContactInput, type ReopenInput } from "@/modules/activities/shared/payments/rules";
import { alreadyDone, failureLabel, guardVersion, lockFailure, recordStep } from "@/modules/activities/shared/payments/service";
import { emailPlan, testEmailWords, validAddress } from "@/modules/activities/features/failed-payments/server/email";
import { nonSwimmerPlan } from "@/modules/activities/features/failed-payments/server/non-swimmers";
import { sendFamilyEmail } from "@/modules/activities/shared/parents/family-email";
import { EMAIL_STEP_LABEL } from "@/modules/activities/shared/payments/emails";
import { METHOD_LABEL, RESULT_LABEL, type PaymentAction, type PaymentResult, type PaymentStatus } from "@/modules/activities/shared/payments/types";
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
  if (!planned) return fail("Swimmers can’t be checked while the Classes app is switched off.");
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

const sendEmailSchema = z.object({ id: z.string().min(1), operationId: z.uuid(), version: z.number().int().positive(), step: z.union([z.literal(1), z.literal(2), z.literal(3)]) });
type SendEmailInput = z.input<typeof sendEmailSchema>;

/** Reception sends the next warning email to the family (owner, 2 November 2026). The swimmer's
 *  email and the site's phone are read first; then, under the payment's lock, it checks this is
 *  still the next step and due, sends, and records it (the history, an audit row, the payment now
 *  Contacted) in the same transaction, so a failed send records nothing. Only the live site emails
 *  anyone (previews run on copies of real families' records); elsewhere the step is recorded as not
 *  sent, so the flow can be tried. */
export async function sendPaymentEmail(input: SendEmailInput): Promise<PaymentResult> {
  const parsed = sendEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Refresh the page and try again." };
  const { id, operationId, version, step: wanted } = parsed.data;
  const who = await requirePaymentsActor();
  // Read here, never from the caller: a server action's arguments come from the browser.
  const live = process.env.VERCEL_ENV === "production";
  try {
    const before = await prisma.paymentFailure.findFirst({ where: { id, orgId: who.orgId ?? undefined } });
    if (!before || !(await mayFor("payments.read", { siteId: before.siteId, orgId: who.orgId }))) throw new PaymentError("This payment is not available.");
    if (!(await mayFor("payments.follow", { siteId: before.siteId, orgId: who.orgId }))) throw new PaymentError("Following up payments needs Payments: Use at this site.");
    const plan = await emailPlan(before);
    await prisma.$transaction(async (tx) => {
      await lockFailure(tx, id);
      if (await alreadyDone(tx, id, operationId, who, "email")) return;
      const row = await tx.paymentFailure.findUniqueOrThrow({ where: { id } });
      guardVersion(row, version);
      if (!plan || plan.step !== wanted) throw new PaymentError("That email has already gone, or the payment is closed. Refresh the page.");
      if (plan.blocked) throw new PaymentError(plan.blocked);
      if (!plan.due) throw new PaymentError(`The ${EMAIL_STEP_LABEL[plan.step].toLowerCase()} is due on ${formatDay(plan.dueOn)}.`);
      if (live) {
        try {
          await sendFamilyEmail(plan.to, plan.subject, plan.email);
        } catch {
          // Provider responses can contain credentials: log the payment, not the error.
          console.error("Failed payments: a warning email was not sent", { failureId: id, step: plan.step });
          throw new PaymentError("The email couldn't be sent, so nothing was recorded. Try again in a few minutes.");
        }
      }
      const now = new Date();
      const saved = await tx.paymentFailure.update({ where: { id }, data: {
        ...contactChange(row.status as PaymentStatus, now), emailsSent: plan.step, firstEmailAt: row.firstEmailAt ?? now, lastEmailAt: now, version: { increment: 1 },
      } });
      await recordStep(tx, saved, who, "email", operationId, { method: "email", result: String(plan.step),
        note: live ? `${EMAIL_STEP_LABEL[plan.step]} sent to ${plan.to}` : `${EMAIL_STEP_LABEL[plan.step]} recorded, not sent: emails only go from the live site`,
        words: EMAIL_STEP_LABEL[plan.step].toLowerCase() });
    });
  } catch (error) {
    if (error instanceof PaymentError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath("/payments", "layout");
  return { ok: true, id };
}

/** An admin checks the warning emails actually go (owner, 4 November 2026): the payment's next
 *  email, marked as a test, is sent to the signed-in person's own address. It needs Payments:
 *  Manage at the payment's site (Admin: Manage and superadmins hold it). Nothing on the payment
 *  changes; an audit row records the test. It sends from every environment, previews included,
 *  because it only ever goes to the person who asked. */
export async function sendTestPaymentEmail(input: { id: string }): Promise<{ ok: true; to: string } | { ok: false; error: string }> {
  const parsed = z.object({ id: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return fail("Refresh the page and try again.");
  const { id } = parsed.data;
  const who = await requirePaymentsActor();
  const row = await prisma.paymentFailure.findFirst({ where: { id, orgId: who.orgId ?? undefined } });
  if (!row || !(await mayFor("payments.read", { siteId: row.siteId, orgId: who.orgId }))) return fail("This payment is not available.");
  if (!(await mayFor("payments.manage", { siteId: row.siteId, orgId: who.orgId }))) return fail("Sending a test email needs Payments: Manage at this site.");
  const to = (await requireSession()).user.email?.trim().toLowerCase() ?? "";
  if (!validAddress(to)) return fail("Your account has no valid email address to send the test to.");
  const { step, subject, email } = await testEmailWords(row);
  try {
    await sendFamilyEmail(to, `[Test] ${subject}`, email);
  } catch {
    // Provider responses can contain credentials: log the payment, not the error.
    console.error("Failed payments: a test email was not sent", { failureId: id, step });
    return fail("The test email couldn't be sent, so the email service isn't working. Check the parents mailbox settings.");
  }
  await logAudit({ actorId: who.id, actorName: who.name, action: "test_email", entity: "PaymentFailure", entityId: id, clubId: row.siteId,
    summary: `${failureLabel(row)}. Test of the ${EMAIL_STEP_LABEL[step].toLowerCase()} sent to ${to}` });
  return { ok: true, to };
}
