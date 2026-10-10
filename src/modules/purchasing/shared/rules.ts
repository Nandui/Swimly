import { Ban, CircleCheck, CircleDashed, CircleX, Clock3 } from "lucide-react";
import type { StatusMeta } from "@/lib/status";

/** Purchasing's rules, pure so they are tested on their own (docs/purchasing.md). */

/** Where an order is. Tones come from here, never a call site. */
export const PO_STATUS_META = {
  draft: { label: "Draft", color: "gray", icon: CircleDashed },
  pending: { label: "Waiting for approval", color: "orange", icon: Clock3 },
  approved: { label: "Approved", color: "green", icon: CircleCheck },
  rejected: { label: "Rejected", color: "red", icon: CircleX },
  cancelled: { label: "Cancelled", color: "gray", icon: Ban },
} as const satisfies Record<string, StatusMeta>;
export type PoStatus = keyof typeof PO_STATUS_META;
/** A supplier or product taken off the approved list. */
export const APPROVAL_LIST_META = {
  removed: { label: "Not approved", color: "gray", icon: Ban },
} as const satisfies Record<string, StatusMeta>;
/** The requester can still change an order in these. */
export const EDITABLE: readonly PoStatus[] = ["draft", "rejected"];

/** The order number: "PO-BT-00001", the site's code and its next number. */
export function poNumber(siteCode: string, n: number) {
  return `PO-${siteCode}-${String(n).padStart(5, "0")}`;
}

/** Euro amounts as staff read them: "€1,234.50". */
const EURO = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });
export const euro = (cents: number) => EURO.format(cents / 100);
/** "12.50" or "12" typed by a person, as cents; null when it is not an amount. */
export function centsOf(value: string): number | null {
  const clean = value.trim().replace(/[€,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

export function orderTotal(lines: readonly { unitPriceCents: number; quantity: number }[]) {
  return lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
}

export type ApprovalRule = { supplierId: string | null; roleId: string; limitCents: number | null };

/** The rules that decide a supplier's orders: its own when it has any,
 *  otherwise the ones for every supplier. */
export function rulesFor(rules: readonly ApprovalRule[], supplierId: string) {
  const own = rules.filter((r) => r.supplierId === supplierId);
  return own.length ? own : rules.filter((r) => r.supplierId === null);
}

/** Whether someone in this role may approve this much from this supplier. */
export function mayApprove(rules: readonly ApprovalRule[], supplierId: string, roleId: string | null, totalCents: number) {
  if (!roleId) return false;
  return rulesFor(rules, supplierId).some((r) => r.roleId === roleId && (r.limitCents === null || r.limitCents >= totalCents));
}

/** The roles that may approve this much from this supplier, the smallest
 *  limit first, so the order goes to the nearest level of authority. */
export function approverRoles(rules: readonly ApprovalRule[], supplierId: string, totalCents: number) {
  return rulesFor(rules, supplierId)
    .filter((r) => r.limitCents === null || r.limitCents >= totalCents)
    .sort((a, b) => (a.limitCents ?? Infinity) - (b.limitCents ?? Infinity))
    .map((r) => r.roleId)
    .filter((id, i, all) => all.indexOf(id) === i);
}
