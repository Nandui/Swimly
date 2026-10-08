import { Check, Clock, X, type LucideIcon } from "lucide-react";

/** Dates come as "2026-11-07" (a day, not an instant), so they are read in UTC. */
const DAY = new Intl.DateTimeFormat("en-IE", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const part = (d: Date, type: string) => DAY.formatToParts(d).find((p) => p.type === type)?.value ?? "";

/** "Sat 7 Nov" */
export function day(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${part(d, "weekday")} ${part(d, "day")} ${part(d, "month")}`;
}

/** "Sat 7 Nov to Sun 15 Nov · 4 days" */
export function dates(c: { firstDay: string | null; lastDay: string | null; sessions: unknown[] }) {
  if (!c.firstDay) return "";
  const span = c.lastDay && c.lastDay !== c.firstDay ? `${day(c.firstDay)} to ${day(c.lastDay)}` : day(c.firstDay);
  return `${span} · ${c.sessions.length} ${c.sessions.length === 1 ? "day" : "days"}`;
}

export type Meta = { label: string; tone: "green" | "orange" | "red" | "blue" | "gray"; icon: LucideIcon };

/** How many places are left, always with an icon so colour is never the only signal. */
export function placesMeta(left: number): Meta {
  if (left <= 0) return { label: "Full", tone: "red", icon: X };
  if (left <= 2) return { label: `${left} ${left === 1 ? "place" : "places"} left`, tone: "orange", icon: Clock };
  return { label: `${left} places left`, tone: "green", icon: Check };
}

export const SITE_NAME = process.env.NEXT_PUBLIC_ACADEMY_NAME?.trim() || "LeisureWorld Academy";
