"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Coffee, MapPin, Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Label } from "@/components/shadcn/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/shadcn/sheet";
import { Switch } from "@/components/shadcn/switch";
import { Tag } from "@/components/ui-kit/tag";
import { SegmentedChoice } from "@/components/ui-kit/segmented-links";
import { AssignmentDialog, NeedDialog } from "@/modules/rota/shared/components/plan-dialogs";
import type { AreaLanes } from "@/modules/rota/shared/components/area-lanes";
import { FillSheet, type GapRef } from "@/modules/rota/shared/components/fill-sheet";
import { clock } from "@/modules/rota/shared/constants";
import type { Block, DayNeed, DayZone, Group, Person } from "@/modules/rota/shared/day";
import { lanesLabel } from "@/modules/rota/shared/lanes";
import { ROTA_DAY_META, activityIcon, qualificationShort } from "@/modules/rota/shared/meta";
import { freeTime, needRows, personBlocks, type CoverSpan, type NeedRow } from "@/modules/rota/shared/plan-rows";
import { duration } from "@/modules/rota/shared/shifts";
import { AnyActivity, OptionRow, ShiftSheet, checkLabel, warned, type TypeOption } from "@/modules/rota/features/plan/components/people-plan";
import { firstTick, panView, sameView, tickStep, ticks as ticksOf, zoomView, type View } from "@/modules/rota/features/plan/server/view";

/** One day of a department's plan, shift first (owner, 13 October 2026: "we need to produce shifts
 *  for them, these will also be done to allocate staff during those shifts to activities, bookings,
 *  classes"). Time runs across the top. **What needs people** comes first: one row per activity
 *  the department needs, booking, run of swim classes or other module's session, with how many
 *  people it has against how many it needs over the day; a stretch short of people opens Who can
 *  fill it. **Staff on today** follows: one row per person, their shift outlined, what they are on
 *  inside it, their breaks, and every stretch nothing is given to yet as "No activity", which
 *  opens what that time could go to, from any department (lending). Each person shows today's paid
 *  hours and the week's against their contract. "Show" zooms; the wheel zooms around the pointer
 *  and dragging moves a zoomed-in day. Below 1024px the day is an agenda. */

type Option = { id: string; name: string };
type Props = {
  siteId: string;
  departmentId: string;
  /** Department names by id, for other departments' work. */
  departmentNames: Record<string, string>;
  date: string;
  dateLabel: string;
  /** The day has come (today or earlier): changes ask for a reason. */
  live: boolean;
  canChange: boolean;
  /** This department's activities that day, by area (for the agenda). */
  zones: DayZone[];
  /** This department's activities, bookings and classes, and other modules' sessions. */
  groups: Group[];
  /** Every department's, for lending and "Show other departments". */
  allGroups: Group[];
  /** Everyone on this department's day. */
  people: Person[];
  /** Paid minutes this week at this site, and contracted minutes a week, by person. */
  hours: Record<string, { week: number; contract: number | null }>;
  types: Option[];
  /** Every department's activities, to put someone on any of them. */
  anyTypes: TypeOption[];
  /** The site's areas and their lanes, for a new activity's "where" (Admin, Areas). */
  areaList: AreaLanes[];
};

/** A class block standing for a run of back-to-back classes with the same teacher (or nobody). */
type Shown = Block & { count: number; refs: string[] };
type Free = { userId: string; start: number; end: number };

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
const firstName = (name: string | null) => (name ?? "Someone").split(" ")[0];
const WARNING_WORDS: Record<string, string> = { off: "off that day", missing: "qualification not recorded", expired: "qualification expired", overlap: "double-booked", break: "on a break during it" };
const isOff = (b: Block) => b.kind === "on" && b.warnings.includes("off");
const needsCover = (b: Block) => b.kind === "gap" || isOff(b);
const ROW_WORDS: Record<NeedRow["kind"], string> = { activity: "Needed", booking: "Booking", classes: "Swim classes", booked: "Booked" };

