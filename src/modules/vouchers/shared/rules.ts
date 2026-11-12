import { Ban, CircleCheck, Clock3, Hourglass, Ticket } from "lucide-react";
import type { StatusMeta } from "@/lib/status";

/** The Vouchers rules, pure so they are tested on their own (docs/vouchers.md). */

/** Where one voucher is. Tones come from here, never a call site. */
export const VOUCHER_STATE_META = {
  valid: { label: "Valid", color: "green", icon: Ticket },
  used: { label: "Used", color: "blue", icon: CircleCheck },
  upcoming: { label: "Not valid yet", color: "orange", icon: Clock3 },
  expired: { label: "Expired", color: "gray", icon: Hourglass },
  void: { label: "Cancelled", color: "red", icon: Ban },
} as const satisfies Record<string, StatusMeta>;
export type VoucherState = keyof typeof VOUCHER_STATE_META;

/** Where a batch is, from its dates and whether it was cancelled. */
export const BATCH_STATE_META = {
  running: { label: "Running", color: "green", icon: Ticket },
  upcoming: { label: "Not started", color: "orange", icon: Clock3 },
  ended: { label: "Ended", color: "gray", icon: Hourglass },
  void: { label: "Cancelled", color: "red", icon: Ban },
} as const satisfies Record<string, StatusMeta>;
export type BatchState = keyof typeof BATCH_STATE_META;

/** The most vouchers one batch can hold; a bigger gift is two batches. */
export const MAX_BATCH = 500;
/** The small print a new batch starts with. */
export const DEFAULT_TERMS = "One use only. Hand this voucher in at reception. Subject to availability and the pool timetable. No cash value; not for resale.";

/** A batch's dates as `YYYY-MM-DD`, the days it is valid from and until (both included). */
export type Validity = { validFrom: string; validUntil: string; voided: boolean };

export function batchState(batch: Validity, today: string): BatchState {
  if (batch.voided) return "void";
  if (today < batch.validFrom) return "upcoming";
  return today > batch.validUntil ? "ended" : "running";
}

/** A voucher's state on a day. Used wins over everything: a used voucher stays
 *  used after its batch ends or is cancelled. */
export function voucherState(voucher: { redeemed: boolean; voided: boolean }, batch: Validity, today: string): VoucherState {
  if (voucher.redeemed) return "used";
  if (voucher.voided || batch.voided) return "void";
  if (today < batch.validFrom) return "upcoming";
  return today > batch.validUntil ? "expired" : "valid";
}

/* Codes. Eight characters from an alphabet without the look-alikes (no 0 or O,
   no 1, I or L), printed in two groups: "7K3M-9QXD". 31^8 is about 850 billion,
   so a code cannot be guessed at the desk. */

export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 8;

/** A new code. `pick(n)` returns a whole number from 0 up to, not including, n. */
export function newCode(pick: (n: number) => number): string {
  let raw = "";
  for (let i = 0; i < CODE_LENGTH; i++) raw += CODE_ALPHABET[pick(CODE_ALPHABET.length)];
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/** What a person typed, as the stored code; null when it cannot be one. Spaces,
 *  dashes and lower case are forgiven. */
export function normaliseCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (raw.length !== CODE_LENGTH || [...raw].some((c) => !CODE_ALPHABET.includes(c))) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/** `count` codes, all different from each other and from `taken`. */
export function newCodes(count: number, taken: ReadonlySet<string>, pick: (n: number) => number): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    const code = newCode(pick);
    if (!taken.has(code)) codes.add(code);
  }
  return [...codes];
}

/** Whether a voucher can be used at a site: its batch names the sites that accept it. */
export function acceptedAt(batch: { siteIds: readonly string[] }, siteId: string) {
  return batch.siteIds.includes(siteId);
}

/** Used and still usable, out of how many were made. */
export function usage(quantity: number, used: number) {
  return { used, unused: Math.max(0, quantity - used), percent: quantity ? Math.round((used / quantity) * 100) : 0 };
}
