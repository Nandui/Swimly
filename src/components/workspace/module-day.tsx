"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { DayTimeline, type DayTimelineBlock, type DayTimelineKind } from "@/components/ui-kit/day-timeline";
import { Inspector } from "@/components/ui-kit/inspector";
import { Tag } from "@/components/ui-kit/tag";
import { useNow } from "@/components/home/home-day";
import { formatTime, formatTimeRange } from "@/lib/format";
import { HOME_SESSION_META } from "@/lib/home-meta";
import type { HomeSession } from "@/modules/contributions";

const KIND: Record<HomeSession["state"], DayTimelineKind> = { done: "done", now: "now", next: "next", cover: "gap", off: "off", assessment: "book" };
const keyOf = (session: HomeSession, index: number) => `${session.href}:${session.start}:${index}`;

/** An app's day on its starter page, as the approved canvas draws Swim school's: a lane for each
 *  place (each pool), the live time, how far through the day it is, and a link to the full
 *  timetable. A block opens the Inspector with what it is, when, where and who, and the way to
 *  open it. Phones get the blocks and, under the card, what is on now and next as rows. */
export function ModuleDay({ title, href, linkLabel, sessions, initialNow }: {
  title: string;
  href: string;
  linkLabel: string;
  sessions: HomeSession[];
  initialNow: number;
}) {
  const now = useNow(initialNow);
  // The block last opened stays while the inspector slides away, so its words do not vanish first.
  const [open, setOpen] = useState<{ key: string; shown: boolean } | null>(null);
  const first = Math.floor(Math.min(...sessions.map((s) => s.start)) / 60) * 60;
  const last = Math.ceil(Math.max(...sessions.map((s) => s.end)) / 60) * 60;
  // At most an hour's lead-in before the first session, so the time now shows when it is close.
  const from = Math.min(first, Math.max(Math.floor(now / 60) * 60, first - 60));
  const to = Math.max(last, from + 120);
  const step = to - from > 8 * 60 ? 120 : 60;
  const hours: { at: number; label: string }[] = [];
  for (let at = from; at <= to; at += step) hours.push({ at, label: formatTime(at) });
  const lanes = [...new Set(sessions.map((s) => s.area))].map((area) => ({ key: area, label: area }));
  const blocks: DayTimelineBlock[] = sessions.map((s, index) => ({
    key: keyOf(s, index), lane: s.area, start: s.start, end: s.end, kind: KIND[s.state], label: s.label,
    sub: s.state === "now" || s.state === "cover" ? HOME_SESSION_META[s.state].label : formatTime(s.start),
    ariaLabel: [s.label, s.area, formatTimeRange(s.start, s.end), HOME_SESSION_META[s.state].label, s.hint].filter(Boolean).join(", "),
  }));
  const running = sessions.filter((s) => s.state !== "off");
  const done = running.filter((s) => s.end <= now).length;
  const on = running.filter((s) => s.start <= now && s.end > now).length;
  const ahead = running.length - done - on;
  const soon = sessions.filter((s) => s.state !== "off" && s.end > now).slice(0, 5);
  const picked = sessions.find((s, index) => keyOf(s, index) === open?.key) ?? null;
  return (
    <>
      <section aria-labelledby="overview-day" className="flex min-w-0 flex-col">
        <div className="pc-section-head">
          <h2 id="overview-day">{title}</h2>
          <Link href={href} className="text-subheadline text-(--accent)">{linkLabel}</Link>
        </div>
        <div className="pc-panel">
          <p className="flex flex-wrap items-center gap-2 text-footnote text-(--label-2)">
            <span className="live-dot" aria-hidden="true" />
            <span className="font-semibold tabular-nums text-(--label)">{formatTime(now)}</span>
            <span className="tabular-nums">{[`${done} done`, `${on} on now`, `${ahead} to come`].join(" · ")}</span>
          </p>
          <DayTimeline from={from} to={to} now={now} nowLabel={formatTime(now)} hours={hours} lanes={lanes} blocks={blocks} label={title}
            onSelect={(key) => setOpen({ key, shown: true })} selected={open?.shown ? open.key : null} />
        </div>
      </section>
      {soon.length ? (
        <section aria-labelledby="overview-soon" className="flex min-w-0 flex-col md:hidden">
          <div className="pc-section-head"><h2 id="overview-soon">On now and next</h2></div>
          <ul className="pc-list">
            {soon.map((s) => (
              <li key={`${s.href}:${s.start}`}>
                <Link href={s.href} className="pc-row">
                  <span className="w-12 shrink-0 font-semibold tabular-nums">{formatTime(s.start)}</span>
                  <span className="pc-row-body"><span>{s.label}</span><span className="pc-row-hint" data-tone={s.state === "cover" ? "orange" : undefined}>{[s.area, s.state === "now" || s.state === "cover" ? HOME_SESSION_META[s.state].label : s.hint].filter(Boolean).join(" · ")}</span></span>
                  <ChevronRight aria-hidden="true" className="pc-row-chevron" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <Inspector open={picked !== null && !!open?.shown} onOpenChange={(next) => { if (!next && open) setOpen({ ...open, shown: false }); }}
        status={picked ? <Tag meta={HOME_SESSION_META[picked.state]} /> : null}
        title={picked?.label ?? ""}
        description={picked ? [formatTimeRange(picked.start, picked.end), picked.area, picked.hint].filter(Boolean).join(" · ") : undefined}
        actions={picked ? <Button asChild><Link href={picked.href}>{picked.state === "cover" ? "Find cover" : `Open ${picked.label}`}<ChevronRight aria-hidden="true" /></Link></Button> : null} />
    </>
  );
}
