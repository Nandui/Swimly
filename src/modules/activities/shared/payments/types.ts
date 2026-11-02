import { Ban, CircleCheck, Landmark, PhoneCall, PhoneOutgoing } from "lucide-react";
import { formatMonth } from "@/lib/format";
import type { StatusMeta } from "@/lib/status";

/** Payments' words, pure: server and client both read them. Each status has its own icon, so
 *  colour is never the only signal. */

export const PAYMENT_STATUSES = ["to_contact", "contacted", "paid", "new_mandate", "cancelled"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
/** To contact waits on reception (orange, needs action); Contacted waits on the member (blue);
 *  Paid and New mandate are recovered (green); Place cancelled ended without the money (grey). */
export const PAYMENT_STATUS_META = {
  to_contact: { label: "To contact", color: "orange", icon: PhoneOutgoing },
  contacted: { label: "Contacted", color: "blue", icon: PhoneCall },
  paid: { label: "Paid at the desk", color: "green", icon: CircleCheck },
  new_mandate: { label: "New mandate set up", color: "green", icon: Landmark },
  cancelled: { label: "Place cancelled", color: "gray", icon: Ban },
} as const satisfies Record<PaymentStatus, StatusMeta>;
export const OPEN_STATUSES = ["to_contact", "contacted"] as const satisfies readonly PaymentStatus[];
export const OUTCOMES = ["paid", "new_mandate", "cancelled"] as const satisfies readonly PaymentStatus[];
export type Outcome = (typeof OUTCOMES)[number];
/** What each close says it means, on its button. */
export const OUTCOME_HINT: Record<Outcome, string> = {
  paid: "They paid what failed at the desk or on the phone, taken in Legend.",
  new_mandate: "Their bank details are updated in Legend, so the money is collected again.",
  cancelled: "They left, or their place was ended, so the money is not being chased.",
};

export const CONTACT_METHODS = ["phone", "text", "email", "desk"] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];
export const METHOD_LABEL: Record<ContactMethod, string> = { phone: "Phone call", text: "Text", email: "Email", desk: "At the desk" };
export const CONTACT_RESULTS = ["no_answer", "message", "spoke"] as const;
export type ContactResult = (typeof CONTACT_RESULTS)[number];
export const RESULT_LABEL: Record<ContactResult, string> = { no_answer: "No answer", message: "Left a message", spoke: "Spoke to them" };

/** The history's words for each step. */
export const PAYMENT_ACTIONS = {
  import: "Added from the failure sheet",
  contact: "Contacted",
  paid: "Marked paid at the desk",
  new_mandate: "Marked new mandate set up",
  cancelled: "Marked place cancelled",
  reopen: "Opened again",
} as const;
export type PaymentAction = keyof typeof PAYMENT_ACTIONS;

/** What the bank's commonest return codes mean, for the person about to ring: what to ask for. */
export const RETURN_ADVICE: Record<string, string> = {
  AM04: "Not enough money in the account. Ask them to pay at the desk.",
  MD01: "The bank has no mandate: it was cancelled or never set up. They need a new mandate, or to pay at the desk.",
  AC06: "The account is blocked. Ask for new bank details and a new mandate.",
  AC04: "The account is closed. Ask for new bank details and a new mandate.",
  AG01: "The bank will not take direct debits from this account. Ask for another account or payment at the desk.",
  MS02: "They refused the payment with their bank. Ask why, and for payment at the desk.",
  MS03: "The bank gave no reason. Ask them to check with their bank and pay at the desk.",
};

/** "2026-09" as "September 2026". */
export const monthLabel = (month: string) => (/^\d{4}-\d{2}$/.test(month) ? formatMonth(`${month}-01`) : month);

const EURO = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });
export const euro = (cents: number) => EURO.format(cents / 100);

/** One failure as screens see it: no Core rows. */
export type PaymentView = {
  id: string; status: PaymentStatus; version: number;
  siteId: string; siteName: string; month: string; reference: string; memberNumber: string; memberId: string | null;
  name: string; amountCents: number; returnCode: string; returnReason: string;
  attempts: number; lastContactAt: string | null; outcome: string;
  closedByName: string | null; closedAt: string | null; createdAt: string;
};
export type PaymentHistory = { id: string; action: PaymentAction; actorName: string; method: string; result: string; note: string; createdAt: string };
export type PaymentResult = { ok: true; id: string } | { ok: false; error: string };
