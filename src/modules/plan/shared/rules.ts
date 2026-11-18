import { z } from "zod";
import { CalendarOff, HeartPulse, Palmtree } from "lucide-react";
import type { StatusMeta } from "@/lib/status";
import { isDateOnly } from "@/lib/format";

/** Plan (test)'s rules, pure and client-safe: what a duty, area, session, shift, block and day off
 *  must say. Times are minutes after midnight in 5-minute steps; days are "YYYY-MM-DD". */

export const DUTY_COLORS = ["blue", "green", "orange", "purple", "red", "gray"] as const;
export type DutyColor = (typeof DUTY_COLORS)[number];
export const DUTY_COLOR_LABEL: Record<DutyColor, string> = { blue: "Blue", green: "Green", orange: "Orange", purple: "Purple", red: "Red", gray: "Grey" };
export const dutyColor = (color: string): DutyColor => (DUTY_COLORS as readonly string[]).includes(color) ? (color as DutyColor) : "blue";

export const OFF_REASONS = ["holiday", "sick", "other"] as const;
export const OFF_REASON_META = {
  holiday: { label: "Holiday", color: "blue", icon: Palmtree },
  sick: { label: "Sick", color: "orange", icon: HeartPulse },
  other: { label: "Off", color: "gray", icon: CalendarOff },
} satisfies Record<(typeof OFF_REASONS)[number], StatusMeta>;
export const offReasonMeta = (reason: string): StatusMeta => OFF_REASON_META[(OFF_REASONS as readonly string[]).includes(reason) ? (reason as (typeof OFF_REASONS)[number]) : "other"];


export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

