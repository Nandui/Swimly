import type { TagColor } from "@/components/ui-kit/tag";

export const refundStatuses = {
  DRAFT: { label: "Draft", color: "gray" },
  SUBMITTED: { label: "Submitted", color: "blue" },
  IN_REVIEW: { label: "In review", color: "purple" },
  NEEDS_INFORMATION: { label: "Needs information", color: "orange" },
  APPROVED: { label: "Awaiting payment", color: "blue" },
  REFUNDED: { label: "Refunded", color: "green" },
  DECLINED: { label: "Declined", color: "red" },
  WITHDRAWN: { label: "Withdrawn", color: "gray" },
} satisfies Record<string, { label: string; color: TagColor }>;
export type RefundStatus = keyof typeof refundStatuses;
export const refundServices = { AQUATICS: "Aquatics", MEMBERSHIP: "Membership", BOOKING: "Booking", OTHER: "Other" } as const;
export const paymentMethods = { CARD: "Card", BANK_TRANSFER: "Bank transfer", CASH: "Cash", OTHER: "Other" } as const;
export const refundActions = { save: "Draft saved", submit: "Submitted to finance", claim: "Finance handler changed", information: "Information requested", approve: "Approved", decline: "Declined", withdraw: "Withdrawn", cancel: "Approval cancelled", pay: "Payment recorded", upload: "Receipt added", remove: "Receipt removed" } as const;
export type RefundAction = keyof typeof refundActions;
export type RefundActor = { id: string; name: string; request: boolean; review: boolean; process: boolean };
export type RefundFields = {
  clubId: string; customerName: string; contactEmail: string; contactPhone: string; memberNumber: string;
  service: keyof typeof refundServices; description: string; amount: string; paymentDate: string; paymentReference: string; reason: string;
};
export type Receipt = { id: string; name: string; mime: string; size: number; removedAt: string | null };
export type RefundView = Omit<RefundFields, "amount"> & {
  id: string; number: number; status: RefundStatus; version: number; creatorId: string; creatorName: string; clubName: string;
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
export const canReadRefund = (row: { status: string; creatorId: string; submittedAt?: Date | string | null }, who: { id: string }) => row.creatorId === who.id || (row.status !== "DRAFT" && row.submittedAt != null);
