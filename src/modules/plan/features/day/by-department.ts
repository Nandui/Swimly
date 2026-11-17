import { freeTimeOf } from "@/modules/plan/features/day/by-area";
import type { Span } from "@/modules/plan/shared/model";

/** The Day, one department at a time (owner, 17 November 2026: "our operations go around the needs
 *  of the business", and one department on screen so the day stays readable). A department's day is
 *  what it needs, then who is in:
 *  - what runs for hours (a pool open, a desk open) has a line of its own, read as who is on
 *    it stretch by stretch, with the stretches nobody fills;
 *  - everything shorter (bookings, lessons) shares one line;
 *  - a duty given by itself, belonging to nothing on, is other work;
 *  - then a line for each person on shift in the department, with their whole shift.
 *  A need belongs to the department its duty belongs to; a duty with no department shows in every
 *  department. Pure, so it is tested without a screen (by-department.test.ts); the screen decides
 *  every word. Each stretch carries `open`, the key the Day's inspector opens it by. */

/** A stretch of a need: someone on it, or nobody. */
export type NeedStretch = Span & { key: string; open: string; userId: string | null; short: number };
export type NeedLine = Span & { key: string; label: string; dutyId: string; stretches: NeedStretch[] };
/** A duty given by itself. */
export type OtherWork = Span & { key: string; open: string; dutyId: string; userId: string };
/** One stretch of someone's shift. */
export type ShiftStint = Span & { key: string; open: string; kind: "duty" | "break" | "class" | "free"; dutyId: string | null; what: string | null };
export type ShiftLine = Span & { shiftId: string; userId: string; stints: ShiftStint[] };

type NeedIn = Span & {
  key: string;
  kind: "session" | "class";
  sessionId: string | null;
  label: string;
  dutyId: string;
  fills: readonly (Span & { userId?: string; blockId?: string })[];
  gaps: readonly (Span & { short: number })[];
};
type ShiftIn = Span & {
  id: string;
  userId: string;
  departmentId: string;
  blocks: readonly (Span & { id: string; dutyId: string; sessionId: string | null })[];
  classes: readonly (Span & { source: string; ref: string; title: string })[];
};

/** A need that runs this long (three hours) has a line of its own: a pool or a desk open, not a lesson or a booking. */
export const LONG_NEED_MINUTES = 3 * 60;

const byTime = (a: Span, b: Span) => a.start - b.start || a.end - b.end;
const itemKeyOf = (need: { sessionId: string | null; key: string }) => (need.sessionId ? `s:${need.sessionId}` : need.key);

/** Whether a need is this department's: its duty's department, or any department when the duty has none. */
export function needIsFor(departmentId: string, dutyDepartment: string | null): boolean {
  return dutyDepartment === null || dutyDepartment === departmentId;
}

/** How many stretches of each department's needs nobody fills, for the department switch. */
export function shortByDepartment(departmentIds: readonly string[], needs: readonly Pick<NeedIn, "dutyId" | "gaps">[], dutyDepartment: (dutyId: string) => string | null): Map<string, number> {
  return new Map(departmentIds.map((id) => [id, needs.filter((n) => needIsFor(id, dutyDepartment(n.dutyId))).reduce((sum, n) => sum + n.gaps.length, 0)]));
}

export function dayByDepartment(input: {
  departmentId: string;
  needs: readonly NeedIn[];
  /** Every shift at the site, to say whose block a fill is. */
  shifts: readonly ShiftIn[];
  dutyDepartment: (dutyId: string) => string | null;
  isBreak: (dutyId: string) => boolean;
}): { standing: NeedLine[]; booked: NeedLine[]; other: OtherWork[]; people: ShiftLine[]; short: number } {
  const { departmentId, shifts } = input;
  const owner = new Map(shifts.flatMap((s) => s.blocks.map((b) => [b.id, s] as const)));
  const mine = input.needs.filter((n) => needIsFor(departmentId, input.dutyDepartment(n.dutyId)));

  const lineOf = (need: NeedIn): NeedLine => ({
    key: need.key, label: need.label, dutyId: need.dutyId, start: need.start, end: need.end,
    stretches: [
      ...need.fills.map((f, i): NeedStretch => {
        const shift = f.blockId ? owner.get(f.blockId) : undefined;
        const userId = f.userId ?? shift?.userId ?? null;
        // A duty block opens as itself; a class's teacher opens the class; a fill nobody can be
        // named for opens the thing it is on.
        const open = shift && f.blockId ? `block|${shift.id}|${f.blockId}` : need.kind === "class" && userId ? `class|${need.key}|${userId}` : `item|${itemKeyOf(need)}`;
        return { key: `${need.key}|${f.blockId ?? `u${i}`}`, open, start: f.start, end: f.end, userId, short: 0 };
      }),
      ...need.gaps.map((g, index): NeedStretch => ({ key: `${need.key}|gap${index}`, open: `gap|${need.key}|${index}`, start: g.start, end: g.end, userId: null, short: g.short })),
    ].sort(byTime),
  });
  const lines = mine.map(lineOf).sort((a, b) => byTime(a, b) || a.label.localeCompare(b.label));
  const standing = lines.filter((l) => l.end - l.start >= LONG_NEED_MINUTES);
  const booked = lines.filter((l) => l.end - l.start < LONG_NEED_MINUTES);

  const here = shifts.filter((s) => s.departmentId === departmentId).sort((a, b) => byTime(a, b) || a.userId.localeCompare(b.userId));
  const other = here.flatMap((s) => s.blocks.filter((b) => !b.sessionId && !input.isBreak(b.dutyId))
    .map((b): OtherWork => ({ key: `w|${b.id}`, open: `block|${s.id}|${b.id}`, start: b.start, end: b.end, dutyId: b.dutyId, userId: s.userId }))).sort(byTime);

  const sessionLabel = new Map(input.needs.filter((n) => n.sessionId).map((n) => [n.sessionId, n.label]));
  const people = here.map((s): ShiftLine => ({ shiftId: s.id, userId: s.userId, start: s.start, end: s.end, stints: [
    ...s.blocks.map((b): ShiftStint => ({ key: `b|${b.id}`, open: `block|${s.id}|${b.id}`, start: b.start, end: b.end, kind: input.isBreak(b.dutyId) ? "break" : "duty", dutyId: b.dutyId, what: sessionLabel.get(b.sessionId) ?? null })),
    ...s.classes.map((c): ShiftStint => ({ key: `c|${c.source}|${c.ref}`, open: `class|c:${c.source}:${c.ref}|${s.userId}`, start: c.start, end: c.end, kind: "class", dutyId: null, what: c.title })),
    ...freeTimeOf(s).map((f): ShiftStint => ({ key: `f|${s.id}|${f.start}`, open: `free|${s.id}|${f.start}|${f.end}`, start: f.start, end: f.end, kind: "free", dutyId: null, what: null })),
  ].sort(byTime) }));

  return { standing, booked, other, people, short: mine.reduce((sum, n) => sum + n.gaps.length, 0) };
}
