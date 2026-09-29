/** Matching a list exported from Legend (Member Agreements, filtered to the
 *  Aquatics agreement) against the swim school's outstanding Legend checks.
 *  A member on the list has their agreement set up in Legend, so their
 *  outstanding place can be confirmed; unless the agreement is terminated, or
 *  it names a different programme from the place, which a person should look
 *  at. Pure, so the rules are tested on their own; the server reads the file
 *  and the places. */

export type LegendMember = {
  memberNumber: string;
  /** Legend's "Agreement Price Name", e.g. "Water Safety & Fun". */
  priceName: string;
  terminated: boolean;
};

export class LegendListError extends Error {}

const text = (value: unknown) => (value === null || value === undefined ? "" : String(value)).replace(/\s+/g, " ").trim();
export const normaliseMember = (value: string) => value.replace(/\s+/g, "").toUpperCase();

/** Rows of the export's data sheet, header first. A member listed twice is
 *  one member; any agreement that is not terminated keeps them on the list. */
export function parseLegendList(rows: readonly (readonly unknown[])[], today: string): LegendMember[] {
  const header = (rows[0] ?? []).map(text);
  const col = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const member = col("Member Number"), price = col("Agreement Price Name"), ended = col("Termination Date");
  if (member < 0) throw new LegendListError("This does not look like a Legend member list: there is no Member Number column.");
  const out = new Map<string, LegendMember>();
  for (const row of rows.slice(1)) {
    const memberNumber = normaliseMember(text(row[member]));
    if (!/^[A-Z]{2,4}\d{3,}$/.test(memberNumber)) continue; // blank rows, "998 rows found."
    const end = ended >= 0 ? row[ended] : null;
    const endIso = end instanceof Date ? end.toISOString().slice(0, 10) : /^\d{4}-\d{2}-\d{2}/.test(text(end)) ? text(end).slice(0, 10) : "";
    const next: LegendMember = { memberNumber, priceName: price >= 0 ? text(row[price]) : "", terminated: !!endIso && endIso <= today };
    const seen = out.get(memberNumber);
    if (!seen || (seen.terminated && !next.terminated)) out.set(memberNumber, next);
  }
  return [...out.values()];
}

const simple = (value: string) => value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();

/** Does the agreement's price name describe this place? "Lifesaving" matches
 *  the "RLSS Lifesaving" programme; a level named in the price ("Otters")
 *  matches that level. No price name is no evidence either way. */
export function agreementFits(priceName: string, place: { programmeName: string; levelName: string }) {
  const price = simple(priceName);
  if (!price) return true;
  const programme = simple(place.programmeName), level = simple(place.levelName);
  return (!!programme && (programme.includes(price) || price.includes(programme))) || (!!level && level === price);
}

export type Place = { id: string; memberNumber: string | null; programmeName: string; levelName: string; siteId: string };

export type LegendPlan = {
  /** Outstanding places at the working site that the list confirms. */
  confirm: Place[];
  /** Outstanding places whose Legend agreement names another programme. */
  mismatch: (Place & { priceName: string })[];
  /** Members whose agreement is terminated in Legend and who have an outstanding place here. */
  terminated: Place[];
  /** Members on the list whose places here are already confirmed. */
  alreadyConfirmed: number;
  /** Members on the list with outstanding places only at another site. */
  otherSite: number;
  /** Member numbers on the list with no active place in the swim school. */
  notFound: string[];
  listed: number;
};

/** What the list means for the working site's places. `outstanding` is every
 *  active place still to check, at any site; `knownMembers` is everyone with
 *  an active place, so a listed member with nothing outstanding is already
 *  confirmed, and one not known has no place in the swim school. */
export function planLegendMatch(members: readonly LegendMember[], outstanding: readonly Place[], siteId: string, knownMembers: ReadonlySet<string>): LegendPlan {
  const plan: LegendPlan = { confirm: [], mismatch: [], terminated: [], alreadyConfirmed: 0, otherSite: 0, notFound: [], listed: members.length };
  const byMember = new Map<string, Place[]>();
  for (const place of outstanding) {
    if (!place.memberNumber) continue;
    const key = normaliseMember(place.memberNumber);
    byMember.set(key, [...(byMember.get(key) ?? []), place]);
  }
  for (const m of members) {
    const places = byMember.get(m.memberNumber) ?? [];
    const here = places.filter((p) => p.siteId === siteId);
    if (!here.length) {
      if (places.length) plan.otherSite++;
      else if (knownMembers.has(m.memberNumber)) plan.alreadyConfirmed++;
      else plan.notFound.push(m.memberNumber);
      continue;
    }
    for (const place of here) {
      if (m.terminated) plan.terminated.push(place);
      else if (agreementFits(m.priceName, place)) plan.confirm.push(place);
      else plan.mismatch.push({ ...place, priceName: m.priceName });
    }
  }
  return plan;
}
