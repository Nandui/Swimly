import type { YoungBand } from "@/lib/rota/constants";
import { dayShift, type WorkItem } from "@/lib/rota/shifts";

/** Who can fill a gap, best first (owner decision, 6 October 2026: "Who can fill it"). Best
 *  means qualified, free and with the fewest hours that week. Nothing here refuses anyone: an
 *  expired qualification or a double booking is a warning beside the name, and the planner
 *  decides. Pure (fit.test.ts). */

export type Held = { userId: string; typeId: string; issuedOn: string; expiresOn: string | null; revoked: boolean };
export type FitIssue = "off" | "expired" | "missing" | "overlap" | "long";
export type Fit = {
  userId: string;
  name: string;
  issues: FitIssue[];
  /** What else they are on that day, in time order. */
  day: WorkItem[];
  weekMinutes: number;
  /** Their day once on this gap, from first start to last finish. */
  dayLength: number;
};

/** How far down the list each warning puts someone: a long day is a second look, a double
 *  booking needs moving, a lifeguard without a valid qualification is not safe, and someone
 *  who is off comes last of all. */
const SEVERITY: Record<FitIssue, number> = { long: 1, overlap: 20, missing: 30, expired: 30, off: 1000 };

/** A day this long or longer is worth a second look ("Makes a 9h day"). */
export const LONG_DAY = 9 * 60;

/** Is the qualification held, and in date, on that day? */
export function qualification(held: readonly Held[], userId: string, typeId: string | null, on: string): "ok" | "missing" | "expired" {
  if (!typeId) return "ok";
  const ofType = held.filter((q) => q.userId === userId && q.typeId === typeId && !q.revoked && q.issuedOn <= on);
  if (!ofType.length) return "missing";
  return ofType.some((q) => !q.expiresOn || q.expiresOn >= on) ? "ok" : "expired";
}

export function rankFits(gap: { date: string; start: number; end: number; requiredTypeId: string | null }, people: readonly { userId: string; name: string }[], context: {
  held: readonly Held[];
  /** Everything each person is on that day: rota activities and swim classes. */
  work: ReadonlyMap<string, readonly WorkItem[]>;
  off: ReadonlySet<string>;
  weekMinutes: ReadonlyMap<string, number>;
  young?: ReadonlyMap<string, YoungBand>;
}): Fit[] {
  const fits = people.map(({ userId, name }) => {
    const day = [...(context.work.get(userId) ?? [])].sort((a, b) => a.start - b.start);
    const issues: FitIssue[] = [];
    if (context.off.has(userId)) issues.push("off");
    const q = qualification(context.held, userId, gap.requiredTypeId, gap.date);
    if (q !== "ok") issues.push(q);
    if (day.some((w) => w.start < gap.end && gap.start < w.end)) issues.push("overlap");
    const after = dayShift([...day, { start: gap.start, end: gap.end, label: "" }], context.young?.get(userId) ?? null);
    const dayLength = after ? Math.max(...after.parts.map((p) => p.end - p.start)) : gap.end - gap.start;
    if (dayLength >= LONG_DAY) issues.push("long");
    return { userId, name, issues, day, weekMinutes: context.weekMinutes.get(userId) ?? 0, dayLength };
  });
  const weight = (f: Fit) => f.issues.reduce((sum, i) => sum + SEVERITY[i], 0);
  return fits.sort((a, b) => weight(a) - weight(b) || a.weekMinutes - b.weekMinutes || a.name.localeCompare(b.name));
}
