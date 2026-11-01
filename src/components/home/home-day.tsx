"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DayTimeline, type DayTimelineBlock, type DayTimelineKind } from "@/components/ui-kit/day-timeline";
import { Tag } from "@/components/ui-kit/tag";
import { formatTime, formatTimeRange, minutesNow } from "@/lib/format";
import { HOME_SESSION_META } from "@/lib/home-meta";
import type { HomeSession } from "@/modules/contributions";

/** The time now at the centre, in minutes after midnight, moving with the clock (DESIGN.md,
 *  Live): the server's time when the page was made, then asked of the platform every 30
 *  seconds, so the now line and pill keep up. */
export function useNow(initial: number) {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(minutesNow()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

const KIND: Record<HomeSession["state"], DayTimelineKind> = { done: "done", now: "now", next: "next", cover: "gap", off: "off", assessment: "book" };
const LANES = [
  { key: "classes", label: "Classes" },
  { key: "cover", label: "Cover" },
  { key: "bookings", label: "Bookings" },
];
const laneOf = (session: HomeSession) => (session.state === "cover" ? "cover" : session.state === "assessment" ? "bookings" : "classes");

/** The working site's day on Home (the canvas's "Riverside today"): classes, the places still to
 *  cover and the bookings as lanes, the live time and how many places are left to cover. */
export function HomeDay({ siteName, sessions, initialNow, href }: { siteName: string | null; sessions: HomeSession[]; initialNow: number; href: string }) {
  const now = useNow(initialNow);
  const first = Math.floor(Math.min(...sessions.map((s) => s.start)) / 60) * 60;
  const last = Math.ceil(Math.max(...sessions.map((s) => s.end)) / 60) * 60;
  // At most an hour's lead-in before the first session, so the time now shows when it is close.
  const from = Math.min(first, Math.max(Math.floor(now / 60) * 60, first - 60));
  const to = Math.max(last, from + 120);
  const step = to - from > 8 * 60 ? 120 : 60;
  const hours: { at: number; label: string }[] = [];
  for (let at = from; at <= to; at += step) hours.push({ at, label: formatTime(at) });
  const lanes = LANES.filter((lane) => lane.key === "classes" || sessions.some((s) => laneOf(s) === lane.key));
  const blocks: DayTimelineBlock[] = sessions.map((s, index) => ({
    key: `${s.href}:${s.start}:${index}`, lane: laneOf(s), start: s.start, end: s.end, kind: KIND[s.state], label: s.label,
    sub: s.state === "assessment" ? s.hint : undefined, href: s.href,
    ariaLabel: [s.label, formatTimeRange(s.start, s.end), HOME_SESSION_META[s.state].label, s.hint].filter(Boolean).join(", "),
  }));
  const toCover = sessions.filter((s) => s.state === "cover" && s.end > now).length;
  const title = siteName ? `${siteName} today` : "Today";
  return (
    <section aria-labelledby="home-day" className="pc-panel">
      <div className="pc-panel-head">
        <h2 id="home-day">{title}</h2>
        <span className="flex items-center gap-2">
          <span className="live-dot" aria-hidden="true" />
          <span className="text-footnote font-semibold tabular-nums text-(--label-2)">{formatTime(now)}</span>
          {toCover ? <Tag meta={HOME_SESSION_META.cover} label={`${toCover} to cover`} /> : null}
          <Link href={href} className="text-subheadline text-(--accent)">Timetable</Link>
        </span>
      </div>
      <DayTimeline from={from} to={to} now={now} nowLabel={formatTime(now)} hours={hours} lanes={lanes} blocks={blocks} label={title} />
    </section>
  );
}
