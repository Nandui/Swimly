import { z } from "zod";
import { isDateOnly, today } from "@/lib/format";
import { editableRefund, paymentMethods, refundServices, type RefundActor } from "./types";

export class RefundError extends Error {}
export function money(value: string): number | null {
  if (!value.trim()) return null;
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(value.trim())) throw new RefundError("Enter a euro amount with no more than two decimal places.");
  const [whole, decimal = ""] = value.trim().split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (cents <= 0) throw new RefundError("The refund amount must be greater than zero.");
  return cents;
}
const text = (max: number) => z.string().trim().max(max);
export const fieldsSchema = z.object({
  clubId: text(100).min(1, "Choose a site."), customerName: text(200), contactEmail: text(254).refine(v => !v || z.string().email().safeParse(v).success, "Enter a valid email address."),
  contactPhone: text(80), memberNumber: text(80), service: z.enum(Object.keys(refundServices) as [keyof typeof refundServices, ...Array<keyof typeof refundServices>]),
  description: text(2000), amount: text(24), paymentDate: text(10).refine(v => !v || (isDateOnly(v) && v <= today()), "Choose a valid payment date, today or earlier."), paymentReference: text(200), reason: text(4000),
});
export function parseFields(input: unknown, submit: boolean) {
  const parsed = fieldsSchema.safeParse(input);
  if (!parsed.success) throw new RefundError(parsed.error.issues[0].message);
  const { amount, ...fields } = parsed.data;
  const requestedCents = money(amount);
  if (submit && (!fields.customerName || !fields.description || !fields.paymentDate || !fields.paymentReference || !fields.reason || requestedCents === null))
    throw new RefundError("Complete the customer, service description, amount, original payment date and reference, and refund reason before submitting.");
  return { ...fields, requestedCents };
}
export const commandSchema = z.object({
  id: z.string().uuid(), operationId: z.string().uuid(), version: z.number().int().min(0),
  action: z.enum(["save", "submit", "claim", "information", "approve", "decline", "withdraw", "cancel", "pay"]),
  fields: z.unknown().optional(), note: text(4000).default(""), amount: text(24).default(""),
  paidOn: text(10).default(""), paidMethod: text(40).default(""), paidReference: text(200).default(""),
});
export type RefundCommand = z.input<typeof commandSchema>;
type Row = { status: string; creatorId: string; requestedCents: number | null; approvedCents: number | null; paymentDate: string };
export function transition(row: Row, who: RefundActor, command: z.output<typeof commandSchema>) {
  const { action, note } = command;
  const reviewable = row.status === "SUBMITTED" || row.status === "IN_REVIEW";
  if (action === "save" || action === "submit") {
    if (!editableRefund(row, who)) throw new RefundError("This request can no longer be edited. Refresh to see its current status.");
    return { status: action === "submit" ? "SUBMITTED" : row.status };
  }
  if (action === "claim") {
    if (!(reviewable && who.review) && !(row.status === "APPROVED" && who.process)) throw new RefundError("You cannot take responsibility at this stage.");
    return { status: reviewable ? "IN_REVIEW" : row.status, handlerId: who.id, handlerName: who.name };
  }
  if (["approve", "decline", "information"].includes(action)) {
    if (!who.review || !reviewable) throw new RefundError("This request is not available for your review. Refresh the page.");
    if (row.creatorId === who.id) throw new RefundError("Another finance colleague must review your request.");
    if (action !== "approve" && !note) throw new RefundError("Enter a reason for this decision.");
    if (action === "approve") {
      const approvedCents = money(command.amount);
      if (approvedCents === null || row.requestedCents === null || approvedCents > row.requestedCents) throw new RefundError("Approve an amount greater than zero and no higher than the requested amount.");
      if (approvedCents !== row.requestedCents && !note) throw new RefundError("Explain why the approved refund is lower than requested.");
      return { status: "APPROVED", approvedCents, approvedById: who.id, approvedByName: who.name, handlerId: who.id, handlerName: who.name };
    }
    return { status: action === "decline" ? "DECLINED" : "NEEDS_INFORMATION", handlerId: who.id, handlerName: who.name };
  }
  if (action === "withdraw") {
    if (!who.request || !["DRAFT", "SUBMITTED", "IN_REVIEW", "NEEDS_INFORMATION"].includes(row.status)) throw new RefundError("Only an unapproved request can be withdrawn by reception.");
    if (!note) throw new RefundError("Enter a reason for withdrawing the request.");
    return { status: "WITHDRAWN" };
  }
  if (action === "cancel") {
    if (!(who.review || who.process) || row.status !== "APPROVED") throw new RefundError("Only an unpaid approval can be cancelled by finance.");
    if (!note) throw new RefundError("Enter a reason for cancelling the approval.");
    return { status: "WITHDRAWN" };
  }
  if (!who.process || row.status !== "APPROVED" || !row.approvedCents) throw new RefundError("Only an approved, unpaid refund can be recorded as paid.");
  if (!isDateOnly(command.paidOn) || command.paidOn > today() || command.paidOn < row.paymentDate) throw new RefundError("Choose a refund payment date between the original payment and today.");
  if (!Object.hasOwn(paymentMethods, command.paidMethod) || !command.paidReference) throw new RefundError("Enter the external payment method and reference.");
  return { status: "REFUNDED", paidOn: command.paidOn, paidMethod: command.paidMethod, paidReference: command.paidReference, paidById: who.id, paidByName: who.name };
}
