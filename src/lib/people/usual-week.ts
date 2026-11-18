import { z } from "zod";
import { formatTime, formatTimeRange } from "@/lib/format";

/** The times a person says they can usually work (D34, D35), pure and client-safe: for each
 *  weekday, Monday first, any time, not at all, or between two times. A fact about the person,
 *  kept beside their contracted hours; whoever plans them reads it as a guide and still decides.
 *  Times are minutes after midnight in 5-minute steps. */

export const USUAL_MODES = ["any", "none", "between"] as const;
export type UsualDay = { mode: (typeof USUAL_MODES)[number]; start: number | null; end: number | null };
export type UsualWeek = readonly UsualDay[];
export const USUAL_WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const WEEKDAYS_PLURAL = ["Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays", "Sundays"] as const;
export const ANY_WEEK: UsualWeek = USUAL_WEEKDAYS.map(() => ({ mode: "any", start: null, end: null }));

const minutes = z.number({ message: "Enter the time as hours and minutes." }).int().min(0).max(1440).refine((m) => m % 5 === 0, "Use times in 5-minute steps, like 09:00 or 09:05.");
const usualDay = z.object({ mode: z.enum(USUAL_MODES), start: minutes.nullable().default(null), end: minutes.nullable().default(null) }).strict()
  .refine((d) => d.mode !== "between" || (d.start !== null && d.end !== null), { message: "Give both times for each day you can work part of.", path: ["start"] })
  .refine((d) => d.mode !== "between" || d.start === null || d.end === null || d.end > d.start, { message: "The end must be after the start.", path: ["end"] })
  // Times mean something only on a "between" day: the other two never keep them.
  .transform((d): UsualDay => d.mode === "between" ? d : { mode: d.mode, start: null, end: null });
export const usualWeekSchema = z.object({ days: z.array(usualDay).length(7, "Say something for each day, Monday to Sunday.") }).strict();
export type UsualWeekInput = z.input<typeof usualWeekSchema>;

/** A day of the usual week in a planner's words: "Can't work", "Can work 16:00 to 21:00", or null
 *  when any time suits (nothing to say). */
export function usualDayText(day: UsualDay | undefined): string | null {
  if (!day || day.mode === "any") return null;
  return day.mode === "none" || day.start === null || day.end === null ? "Can't work" : `Can work ${formatTimeRange(day.start, day.end)}`;
}

/** A whole usual week in one line, for the activity log and lists: the days that say something,
 *  or "any time, every day". */
export function usualWeekText(days: UsualWeek): string {
  const limits = days.flatMap((d, i) => { const text = usualDayText(d); return text ? [`${USUAL_WEEKDAYS[i]}: ${text.toLowerCase()}`] : []; });
  return limits.length ? limits.join("; ") : "any time, every day";
}

/** A stored usual week as seven days, Monday first. A day that does not read right is any time. */
export function usualWeekOf(row: { modes: readonly string[]; starts: readonly number[]; ends: readonly number[] }): UsualDay[] {
  return Array.from({ length: 7 }, (_, i): UsualDay => {
    const mode = USUAL_MODES.find((m) => m === row.modes[i]) ?? "any";
    if (mode !== "between") return { mode, start: null, end: null };
    return row.ends[i] > row.starts[i] ? { mode, start: row.starts[i], end: row.ends[i] } : { mode: "any", start: null, end: null };
  });
}

/** Monday 0 to Sunday 6, of a `YYYY-MM-DD`. */
const weekdayIndex = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;

/** What to say when a shift falls outside the times its person said they can usually work, or
 *  null: they have not said, any time suits that weekday, or the shift is inside their times. */
export function outsideUsualWeek(week: UsualWeek | undefined, date: string, start: number, end: number): string | null {
  const weekday = weekdayIndex(date);
  const day = week?.[weekday];
  if (!day || day.mode === "any") return null;
  if (day.mode === "none" || day.start === null || day.end === null) return `Outside the times they gave: they can't work ${WEEKDAYS_PLURAL[weekday]}.`;
  if (start >= day.start && end <= day.end) return null;
  return `Outside the times they gave: ${WEEKDAYS_PLURAL[weekday]} ${formatTime(day.start)}–${formatTime(day.end)}.`;
}

/** The most minutes a person could work in a week, taking only places that sit wholly inside the
 *  times they gave. `places` are the weekly places on offer (weekday 1 Monday to 7 Sunday);
 *  places that overlap count once, because nobody works two at a time. */
export function minutesThatFit(week: UsualWeek, places: readonly { weekday: number; startMin: number; endMin: number }[]): number {
  let total = 0;
  for (let weekday = 1; weekday <= 7; weekday++) {
    const day = week[weekday - 1];
    if (day?.mode === "none") continue;
    const inside = places
      .filter((p) => p.weekday === weekday && p.endMin > p.startMin && (!day || day.mode === "any" || (day.start !== null && day.end !== null && p.startMin >= day.start && p.endMin <= day.end)))
      .sort((a, b) => a.startMin - b.startMin);
    let reach = -1;
    for (const p of inside) {
      total += Math.max(0, p.endMin - Math.max(p.startMin, reach));
      reach = Math.max(reach, p.endMin);
    }
  }
  return total;
}
