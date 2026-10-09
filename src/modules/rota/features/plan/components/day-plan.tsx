"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, MapPin, Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Tag } from "@/components/ui-kit/tag";
import { SegmentedChoice } from "@/components/ui-kit/segmented-links";
import { AssignmentDialog, NeedDialog } from "@/modules/rota/shared/components/plan-dialogs";
import { FillSheet, type GapRef } from "@/modules/rota/shared/components/fill-sheet";
import { clock } from "@/modules/rota/shared/constants";
import type { Block, DayZone, Group } from "@/modules/rota/shared/day";
import { ROTA_DAY_META, activityIcon, qualificationShort } from "@/modules/rota/shared/meta";
import { firstTick, panView, sameView, tickStep, ticks as ticksOf, zoomView, type View } from "@/modules/rota/features/plan/server/view";

/** One day of the rota as a timeline (owner decisions, 6 October 2026, from the approved mockup):
 *  the day across the full width, one tile per **area** of the site (Admin, Areas: Main pool,
 *  Learner pool), with each activity in it under a slim heading and that activity's places stacked as lanes,
 *  people in blue and gaps in amber. "Show" zooms to the morning, afternoon or evening.
 *  A block says as much as its width allows (name and times, then the first name, then initials),
 *  and its full words are always its accessible name. Back-to-back swim classes merge into one
 *  block until there is room to show each. Scrolling over the hours or lanes zooms around the
 *  pointer and dragging empty space moves the view (owner request, 6 October 2026); at the zoom's
 *  limits the wheel scrolls the page as usual, and on touch a vertical swipe still scrolls it.
 *  Below 1024px the same day is an agenda. */

type Option = { id: string; name: string };
type Props = {
  siteId: string;
  date: string;
  dateLabel: string;
  /** The day has come (today or earlier): changes ask for a reason. */
  live: boolean;
  canChange: boolean;
  /** The day's areas, each with its activities. */
  zones: DayZone[];
  types: Option[];
  /** The site's areas, for a new activity's "where" (Admin, Areas). */
  places: string[];
};

/** A class block standing for a run of back-to-back classes with the same teacher (or nobody). */
type Shown = Block & { count: number; refs: string[] };

const WINDOW_KEYS = ["day", "am", "pm", "eve"] as const;
/** How far a press moves before it is a drag, not a click. */
const DRAG_AFTER = 6;
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
  const what = `${g.name} in ${g.place}`;
  const extra = b.count > 1 ? `, ${b.count} classes` : b.detail ? `, ${b.detail}` : "";
  const warn = b.warnings.length ? `. Check: ${b.warnings.map((w) => WARNING_WORDS[w]).join(", ")}` : "";
  if (b.kind === "on" && b.warnings.includes("off")) return `${b.name} is off: ${what}, ${clock(b.start)} to ${clock(b.end)}${extra} needs cover. Choose someone`;
  return b.kind === "gap" ? `Gap: nobody on ${what}, ${clock(b.start)} to ${clock(b.end)}${extra}. Choose someone` : `${b.name}, ${what}, ${clock(b.start)} to ${clock(b.end)}${extra}${warn}`;
}

