"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Coffee, MapPin, Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Tag } from "@/components/ui-kit/tag";
import { SegmentedChoice } from "@/components/ui-kit/segmented-links";
import { AssignmentDialog, NeedDialog } from "@/modules/rota/shared/components/plan-dialogs";
import type { AreaLanes } from "@/modules/rota/shared/components/area-lanes";
import { FillSheet, type GapRef } from "@/modules/rota/shared/components/fill-sheet";
import { clock } from "@/modules/rota/shared/constants";
import type { Block, DayNeed, DayZone, Group, Person, ZoneBand, ZoneItem } from "@/modules/rota/shared/day";
import { lanesLabel } from "@/modules/rota/shared/lanes";
import { ROTA_DAY_META, activityIcon, qualificationShort } from "@/modules/rota/shared/meta";
import { duration } from "@/modules/rota/shared/shifts";
import { bandRows } from "@/modules/rota/shared/zones";
import { ShiftSheet, checkLabel, warned } from "@/modules/rota/features/plan/components/people-plan";
import { firstTick, panView, sameView, tickStep, ticks as ticksOf, zoomView, type View } from "@/modules/rota/features/plan/server/view";

/** One day of the rota as one timeline (owner request, 13 October 2026: "make it horizontal
 *  instead of vertical. Zones top, staff left"). Time runs across the top. **Zones** come first:
 *  each of the site's areas in its order, a pool with lanes split into a row across it and a row
 *  per lane, showing what uses it (bookings, activities, swim classes, other modules' sessions)
 *  and what still needs someone. **Staff** follow: a row of what still needs someone, then one
 *  row per person, name and shift on the left and their day across, with their breaks.
 *  Choosing a gap opens Who can fill it; choosing a person's block changes their time; choosing a
 *  person opens their shift. "Show" zooms to the morning, afternoon or evening; the wheel zooms
 *  around the pointer and dragging moves a zoomed-in day. Below 1024px the day is an agenda. */

type Option = { id: string; name: string };
type Props = {
  siteId: string;
  departmentId: string;
  date: string;
  dateLabel: string;
  /** The day has come (today or earlier): changes ask for a reason. */
  live: boolean;
  canChange: boolean;
  /** This department's activities that day, by area (for the staff rows and the agenda). */
  zones: DayZone[];
  /** Every area of the site and what uses it that day, every department's. */
  areas: ZoneBand[];
  /** Everyone working on this department's day. */
  people: Person[];
  types: Option[];
  /** The site's areas and their lanes, for a new activity's "where" (Admin, Areas). */
  areaList: AreaLanes[];
};

/** A class block standing for a run of back-to-back classes with the same teacher (or nobody). */
type Shown = Block & { count: number; refs: string[] };
/** A block with the activity it belongs to. */
type Placed = { g: Group; b: Shown };

const WINDOW_KEYS = ["day", "am", "pm", "eve"] as const;
/** How far a press moves before it is a drag, not a click. */
const DRAG_AFTER = 6;
type WindowKey = (typeof WINDOW_KEYS)[number];

