"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, TriangleAlert } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Tag } from "@/components/ui-kit/tag";
import { SegmentedChoice } from "@/components/ui-kit/segmented-links";
import { AssignmentDialog, NeedDialog } from "@/components/rota/plan-dialogs";
import { FillSheet, type GapRef } from "@/components/rota/fill-sheet";
import { clock } from "@/lib/rota/constants";
import type { Block, Group } from "@/lib/rota/day";
import { ROTA_DAY_META, activityIcon, qualificationShort } from "@/lib/rota/meta";

/** One day of the rota as a timeline (owner decisions, 6 October 2026, from the approved mockup):
 *  the day across the full width, one group per activity and place with its places stacked as
 *  lanes, people in blue and gaps in amber. "Show" zooms to the morning, afternoon or evening.
 *  A block says as much as its width allows (name and times, then the first name, then initials),
 *  and its full words are always its accessible name. Back-to-back swim classes merge into one
 *  block until there is room to show each. Below 1280px the same day is an agenda. */

type Option = { id: string; name: string };
type Props = {
  siteId: string;
  date: string;
  dateLabel: string;
  /** The day has come (today or earlier): changes ask for a reason. */
  live: boolean;
  canChange: boolean;
  groups: Group[];
  types: Option[];
  places: string[];
};

/** A class block standing for a run of back-to-back classes with the same teacher (or nobody). */
type Shown = Block & { count: number; refs: string[] };

const WINDOW_KEYS = ["day", "am", "pm", "eve"] as const;
type WindowKey = (typeof WINDOW_KEYS)[number];

function windows(groups: Group[]): Record<WindowKey, { from: number; to: number; label: string }> {
  const blocks = groups.flatMap((g) => g.lanes.flat());
  const first = blocks.length ? Math.min(...blocks.map((b) => b.start)) : 7 * 60;
  const last = blocks.length ? Math.max(...blocks.map((b) => b.end)) : 22 * 60;
  const from = Math.min(7 * 60, Math.floor(first / 60) * 60), to = Math.max(22 * 60, Math.ceil(last / 60) * 60);
  return {
    day: { from, to, label: "Whole day" },
    am: { from, to: 12 * 60, label: "Morning" },
    pm: { from: 12 * 60, to: 17 * 60, label: "Afternoon" },
    eve: { from: 17 * 60, to, label: "Evening" },
  };
}

/** Merge each lane's back-to-back classes taught by the same person (or nobody). */
function merged(lane: Block[]): Shown[] {
  const out: Shown[] = [];
  for (const b of lane) {
    const last = out[out.length - 1];
    if (last && b.classRef && last.classRef && last.userId === b.userId && last.end === b.start) {
      last.end = b.end; last.count += 1; last.refs.push(b.classRef); last.detail = null;
      last.warnings = [...new Set([...last.warnings, ...b.warnings])];
    } else out.push({ ...b, warnings: [...b.warnings], count: 1, refs: b.classRef ? [b.classRef] : [] });
  }
  return out;
}
const single = (lane: Block[]): Shown[] => lane.map((b) => ({ ...b, count: 1, refs: b.classRef ? [b.classRef] : [] }));

/** An agenda row that opens something: the shared Button drawn as a list row. */
const ROW = "pc-row h-auto w-full justify-start whitespace-normal text-start font-normal";
const shortName = (name: string) => { const [f, ...rest] = name.split(" "); return rest.length ? `${f} ${rest[rest.length - 1][0]}.` : f; };
const nameInitials = (name: string) => name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("");
const WARNING_WORDS: Record<string, string> = { off: "off that day", missing: "qualification not recorded", expired: "qualification expired", overlap: "double-booked" };

function describe(b: Shown, g: Group) {
  const what = [g.name, g.place].filter(Boolean).join(", ");
  const extra = b.count > 1 ? `, ${b.count} classes` : b.detail ? `, ${b.detail}` : "";
  const warn = b.warnings.length ? `. Check: ${b.warnings.map((w) => WARNING_WORDS[w]).join(", ")}` : "";
  if (b.kind === "on" && b.warnings.includes("off")) return `${b.name} is off: ${what}, ${clock(b.start)} to ${clock(b.end)}${extra} needs cover. Choose someone`;
  return b.kind === "gap" ? `Gap: nobody on ${what}, ${clock(b.start)} to ${clock(b.end)}${extra}. Choose someone` : `${b.name}, ${what}, ${clock(b.start)} to ${clock(b.end)}${extra}${warn}`;
}

