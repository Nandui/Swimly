import { Mail } from "lucide-react";
import { addDaysIso, formatDay } from "@/lib/format";
import type { StatusMeta } from "@/lib/status";
import type { FamilyEmail } from "@/modules/activities/shared/parents/family-email";
import { euro, monthLabel, type PaymentStatus } from "./types";

/** The three warning emails to a family whose direct debit failed (owner, 2 November 2026):
 *  reception sends each from the payment's page. The first any time once it is on the list; the
 *  reminder from 3 days after the first; the final notice from 7 days after the first, which says
 *  the place may be cancelled 3 days later. Pure: the page, the action and the tests read it. */

export const EMAIL_STEPS = [1, 2, 3] as const;
export type EmailStep = (typeof EMAIL_STEPS)[number];
export const EMAIL_STEP_LABEL: Record<EmailStep, string> = { 1: "First email", 2: "Reminder", 3: "Final notice" };
/** A row's tag when its next email can go today; the step's words replace the label. */
export const EMAIL_READY_META = { label: "Email ready", color: "blue", icon: Mail } as const satisfies StatusMeta;
/** Days after the first email when each step may be sent; and how long each gives to pay. */
const DUE_AFTER_FIRST: Record<EmailStep, number> = { 1: 0, 2: 3, 3: 7 };
const REMINDER_PAY_BY = 7;
const FINAL_GRACE = 3;

/** The bank's reason in a family's words; null when it gives none Turnfin knows. */
export const FAMILY_REASON: Record<string, string> = {
  AM04: "Not enough money in the account",
  MD01: "The bank has no direct debit instruction for this account",
  AC06: "The account is blocked",
  AC04: "The account is closed",
  AG01: "The bank won't take direct debits from this account",
  MS02: "The payment was stopped at your bank",
  MS03: "The bank didn't give a reason",
};

/** Which email is next for a payment, and from when (ISO dates, Europe/Dublin): null once all three
 *  went or the payment is closed. */
export function nextEmail(p: { status: PaymentStatus; emailsSent: number; firstEmailOn: string | null }, todayIso: string) {
  if (p.status !== "to_contact" && p.status !== "contacted") return null;
  const step = (p.emailsSent + 1) as EmailStep;
  if (!EMAIL_STEPS.includes(step)) return null;
  const dueOn = step === 1 || !p.firstEmailOn ? todayIso : addDaysIso(p.firstEmailOn, DUE_AFTER_FIRST[step]);
  return { step, dueOn, due: dueOn <= todayIso };
}

export type PaymentEmailFacts = {
  /** The account holder or the swimmer's contact, as "Hello …". */
  greet: string;
  /** The swimmer's first name. */
  child: string;
  amountCents: number; month: string; returnCode: string;
  site: string; phone: string;
  /** When the first email went (ISO), for the reminders; the day this one is sent (ISO). */
  firstEmailOn: string | null; sentOn: string;
};

/** One step's email: its subject and content in the family email layout. */
export function paymentEmail(step: EmailStep, f: PaymentEmailFacts): { subject: string; email: FamilyEmail } {
  const month = monthLabel(f.month), monthOnly = month.split(" ")[0];
  const reason = FAMILY_REASON[f.returnCode];
  const pay = f.phone ? `You can pay at reception at ${f.site}, or phone reception on ${f.phone} to pay by card.` : `You can pay at reception at ${f.site}.`;
  const paid = "If you've already paid, thank you, and please ignore this email.";
  const footer = "LeisureWorld Aquatics · Swimming lessons";
  const hello = `Hello ${f.greet},`;
  const base = { footer, signOff: "Thank you,", preheader: `${f.child}'s swimming payment for ${monthOnly}: ${euro(f.amountCents)}` };
  if (step === 1) {
    return { subject: `${f.child}'s swimming lesson payment didn't go through`, email: { ...base,
      title: "Your payment didn't go through", tone: "info",
      before: [hello, `The direct debit for ${f.child}'s swimming lessons in ${monthOnly} didn't go through, so the payment is still outstanding.`],
      details: [["Swimmer", f.child], ["Amount", euro(f.amountCents)], ["Month", month], ...(reason ? [["Bank's reason", reason] as [string, string]] : [])],
      after: ["This happens sometimes and is easy to sort out.", pay, paid],
    } };
  }
  const first = f.firstEmailOn ? formatDay(f.firstEmailOn) : "recently";
  if (step === 2) {
    const by = formatDay(addDaysIso(f.firstEmailOn ?? f.sentOn, REMINDER_PAY_BY));
    return { subject: `Reminder: ${f.child}'s swimming payment is still outstanding`, email: { ...base,
      title: "Payment still outstanding", tone: "warn",
      before: [hello, `We wrote to you on ${first} because the direct debit for ${f.child}'s swimming lessons didn't go through. We haven't received the payment yet.`],
      details: [["Swimmer", f.child], ["Amount due", euro(f.amountCents)], ["Month", month], ["Please pay by", by]],
      after: [pay, "If something has changed, such as your bank account, or you'd like to talk it through, reception will be happy to help.", paid],
    } };
  }
  const by = formatDay(addDaysIso(f.sentOn, FINAL_GRACE));
  return { subject: `Final notice: ${f.child}'s swimming place`, email: { ...base,
    title: "Final notice", tone: "final",
    before: [hello, `We've written to you twice about the payment for ${f.child}'s swimming lessons in ${monthOnly}, and it's still outstanding.`],
    details: [["Swimmer", f.child], ["Amount due", euro(f.amountCents)], ["Month", month], ["Pay by", by]],
    after: [`If we don't receive the payment by ${by}, ${f.child}'s place in their class may be cancelled and offered to the next swimmer on the waiting list.`,
      `To keep the place, ${pay.charAt(0).toLowerCase()}${pay.slice(1)}`, paid],
  } };
}
