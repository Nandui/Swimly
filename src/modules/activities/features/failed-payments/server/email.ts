import "server-only";
import { z } from "zod";
import type { PaymentFailure } from "@/generated/prisma/client";
import { sitePhones, siteName } from "@/lib/directory";
import { today } from "@/lib/format";
import { members, type Member } from "@/modules/contributions";
import { nextEmail, paymentEmail, type EmailStep } from "@/modules/activities/shared/payments/emails";
import { familyEmailText, type FamilyEmail } from "@/modules/activities/shared/parents/family-email";
import type { PaymentStatus } from "@/modules/activities/shared/payments/types";

const address = z.string().email().max(254);

/** The next warning email for a failed payment, as the page previews it and the send action sends
 *  it: its step, when it is due, who it goes to and its words. `blocked` says why it can't go yet
 *  (no swimmer, no email address); null once all three went or the payment is closed. Reads the
 *  swimmer through the member directory and the site's phone, so call it outside a transaction. */
export async function emailPlan(row: PaymentFailure, member?: Member | null) {
  const next = nextEmail({ status: row.status as PaymentStatus, emailsSent: row.emailsSent, firstEmailOn: row.firstEmailAt ? today(row.firstEmailAt) : null }, today());
  if (!next) return null;
  if (member === undefined) {
    const directory = await members();
    member = row.memberId && directory ? (await directory.byIds([row.memberId], { medical: false })).get(row.memberId) ?? null : null;
  }
  const to = member?.contactEmail?.trim().toLowerCase() ?? "";
  const blocked = !member ? "This payment isn't linked to a swimmer, so there's no family email to send to."
    : !to || !address.safeParse(to).success || /[\r\n]/.test(to) ? "There's no valid email address on the swimmer's record. Add one on their profile, or contact the family another way."
    : null;
  const [site, phones] = await Promise.all([siteName(row.siteId), sitePhones([row.siteId])]);
  const { subject, email } = paymentEmail(next.step, {
    greet: member?.contactName?.trim() || row.name, child: member?.firstName ?? "your child",
    amountCents: row.amountCents, month: row.month, returnCode: row.returnCode,
    site, phone: phones.get(row.siteId)?.trim() ?? "",
    firstEmailOn: row.firstEmailAt ? today(row.firstEmailAt) : null, sentOn: today(),
  });
  return { step: next.step as EmailStep, dueOn: next.dueOn, due: next.due, to, blocked, subject, email: email as FamilyEmail, text: familyEmailText(email) };
}
export type EmailPlan = NonNullable<Awaited<ReturnType<typeof emailPlan>>>;
