import { Ban, CheckCheck, CircleHelp, Clock3, FilePenLine, Inbox, ScanSearch, XCircle } from "lucide-react";
import type { StatusMeta } from "@/lib/status";

/** Each status has its own icon shape, so colour is never the only signal. */
export const coinageStatuses = {
  DRAFT: { label: "Draft", color: "gray", icon: FilePenLine },
  SUBMITTED: { label: "Submitted", color: "blue", icon: Inbox },
  IN_REVIEW: { label: "In review", color: "purple", icon: ScanSearch },
  NEEDS_INFORMATION: { label: "Needs information", color: "orange", icon: CircleHelp },
  APPROVED: { label: "Awaiting order", color: "blue", icon: Clock3 },
  ORDERED: { label: "Ordered", color: "green", icon: CheckCheck },
  DECLINED: { label: "Declined", color: "red", icon: XCircle },
  WITHDRAWN: { label: "Withdrawn", color: "gray", icon: Ban },
} satisfies Record<string, StatusMeta>;
export type CoinageStatus = keyof typeof coinageStatuses;

/** The coins and notes a till takes, largest first. Keys are the face value in cents. */
export const denominations = [
  { cents: 2000, label: "€20 notes" }, { cents: 1000, label: "€10 notes" }, { cents: 500, label: "€5 notes" },
  { cents: 200, label: "€2 coins" }, { cents: 100, label: "€1 coins" }, { cents: 50, label: "50c coins" },
  { cents: 20, label: "20c coins" }, { cents: 10, label: "10c coins" }, { cents: 5, label: "5c coins" },
  { cents: 2, label: "2c coins" }, { cents: 1, label: "1c coins" },
] as const;
export type CoinageLines = Partial<Record<string, number>>;

export const coinageActions = { save: "Draft saved", submit: "Sent to accounts", claim: "Accounts handler changed", information: "Information requested", approve: "Approved", decline: "Declined", withdraw: "Withdrawn", cancel: "Approval cancelled", order: "Order recorded" } as const;
export type CoinageActor = { id: string; name: string; request: boolean; review: boolean; process: boolean };
/** The form's fields as typed: one euro amount per denomination, named `line<cents>`. */
export type CoinageFields = { clubId: string; forWhom: string; neededBy: string; notes: string } & Partial<Record<`line${number}`, string>>;
export type CoinageView = {
  id: string; number: number; status: CoinageStatus; version: number; creatorId: string; creatorName: string; clubId: string; clubName: string;
  forWhom: string; neededBy: string; lines: CoinageLines; totalCents: number | null; notes: string;
  handlerId: string | null; handlerName: string | null; approvedByName: string | null;
  orderedOn: string | null; deliveryOn: string | null; orderReference: string | null; orderedByName: string | null;
  submittedAt: string | null; createdAt: string; updatedAt: string;
};
type CoinageHistory = { id: string; actorName: string; action: string; note: string; createdAt: string; snapshot: Record<string, unknown> };
export type CoinageDetail = { request: CoinageView; events: CoinageHistory[]; delivery: { id: string; status: string; error: string | null }[] };
export type CoinageResult = { ok: true; id: string; version: number; warning?: string } | { ok: false; error: string };

export const coinageNumber = (number: number) => `CO-${String(number).padStart(6, "0")}`;
export const euros = (cents: number | null) => cents === null ? "Not entered" : new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);
/** The denominations a request asks for, largest first, with how many coins or notes that is. */
export const coinageLines = (lines: CoinageLines) => denominations.filter(d => (lines[String(d.cents)] ?? 0) > 0)
  .map(d => ({ ...d, amountCents: lines[String(d.cents)]!, pieces: lines[String(d.cents)]! / d.cents }));
export const editableCoinage = (row: { status: string; creatorId: string }, who: CoinageActor) => who.request && (row.status === "NEEDS_INFORMATION" || (row.status === "DRAFT" && row.creatorId === who.id));

/** Which request view a list address shows: everyone's, the person's own, or their drafts. */
export type CoinageListView = "requests" | "mine" | "drafts";
export const coinageListView = (params: { get(key: string): string | null }, whoId: string): CoinageListView =>
  params.get("status") === "DRAFT" ? "drafts" : params.get("creator") === whoId ? "mine" : "requests";

/** The accounts and desk steps open to this person on this request, in the order shown. */
export const coinageNextActionKeys = ["claim", "approve", "information", "decline", "order", "cancel", "withdraw"] as const;
export type CoinageNextAction = (typeof coinageNextActionKeys)[number];
export function coinageNextActions(row: { status: string; creatorId: string; handlerId: string | null }, who: CoinageActor): CoinageNextAction[] {
  const reviewable = row.status === "SUBMITTED" || row.status === "IN_REVIEW", independent = row.creatorId !== who.id;
  return [
    ...((reviewable && who.review || row.status === "APPROVED" && who.process) && row.handlerId !== who.id ? ["claim" as const] : []),
    ...(reviewable && who.review && independent ? ["approve", "information", "decline"] as const : []),
    ...(row.status === "APPROVED" && who.process ? ["order" as const] : []),
    ...(row.status === "APPROVED" && (who.review || who.process) ? ["cancel" as const] : []),
    ...(who.request && ["DRAFT", "SUBMITTED", "IN_REVIEW", "NEEDS_INFORMATION"].includes(row.status) ? ["withdraw" as const] : []),
  ];
}
/** The one line under "Next action" that says whose move it is. */
export function coinageNextStep(status: string) {
  return status === "DRAFT" ? "Add the coins and notes needed and send it to accounts when ready."
    : status === "NEEDS_INFORMATION" ? "The desk needs to answer the accounts query and send it again."
    : status === "APPROVED" ? "Accounts needs to order the coinage, then record the order here."
    : status === "SUBMITTED" || status === "IN_REVIEW" ? "Accounts needs to check the request and decide."
    : status === "ORDERED" ? "The coinage is ordered. Check it against this list when it arrives."
    : "This request is closed. Its history is kept.";
}
export const canReadCoinage = (row: { status: string; creatorId: string; submittedAt?: Date | string | null }, who: { id: string }) => row.creatorId === who.id || (row.status !== "DRAFT" && row.submittedAt != null);
