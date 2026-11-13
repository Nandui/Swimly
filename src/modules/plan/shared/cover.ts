import { z } from "zod";
import { isDateOnly } from "@/lib/format";
import type { Span } from "@/modules/plan/shared/model";

/** Asking staff to cover a gap (owner, 12 November 2026, D31), pure and client-safe: a gap on the
 *  Day is posted to its department's Google Chat space; staff answer yes or no; whoever plans the
 *  department chooses one of the yeses, and Plan puts them on. Nothing here blocks on a warning. */

export const COVER_ANSWERS = ["yes", "no"] as const;
export type CoverAnswer = (typeof COVER_ANSWERS)[number];

const minutes = z.number().int().min(0).max(1440);
export const coverAskSchema = z.object({
  siteId: z.string().min(1),
  date: z.string().refine(isDateOnly, "Choose a day."),
  /** The need on the Day: "s:<session>:<duty>" or "c:<source>:<ref>". */
  needKey: z.string().min(3),
  start: minutes,
  end: minutes,
  /** Only read when the duty belongs to no department. */
  departmentId: z.string().trim().nullable().default(null).transform((v) => v || null),
  note: z.string().trim().max(200, "Keep the note under 200 characters.").default(""),
}).refine((v) => v.end > v.start, { message: "The end must be after the start.", path: ["end"] });
export type CoverAskInput = z.input<typeof coverAskSchema>;

const overlaps = (a: Span, b: Span) => a.start < b.end && b.start < a.end;

/** The request still open for this need over some of this stretch, if any: one ask at a time. */
export function openRequestFor<R extends Span & { needKey: string }>(requests: readonly R[], needKey: string, span: Span): R | null {
  return requests.find((r) => r.needKey === needKey && overlaps(r, span)) ?? null;
}

/** The part of what was asked that can still be filled: inside the need as it runs today. */
export function stillToCover(asked: Span, need: Span | null): Span | null {
  if (!need) return null;
  const part = { start: Math.max(asked.start, need.start), end: Math.min(asked.end, need.end) };
  return part.end > part.start ? part : null;
}

/** A shift's times once it also covers this stretch: a new one is the stretch; one they already
 *  have grows to take it in, never shrinks. */
export function shiftCovering(shift: Span | null, span: Span): Span & { changed: boolean } {
  if (!shift) return { ...span, changed: true };
  const start = Math.min(shift.start, span.start), end = Math.max(shift.end, span.end);
  return { start, end, changed: start !== shift.start || end !== shift.end };
}

/** How many said yes and no, for one line: "2 can cover · 1 can't". */
export function offerCounts(offers: readonly { answer: string }[]) {
  const yes = offers.filter((o) => o.answer === "yes").length;
  return { yes, no: offers.length - yes };
}
export function offerLine(offers: readonly { answer: string }[]): string {
  const { yes, no } = offerCounts(offers);
  if (!yes && !no) return "No answers yet";
  return [yes ? `${yes} can cover` : null, no ? `${no} can't` : null].filter(Boolean).join(" · ");
}
