import { CircleCheck, CircleX, Clock3, TriangleAlert } from "lucide-react";
import { addDaysIso, toDateOnlyString as iso } from "@/lib/format";
import type { StatusMeta } from "@/lib/status";

/** What a person's position asks of them (owner decision, 8 October 2026): each qualification it
 *  needs, and whether they hold it in date. Pure, so the rule is tested on its own, and every
 *  screen (the Staff page, the HR file, Training's expiring list) reads it the same way. */

export const REQUIREMENT_META = {
  met: { label: "In date", color: "green", icon: CircleCheck },
  expiring: { label: "Expires soon", color: "orange", icon: Clock3 },
  expired: { label: "Expired", color: "red", icon: TriangleAlert },
  missing: { label: "Not held", color: "red", icon: CircleX },
} as const satisfies Record<string, StatusMeta>;
export type RequirementState = keyof typeof REQUIREMENT_META;

/** Expiring = within 60 days, the usual renewal window (as `qualificationState`). */
const REQUIREMENT_WARNING_DAYS = 60;

type Held = { typeId: string; issuedOn: Date | null; expiresOn: Date | null; revokedAt: Date | null };

/** Each required qualification with the person's best record of it: the one valid longest, so a
 *  renewed certificate counts and an older expired one does not. Worst first. */
export function requirementStates(required: readonly { id: string; name: string }[], held: readonly Held[], on: string) {
  const order: Record<RequirementState, number> = { missing: 0, expired: 1, expiring: 2, met: 3 };
  return required.map((type) => {
    const records = held.filter((h) => h.typeId === type.id && !h.revokedAt && (!h.issuedOn || iso(h.issuedOn) <= on));
    const best = records.sort((a, b) => (b.expiresOn ? iso(b.expiresOn) : "9999") .localeCompare(a.expiresOn ? iso(a.expiresOn) : "9999"))[0];
    const expiresOn = best?.expiresOn ? iso(best.expiresOn) : null;
    const state: RequirementState = !best ? "missing" : expiresOn && expiresOn < on ? "expired" : expiresOn && expiresOn <= addDaysIso(on, REQUIREMENT_WARNING_DAYS) ? "expiring" : "met";
    return { typeId: type.id, name: type.name, state, expiresOn };
  }).sort((a, b) => order[a.state] - order[b.state] || a.name.localeCompare(b.name));
}

/** A line for a profile or a list: "All 3 in date", "1 missing, 1 expires soon". */
export function requirementSummary(states: readonly { state: RequirementState }[]) {
  if (!states.length) return "Their position needs no qualifications";
  const count = (s: RequirementState) => states.filter((x) => x.state === s).length;
  const parts = [
    count("missing") ? `${count("missing")} not held` : null,
    count("expired") ? `${count("expired")} expired` : null,
    count("expiring") ? `${count("expiring")} ${count("expiring") === 1 ? "expires" : "expire"} soon` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : states.length === 1 ? "In date" : `All ${states.length} in date`;
}
