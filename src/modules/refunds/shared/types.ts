import { Ban, CheckCheck, CircleHelp, Clock3, FilePenLine, Inbox, ScanSearch, XCircle } from "lucide-react";
import type { StatusMeta } from "@/lib/status";

/** Each status has its own icon shape, so colour is never the only signal. */
export const refundStatuses = {
  DRAFT: { label: "Draft", color: "gray", icon: FilePenLine },
  SUBMITTED: { label: "Submitted", color: "blue", icon: Inbox },
  IN_REVIEW: { label: "In review", color: "purple", icon: ScanSearch },
  NEEDS_INFORMATION: { label: "Needs information", color: "orange", icon: CircleHelp },
  APPROVED: { label: "Awaiting payment", color: "blue", icon: Clock3 },
  REFUNDED: { label: "Refunded", color: "green", icon: CheckCheck },
  DECLINED: { label: "Declined", color: "red", icon: XCircle },
  WITHDRAWN: { label: "Withdrawn", color: "gray", icon: Ban },
} satisfies Record<string, StatusMeta>;
export type RefundStatus = keyof typeof refundStatuses;
export const refundServices = { AQUATICS: "Aquatics", MEMBERSHIP: "Membership", BOOKING: "Booking", OTHER: "Other" } as const;
export const paymentMethods = { CARD: "Card", BANK_TRANSFER: "Bank transfer", CASH: "Cash", OTHER: "Other" } as const;
export const refundActions = { save: "Draft saved", submit: "Submitted to finance", claim: "Finance handler changed", information: "Information requested", approve: "Approved", decline: "Declined", withdraw: "Withdrawn", cancel: "Approval cancelled", pay: "Payment recorded", upload: "Receipt added", remove: "Receipt removed" } as const;
export type RefundAction = keyof typeof refundActions;
export type RefundActor = { id: string; name: string; request: boolean; review: boolean; process: boolean };
export type RefundFields = {
  clubId: string; customerName: string; contactEmail: string; contactPhone: string; memberNumber: string;
  service: keyof typeof refundServices | ""; description: string; amount: string; paymentDate: string; paymentReference: string; reason: string;
};
export type Receipt = { id: string; name: string; mime: string; size: number; removedAt: string | null };
export type RefundView = Omit<RefundFields, "amount" | "service"> & {
  service: keyof typeof refundServices; id: string; number: number; status: RefundStatus; version: number; creatorId: string; creatorName: string; clubName: string;
  requestedCents: number | null; approvedCents: number | null; approvedByName: string | null;
  handlerId: string | null; handlerName: string | null; submittedAt: string | null; createdAt: string; updatedAt: string;
  paidOn: string | null; paidMethod: string | null; paidReference: string | null; paidByName: string | null;
};
export type RefundHistory = { id: string; actorName: string; action: string; note: string; createdAt: string; snapshot: Record<string, unknown> };
export type RefundDetail = { request: RefundView; attachments: Receipt[]; events: RefundHistory[]; delivery: { id: string; status: string; error: string | null }[] };
export type RefundResult = { ok: true; id: string; version: number; warning?: string } | { ok: false; error: string };
export const refundNumber = (number: number) => `RF-${String(number).padStart(6, "0")}`;
export const euros = (cents: number | null) => cents === null ? "Not entered" : new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);
export const editableRefund = (row: { status: string; creatorId: string }, who: RefundActor) => who.request && (row.status === "NEEDS_INFORMATION" || (row.status === "DRAFT" && row.creatorId === who.id));
/** Which request view a list address shows: everyone's, the person's own, or their drafts.
 *  The page bar and the list heading both follow it. */
export type RefundListView = "requests" | "mine" | "drafts";
export const refundListView = (params: { get(key: string): string | null }, whoId: string): RefundListView =>
  params.get("status") === "DRAFT" ? "drafts" : params.get("creator") === whoId ? "mine" : "requests";
/** The finance and reception steps open to this person on this request, in the order shown. */
export const refundFinanceActions = ["claim", "approve", "information", "decline", "pay", "cancel", "withdraw"] as const;
export type RefundFinanceAction = (typeof refundFinanceActions)[number];
export function refundNextActions(row: { status: string; creatorId: string; handlerId: string | null }, who: RefundActor): RefundFinanceAction[] {
  const reviewable = row.status === "SUBMITTED" || row.status === "IN_REVIEW", independent = row.creatorId !== who.id;
  return [
    ...((reviewable && who.review || row.status === "APPROVED" && who.process) && row.handlerId !== who.id ? ["claim" as const] : []),
    ...(reviewable && who.review && independent ? ["approve", "information", "decline"] as const : []),
    ...(row.status === "APPROVED" && who.process ? ["pay" as const] : []),
    ...(row.status === "APPROVED" && (who.review || who.process) ? ["cancel" as const] : []),
    ...(who.request && ["DRAFT", "SUBMITTED", "IN_REVIEW", "NEEDS_INFORMATION"].includes(row.status) ? ["withdraw" as const] : []),
  ];
}
/** The one line under "Next action" that says whose move it is. */
export function refundNextStep(status: string) {
  return status === "DRAFT" ? "Complete the details and submit to finance when ready."
    : status === "NEEDS_INFORMATION" ? "Reception needs to answer the finance query and resubmit."
    : status === "APPROVED" ? "Finance needs to issue the refund in the payment system, then record it here."
    : status === "SUBMITTED" || status === "IN_REVIEW" ? "Finance needs to review the request and decide the outcome."
    : "This request is closed. Its decisions and payment history are kept.";
}
export const canReadRefund =(row: { status: string; creatorId: string; submittedAt?: Date | string | null }, who: { id: string }) => row.creatorId === who.id || (row.status !== "DRAFT" && row.submittedAt != null);