export function DayPlan({ siteId, date, dateLabel, live, canChange, groups, types, places }: Props) {
  const wins = useMemo(() => windows(groups), [groups]);
  const [win, setWin] = useState<WindowKey>("day");
  const [gap, setGap] = useState<GapRef | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [trackPx, setTrackPx] = useState(900);
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setTrackPx(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const { from, to } = wins[win];
  const span = to - from, hours = span / 60;
  const perHour = trackPx / hours;
  const step = hours > 8 ? 2 : 1;
  const ticks = Array.from({ length: Math.floor(hours / step) + 1 }, (_, i) => from + i * step * 60);

  const openGap = (g: Group, b: Shown) => {
    if (!canChange) return;
    setSelected(`${g.key}|${b.start}|${b.place ?? b.refs.join(",")}`);
    setGap({ siteId, date, typeId: g.typeId, what: [g.name, g.place].filter(Boolean).join(" · "), dateLabel, start: b.start, end: b.end, requiredName: g.requiredName,
      needId: b.needId, place: b.place, classRefs: b.refs,
      replace: b.kind === "on" && b.warnings.includes("off") ? { assignmentId: b.assignmentId, name: b.name ?? "Someone" } : null });
  };

  const blockFor = (g: Group, b: Shown, key: string) => {
    const a = Math.max(b.start, from), e = Math.min(b.end, to);
    if (e <= a) return null;
    const px = trackPx * (e - a) / span;
    const density = px >= 120 ? "full" : px >= 64 ? "compact" : "icon";
    const style = { left: `calc(${(a - from) / span * 100}% + 2px)`, width: `calc(${(e - a) / span * 100}% - 4px)` };
    const label = describe(b, g);
    const off = b.kind === "on" && b.warnings.includes("off");
    const words = b.kind === "gap"
      ? <><TriangleAlert aria-hidden="true" />{density === "icon" ? null : <span className="pc-block-body"><span className="pc-block-title">{density === "full" ? "Nobody" : "Gap"}</span>{density === "full" ? <span className="pc-block-hint">{clock(b.start)}–{clock(b.end)}{b.count > 1 ? ` · ${b.count} classes` : ""}</span> : null}</span>}</>
      : <>
          {b.warnings.length && density !== "icon" ? <TriangleAlert aria-hidden="true" /> : null}
          <span className="pc-block-body">
            <span className="pc-block-title">{density === "full" ? shortName(b.name ?? "") : density === "compact" ? (b.name ?? "").split(" ")[0] : nameInitials(b.name ?? "")}</span>
            {density === "full" ? <span className="pc-block-hint">{clock(b.start)}–{clock(b.end)}{off ? " · off" : ""}{b.count > 1 ? ` · ${b.count} classes` : b.detail ? ` · ${b.detail}` : ""}</span>
              : density === "compact" && (b.detail || b.count > 1) ? <span className="pc-block-hint">{b.count > 1 ? `${b.count} classes` : b.detail}</span> : null}
          </span>
        </>;
    const common = { "data-block": b.kind === "gap" ? "cover" : off ? "absent" : "next", "data-density": density === "icon" ? "icon" : density, style, title: label };
    const id = `${g.key}|${b.start}|${b.place ?? b.refs.join(",")}`;
    if (!canChange) return <span key={key} className="pc-block" {...common} role="img" aria-label={label.replace(". Choose someone", "")}>{words}</span>;
    if (b.kind === "gap" || b.classRef || off) {
      return (
        <Button key={key} type="button" variant="link" className="pc-block" {...common} aria-label={label}
          aria-pressed={b.kind === "gap" ? selected === id : undefined} onClick={() => openGap(g, b)}>{words}</Button>
      );
    }
    return b.assignmentId ? (
      <AssignmentDialog key={key} live={live} assignment={{ id: b.assignmentId, needId: b.needId!, place: b.place!, userId: b.userId!, name: b.name ?? "", start: b.start, end: b.end, what: [g.name, g.place].filter(Boolean).join(", ") }}
        trigger={<Button type="button" variant="link" className="pc-block" {...common} aria-label={label}>{words}</Button>} />
    ) : <span key={key} className="pc-block" {...common} role="img" aria-label={label}>{words}</span>;
  };

  if (!groups.length) return null;
  return (
    <>
      <div className="rota-tl">
        <div className="rota-tl-zoom">
          <span className="text-xs text-ui-muted-foreground" id={`rota-show-${date}`}>Show</span>
          <SegmentedChoice aria-labelledby={`rota-show-${date}`} value={win} onValueChange={(v) => setWin(v as WindowKey)}
            options={WINDOW_KEYS.map((k) => ({ value: k, label: k === "day" ? wins[k].label : `${wins[k].label} ${clock(wins[k].from).slice(0, 2)}–${clock(wins[k].to).slice(0, 2)}` }))} />
        </div>
        <div className="rota-tl-row" aria-hidden="true">
          <span />
          <div className="rota-tl-hours">{ticks.map((t) => <span key={t} style={{ left: `${(t - from) / span * 100}%` }}>{clock(t)}</span>)}</div>
        </div>
        {groups.map((g, gi) => {
          const Icon = activityIcon(g.icon);
          const count = g.lanes.length;
          const label = (
            <>
              <span className="rota-tl-name"><Icon aria-hidden="true" /><span>{g.name}</span></span>
              <small>{[g.place, g.fromClasses ? "Swim classes" : `${count} ${count === 1 ? "place" : "places"}`].filter(Boolean).join(" · ")}</small>
              {g.requiredName ? <small>Needs {qualificationShort(g.requiredName)}</small> : null}
              <Tag meta={ROTA_DAY_META[g.gapCount ? "gaps" : "covered"]} label={g.gapCount ? `${g.gapCount} ${g.gapCount === 1 ? "gap" : "gaps"}` : undefined} />
            </>
          );
          return (
            <section key={g.key} className="rota-tl-row" aria-label={[g.name, g.place].filter(Boolean).join(", ")}>
              {canChange && !g.fromClasses && g.needs.length === 1 ? (
                <NeedDialog siteId={siteId} date={date} live={live} types={types} places={places_(places, g)} need={g.needs[0]}
                  trigger={<Button type="button" variant="outline" className="rota-tl-label h-auto whitespace-normal font-normal" aria-label={`Change ${g.name}${g.place ? `, ${g.place}` : ""}`}>{label}</Button>} />
              ) : <div className="rota-tl-label">{label}</div>}
              <div className="rota-tl-lanes" style={{ ["--rota-hours" as string]: hours }}>
                {g.lanes.map((lane, li) => (
                  <div key={li} className="rota-tl-track" ref={gi === 0 && li === 0 ? track : undefined}>
                    {(g.fromClasses && perHour < 160 ? merged(lane) : single(lane)).map((b, bi) => blockFor(g, b, `${li}-${bi}`))}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        <div className="rota-tl-key">
          <span><i style={{ background: "var(--pc-block-next)" }} />Someone on it</span>
          <span><i style={{ background: "var(--pc-block-cover)" }} />Nobody yet (a gap)</span>
          <span><i style={{ background: "var(--pc-danger-soft)" }} />Off: needs cover</span>
          {canChange ? <span><i style={{ boxShadow: "inset 0 0 0 2px var(--pc-primary)" }} />The gap you are filling</span> : null}
          <span>Each row of a group is one place the activity needs</span>
        </div>
      </div>
      <div className="rota-agenda">
        {groups.map((g) => {
          const Icon = activityIcon(g.icon);
          const rows = g.lanes.flatMap((lane) => (g.fromClasses ? merged(lane) : single(lane))).sort((a, b) => a.start - b.start);
          return (
            <section key={g.key} aria-label={[g.name, g.place].filter(Boolean).join(", ")} className="flex flex-col gap-2">
              <div className="rota-agenda-head">
                <span className="pc-tile-icon" aria-hidden="true"><Icon /></span>
                <span className="flex min-w-0 flex-col"><span className="font-semibold">{[g.name, g.place].filter(Boolean).join(" · ")}</span>
                  <span className="text-xs text-ui-muted-foreground">{g.requiredName ? `Needs ${qualificationShort(g.requiredName)}` : g.fromClasses ? "Swim classes" : `${g.lanes.length} ${g.lanes.length === 1 ? "place" : "places"}`}</span></span>
              </div>
              <ul className="pc-rows">
                {rows.map((b, i) => {
                  const off = b.kind === "on" && b.warnings.includes("off");
                  const text = <span className="pc-row-body"><span className="pc-row-title tabular-nums">{clock(b.start)} to {clock(b.end)}</span>
                    <span className="pc-row-hint">{b.kind === "gap" ? "Nobody yet" : off ? `${b.name} is off` : b.name}{b.count > 1 ? ` · ${b.count} classes` : b.detail ? ` · ${b.detail}` : ""}</span></span>;
                  const trail = <span className="pc-row-trail">{b.kind === "gap" || off ? <Tag meta={ROTA_DAY_META.gaps} label={off ? "Cover needed" : "Gap"} /> : null}{canChange ? <ChevronRight aria-hidden="true" className="pc-row-chevron" /> : null}</span>;
                  if (!canChange) return <li key={i}><div className="pc-row" {...(b.kind === "gap" || off ? { "data-first": "" } : {})}>{text}{trail}</div></li>;
                  if (b.kind === "gap" || b.classRef || off) {
                    return <li key={i}><Button type="button" variant="outline" className={ROW} onClick={() => openGap(g, b)} aria-label={describe(b, g)} {...(b.kind === "gap" || off ? { "data-first": "" } : {})}>{text}{trail}</Button></li>;
                  }
                  return <li key={i}>{canChange && b.assignmentId ? (
                    <AssignmentDialog live={live} assignment={{ id: b.assignmentId, needId: b.needId!, place: b.place!, userId: b.userId!, name: b.name ?? "", start: b.start, end: b.end, what: [g.name, g.place].filter(Boolean).join(", ") }}
                      trigger={<Button type="button" variant="outline" className={ROW} aria-label={describe(b, g)}>{text}{trail}</Button>} />
                  ) : <div className="pc-row">{text}</div>}</li>;
                })}
              </ul>
            </section>
          );
        })}
      </div>
      <FillSheet gap={gap} live={live} onClose={() => { setGap(null); setSelected(null); }} />
    </>
  );
}

/** The places offered for an activity: the ones used before, this group's first. */
function places_(places: string[], g: Group) {
  return [...new Set([g.place, ...places].filter(Boolean))];
}