/** "HH:MM" to minutes after midnight (24:00 allowed), or null. */
export function parseClock(value: string): number | null {
  const match = /^([01]\d|2[0-4]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes <= 1440 ? minutes : null;
}
export const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

const minutes = z.number({ message: "Enter the time as hours and minutes." }).int().min(0).max(1440).refine((m) => m % 5 === 0, "Use times in 5-minute steps, like 09:00 or 09:05.");
const day = z.string().refine(isDateOnly, "Choose a day.");
const id = z.string().min(1);
const optionalId = z.string().trim().nullable().default(null).transform((v) => v || null);

/** The end must come after the start: a span that crosses midnight is two shifts. */
const span = (v: { start: number; end: number }) => v.end > v.start;
const spanMessage = { message: "The end must be after the start.", path: ["end"] };

export const dutySchema = z.object({
  name: z.string().trim().min(2, "Name the kind of work.").max(60),
  departmentId: optionalId,
  qualificationTypeId: optionalId,
  color: z.enum(DUTY_COLORS),
  defaultMinutes: z.number().int().min(5).max(1440).nullable().default(null),
  isBreak: z.boolean().default(false),
  forClasses: z.boolean().default(false),
  tasks: z.array(z.object({
    /** A task already on the duty keeps its id, so the days it was chosen on keep it. */
    id: z.string().min(1).optional(),
    name: z.string().trim().min(2, "Name each position.").max(80),
  })).max(20).default([]),
}).refine((d) => !(d.isBreak && d.forClasses), { message: "A break can't be the kind of work classes need.", path: ["forClasses"] });
export type DutyInput = z.input<typeof dutySchema>;

export const sessionSchema = z.object({
  siteId: id,
  title: z.string().trim().min(2, "Name the activity.").max(80),
  areaId: optionalId,
  lanes: z.array(z.number().int().min(1).max(20)).max(20).default([]),
  start: minutes,
  end: minutes,
  weekdays: z.array(z.number().int().min(0).max(6)).min(1, "Choose at least one day of the week."),
  firstDay: day,
  lastDay: day,
  skipDays: z.array(day).max(60).default([]),
  note: z.string().trim().max(500).default(""),
  needs: z.array(z.object({ dutyId: id, count: z.number().int().min(1, "Each line needs at least one person.").max(20) })).max(10).default([]),
  /** A kind of work made with the activity, in place of a line in `needs` (D33). */
  newDuty: z.object({
    name: z.string().trim().min(2, "Name the kind of work.").max(60),
    departmentId: optionalId,
    count: z.number().int().min(1, "It needs at least one person.").max(20),
  }).nullable().default(null),
}).refine(span, spanMessage)
  .refine((s) => !(s.newDuty && s.needs.length), { message: "Choose a kind of work from the list, or name a new one, not both.", path: ["needs"] })
  .refine((s) => s.lastDay >= s.firstDay, { message: "The last day can't be before the first.", path: ["lastDay"] })
  .refine((s) => new Set(s.needs.map((n) => n.dutyId)).size === s.needs.length, { message: "Name each kind of work once, with how many.", path: ["needs"] });
export type SessionInput = z.input<typeof sessionSchema>;

/** An activity names one kind of work (D33). `now` is how many it would name, `before` how many it
 *  named already (null for a new one): an activity made before the rule keeps its lines and can
 *  lose them, but never gains one. Returns what to tell the person, or null when it is fine. */
export function kindsOfWorkProblem(now: number, before: number | null): string | null {
  if (now === 1 || (before !== null && now <= before)) return null;
  return now === 0 ? "Choose the kind of work it needs, and how many." : "An activity names one kind of work. For a second kind, add another activity.";
}

/** Work belongs to an activity (D33). Only a break stands by itself, and a block that already did
 *  before the rule, which can still be changed until it is moved to an activity. */
export function mayStandAlone(input: { isBreak: boolean; before: { sessionId: string | null } | null }): boolean {
  return input.isBreak || input.before?.sessionId === null;
}

export const sessionDaySchema = z.object({
  sessionId: id, date: day, cancelled: z.boolean(), start: minutes.nullable(), end: minutes.nullable(),
}).refine((d) => d.cancelled || (d.start !== null && d.end !== null && d.end > d.start), spanMessage);
export type SessionDayInput = z.input<typeof sessionDaySchema>;

export const shiftSchema = z.object({
  siteId: id, departmentId: z.string().min(1, "Choose the department."), userId: z.string().min(1, "Choose who."), date: day, start: minutes, end: minutes,
  note: z.string().trim().max(300).default(""),
}).refine(span, spanMessage);
export type ShiftInput = z.input<typeof shiftSchema>;

export const blockSchema = z.object({
  shiftId: id, dutyId: z.string().min(1, "Choose the kind of work."), sessionId: optionalId, start: minutes, end: minutes,
  /** The duty's tasks this person does in the block, each from `at` to `end`; none unless chosen. */
  tasks: z.array(z.object({ id: z.string().min(1), at: minutes, end: minutes })).max(20).default([]),
}).refine(span, spanMessage)
  .refine((b) => b.tasks.every((t) => t.end > t.at), { message: "Each position's end must be after its start.", path: ["tasks"] })
  .refine((b) => new Set(b.tasks.map((t) => t.id)).size === b.tasks.length, { message: "Give each position once.", path: ["tasks"] });
export type BlockInput = z.input<typeof blockSchema>;

export const offSchema = z.object({
  userId: z.string().min(1, "Choose who."), firstDay: day, lastDay: day, reason: z.enum(OFF_REASONS),
  note: z.string().trim().max(300).default(""),
}).refine((o) => o.lastDay >= o.firstDay, { message: "The last day can't be before the first.", path: ["lastDay"] });
export type OffInput = z.input<typeof offSchema>;

/** The times a person says they can usually work (D34): for each weekday, Monday first, any time,
 *  not at all, or between two times. It guides whoever plans and never limits them. */
export const USUAL_MODES = ["any", "none", "between"] as const;
export type UsualDay = { mode: (typeof USUAL_MODES)[number]; start: number | null; end: number | null };
export type UsualWeek = readonly UsualDay[];
export const ANY_WEEK: UsualWeek = WEEKDAYS.map(() => ({ mode: "any", start: null, end: null }));

const usualDay = z.object({ mode: z.enum(USUAL_MODES), start: minutes.nullable().default(null), end: minutes.nullable().default(null) }).strict()
  .refine((d) => d.mode !== "between" || (d.start !== null && d.end !== null), { message: "Give both times for each day you can work part of.", path: ["start"] })
  .refine((d) => d.mode !== "between" || d.start === null || d.end === null || d.end > d.start, spanMessage)
  // Times mean something only on a "between" day: the other two never keep them.
  .transform((d): UsualDay => d.mode === "between" ? d : { mode: d.mode, start: null, end: null });
export const usualWeekSchema = z.object({ days: z.array(usualDay).length(7, "Say something for each day, Monday to Sunday.") }).strict();
export type UsualWeekInput = z.input<typeof usualWeekSchema>;

/** A day of the usual week in a planner's words: "Can't work", "Can work 16:00 to 21:00", or null
 *  when any time suits (nothing to say). */
export function usualDayText(day: UsualDay | undefined): string | null {
  if (!day || day.mode === "any") return null;
  return day.mode === "none" || day.start === null || day.end === null ? "Can't work" : `Can work ${clock(day.start)} to ${clock(day.end)}`;
}

/** A Zod failure as the one sentence to show. */
export const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? "Check the details and try again.";