export function DayPlan({ siteId, date, dateLabel, live, canChange, zones, types, places }: Props) {
  const groups = useMemo(() => zones.flatMap((z) => z.groups), [zones]);
  const wins = useMemo(() => windows(groups), [groups]);
  const bounds = wins.day;
  const [view, setView] = useState<View>({ from: bounds.from, to: bounds.to });
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);
  const win = WINDOW_KEYS.find((k) => sameView(wins[k], view)) ?? "";
  const timeline = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; view: View; id: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState(false);
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
  const { from, to } = view;
  const span = to - from, hours = span / 60;
  const perHour = trackPx / hours;
  const ticks = ticksOf(view);
  const step = tickStep(span);
  const zoomed = !sameView(view, bounds);
  // Hour lines on every track, on the labels' step, wherever the view starts.
  const gridStyle = { ["--rota-step" as string]: `${(step / span) * trackPx}px`, ["--rota-offset" as string]: `${((firstTick(view) - from) / span) * trackPx}px` };

  // The wheel zooms around the pointer over the hours and lanes; sideways (or with Shift) it moves.
  // At a limit the page scrolls instead, so the timeline never traps the wheel.
  useEffect(() => {
    const el = timeline.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const box = track.current?.getBoundingClientRect();
      if (!box || e.clientX < box.left || e.clientX > box.right) return;
      const v = viewRef.current, s = v.to - v.from;
      const sideways = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const next = sideways
        ? panView(v, bounds, ((e.shiftKey ? e.deltaY : e.deltaX) / box.width) * s)
        : zoomView(v, bounds, v.from + ((e.clientX - box.left) / box.width) * s, Math.exp(e.deltaY * 0.0015));
      if (sameView(next, v)) return;
      e.preventDefault();
      viewRef.current = next;
      setView(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [bounds]);

  /** Drag anywhere on the hours or a lane to move a zoomed-in view. A press becomes a drag once it
   *  moves a few pixels; then it never also opens the block it started on. */
  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    suppressClick.current = false;
    if (e.button !== 0 || !zoomed) return;
    drag.current = { x: e.clientX, view, id: e.pointerId, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved) {
      if (Math.abs(e.clientX - d.x) < DRAG_AFTER) return;
      d.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
    }
    setView(panView(d.view, bounds, (-(e.clientX - d.x) / trackPx) * (d.view.to - d.view.from)));
  };
  const endDrag = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (d?.id !== e.pointerId) return;
    drag.current = null;
    if (!d.moved) return;
    // Swallow only the click that ends this drag, if the browser sends one.
    suppressClick.current = true;
    setTimeout(() => { suppressClick.current = false; }, 0);
    setDragging(false);
  };
  /** The click that ends a drag opens nothing. */
  const onClickCapture = (e: React.MouseEvent) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  };
  const dragHandlers = { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag, onClickCapture };

  const openGap = (g: Group, b: Shown) => {
    if (!canChange) return;
    setSelected(`${g.key}|${b.start}|${b.place ?? b.refs.join(",")}`);
    setGap({ siteId, date, typeId: g.typeId, what: `${g.name} in ${g.place}`, dateLabel, start: b.start, end: b.end, requiredName: g.requiredName,
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
      <AssignmentDialog key={key} live={live} assignment={{ id: b.assignmentId, needId: b.needId!, place: b.place!, userId: b.userId!, name: b.name ?? "", start: b.start, end: b.end, what: `${g.name} in ${g.place}` }}
        trigger={<Button type="button" variant="link" className="pc-block" {...common} aria-label={label}>{words}</Button>} />
    ) : <span key={key} className="pc-block" {...common} role="img" aria-label={label}>{words}</span>;
  };

  if (!groups.length) return null;
  const gapTag = (n: number) => <Tag meta={ROTA_DAY_META[n ? "gaps" : "covered"]} label={n ? `${n} ${n === 1 ? "gap" : "gaps"}` : undefined} />;
  const firstTrack = groups[0]?.key;
  /** An activity in a zone: what it is, what it needs and how many places. */
  const activityLine = (g: Group) => g.href ? "Planned in the Academy" : [g.fromClasses ? "Swim classes" : `${g.lanes.length} ${g.lanes.length === 1 ? "place" : "places"}`,
    g.requiredName ? `needs ${qualificationShort(g.requiredName)}` : null].filter(Boolean).join(" · ");
  const addHere = (z: DayZone) => canChange && !z.unmatched && types.length ? (
    <NeedDialog siteId={siteId} date={date} live={live} types={types} places={places} place={z.name}
      trigger={<Button type="button" variant="outline" size="icon" aria-label={`Add an activity in ${z.name}`}><Plus aria-hidden="true" /></Button>} />
  ) : null;
  const unmatchedNote = "Not one of the site's areas. Add it in Admin, Areas, or change the activity's or class's place.";
  return (
    <>
      <div className="rota-tl" ref={timeline} data-zoomed={zoomed ? "" : undefined} data-dragging={dragging ? "" : undefined}>
        <div className="rota-tl-zoom">
          <span className="text-xs text-ui-muted-foreground" id={`rota-show-${date}`}>Show</span>
          <SegmentedChoice aria-labelledby={`rota-show-${date}`} value={win} onValueChange={(v) => setView({ from: wins[v as WindowKey].from, to: wins[v as WindowKey].to })}
            options={WINDOW_KEYS.map((k) => ({ value: k, label: k === "day" ? wins[k].label : `${wins[k].label} ${clock(wins[k].from).slice(0, 2)}–${clock(wins[k].to).slice(0, 2)}` }))} />
          <span className="text-xs text-ui-muted-foreground">{zoomed ? `${clock(Math.round(from))} to ${clock(Math.round(to))} · ` : ""}Scroll over the day to zoom{zoomed ? ", drag it to move" : ""}</span>
        </div>
        <div className="rota-tl-row" aria-hidden="true">
          <span />
          <div className="rota-tl-hours" {...dragHandlers}>{ticks.map((t) => {
            const at = (t - from) / span;
            return <span key={t} style={{ left: `${at * 100}%`, translate: at < 0.03 ? "0 0" : at > 0.97 ? "-100% 0" : "-50% 0" }}>{clock(t)}</span>;
          })}</div>
        </div>
        {zones.map((z) => (
          <section key={z.key} className="rota-tl-row" aria-label={z.name}>
            <div className="rota-tl-label rota-tl-zone">
              <span className="rota-tl-name"><MapPin aria-hidden="true" /><span>{z.name}</span></span>
              <small>{z.groups.length} {z.groups.length === 1 ? "activity" : "activities"}</small>
              {z.unmatched ? <small title={unmatchedNote}>Not an area yet</small> : null}
              <span className="rota-tl-zone-foot">{gapTag(z.gapCount)}{addHere(z)}</span>
            </div>
            <div className="rota-tl-zone-body">
              {z.groups.map((g) => {
                const Icon = activityIcon(g.icon);
                const head = <><Icon aria-hidden="true" /><span className="rota-tl-act-name">{g.name}</span><span className="rota-tl-act-meta">{activityLine(g)}</span>{g.gapCount ? <span className="rota-tl-act-meta">· {g.gapCount} {g.gapCount === 1 ? "gap" : "gaps"}</span> : null}</>;
                return (
                  <div key={g.key} className="rota-tl-act">
                    {canChange && !g.fromClasses && g.needs.length === 1 ? (
                      <NeedDialog siteId={siteId} date={date} live={live} types={types} places={places} need={g.needs[0]}
                        trigger={<Button type="button" variant="ghost" className="rota-tl-act-head" aria-label={`Change ${g.name} in ${z.name}`}>{head}</Button>} />
                    ) : g.href ? (
                      <Button asChild variant="ghost" className="rota-tl-act-head"><Link href={g.href} aria-label={`${g.name} in ${z.name}: planned in the Academy. Open the course`}>{head}</Link></Button>
                    ) : <div className="rota-tl-act-head">{head}</div>}
                    <div className="rota-tl-lanes" style={gridStyle} {...dragHandlers}>
                      {g.lanes.map((lane, li) => (
                        <div key={li} className="rota-tl-track" ref={g.key === firstTrack && li === 0 ? track : undefined}>
                          {(g.fromClasses && perHour < 160 ? merged(lane) : single(lane)).map((b, bi) => blockFor(g, b, `${li}-${bi}`))}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        <div className="rota-tl-key">
          <span><i style={{ background: "var(--pc-block-next)" }} />Someone on it</span>
          <span><i style={{ background: "var(--pc-block-cover)" }} />Nobody yet (a gap)</span>
          <span><i style={{ background: "var(--pc-danger-soft)" }} />Off: needs cover</span>
          {canChange ? <span><i style={{ boxShadow: "inset 0 0 0 2px var(--pc-primary)" }} />The gap you are filling</span> : null}
          <span>Each row under an activity is one place it needs</span>
        </div>
      </div>
      <div className="rota-agenda">
        {zones.map((z) => (
          <section key={z.key} aria-label={z.name} className="flex flex-col gap-3">
            <div className="rota-agenda-head">
              <span className="pc-tile-icon" aria-hidden="true"><MapPin /></span>
              <span className="flex min-w-0 flex-1 flex-col"><span className="font-semibold">{z.name}</span>
                <span className="text-xs text-ui-muted-foreground">{z.unmatched ? "Not an area yet" : `${z.groups.length} ${z.groups.length === 1 ? "activity" : "activities"}`}</span></span>
              {gapTag(z.gapCount)}{addHere(z)}
            </div>
            {z.groups.map((g) => {
              const Icon = activityIcon(g.icon);
              const rows = g.lanes.flatMap((lane) => (g.fromClasses ? merged(lane) : single(lane))).sort((a, b) => a.start - b.start);
              return (
                <div key={g.key} className="flex flex-col gap-2">
                  <span className="rota-tl-act-head"><Icon aria-hidden="true" /><span className="rota-tl-act-name">{g.name}</span><span className="rota-tl-act-meta">{activityLine(g)}</span></span>
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
                      return <li key={i}>{b.assignmentId ? (
                        <AssignmentDialog live={live} assignment={{ id: b.assignmentId, needId: b.needId!, place: b.place!, userId: b.userId!, name: b.name ?? "", start: b.start, end: b.end, what: `${g.name} in ${g.place}` }}
                          trigger={<Button type="button" variant="outline" className={ROW} aria-label={describe(b, g)}>{text}{trail}</Button>} />
                      ) : <div className="pc-row">{text}</div>}</li>;
                    })}
                  </ul>
                </div>
              );
            })}
          </section>
        ))}
      </div>
      <FillSheet gap={gap} live={live} onClose={() => { setGap(null); setSelected(null); }} />
    </>
  );
}
