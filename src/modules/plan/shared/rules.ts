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

export const TASK_WHEN = ["start", "end", "at"] as const;
export const TASK_WHEN_LABEL: Record<(typeof TASK_WHEN)[number], string> = { start: "At the start", end: "At the end", at: "At a set time" };

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
  name: z.string().trim().min(2, "Name the duty.").max(60),
  departmentId: optionalId,
  qualificationTypeId: optionalId,
  color: z.enum(DUTY_COLORS),
  defaultMinutes: z.number().int().min(5).max(1440).nullable().default(null),
  isBreak: z.boolean().default(false),
  forClasses: z.boolean().default(false),
  tasks: z.array(z.object({
    name: z.string().trim().min(2, "Name each task.").max(80),
    when: z.enum(TASK_WHEN),
    atMinutes: minutes.nullable().default(null),
  }).refine((t) => t.when !== "at" || t.atMinutes !== null, { message: "Give the task's time.", path: ["atMinutes"] })).max(20).default([]),
}).refine((d) => !(d.isBreak && d.forClasses), { message: "A break can't be the duty classes need.", path: ["forClasses"] });
export type DutyInput = z.input<typeof dutySchema>;

export const areaSchema = z.object({
  siteId: id,
  name: z.string().trim().min(2, "Name the area.").max(60),
  parentId: optionalId,
  lanes: z.number().int().min(0).max(20).default(0),
  departmentId: optionalId,
});
export type AreaInput = z.input<typeof areaSchema>;

export const sessionSchema = z.object({
  siteId: id,
  title: z.string().trim().min(2, "Say what's on.").max(80),
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
}).refine(span, spanMessage)
  .refine((s) => s.lastDay >= s.firstDay, { message: "The last day can't be before the first.", path: ["lastDay"] })
  .refine((s) => new Set(s.needs.map((n) => n.dutyId)).size === s.needs.length, { message: "Name each duty once, with how many.", path: ["needs"] });
export type SessionInput = z.input<typeof sessionSchema>;

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
  shiftId: id, dutyId: z.string().min(1, "Choose the duty."), sessionId: optionalId, start: minutes, end: minutes,
}).refine(span, spanMessage);
export type BlockInput = z.input<typeof blockSchema>;

export const offSchema = z.object({
  userId: z.string().min(1, "Choose who."), firstDay: day, lastDay: day, reason: z.enum(OFF_REASONS),
  note: z.string().trim().max(300).default(""),
}).refine((o) => o.lastDay >= o.firstDay, { message: "The last day can't be before the first.", path: ["lastDay"] });
export type OffInput = z.input<typeof offSchema>;

/** A Zod failure as the one sentence to show. */
export const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? "Check the details and try again.";