function windows(times: { start: number; end: number }[]): Record<WindowKey, { from: number; to: number; label: string }> {
  const first = times.length ? Math.min(...times.map((b) => b.start)) : 7 * 60;
  const last = times.length ? Math.max(...times.map((b) => b.end)) : 22 * 60;
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

/** Things into as few rows as fit without overlapping. */
function pack<T extends { start: number; end: number }>(list: T[]): T[][] {
  const rows: T[][] = [];
  for (const x of [...list].sort((a, b) => a.start - b.start || b.end - a.end)) {
    const row = rows.find((r) => r[r.length - 1].end <= x.start);
    if (row) row.push(x); else rows.push([x]);
  }
  return rows;
}

/** An agenda row that opens something: the shared Button drawn as a list row. */
const ROW = "pc-row h-auto w-full justify-start whitespace-normal text-start font-normal";
const nameInitials = (name: string) => name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("");
const WARNING_WORDS: Record<string, string> = { off: "off that day", missing: "qualification not recorded", expired: "qualification expired", overlap: "double-booked", break: "on a break during it" };
const isOff = (b: Block) => b.kind === "on" && b.warnings.includes("off");
const needsCover = (b: Block) => b.kind === "gap" || isOff(b);
const ITEM_BLOCK: Record<ZoneItem["kind"], string> = { booking: "assessment", booked: "assessment", activity: "next", class: "now" };
const ITEM_WORDS: Record<ZoneItem["kind"], string> = { booking: "Booking", booked: "Booked", activity: "Activity", class: "Swim class" };

export function DayPlan({ siteId, departmentId, date, dateLabel, live, canChange, zones, areas, people, types, areaList }: Props) {
  const groups = useMemo(() => zones.flatMap((z) => z.groups), [zones]);
  const laneCount = useMemo(() => new Map(areas.map((a) => [a.name.toLowerCase(), a.lanes])), [areas]);
  const ourNeeds = useMemo(() => new Map(groups.flatMap((g) => g.needs.map((n) => [n.id, n] as [string, DayNeed]))), [groups]);
  const wins = useMemo(() => windows([
    ...groups.flatMap((g) => g.lanes.flat()),
    ...areas.flatMap((a) => a.items),
    ...people.flatMap((p) => p.shift.parts),
  ]), [groups, areas, people]);
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
  const [openPerson, setOpenPerson] = useState<string | null>(null);
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

  // The wheel zooms around the pointer over the day; sideways (or with Shift) it moves.
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

  /** Drag anywhere on the hours or a row to move a zoomed-in view. A press becomes a drag once it
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

  /** Where a block is, in words: "Main pool, lanes 1 to 2". */
  const whereOf = (g: Group, b: Block) => {
    const count = laneCount.get(g.place.toLowerCase()) ?? 0;
    const lanes = b.needId ? ourNeeds.get(b.needId)?.lanes ?? [] : [];
    return count && lanes.length ? `${g.place}, ${lanesLabel(lanes, count).toLowerCase()}` : g.place;
  };
  const describe = (b: Shown, g: Group) => {
    const what = `${g.name} in ${whereOf(g, b)}`;
    const extra = b.count > 1 ? `, ${b.count} classes` : b.detail ? `, ${b.detail}` : "";
    const warn = b.warnings.length ? `. Check: ${b.warnings.map((w) => WARNING_WORDS[w]).join(", ")}` : "";
    if (isOff(b)) return `${b.name} is off: ${what}, ${clock(b.start)} to ${clock(b.end)}${extra} needs cover. Choose someone`;
    return b.kind === "gap" ? `Gap: nobody on ${what}, ${clock(b.start)} to ${clock(b.end)}${extra}. Choose someone` : `${b.name}, ${what}, ${clock(b.start)} to ${clock(b.end)}${extra}${warn}`;
  };
  const blockId = (g: Group, b: Shown) => `${g.key}|${b.start}|${b.place ?? b.refs.join(",")}`;
  const openGap = (g: Group, b: Shown) => {
    if (!canChange) return;
    setSelected(blockId(g, b));
    setGap({ siteId, date, typeId: g.typeId, what: `${g.name} in ${g.place}`, dateLabel, start: b.start, end: b.end, requiredName: g.requiredName,
      needId: b.needId, place: b.place, classRefs: b.refs,
      replace: isOff(b) ? { assignmentId: b.assignmentId, name: b.name ?? "Someone" } : null });
  };
  /** Where something sits on a track, or null when it is outside the view. */
  const at = (start: number, end: number) => {
    const a = Math.max(start, from), e = Math.min(end, to);
    if (e <= a) return null;
    const px = trackPx * (e - a) / span;
    return { px, style: { left: `calc(${(a - from) / span * 100}% + 2px)`, width: `calc(${(e - a) / span * 100}% - 4px)` } };
  };

  /** A block on a staff row: in the gaps row it says what needs someone; on a person's row, what
   *  they are on. Both read as much as the width allows. */
  const blockFor = (g: Group, b: Shown, key: string, row: "gaps" | "person") => {
    const pos = at(b.start, b.end);
    if (!pos) return null;
    const density = pos.px >= 120 ? "full" : pos.px >= 64 ? "compact" : "icon";
    const label = describe(b, g);
    const off = isOff(b);
    const title = row === "gaps" ? (off ? `${(b.name ?? "").split(" ")[0]} off` : g.name) : g.name;
    const hint = [whereOf(g, b), b.count > 1 ? `${b.count} classes` : b.detail, `${clock(b.start)}–${clock(b.end)}`].filter(Boolean).join(" · ");
    const Icon = activityIcon(g.icon);
    const words = density === "icon"
      ? (row === "gaps" || b.warnings.length ? <TriangleAlert aria-hidden="true" /> : <span className="pc-block-title">{nameInitials(g.name)}</span>)
      : <>
          {row === "gaps" || b.warnings.length ? <TriangleAlert aria-hidden="true" /> : <Icon aria-hidden="true" />}
          <span className="pc-block-body">
            <span className="pc-block-title">{title}</span>
            {density === "full" ? <span className="pc-block-hint">{hint}</span> : null}
          </span>
        </>;
    const common = { "data-block": b.kind === "gap" ? "cover" : off ? "absent" : "next", "data-density": density, style: pos.style, title: label };
    const id = blockId(g, b);
    if (!canChange) return <span key={key} className="pc-block" {...common} role="img" aria-label={label.replace(". Choose someone", "")}>{words}</span>;
    if (needsCover(b) || (b.classRef && row === "person")) {
      return (
        <Button key={key} type="button" variant="link" className="pc-block" {...common} aria-label={label}
          aria-pressed={needsCover(b) ? selected === id : undefined} onClick={() => openGap(g, b)}>{words}</Button>
      );
    }
    return b.assignmentId ? (
      <AssignmentDialog key={key} live={live} assignment={{ id: b.assignmentId, needId: b.needId!, place: b.place!, userId: b.userId!, name: b.name ?? "", start: b.start, end: b.end, what: `${g.name} in ${g.place}` }}
        trigger={<Button type="button" variant="link" className="pc-block" {...common} aria-label={label}>{words}</Button>} />
    ) : <span key={key} className="pc-block" {...common} role="img" aria-label={label}>{words}</span>;
  };

  /** Something using an area: a booking, an activity, a class, another module's session. */
  const itemFor = (band: ZoneBand, item: ZoneItem, key: string, clash: boolean) => {
    const pos = at(item.start, item.end);
    if (!pos) return null;
    const density = pos.px >= 120 ? "full" : pos.px >= 48 ? "compact" : "icon";
    const lanes = band.lanes ? `, ${lanesLabel(item.lanes, band.lanes).toLowerCase()}` : "";
    const fill = item.gaps && item.departmentId === departmentId ? `${item.gaps} to fill` : null;
    const label = `${ITEM_WORDS[item.kind]}: ${item.label}${item.detail ? `, ${item.detail}` : ""} in ${band.name}${lanes}, ${clock(item.start)} to ${clock(item.end)}${fill ? `, ${fill}` : ""}${clash ? ". Shares a lane with something else then" : ""}`;
    const words = density === "icon" ? null : (
      <span className="pc-block-body">
        <span className="pc-block-title">{item.label}</span>
        {density === "full" ? <span className="pc-block-hint">{[item.detail, `${clock(item.start)}–${clock(item.end)}`, fill].filter(Boolean).join(" · ")}</span> : null}
      </span>
    );
    // Another department's things show the time and lanes taken, without their gaps.
    const ours = item.departmentId === departmentId;
    const common = { "data-block": clash ? "absent" : !ours && item.kind === "activity" ? "done" : ours && item.gaps && item.kind !== "class" ? "cover" : ITEM_BLOCK[item.kind], "data-density": density, style: pos.style, title: label };
    const need = item.needId ? ourNeeds.get(item.needId) : null;
    if (canChange && need) {
      return (
        <NeedDialog key={key} siteId={siteId} date={date} live={live} types={types} areas={areaList} need={need}
          trigger={<Button type="button" variant="link" className="pc-block" {...common} aria-label={`${label}. Change it`}>{words}</Button>} />
      );
    }
    if (item.href) return <Button key={key} asChild variant="link" className="pc-block" {...common}><Link href={item.href} aria-label={`${label}. Open it`}>{words}</Link></Button>;
    return <span key={key} className="pc-block" {...common} role="img" aria-label={label}>{words}</span>;
  };

  // The staff rows: what still needs someone, then each person's day.
  const shown = (g: Group, lane: Block[]) => (g.fromClasses && perHour < 160 ? merged(lane) : single(lane));
  const placed: Placed[] = groups.filter((g) => !g.href).flatMap((g) => g.lanes.flatMap((lane) => shown(g, lane).map((b) => ({ g, b }))));
  const open = placed.filter((x) => needsCover(x.b));
  const gapRows = pack(open.map((x) => ({ ...x, start: x.b.start, end: x.b.end })));
  const gapCount = groups.reduce((n, g) => n + g.gapCount, 0);
  const person = people.find((p) => p.userId === openPerson) ?? null;
  const addHere = (name: string) => canChange && types.length ? (
    <NeedDialog siteId={siteId} date={date} live={live} types={types} areas={areaList} place={name}
      trigger={<Button type="button" variant="ghost" size="icon" aria-label={`Add an activity in ${name}`}><Plus aria-hidden="true" /></Button>} />
  ) : null;
  const unmatchedNote = "Not one of the site's areas. Add it in Admin, Areas, or change the activity's or class's place.";
  const gapTag = (n: number) => <Tag meta={ROTA_DAY_META[n ? "gaps" : "covered"]} label={n ? `${n} ${n === 1 ? "gap" : "gaps"}` : undefined} />;
  /** An activity in the agenda: what it is, what it needs and how many places. */
  const activityLine = (g: Group) => g.href ? `Planned in ${g.plannedIn ?? "another module"}` : [g.fromClasses ? "Swim classes" : `${g.lanes.length} ${g.lanes.length === 1 ? "place" : "places"}`,
    g.requiredName ? `needs ${qualificationShort(g.requiredName)}` : null].filter(Boolean).join(" · ");

  return (
    <>
      <div className="rota-tl" ref={timeline} data-zoomed={zoomed ? "" : undefined} data-dragging={dragging ? "" : undefined}>
        <div className="rota-tl-zoom">
          <span className="text-xs text-ui-muted-foreground" id={`rota-show-${date}`}>Show</span>
          <SegmentedChoice aria-labelledby={`rota-show-${date}`} value={win} onValueChange={(v) => setView({ from: wins[v as WindowKey].from, to: wins[v as WindowKey].to })}
            options={WINDOW_KEYS.map((k) => ({ value: k, label: k === "day" ? wins[k].label : `${wins[k].label} ${clock(wins[k].from).slice(0, 2)}–${clock(wins[k].to).slice(0, 2)}` }))} />
          <span className="text-xs text-ui-muted-foreground">{zoomed ? `${clock(Math.round(from))} to ${clock(Math.round(to))} · ` : ""}Scroll over the day to zoom{zoomed ? ", drag it to move" : ""}</span>
        </div>
        <div className="rota-tl-row rota-tl-sticky" aria-hidden="true">
          <span />
          <div className="rota-tl-hours" ref={track} {...dragHandlers}>{ticks.map((t) => {
            const pos = (t - from) / span;
            return <span key={t} style={{ left: `${pos * 100}%`, translate: pos < 0.03 ? "0 0" : pos > 0.97 ? "-100% 0" : "-50% 0" }}>{clock(t)}</span>;
          })}</div>
        </div>

        <h3 className="rota-tl-sec">Zones</h3>
        {areas.map((band) => {
          const rows = bandRows(band);
          const using = band.items.length;
          return (
            <section key={band.key} className="rota-tl-band" aria-label={band.lanes ? `${band.name}, ${band.lanes} lanes` : band.name}>
              {rows.map((row) => (
                <div key={row.key} className="rota-tl-row">
                  {row.head ? (
                    <div className="rota-tl-label rota-tl-area">
                      <span className="rota-tl-name"><MapPin aria-hidden="true" /><span>{band.name}</span></span>
                      <small title={band.unmatched ? unmatchedNote : undefined}>{band.unmatched ? "Not an area yet" : band.lanes ? `${band.lanes} lanes` : using ? `${using} on` : "Nothing on"}</small>
                      {!band.unmatched ? <span className="rota-tl-area-add">{addHere(band.name)}</span> : null}
                    </div>
                  ) : row.lane && row.key.endsWith("|0") ? (
                    <div className="rota-tl-label rota-tl-lane"><span>Lane {row.lane}</span></div>
                  ) : <span aria-hidden="true" />}
                  <div className="rota-tl-track" data-row={row.lane ? "lane" : "area"} style={gridStyle} {...dragHandlers}>
                    {row.items.map((item, i) => itemFor(band, item, `${row.key}-${i}`, row.clashes.includes(item.key)))}
                  </div>
                </div>
              ))}
            </section>
          );
        })}

        <h3 className="rota-tl-sec">Staff</h3>
        <section aria-label="Needs someone" className="rota-tl-band">
          {(gapRows.length ? gapRows : [[]]).map((row, ri) => (
            <div key={`gaps-${ri}`} className="rota-tl-row">
              {ri === 0 ? (
                <div className="rota-tl-label rota-tl-person">
                  <span className="rota-tl-name"><TriangleAlert aria-hidden="true" /><span>Needs someone</span></span>
                  <small>{gapCount ? `${gapCount} ${gapCount === 1 ? "gap" : "gaps"} to fill` : groups.length ? "Everything is covered" : "Nothing planned yet"}</small>
                </div>
              ) : <span aria-hidden="true" />}
              <div className="rota-tl-track" data-row="person" style={gridStyle} {...dragHandlers}>
                {row.map((x, i) => blockFor(x.g, x.b, `gap-${ri}-${i}`, "gaps"))}
              </div>
            </div>
          ))}
        </section>
        {people.map((p) => {
          const mine = placed.filter((x) => x.b.kind === "on" && x.b.userId === p.userId);
          const rows = pack(mine.map((x) => ({ ...x, start: x.b.start, end: x.b.end })));
          const breaks = p.shift.parts.flatMap((x) => x.breaks);
          const times = p.shift.parts.map((x) => `${clock(x.start)}–${clock(x.end)}`).join(", ");
          return (
            <section key={p.userId} aria-label={`${p.name}, ${times}`} className="rota-tl-band">
              {(rows.length ? rows : [[]]).map((row, ri) => (
                <div key={ri} className="rota-tl-row">
                  {ri === 0 ? (
                    <Button type="button" variant="ghost" className="rota-tl-label rota-tl-person h-auto items-stretch whitespace-normal" onClick={() => setOpenPerson(p.userId)}
                      aria-label={`${p.name}: ${times}, ${duration(p.shift.paidMinutes)} paid${warned(p) ? `. ${checkLabel(p)}` : ""}. Open their shift`}>
                      <span className="rota-tl-name"><span>{p.name}</span></span>
                      <small className="tabular-nums">{times} · {duration(p.shift.paidMinutes)} paid</small>
                      {warned(p) ? <small className="rota-people-warn"><TriangleAlert aria-hidden="true" />{checkLabel(p)}</small> : null}
                    </Button>
                  ) : <span aria-hidden="true" />}
                  <div className="rota-tl-track rota-tl-staff" data-row="person" style={gridStyle} {...dragHandlers}>
                    {ri === 0 ? p.shift.parts.map((x) => {
                      const pos = at(x.start, x.end);
                      return pos ? <span key={`s${x.start}`} className="rota-people-shift" data-planned={x.planned ? "" : undefined} style={pos.style} /> : null;
                    }) : null}
                    {row.map((x, i) => blockFor(x.g, x.b, `${p.userId}-${ri}-${i}`, "person"))}
                    {ri === 0 ? breaks.map((b) => {
                      const pos = at(b.start, b.end);
                      return pos ? (
                        <span key={`b${b.start}`} className="rota-people-break" data-pinned={b.pinned ? "" : undefined} style={pos.style}
                          role="img" aria-label={`${b.pinned ? "Break" : "Suggested break"}, ${b.paid ? "paid" : "unpaid"}, ${clock(b.start)} to ${clock(b.end)}`} title={`${b.paid ? "Paid" : "Unpaid"} break ${clock(b.start)}–${clock(b.end)}`}>
                          <Coffee aria-hidden="true" />
                        </span>
                      ) : null;
                    }) : null}
                  </div>
                </div>
              ))}
            </section>
          );
        })}
        {!people.length ? (
          <div className="rota-tl-row">
            <span aria-hidden="true" />
            <p className="text-sm text-ui-muted-foreground">Nobody is working yet. Add someone to a shift, or choose a gap above to put someone on it.</p>
          </div>
        ) : null}

        <div className="rota-tl-key">
          <span><i style={{ background: "var(--pc-block-assess)" }} />Booking</span>
          <span><i style={{ background: "var(--pc-block-now)" }} />Swim classes</span>
          <span><i style={{ background: "var(--pc-block-next)" }} />Someone on it</span>
          <span><i style={{ background: "var(--pc-block-cover)" }} />Needs someone</span>
          <span><i style={{ background: "var(--pc-danger-soft)" }} />Off, or two things on one lane</span>
          <span><i className="rota-people-shift" data-planned="" />Planned shift</span>
          <span><i className="rota-people-break" data-pinned="" />Break placed</span>
          <span><i className="rota-people-break" />Break suggested</span>
        </div>
      </div>

      <div className="rota-agenda">
        {zones.map((z) => (
          <section key={z.key} aria-label={z.name} className="flex flex-col gap-3">
            <div className="rota-agenda-head">
              <span className="pc-tile-icon" aria-hidden="true"><MapPin /></span>
              <span className="flex min-w-0 flex-1 flex-col"><span className="font-semibold">{z.name}</span>
                <span className="text-xs text-ui-muted-foreground">{z.unmatched ? "Not an area yet" : `${z.groups.length} ${z.groups.length === 1 ? "activity" : "activities"}`}</span></span>
              {gapTag(z.gapCount)}{!z.unmatched ? addHere(z.name) : null}
            </div>
            {z.groups.map((g) => {
              const Icon = activityIcon(g.icon);
              const rows = g.lanes.flatMap((lane) => (g.fromClasses ? merged(lane) : single(lane))).sort((a, b) => a.start - b.start);
              return (
                <div key={g.key} className="flex flex-col gap-2">
                  <span className="rota-tl-act-head"><Icon aria-hidden="true" /><span className="rota-tl-act-name">{g.name}</span><span className="rota-tl-act-meta">{activityLine(g)}</span></span>
                  <ul className="pc-rows">
                    {rows.map((b, i) => {
                      const off = isOff(b);
                      const text = <span className="pc-row-body"><span className="pc-row-title tabular-nums">{clock(b.start)} to {clock(b.end)}</span>
                        <span className="pc-row-hint">{b.kind === "gap" ? "Nobody yet" : off ? `${b.name} is off` : b.name}{b.count > 1 ? ` · ${b.count} classes` : b.detail ? ` · ${b.detail}` : ""}</span></span>;
                      const trail = <span className="pc-row-trail">{needsCover(b) ? <Tag meta={ROTA_DAY_META.gaps} label={off ? "Cover needed" : "Gap"} /> : null}{canChange ? <ChevronRight aria-hidden="true" className="pc-row-chevron" /> : null}</span>;
                      if (!canChange) return <li key={i}><div className="pc-row" {...(needsCover(b) ? { "data-first": "" } : {})}>{text}{trail}</div></li>;
                      if (needsCover(b) || b.classRef) {
                        return <li key={i}><Button type="button" variant="outline" className={ROW} onClick={() => openGap(g, b)} aria-label={describe(b, g)} {...(needsCover(b) ? { "data-first": "" } : {})}>{text}{trail}</Button></li>;
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
      <ShiftSheet person={person} onClose={() => setOpenPerson(null)} siteId={siteId} departmentId={departmentId} date={date} dateLabel={dateLabel} live={live} canChange={canChange} />
    </>
  );
}
