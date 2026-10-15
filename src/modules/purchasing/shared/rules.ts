import { Ban, CircleCheck, CircleDashed, CircleX, Clock3, FlaskConical, MailCheck, MailX, Power, PowerOff } from "lucide-react";
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
/** An email of an approved order: to the supplier, a test to the sender, or one that failed. */
export const PO_EMAIL_META = {
  supplier: { label: "Sent to supplier", color: "green", icon: MailCheck },
  test: { label: "Test to sender", color: "blue", icon: FlaskConical },
  failed: { label: "Not sent", color: "red", icon: MailX },
} as const satisfies Record<string, StatusMeta>;
/** Whether approved orders may be emailed to suppliers. */
export const SUPPLIER_EMAILS_META = {
  on: { label: "On", color: "green", icon: Power },
  off: { label: "Off, tests only", color: "gray", icon: PowerOff },
} as const satisfies Record<string, StatusMeta>;
/** The requester can still change an order in these. */
export const EDITABLE: readonly PoStatus[] = ["draft", "rejected"];

export const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;
const MONTH_IN_IRELAND = new Intl.DateTimeFormat("en-IE", { timeZone: "Europe/Dublin", month: "numeric" });

/** The order number: "BT-OCT-0042", the site's code, the month it is approved
 *  (Irish time) and the organisation's running number, which never resets and is
 *  unique on its own (owner request, 15 October 2026). */
export function poNumber(siteCode: string, approvedAt: Date, n: number) {
  const month = MONTHS[Number(MONTH_IN_IRELAND.format(approvedAt)) - 1];
  return `${siteCode.toUpperCase()}-${month}-${String(n).padStart(4, "0")}`;
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

/* Retail details (owner request, 15 October 2026): a product's brand and the sizes and
   colours it comes in; each order line picks one size and one colour. */

/** "S, M, L" typed by a person, as the list of options: trimmed, no blanks, no repeats
 *  (ignoring case), in the order typed. */
export function optionsOf(value: string): string[] {
  const seen = new Set<string>();
  return value.split(/[,\n]/).map((v) => v.trim().replace(/\s+/g, " ")).filter((v) => {
    const key = v.toLowerCase();
    if (!v || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** A line's brand, size and colour as one short phrase: "Speedo · Size M · Navy". */
export function lineDetails(l: { brand?: string; size?: string; colour?: string }) {
  return [l.brand, l.size ? `Size ${l.size}` : "", l.colour].filter(Boolean).join(" · ");
}

/** Whether a line's size and colour are ones the product comes in: one of each list,
 *  and none when it has no list. Returns what is wrong, or null. */
export function variantProblem(p: { name: string; sizes: readonly string[]; colours: readonly string[] }, l: { size: string; colour: string }) {
  if (p.sizes.length ? !p.sizes.includes(l.size) : l.size) return p.sizes.length ? `Choose a size for ${p.name}.` : `${p.name} has no sizes.`;
  if (p.colours.length ? !p.colours.includes(l.colour) : l.colour) return p.colours.length ? `Choose a colour for ${p.name}.` : `${p.name} has no colours.`;
  return null;
}

/** Most addresses Copy to may hold (owner request, 15 October 2026: "a few"). */
export const MAX_COPY_TO = 5;

/** The addresses in a Copy to list, as typed or stored: separated by commas, semicolons
 *  or spaces, each once (ignoring case), in the order given. */
export function copyList(raw: string): string[] {
  const seen = new Set<string>();
  return raw.split(/[\s,;]+/).map((a) => a.trim()).filter((a) => a && !seen.has(a.toLowerCase()) && seen.add(a.toLowerCase()));
}