export function DayPlan({ siteId, departmentId, departmentNames, date, dateLabel, live, canChange, zones, groups, allGroups, people, hours, types, anyTypes, areaList }: Props) {
  const router = useRouter();
  const [others, setOthers] = useState(false);
  const shownGroups = others ? allGroups : groups;
  const rows = useMemo(() => needRows(shownGroups), [shownGroups]);
  const laneCount = useMemo(() => new Map(areaList.map((a) => [a.name.toLowerCase(), a.lanes])), [areaList]);
  const ourNeeds = useMemo(() => new Map(groups.flatMap((g) => g.needs.map((n) => [n.id, n] as [string, DayNeed]))), [groups]);
  const wins = useMemo(() => windows([...rows, ...people.flatMap((p) => p.shift.parts)]), [rows, people]);
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
  const [free, setFree] = useState<Free | null>(null);
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
  const span = to - from;
  const perHour = trackPx / (span / 60);
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

  /** Where something is, in words: "Main pool, lanes 1 to 2". */
  const whereOf = (g: Group, need: DayNeed | null | undefined) => {
    const count = laneCount.get(g.place.toLowerCase()) ?? 0;
    const lanes = need?.lanes ?? [];
    return count && lanes.length ? `${g.place}, ${lanesLabel(lanes, count).toLowerCase()}` : g.place;
  };
  const needOf = (b: Block) => (b.needId ? ourNeeds.get(b.needId) ?? null : null);
  const theirs = (g: Group) => g.departmentId !== departmentId && departmentNames[g.departmentId] ? departmentNames[g.departmentId] : null;
  const openGap = (g: Group, b: Block, refs: string[]) => {
    if (!canChange) return;
    setSelected(`${g.key}|${b.start}|${b.place ?? refs.join(",")}`);
    setGap({ siteId, date, typeId: g.typeId, what: `${g.name} in ${g.place}`, dateLabel, start: b.start, end: b.end, requiredName: g.requiredName,
      needId: b.needId, place: b.place, classRefs: refs,
      replace: isOff(b) ? { assignmentId: b.assignmentId, name: b.name ?? "Someone" } : null });
  };
  /** Where something sits on a track, or null when it is outside the view. */
  const at = (start: number, end: number) => {
    const a = Math.max(start, from), e = Math.min(end, to);
    if (e <= a) return null;
    const px = trackPx * (e - a) / span;
    return { px, style: { left: `calc(${(a - from) / span * 100}% + 2px)`, width: `calc(${(e - a) / span * 100}% - 4px)` } };
  };
  const densityOf = (px: number) => (px >= 120 ? "full" : px >= 56 ? "compact" : "icon");

  /** A stretch of a row's day: green with the people on it, amber where it is short. */
  const coverFor = (row: NeedRow, c: CoverSpan, key: string) => {
    const pos = at(c.start, c.end);
    if (!pos) return null;
    const density = densityOf(pos.px);
    const onIt = row.blocks.filter((b) => b.kind === "on" && !isOff(b) && b.start < c.end && c.start < b.end).map((b) => firstName(b.name));
    const short = c.have < c.want;
    const label = `${row.label}, ${clock(c.start)} to ${clock(c.end)}: ${c.have} of ${c.want} staff${onIt.length ? ` (${[...new Set(onIt)].join(", ")})` : ""}${short && canChange && !row.group.href ? ". Choose someone" : ""}`;
    const words = density === "icon" ? <span className="pc-block-title tabular-nums">{c.have}/{c.want}</span> : (
      <span className="pc-block-body">
        <span className="pc-block-title tabular-nums">{c.have}/{c.want}{short ? ` · needs ${c.want - c.have}` : ""}</span>
        {density === "full" && onIt.length ? <span className="pc-block-hint">{[...new Set(onIt)].join(", ")}</span> : null}
      </span>
    );
    const common = { className: "pc-block rota-cover", "data-block": short ? "cover" : "done", "data-ok": short ? undefined : "", "data-density": density, style: pos.style, title: label };
    if (short && c.gap && canChange && !row.group.href) {
      const refs = row.kind === "classes" ? row.blocks.filter((b) => needsCover(b) && b.classRef && b.start >= c.start && b.end <= c.end).map((b) => b.classRef!) : [];
      const id = `${row.group.key}|${c.gap.start}|${c.gap.place ?? refs.join(",")}`;
      return <Button key={key} type="button" variant="link" {...common} aria-label={label} aria-pressed={selected === id} onClick={() => openGap(row.group, c.gap!, refs)}>{words}</Button>;
    }
    if (canChange && row.need && ourNeeds.has(row.need.id)) return changeActivity(row.need, <Button key={key} type="button" variant="link" {...common} aria-label={`${label}. Change the activity`}>{words}</Button>, key);
    return <span key={key} {...common} role="img" aria-label={label}>{words}</span>;
  };

  /** Open one of this department's activities to change its time, area or how many staff, or
   *  take it off the day, from wherever it shows on the timeline. */
  const changeActivity = (need: DayNeed, trigger: ReactNode, key?: string) => (
    <NeedDialog key={key} siteId={siteId} date={date} live={live} types={types} areas={areaList} need={need} trigger={trigger} />
  );

  /** The label of a row of what needs people: what it is, where, and how many. */
  const rowLabel = (row: NeedRow) => {
    const g = row.group;
    const Icon = activityIcon(g.icon);
    const lent = theirs(g);
    const count = row.kind === "activity" ? `${row.need?.places ?? 1} staff` : row.kind === "booking" ? g.name : row.kind === "classes" ? `${row.blocks.length} ${row.blocks.length === 1 ? "class" : "classes"}`
      : `Planned in ${g.plannedIn ?? "another module"}`;
    const line = [whereOf(g, row.need), count, g.requiredName ? qualificationShort(g.requiredName) : null].filter(Boolean).join(" · ");
    const body = <>
      <span className="rota-tl-name"><Icon aria-hidden="true" /><span>{row.label}</span></span>
      <small>{line}</small>
      <small className="rota-tl-kind">{ROW_WORDS[row.kind]}{lent ? ` · ${lent}` : ""}{row.gaps ? ` · ${row.gaps} to fill` : ""}</small>
    </>;
    const ours = row.need && ourNeeds.has(row.need.id);
    if (canChange && ours) {
      return changeActivity(row.need!, <Button type="button" variant="ghost" className="rota-tl-label h-auto items-stretch whitespace-normal" aria-label={`${row.label}, ${line}. Change the activity`}>{body}</Button>);
    }
    if (g.href) return <Button asChild variant="ghost" className="rota-tl-label h-auto items-stretch whitespace-normal"><Link href={g.href} aria-label={`${row.label}, ${line}. Open it`}>{body}</Link></Button>;
    return <div className="rota-tl-label">{body}</div>;
  };

  /** The way into a block's activity, from the dialog of someone on it. */
  const changeOf = (b: Block) => {
    const need = needOf(b);
    return need ? changeActivity(need, <Button type="button" variant="ghost">Change the activity</Button>) : undefined;
  };

  /** What a person is on, on their row: its activity, booking or class, and the department when
   *  it is another's (lent). */
  const workFor = (g: Group, b: Shown, key: string) => {
    const pos = at(b.start, b.end);
    if (!pos) return null;
    const density = densityOf(pos.px);
    const need = needOf(b);
    const lent = theirs(g);
    const title = b.detail && !b.classRef ? b.detail : g.name;
    const where = whereOf(g, need);
    const hint = [where, b.count > 1 ? `${b.count} classes` : b.classRef ? b.detail : null, lent, `${clock(b.start)}–${clock(b.end)}`].filter(Boolean).join(" · ");
    const warn = b.warnings.length ? `. Check: ${b.warnings.map((w) => WARNING_WORDS[w]).join(", ")}` : "";
    const label = `${title}${lent ? ` for ${lent}` : ""}, ${where}, ${clock(b.start)} to ${clock(b.end)}${warn}`;
    const Icon = activityIcon(g.icon);
    const words = density === "icon"
      ? (b.warnings.length ? <TriangleAlert aria-hidden="true" /> : <span className="pc-block-title">{nameInitials(title)}</span>)
      : <>
          {b.warnings.length ? <TriangleAlert aria-hidden="true" /> : <Icon aria-hidden="true" />}
          <span className="pc-block-body">
            <span className="pc-block-title">{title}</span>
            {density === "full" ? <span className="pc-block-hint">{hint}</span> : null}
          </span>
        </>;
    const kind = isOff(b) ? "absent" : g.fromClasses ? "now" : b.detail ? "assessment" : "next";
    const common = { "data-block": kind, "data-density": density, "data-lent": lent ? "" : undefined, style: pos.style, title: label };
    if (!canChange || g.href) return <span key={key} className="pc-block" {...common} role="img" aria-label={label}>{words}</span>;
    if (b.classRef) return <Button key={key} type="button" variant="link" className="pc-block" {...common} aria-label={`${label}. Change who teaches`} onClick={() => openGap(g, b, b.refs)}>{words}</Button>;
    return b.assignmentId ? (
      <AssignmentDialog key={key} live={live} assignment={{ id: b.assignmentId, needId: b.needId!, place: b.place!, userId: b.userId!, name: b.name ?? "", start: b.start, end: b.end, what: `${g.name} in ${g.place}` }}
        change={changeOf(b)} trigger={<Button type="button" variant="link" className="pc-block" {...common} aria-label={`${label}. Change their time or take them off`}>{words}</Button>} />
    ) : <span key={key} className="pc-block" {...common} role="img" aria-label={label}>{words}</span>;
  };

  const person = people.find((p) => p.userId === openPerson) ?? null;
  const freePerson = free ? people.find((p) => p.userId === free.userId) ?? null : null;
  const gapCount = groups.reduce((n, g) => n + g.gapCount, 0);
  const addHere = (name: string) => canChange && types.length ? (
    <NeedDialog siteId={siteId} date={date} live={live} types={types} areas={areaList} place={name}
      trigger={<Button type="button" variant="ghost" size="icon" aria-label={`Add an activity in ${name}`}><Plus aria-hidden="true" /></Button>} />
  ) : null;
  const gapTag = (n: number) => <Tag meta={ROTA_DAY_META[n ? "gaps" : "covered"]} label={n ? `${n} ${n === 1 ? "gap" : "gaps"}` : undefined} />;
  /** An activity in the agenda: what it is, what it needs and how many places. */
  const activityLine = (g: Group) => g.href ? `Planned in ${g.plannedIn ?? "another module"}` : [g.fromClasses ? "Swim classes" : `${g.lanes.length} ${g.lanes.length === 1 ? "place" : "places"}`,
    g.requiredName ? `needs ${qualificationShort(g.requiredName)}` : null].filter(Boolean).join(" · ");
  const hoursLine = (p: Person) => {
    const h = hours[p.userId];
    if (!h) return null;
    return `Week ${duration(h.week)}${h.contract ? ` of ${duration(h.contract)}` : ""}`;
  };
  const over = (p: Person) => { const h = hours[p.userId]; return !!h?.contract && h.week > h.contract; };

  return (
    <>
      <div className="rota-tl" ref={timeline} data-zoomed={zoomed ? "" : undefined} data-dragging={dragging ? "" : undefined}>
        <div className="rota-tl-zoom">
          <span className="rota-eyebrow" id={`rota-show-${date}`}>Show</span>
          <SegmentedChoice aria-labelledby={`rota-show-${date}`} value={win} onValueChange={(v) => setView({ from: wins[v as WindowKey].from, to: wins[v as WindowKey].to })}
            options={WINDOW_KEYS.map((k) => ({ value: k, label: k === "day" ? wins[k].label : `${wins[k].label} ${clock(wins[k].from).slice(0, 2)}–${clock(wins[k].to).slice(0, 2)}` }))} />
          <span className="rota-tl-hint">{zoomed ? `${clock(Math.round(from))} to ${clock(Math.round(to))} · ` : ""}Scroll over the day to zoom{zoomed ? ", drag it to move" : ""}</span>
          <span className="ms-auto flex min-h-11 items-center gap-2">
            <Switch id={`rota-others-${date}`} checked={others} onCheckedChange={setOthers} />
            <Label htmlFor={`rota-others-${date}`} className="font-normal">Show other departments</Label>
          </span>
        </div>
        <div className="rota-tl-row rota-tl-sticky" aria-hidden="true">
          <span />
          <div className="rota-tl-hours" ref={track} {...dragHandlers}>{ticks.map((t) => {
            const pos = (t - from) / span;
            return <span key={t} style={{ left: `${pos * 100}%`, translate: pos < 0.03 ? "0 0" : pos > 0.97 ? "-100% 0" : "-50% 0" }}>{clock(t)}</span>;
          })}</div>
        </div>

        <h3 className="rota-tl-sec">What needs people<span className="rota-count" data-gaps={gapCount ? "" : undefined}>{gapCount ? `${gapCount} ${gapCount === 1 ? "gap" : "gaps"}` : "Covered"}</span></h3>
        {rows.map((row) => (
          <div key={row.key} className="rota-tl-row">
            {rowLabel(row)}
            <div className="rota-tl-track" data-row="need" style={gridStyle} {...dragHandlers}>
              {row.cover.map((c, i) => coverFor(row, c, `${row.key}-${i}`))}
            </div>
          </div>
        ))}
        {!rows.length ? (
          <div className="rota-tl-row">
            <span aria-hidden="true" />
            <p className="text-sm text-ui-muted-foreground">Nothing needs people yet. Add what the day needs with Add activity; bookings and swim classes appear here on their own.</p>
          </div>
        ) : null}

        <h3 className="rota-tl-sec">Staff on today<span className="rota-count">{people.length}</span></h3>
        {people.map((p) => {
          const mine = personBlocks(allGroups, p.userId).map(({ group, block }) => ({ g: group, b: { ...block, count: 1, refs: block.classRef ? [block.classRef] : [] } as Shown }));
          const shown = perHour < 160 ? mergeRuns(mine) : mine;
          const packed = pack(shown.map((x) => ({ ...x, start: x.b.start, end: x.b.end })));
          const breaks = p.shift.parts.flatMap((x) => x.breaks);
          const open = freeTime(p, mine.map((x) => x.b));
          const times = p.shift.parts.map((x) => `${clock(x.start)}–${clock(x.end)}`).join(", ");
          const week = hoursLine(p);
          return (
            <section key={p.userId} aria-label={`${p.name}, ${times}`} className="rota-tl-band">
              {(packed.length ? packed : [[]]).map((row, ri) => (
                <div key={ri} className="rota-tl-row">
                  {ri === 0 ? (
                    <Button type="button" variant="ghost" className="rota-tl-label rota-tl-person h-auto items-stretch whitespace-normal" onClick={() => setOpenPerson(p.userId)}
                      aria-label={`${p.name}: ${times}, ${duration(p.shift.paidMinutes)} paid today${week ? `, ${week}` : ""}${warned(p) ? `. ${checkLabel(p)}` : ""}. Open their shift`}>
                      <span className="rota-avatar" aria-hidden="true">{nameInitials(p.name)}</span>
                      <span className="rota-tl-name"><span>{p.name}</span></span>
                      <small className="tabular-nums">{times}</small>
                      <small className={`tabular-nums${over(p) ? " rota-people-warn" : ""}`}>{duration(p.shift.paidMinutes)} paid{week ? ` · ${week}` : ""}</small>
                      {hours[p.userId]?.contract ? <span className="rota-meter" data-over={over(p) ? "" : undefined} aria-hidden="true"><span style={{ inlineSize: `${Math.min(100, Math.round((hours[p.userId].week / hours[p.userId].contract!) * 100))}%` }} /></span> : null}
                      {warned(p) ? <small className="rota-people-warn"><TriangleAlert aria-hidden="true" />{checkLabel(p)}</small> : null}
                    </Button>
                  ) : <span aria-hidden="true" />}
                  <div className="rota-tl-track rota-tl-staff" data-row="person" style={gridStyle} {...dragHandlers}>
                    {ri === 0 ? p.shift.parts.map((x) => {
                      const pos = at(x.start, x.end);
                      return pos ? <span key={`s${x.start}`} className="rota-people-shift" data-planned={x.planned ? "" : undefined} style={pos.style} /> : null;
                    }) : null}
                    {ri === 0 ? open.map((f) => {
                      const pos = at(f.start, f.end);
                      if (!pos) return null;
                      const density = densityOf(pos.px);
                      const label = `${p.name}, ${clock(f.start)} to ${clock(f.end)}: no activity or booking yet`;
                      const words = density === "icon" ? null : <span className="pc-block-body"><span className="pc-block-title">No activity</span>{density === "full" ? <span className="pc-block-hint tabular-nums">{clock(f.start)}–{clock(f.end)}</span> : null}</span>;
                      const common = { className: "pc-block rota-free-time", "data-block": "done", "data-density": density, style: pos.style, title: label };
                      return canChange
                        ? <Button key={`f${f.start}`} type="button" variant="link" {...common} aria-label={`${label}. Give this time to something`} onClick={() => setFree({ userId: p.userId, start: f.start, end: f.end })}>{words}</Button>
                        : <span key={`f${f.start}`} {...common} role="img" aria-label={label}>{words}</span>;
                    }) : null}
                    {row.map((x, i) => workFor(x.g, x.b, `${p.userId}-${ri}-${i}`))}
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
            <p className="text-sm text-ui-muted-foreground">Nobody is on today yet. Add staff gives someone a shift; then give its time to what needs people.</p>
          </div>
        ) : null}

        <div className="rota-tl-key">
          <span><i className="pc-block rota-cover" data-block="done" data-ok="" />Enough people</span>
          <span><i style={{ background: "var(--pc-block-cover)" }} />Short of people</span>
          <span><i style={{ background: "var(--pc-block-next)" }} />Activity</span>
          <span><i style={{ background: "var(--pc-block-assess)" }} />Booking</span>
          <span><i style={{ background: "var(--pc-block-now)" }} />Swim classes</span>
          <span><i className="pc-block rota-free-time" data-block="done" />No activity yet</span>
          <span><i className="rota-people-shift" data-planned="" />Shift</span>
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
              const head = <><Icon aria-hidden="true" /><span className="rota-tl-act-name">{g.name}</span><span className="rota-tl-act-meta">{activityLine(g)}</span></>;
              const list = g.lanes.flatMap((lane) => (g.fromClasses ? merged(lane) : single(lane))).sort((a, b) => a.start - b.start);
              return (
                <div key={g.key} className="flex flex-col gap-2">
                  {canChange && g.needs.length === 1 && ourNeeds.has(g.needs[0].id)
                    ? changeActivity(g.needs[0], <Button type="button" variant="ghost" className="rota-tl-act-head ui-motion-press" aria-label={`${g.name}, ${activityLine(g)}. Change the activity`}>{head}</Button>)
                    : <span className="rota-tl-act-head">{head}</span>}
                  {canChange && g.needs.length > 1 ? (
                    <span className="flex flex-wrap gap-2">{g.needs.filter((n) => ourNeeds.has(n.id)).map((n) => changeActivity(n,
                      <Button type="button" variant="outline" className="tabular-nums" aria-label={`Change ${g.name}, ${clock(n.startMinutes)} to ${clock(n.endMinutes)}`}>Change {clock(n.startMinutes)}–{clock(n.endMinutes)}</Button>, n.id))}</span>
                  ) : null}
                  <ul className="pc-rows">
                    {list.map((b, i) => {
                      const off = isOff(b);
                      const what = `${g.name} in ${g.place}, ${clock(b.start)} to ${clock(b.end)}`;
                      const text = <span className="pc-row-body"><span className="pc-row-title tabular-nums">{clock(b.start)} to {clock(b.end)}</span>
                        <span className="pc-row-hint">{b.kind === "gap" ? "Nobody yet" : off ? `${b.name} is off` : b.name}{b.count > 1 ? ` · ${b.count} classes` : b.detail ? ` · ${b.detail}` : ""}</span></span>;
                      const trail = <span className="pc-row-trail">{needsCover(b) ? <Tag meta={ROTA_DAY_META.gaps} label={off ? "Cover needed" : "Gap"} /> : null}{canChange ? <ChevronRight aria-hidden="true" className="pc-row-chevron" /> : null}</span>;
                      if (!canChange || g.href) return <li key={i}><div className="pc-row" {...(needsCover(b) ? { "data-first": "" } : {})}>{text}{trail}</div></li>;
                      if (needsCover(b) || b.classRef) {
                        return <li key={i}><Button type="button" variant="outline" className={ROW} onClick={() => openGap(g, b, b.refs)} aria-label={`${what}. ${needsCover(b) ? "Choose someone" : "Change who teaches"}`} {...(needsCover(b) ? { "data-first": "" } : {})}>{text}{trail}</Button></li>;
                      }
                      return <li key={i}>{b.assignmentId ? (
                        <AssignmentDialog live={live} assignment={{ id: b.assignmentId, needId: b.needId!, place: b.place!, userId: b.userId!, name: b.name ?? "", start: b.start, end: b.end, what: `${g.name} in ${g.place}` }}
                          change={changeOf(b)} trigger={<Button type="button" variant="outline" className={ROW} aria-label={`${b.name}, ${what}`}>{text}{trail}</Button>} />
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
      <ShiftSheet person={person} onClose={() => setOpenPerson(null)} siteId={siteId} departmentId={departmentId} departmentNames={departmentNames} date={date} dateLabel={dateLabel} live={live} canChange={canChange} anyTypes={anyTypes} areaList={areaList} />
      <Sheet open={!!free && !!freePerson} onOpenChange={(o) => { if (!o) setFree(null); }}>
        <SheetContent portalClassName="turnfin-module" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
          {free && freePerson ? (
            <FreeBody key={`${free.userId}-${free.start}`} person={freePerson} free={free} siteId={siteId} departmentId={departmentId} departmentNames={departmentNames} anyTypes={anyTypes} areaList={areaList}
              date={date} dateLabel={dateLabel} live={live} canChange={canChange}
              onDone={() => { setFree(null); router.refresh(); }} onOpenDay={() => { setFree(null); setOpenPerson(freePerson.userId); }} />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Back-to-back swim classes on someone's row as one block when the day is too narrow to read them. */
function mergeRuns(list: { g: Group; b: Shown }[]) {
  const out: { g: Group; b: Shown }[] = [];
  for (const x of list) {
    const last = out[out.length - 1];
    if (last && last.g.key === x.g.key && x.b.classRef && last.b.classRef && last.b.end === x.b.start) {
      last.b = { ...last.b, end: x.b.end, count: last.b.count + 1, refs: [...last.b.refs, x.b.classRef], detail: null, warnings: [...new Set([...last.b.warnings, ...x.b.warnings])] };
    } else out.push({ g: x.g, b: { ...x.b } });
  }
  return out;
}

/** A stretch of someone's shift with nothing given to it yet: what needs someone then, from any
 *  department, best first; or leave it as No activity. */
function FreeBody({ person: p, free, departmentId, departmentNames, anyTypes, areaList, onDone, onOpenDay, ...ctx }: {
  person: Person; free: Free; siteId: string; departmentId: string; departmentNames: Record<string, string>; anyTypes: TypeOption[]; areaList: AreaLanes[];
  date: string; dateLabel: string; live: boolean; canChange: boolean;
  onDone: () => void; onOpenDay: () => void;
}) {
  const options = p.options.filter((o) => o.start < free.end && free.start < o.end);
  const open = options.filter((o) => o.ok), closed = options.filter((o) => !o.ok);
  return (
    <>
      <SheetHeader className="p-6 pb-4">
        <SheetTitle>{firstName(p.name)}, {clock(free.start)} to {clock(free.end)}</SheetTitle>
        <SheetDescription>{ctx.dateLabel}. Give this time to something that needs people or to any activity on the list, or leave it as No activity. It is paid time either way.</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 px-6 pb-6">
        {options.length ? (
          <ul className="pc-rows" aria-label="What needs someone then">
            {[...open, ...closed].map((o) => (
              <OptionRow key={o.key} option={o} person={p} siteId={ctx.siteId} date={ctx.date} live={ctx.live} canChange={ctx.canChange} onDone={onDone} within={free}
                lentTo={o.departmentId !== departmentId ? departmentNames[o.departmentId] ?? "another department" : null} />
            ))}
          </ul>
        ) : <p className="text-sm">Nothing on the day needs someone then.</p>}
        {ctx.canChange && anyTypes.length ? <AnyActivity person={p} within={free} types={anyTypes} areas={areaList} siteId={ctx.siteId} departmentId={departmentId} date={ctx.date} live={ctx.live} onDone={onDone} /> : null}
        <Button type="button" variant="outline" className="self-start" onClick={onOpenDay}>Open {firstName(p.name)}&apos;s shift and breaks</Button>
      </div>
    </>
  );
}
