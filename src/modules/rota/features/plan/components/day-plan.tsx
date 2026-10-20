"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CircleCheck, CircleDashed, Clock3, Coffee, LayoutList, MapPin, Plus, TriangleAlert, Users, ZoomIn, ZoomOut } from "lucide-react";
import { Avatar, AvatarFallback, initials } from "@/components/shadcn/avatar";
import { Button } from "@/components/shadcn/button";
import { Label } from "@/components/shadcn/label";
import { Progress } from "@/components/shadcn/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/shadcn/sheet";
import { Switch } from "@/components/shadcn/switch";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Tag } from "@/components/ui-kit/tag";
import { SegmentedChoice } from "@/components/ui-kit/segmented-links";
import { AssignmentDialog, NeedDialog } from "@/modules/rota/shared/components/plan-dialogs";
import type { AreaLanes } from "@/modules/rota/shared/components/area-lanes";
import { FillSheet, handOverGap, type GapRef } from "@/modules/rota/shared/components/fill-sheet";
import { clock } from "@/modules/rota/shared/constants";
import { ANY_DEPARTMENT, isAreaNeed, type Block, type DayNeed, type DayZone, type Group, type Person } from "@/modules/rota/shared/day";
import { lanesLabel } from "@/modules/rota/shared/lanes";
import { ROTA_DAY_META, ROTA_SHIFT_NOTE_META, activityIcon, qualificationShort } from "@/modules/rota/shared/meta";
import { byArea, freeTime, needRows, nextChange, partPaid, personBlocks, whoIsWhere, type CoverSpan, type NeedRow } from "@/modules/rota/shared/plan-rows";
import { duration } from "@/modules/rota/shared/shifts";
import { AnyActivity, OptionRow, PeoplePlan, ShiftSheet, checkLabel, departmentFor, warned, type TypeOption } from "@/modules/rota/features/plan/components/people-plan";
import { leftOf, stretchOf } from "@/components/ui-kit/scale";
import { useNowMinute } from "@/modules/rota/features/plan/components/now";
import { MIN_SPAN, panView, sameView, ticks as ticksOf, zoomView, type View } from "@/modules/rota/features/plan/server/view";

/** One day of a department's plan as the day's diary (owner, 20 October 2026: "It's the plan, the
 *  diary, the actual guide for the day ... readable and understood by anyone"). From the top:
 *  - **Not covered yet**: every place still to fill, soonest first, each with Choose someone
 *    (best fits first, from any department).
 *  - **Who's where**: at one moment (now, on today), each area and activity with who is on it,
 *    what is short, and the next change ("15:00 · Cian starts, Aoife finishes").
 *  - **The day, person by person** (the default): one line per person with what they are on in
 *    plain words ("Main pool 07:00-10:00", "Break", "Aqua-fit"), coloured by kind, a Not covered
 *    line on top, and a now line. A name opens their day as a list; an empty stretch gives that
 *    time to something; a block changes it.
 *  - **By area**: each thing that needs people with how many it has against how many it needs.
 *  "Time of day" and the zoom buttons zoom (owner request, 15 October 2026: never on scroll);
 *  dragging, sideways scrolling or Earlier and Later move a zoomed-in day, and the zoom and the
 *  view stay on this device. Area narrows the day to one area. Below 1024px each view is a list. */

type Option = { id: string; name: string };
type Props = {
  siteId: string;
  departmentId: string;
  /** Every department on one Plan (owner, 16 October 2026): `groups` and `people` are all of
   *  them, and `departmentId` is only what the viewer's changes are made for where nothing else
   *  says. */
  everyDepartment?: boolean;
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
  /** "Tuesday 20 October": the day's heading. */
  heading: string;
  /** The day is today: a now line, and Who's where starts on now. */
  today?: boolean;
  /** Add staff and Add activity, when the viewer may change the day. */
  actions?: ReactNode;
  /** Why the viewer can't change the day, when they can't. */
  note?: ReactNode;
};

/** A place still to fill on the day, from a row of what needs people. */
type OpenGap = { key: string; row: NeedRow; block: Block; refs: string[]; start: number; end: number; what: string; why: string };
type Mode = "people" | "needs";

/** A class block standing for a run of back-to-back classes with the same teacher (or nobody). */
type Shown = Block & { count: number; refs: string[] };
type Free = { userId: string; start: number; end: number };

const WINDOW_KEYS = ["day", "am", "pm", "eve"] as const;
/** How far a press moves before it is a drag, not a click. */
const DRAG_AFTER = 6;
/** Each zoom button halves or doubles how much of the day shows; Earlier and Later move a third. */
const ZOOM_STEP = 2;
const MOVE_BY = 1 / 3;
/** Where the chosen zoom is kept, so it stays as people move between days and weeks. */
const VIEW_KEY = "turnfin.rota.plan.view";
/** Where the chosen board (People or Needs) is kept on this device. */
const MODE_KEY = "turnfin.rota.plan.mode";
/** Select values for "every area" and a zoom that is none of the named times of day. */
const ALL = "all";
const CUSTOM = "custom";
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

/** The levels of merged swim classes, each once ("Dolphins, Sharks"): the level is what staff
 *  read first on a class, not the department (owner request, 16 October 2026). */
const levels = (a: string | null, b: string | null) => [...new Set([a, b].flatMap((x) => (x ? x.split(", ") : [])))].join(", ") || null;

/** Merge each lane's back-to-back classes taught by the same person (or nobody). */
function merged(lane: Block[]): Shown[] {
  const out: Shown[] = [];
  for (const b of lane) {
    const last = out[out.length - 1];
    if (last && b.classRef && last.classRef && last.userId === b.userId && last.end === b.start && String(last.lanes ?? []) === String(b.lanes ?? [])) {
      last.end = b.end; last.count += 1; last.refs.push(b.classRef); last.detail = levels(last.detail, b.detail);
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

/** The colour of something someone is on (the diary's key): covering an area blue, a booking
 *  violet, an activity or a swim class green. */
const blockKind = (g: Group, b: Block) => (isAreaNeed(g.typeId) ? "next" : !g.fromClasses && g.needs.some((n) => n.id === b.needId && n.repeatTitle) ? "assessment" : "now");

/** An agenda row that opens something: the shared Button drawn as a list row. */
const ROW = "pc-row h-auto w-full justify-start whitespace-normal text-start font-normal";
const nameInitials = (name: string) => name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("");
const firstName = (name: string | null) => (name ?? "Someone").split(" ")[0];
/** "Aoife", "Aoife and Liam", "Aoife, Liam and Niamh". */
const listWords = (names: readonly string[]) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);
const WARNING_WORDS: Record<string, string> = { off: "off that day", missing: "qualification not recorded", expired: "qualification expired", overlap: "double-booked", break: "on a break during it" };
const isOff = (b: Block) => b.kind === "on" && b.warnings.includes("off");
const needsCover = (b: Block) => b.kind === "gap" || isOff(b);
const ROW_WORDS: Record<NeedRow["kind"], string> = { area: "Area needs", activity: "Needed", booking: "Booking", classes: "Swim classes", booked: "Booked" };

export function DayPlan({ siteId, departmentId, everyDepartment = false, departmentNames, date, dateLabel, live, canChange, zones, groups, allGroups, people, hours, types, anyTypes, areaList, heading, today = false, actions, note }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("people");
  const [sheet, setSheet] = useState<"gaps" | "checks" | null>(null);
  // The board last chosen on this device, read after mounting (the server has no localStorage).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(MODE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- a browser-only store, read after hydration
      if (saved === "people" || saved === "needs") setMode(saved);
    } catch { /* No storage: start on People. */ }
  }, []);
  const chooseMode = (next: Mode) => {
    setMode(next);
    try { window.localStorage.setItem(MODE_KEY, next); } catch { /* Not kept. */ }
  };
  const [others, setOthers] = useState(false);
  const shownGroups = others && !everyDepartment ? allGroups : groups;
  const rows = useMemo(() => needRows(shownGroups), [shownGroups]);
  const areas = useMemo(() => byArea(rows, areaList.map((a) => a.name)), [rows, areaList]);
  const [area, setArea] = useState("");
  const areaKey = areas.some((a) => a.place.toLowerCase() === area) ? area : "";
  const shownAreas = areaKey ? areas.filter((a) => a.place.toLowerCase() === areaKey) : areas;
  const laneCount = useMemo(() => new Map(areaList.map((a) => [a.name.toLowerCase(), a.lanes])), [areaList]);
  const ourNeeds = useMemo(() => new Map(groups.flatMap((g) => g.needs.filter((n) => !isAreaNeed(n.id)).map((n) => [n.id, n] as [string, DayNeed]))), [groups]);
  const wins = useMemo(() => windows([...rows, ...people.flatMap((p) => p.shift.parts)]), [rows, people]);
  const bounds = wins.day;
  const [view, setShown] = useState<View>({ from: bounds.from, to: bounds.to });
  /** Set once someone zooms or moves the day, so only their choice is kept, never the start. */
  const chosen = useRef(false);
  const setView = useCallback((next: View | ((v: View) => View)) => { chosen.current = true; setShown(next); }, []);
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);
  // The zoom last used on this device, fitted into this day. Read after mounting, because the
  // server has no localStorage and reading it while rendering would mismatch.
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(VIEW_KEY) ?? "null") as View | null;
      if (saved && Number.isFinite(saved.from) && Number.isFinite(saved.to) && saved.to > saved.from) {
        const next = panView(saved, bounds, 0);
        viewRef.current = next;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- a browser-only store, read after hydration
        setShown(next);
      }
    } catch { /* No storage: start on the whole day. */ }
  }, [bounds]);
  useEffect(() => {
    if (!chosen.current) return;
    try { window.localStorage.setItem(VIEW_KEY, JSON.stringify({ from: Math.round(view.from), to: Math.round(view.to) })); } catch { /* Not kept. */ }
  }, [view]);
  const win = WINDOW_KEYS.find((k) => sameView(wins[k], view)) ?? "";
  const timeline = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; view: View; id: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [gap, setGap] = useState<GapRef | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [openPerson, setOpenPerson] = useState<string | null>(null);
  const [free, setFree] = useState<Free | null>(null);
  const [whereAt, setWhereAt] = useState<number | null>(null);
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
  const zoomed = !sameView(view, bounds);
  const nowMin = useNowMinute(today);
  const nowShown = nowMin !== null && nowMin >= from && nowMin <= to;
  // Hour lines on every track, on the labels' step, wherever the view starts, and on today the
  // line that says where the day has got to.
  const gridLines = [
    ...ticks.map((t) => <span key={`line${t}`} aria-hidden="true" className={`rota-tl-line ${leftOf((t - from) / span)}`} />),
    nowShown ? <span key="now" aria-hidden="true" className={`rota-now-line ${leftOf((nowMin - from) / span)}`} /> : null,
  ];

  // Scrolling never zooms (owner request, 15 October 2026). Up and down always scroll the page;
  // sideways (or with Shift) moves a zoomed-in day, and at either end the page has it instead.
  useEffect(() => {
    const el = timeline.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // A pinch arrives as a wheel with Ctrl: leave it to the browser.
      const box = track.current?.getBoundingClientRect();
      if (!box || e.clientX < box.left || e.clientX > box.right) return;
      const sideways = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (!sideways) return;
      const v = viewRef.current;
      const next = panView(v, bounds, ((e.shiftKey ? e.deltaY : e.deltaX) / box.width) * (v.to - v.from));
      if (sameView(next, v)) return;
      e.preventDefault();
      viewRef.current = next;
      setView(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [bounds, setView]);

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
  /** The zoom buttons zoom around the middle of what shows. */
  const zoomBy = (factor: number) => setView((v) => zoomView(v, bounds, (v.from + v.to) / 2, factor));
  const moveBy = (share: number) => setView((v) => panView(v, bounds, share * (v.to - v.from)));
  const zoomedIn = span <= MIN_SPAN + 0.5;
  const dragHandlers = { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag, onClickCapture };

  /** Where something is, in words: "Main pool, lanes 1 to 2". */
  const whereOf = (g: Group, need: DayNeed | null | undefined, b?: Block) => {
    const count = laneCount.get(g.place.toLowerCase()) ?? 0;
    const lanes = need?.lanes ?? b?.lanes ?? [];
    return count && lanes.length ? `${g.place}, ${lanesLabel(lanes, count).toLowerCase()}` : g.place;
  };
  const needOf = (b: Block) => (b.needId ? ourNeeds.get(b.needId) ?? null : null);
  const theirs = (g: Group) => !everyDepartment && g.departmentId !== departmentId && departmentNames[g.departmentId] ? departmentNames[g.departmentId] : null;
  /** The department a change to this activity is made for: its own, or for something every
   *  department shares (an area's need, a swim class), the plan's. */
  const forGroup = (g: Group) => (everyDepartment && g.departmentId !== ANY_DEPARTMENT ? g.departmentId : departmentId);
  const forPerson = (p: Person) => (everyDepartment ? departmentFor(p, departmentId) : departmentId);
  const openGap = (g: Group, b: Block, refs: string[]) => {
    if (!canChange) return;
    setSelected(`${g.key}|${b.start}|${b.place ?? refs.join(",")}`);
    setGap({ siteId, date, typeId: g.typeId, what: `${(refs.length && b.detail) || g.name} in ${whereOf(g, needOf(b), b)}`, dateLabel, start: b.start, end: b.end, requiredName: g.requiredName,
      needId: b.needId, place: b.place, classRefs: refs, departmentId: forGroup(g),
      teacher: refs.length && b.kind === "on" && b.userId ? { userId: b.userId, name: b.name ?? "Someone" } : null,
      replace: isOff(b) ? { assignmentId: b.assignmentId, name: b.name ?? "Someone" } : null });
  };
  /** Hand part of someone's time on a planned activity to another person (staff "in and out"). */
  const handOverOf = (g: Group, b: Block) => () => {
    setSelected(null);
    setGap(handOverGap({ siteId, date, dateLabel, typeId: g.typeId, what: `${g.name} in ${g.place}`, requiredName: g.requiredName, departmentId: forGroup(g) },
      { id: b.assignmentId!, needId: b.needId!, place: b.place!, userId: b.userId!, name: b.name ?? "", start: b.start, end: b.end }));
  };
  /** Where something sits on a track, or null when it is outside the view. */
  const at = (start: number, end: number) => {
    const a = Math.max(start, from), e = Math.min(end, to);
    if (e <= a) return null;
    const px = trackPx * (e - a) / span;
    return { px, place: stretchOf((a - from) / span, (e - from) / span) };
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
    const names = [...new Set(onIt)].join(", ");
    const words = density === "icon" ? <span className="pc-block-title tabular-nums">{c.have}/{c.want}</span> : (
      <span className="pc-block-body">
        <span className="pc-block-title">{short ? `Needs ${c.want - c.have} more` : names || "Covered"}</span>
        {density === "full" ? <span className="pc-block-hint tabular-nums">{c.have} of {c.want}{short && names ? ` · ${names}` : ""}</span> : null}
      </span>
    );
    const common = { className: `pc-block rota-cover ${pos.place}`, "data-block": short ? "cover" : "done", "data-ok": short ? undefined : "", "data-density": density, title: label };
    if (short && c.gap && canChange && !row.group.href) {
      const refs = row.kind === "classes" ? row.blocks.filter((b) => needsCover(b) && b.classRef && b.start >= c.start && b.end <= c.end).map((b) => b.classRef!) : [];
      const id = `${row.group.key}|${c.gap.start}|${c.gap.place ?? refs.join(",")}`;
      return <Button key={key} type="button" variant="link" {...common} aria-label={label} aria-pressed={selected === id} onClick={() => openGap(row.group, c.gap!, refs)}>{words}</Button>;
    }
    if (canChange && row.need && ourNeeds.has(row.need.id)) return changeActivity(row.need, <Button key={key} type="button" variant="link" {...common} aria-label={`${label}. Change the activity`}>{words}</Button>, key);
    return <span key={key} {...common} role="img" aria-label={label}>{words}</span>;
  };

  /** One swim class on the classes row (owner request, 16 October 2026: the classes come from the
   *  swim school and "you can simply click on them and assign a staff"): its level and who teaches
   *  it, amber when nobody does (or they are off). Choosing it opens who can teach it, staffed or
   *  not; the change is for that day only. */
  const classFor = (row: NeedRow, b: Block, key: string) => {
    const pos = at(b.start, b.end);
    if (!pos) return null;
    const density = densityOf(pos.px);
    const open = needsCover(b);
    const level = b.detail || "Swim class";
    const who = b.kind === "gap" ? "Needs a teacher" : isOff(b) ? `${b.name ?? "Teacher"} is off` : b.name ?? "Someone";
    const warn = b.warnings.filter((w) => w !== "off").map((w) => WARNING_WORDS[w]);
    const label = `${level}, ${row.group.place}, ${clock(b.start)} to ${clock(b.end)}: ${who}${warn.length ? `. Check: ${warn.join(", ")}` : ""}`;
    const words = density === "icon"
      ? (open ? <TriangleAlert aria-hidden="true" /> : <span className="pc-block-title">{nameInitials(b.name ?? level)}</span>)
      : <>
          {open || warn.length ? <TriangleAlert aria-hidden="true" /> : null}
          <span className="pc-block-body">
            <span className="pc-block-title">{density === "full" || b.kind === "gap" ? level : firstName(b.name)}</span>
            {density === "full" ? <span className="pc-block-hint">{who} · {clock(b.start)}–{clock(b.end)}</span> : null}
          </span>
        </>;
    const common = { className: `pc-block ${pos.place}`, "data-block": isOff(b) ? "absent" : open ? "cover" : "now", "data-density": density, title: label };
    if (!canChange || !b.classRef) return <span key={key} {...common} role="img" aria-label={label}>{words}</span>;
    const id = `${row.group.key}|${b.start}|${b.classRef}`;
    return <Button key={key} type="button" variant="link" {...common} aria-label={`${label}. ${open ? "Choose who teaches it" : "Change who teaches it"}`} aria-pressed={selected === id}
      onClick={() => openGap(row.group, b, [b.classRef!])}>{words}</Button>;
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
    const count = row.kind === "activity" || row.kind === "area" ? `${row.need?.places ?? 1} staff` : row.kind === "booking" ? g.name : row.kind === "classes" ? `${row.blocks.length} ${row.blocks.length === 1 ? "class" : "classes"}`
      : `Planned in ${g.plannedIn ?? "another module"}`;
    const line = [whereOf(g, row.need), count, g.requiredName ? qualificationShort(g.requiredName) : null].filter(Boolean).join(" · ");
    const body = <>
      <span className="rota-tl-name"><Icon aria-hidden="true" /><span>{row.label}</span></span>
      <small>{line}</small>
      <small className="rota-tl-kind">{ROW_WORDS[row.kind]}{lent ? ` · ${lent}` : ""}{row.gaps ? ` · ${row.gaps} to fill` : ""}</small>
      {row.need?.together ? <small className="rota-tl-together">{row.need.together}</small> : null}
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

  /** What a person is on, on their row, in the words anyone reads it in: an area they cover by
   *  the area ("Main pool"), anything else by what it is ("Aqua-fit", a class by its level), then
   *  when, and the department when it is another's (lent). */
  const workFor = (g: Group, b: Shown, key: string) => {
    const pos = at(b.start, b.end);
    if (!pos) return null;
    const density = densityOf(pos.px);
    const need = needOf(b);
    const lent = theirs(g);
    const area = isAreaNeed(g.typeId);
    const title = area ? g.place || g.name : b.detail || g.name;
    const where = whereOf(g, need, b);
    const hint = [`${clock(b.start)}–${clock(b.end)}`, area ? g.name : where, b.count > 1 ? `${b.count} classes` : null, lent].filter(Boolean).join(" · ");
    const warn = b.warnings.length ? `. Check: ${b.warnings.map((w) => WARNING_WORDS[w]).join(", ")}` : "";
    const label = `${title}${b.classRef && b.detail ? ` (${g.name})` : ""}${lent ? ` for ${lent}` : ""}, ${where}, ${clock(b.start)} to ${clock(b.end)}${warn}`;
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
    const kind = isOff(b) ? "absent" : blockKind(g, b);
    const common = { className: `pc-block ${pos.place}`, "data-block": kind, "data-density": density, "data-lent": lent ? "" : undefined, title: label };
    if (!canChange || g.href) return <span key={key} {...common} role="img" aria-label={label}>{words}</span>;
    if (b.classRef) return <Button key={key} type="button" variant="link" {...common} aria-label={`${label}. Change who teaches`} onClick={() => openGap(g, b, b.refs)}>{words}</Button>;
    return b.assignmentId ? (
      <AssignmentDialog key={key} live={live} assignment={{ id: b.assignmentId, needId: b.needId!, place: b.place!, userId: b.userId!, name: b.name ?? "", start: b.start, end: b.end, what: `${g.name} in ${g.place}` }}
        change={changeOf(b)} onHandOver={handOverOf(g, b)} trigger={<Button type="button" variant="link" {...common} aria-label={`${label}. Change their time, hand part of it over or take them off`}>{words}</Button>} />
    ) : <span key={key} {...common} role="img" aria-label={label}>{words}</span>;
  };

  const person = people.find((p) => p.userId === openPerson) ?? null;
  const freePerson = free ? people.find((p) => p.userId === free.userId) ?? null : null;
  // With one area chosen: the people on something there, and anyone with time still to give.
  const shownPeople = !areaKey ? people : people.filter((p) => {
    const mine = personBlocks(allGroups, p.userId);
    return mine.some(({ group }) => group.place.trim().toLowerCase() === areaKey) || freeTime(p, mine.map((x) => x.block)).length > 0;
  });
  const shownRows = shownAreas.flatMap((a) => a.rows);

  /** Every place still to fill on the day, once each, soonest first: the Open needs row of the
   *  People board and the "to fill" list. Back-to-back classes nobody teaches are one. */
  const openGaps = useMemo(() => {
    const out: OpenGap[] = [];
    const seen = new Set<string>();
    for (const row of shownRows) {
      if (row.group.href) continue;
      if (row.kind === "classes") {
        for (const b of merged(row.blocks.filter(needsCover))) {
          out.push({ key: `${row.key}|${b.start}|${b.refs.join(",")}`, row, block: b, refs: b.refs, start: b.start, end: b.end,
            what: b.detail || "Swim class", why: isOff(b) ? `${b.name ?? "Teacher"} is off` : b.count > 1 ? `${b.count} classes need a teacher` : "Needs a teacher" });
        }
        continue;
      }
      for (const c of row.cover) {
        if (c.have >= c.want || !c.gap) continue;
        const key = `${row.key}|${c.gap.start}|${c.gap.place ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ key, row, block: c.gap, refs: [], start: c.gap.start, end: c.gap.end, what: row.label,
          why: isOff(c.gap) ? `${c.gap.name ?? "Someone"} is off` : `${c.have} of ${c.want} staff, ${c.want - c.have === 1 ? "1 more needed" : `${c.want - c.have} more needed`}` });
      }
    }
    return out.sort((a, b) => a.start - b.start || a.what.localeCompare(b.what));
  }, [shownRows]);
  const toCheck = shownPeople.filter(warned);
  const paid = shownPeople.reduce((n, p) => n + p.shift.paidMinutes, 0);
  const unpaid = shownPeople.reduce((n, p) => n + p.shift.parts.reduce((m, x) => m + partPaid(x).unpaid, 0), 0);

  const addHere = (name: string) => canChange && types.length ? (
    <NeedDialog siteId={siteId} date={date} live={live} types={types} areas={areaList} place={name}
      trigger={<Button type="button" variant="ghost" size="icon" aria-label={`Add an activity in ${name}`}><Plus aria-hidden="true" /></Button>} />
  ) : null;
  const gapTag = (n: number) => <Tag meta={ROTA_DAY_META[n ? "gaps" : "covered"]} label={n ? `${n} ${n === 1 ? "gap" : "gaps"}` : undefined} />;
  /** An activity in the agenda: what it is, what it needs and how many places. */
  const activityLine = (g: Group) => g.href ? `Planned in ${g.plannedIn ?? "another module"}` : [g.fromClasses ? "Swim classes" : `${g.lanes.length} ${g.lanes.length === 1 ? "place" : "places"}`,
    g.requiredName ? `needs ${qualificationShort(g.requiredName)}` : null].filter(Boolean).join(" · ");
  const week = (p: Person) => hours[p.userId] ?? null;
  const over = (p: Person) => { const h = week(p); return !!h?.contract && h.week > h.contract; };
  const fillOpen = (x: OpenGap) => { setSheet(null); openGap(x.row.group, x.block, x.refs); };

  /** The hours across the top, and on today where the day has got to. */
  const ruler = (
    <div className="rota-tl-head rota-tl-sticky">
      <div className="rota-tl-row" aria-hidden="true">
        <span />
        <div className="rota-tl-hours" ref={track} {...dragHandlers}>{ticks.map((t) => {
          const pos = (t - from) / span;
          return <span key={t} className={`${leftOf(pos)} ${pos < 0.03 ? "" : pos > 0.97 ? "-translate-x-full" : "-translate-x-1/2"}`}>{clock(t)}</span>;
        })}{nowShown ? <span className={`rota-now-tag ${leftOf((nowMin - from) / span)} -translate-x-1/2`}>Now</span> : null}</div>
      </div>
    </div>
  );

  /** The first line of the day by person: every place still to fill, on the clock, ready to give. */
  const openRow = (
    <section aria-label="Not covered yet" className="rota-tl-band rota-open">
      {(openGaps.length ? pack(openGaps) : [[]]).map((line, li) => (
        <div key={li} className="rota-tl-row">
          {li === 0 ? (
            <Button type="button" variant="ghost" className="rota-tl-label rota-open-label h-auto items-stretch whitespace-normal" onClick={() => setSheet("gaps")} disabled={!openGaps.length}
              aria-label={openGaps.length ? `Not covered yet: ${openGaps.length} to fill. List them` : "Every need is filled"}>
              <span className="rota-tl-name"><CircleDashed aria-hidden="true" /><span>Not covered</span></span>
              <small>{openGaps.length ? `${openGaps.length} to fill · list them` : "Every need is filled"}</small>
            </Button>
          ) : <span aria-hidden="true" />}
          <div className="rota-tl-track" data-row="open" {...dragHandlers}>
            {gridLines}
            {line.map((x) => {
              const pos = at(x.start, x.end);
              if (!pos) return null;
              const density = densityOf(pos.px);
              const label = `${x.what} in ${whereOf(x.row.group, x.row.need, x.block)}, ${clock(x.start)} to ${clock(x.end)}: ${x.why}`;
              const words = density === "icon" ? <TriangleAlert aria-hidden="true" /> : (
                <span className="pc-block-body">
                  <span className="pc-block-title">{x.what}</span>
                  {density === "full" ? <span className="pc-block-hint">{x.row.group.place || "No area"} · {clock(x.start)}–{clock(x.end)}</span> : null}
                </span>
              );
              const common = { className: `pc-block ${pos.place}`, "data-block": "cover", "data-density": density, title: label };
              return canChange
                ? <Button key={x.key} type="button" variant="link" {...common} aria-label={`${label}. Choose someone`} aria-pressed={selected === `${x.row.group.key}|${x.block.start}|${x.block.place ?? x.refs.join(",")}`} onClick={() => fillOpen(x)}>{words}</Button>
                : <span key={x.key} {...common} role="img" aria-label={label}>{words}</span>;
            })}
          </div>
        </div>
      ))}
    </section>
  );

  /** One person's row on the People board. */
  const personRow = (p: Person) => {
    const mine = personBlocks(allGroups, p.userId).map(({ group, block }) => ({ g: group, b: { ...block, count: 1, refs: block.classRef ? [block.classRef] : [] } as Shown }));
    const shown = perHour < 160 ? mergeRuns(mine) : mine;
    const packed = pack(shown.map((x) => ({ ...x, start: x.b.start, end: x.b.end })));
    const breaks = p.shift.parts.flatMap((x) => x.breaks);
    const open = freeTime(p, mine.map((x) => x.b));
    const times = p.shift.parts.map((x) => `${clock(x.start)}–${clock(x.end)}`).join(", ");
    const h = week(p);
    const weekWords = h ? `${duration(h.week)}${h.contract ? ` of ${duration(h.contract)}` : ""} this week` : null;
    return (
      <section key={p.userId} aria-label={`${p.name}, ${times}`} className="rota-tl-band">
        {(packed.length ? packed : [[]]).map((row, ri) => (
          <div key={ri} className="rota-tl-row">
            {ri === 0 ? (
              <Button type="button" variant="ghost" className="rota-tl-label rota-tl-person h-auto items-stretch whitespace-normal" onClick={() => setOpenPerson(p.userId)}
                aria-label={`${p.name}: ${p.shift.parts.length > 1 ? "split shift, " : ""}${times}, ${duration(p.shift.paidMinutes)} paid today${weekWords ? `, ${weekWords}` : ""}${warned(p) ? `. ${checkLabel(p)}` : ""}. Open their day`}>
                <Avatar size="lg" aria-hidden="true"><AvatarFallback>{initials(p.name)}</AvatarFallback></Avatar>
                <span className="rota-tl-name"><span>{p.name}</span>{warned(p) ? <TriangleAlert aria-hidden="true" className="rota-warn-icon" /> : null}</span>
                <small className="tabular-nums">{times} · {duration(p.shift.paidMinutes)}</small>
                {h?.contract ? <Progress value={Math.min(100, Math.round((h.week / h.contract) * 100))} data-over={over(p) ? "" : undefined} className="rota-week-bar" aria-hidden="true" /> : null}
              </Button>
            ) : <span aria-hidden="true" />}
            <div className="rota-tl-track rota-tl-staff" data-row="person" {...dragHandlers}>
              {gridLines}
              {ri === 0 ? p.shift.parts.map((x) => {
                const pos = at(x.start, x.end);
                return pos ? <span key={`s${x.start}`} className={`rota-people-shift ${pos.place}`} data-planned={x.planned ? "" : undefined} /> : null;
              }) : null}
              {ri === 0 ? splitGaps(p).map((x) => {
                const pos = at(x.start, x.end);
                if (!pos) return null;
                const label = `Off between ${firstName(p.name)}'s shifts, ${clock(x.start)} to ${clock(x.end)}, unpaid`;
                return <span key={`o${x.start}`} className={`rota-split-gap ${pos.place}`} data-density={densityOf(pos.px)} role="img" aria-label={label} title={label}><span>Off {duration(x.end - x.start)}</span></span>;
              }) : null}
              {ri === 0 ? open.map((f) => {
                const pos = at(f.start, f.end);
                if (!pos) return null;
                const density = densityOf(pos.px);
                const label = `${p.name}, ${clock(f.start)} to ${clock(f.end)}: free, nothing given to this time yet`;
                const words = density === "icon" ? <Plus aria-hidden="true" /> : <><Plus aria-hidden="true" /><span className="pc-block-body"><span className="pc-block-title">{density === "full" ? "Give this time" : "Free"}</span>{density === "full" ? <span className="pc-block-hint tabular-nums">{clock(f.start)}–{clock(f.end)}</span> : null}</span></>;
                const common = { className: `pc-block rota-free-time ${pos.place}`, "data-block": "done", "data-density": density, title: label };
                return canChange
                  ? <Button key={`f${f.start}`} type="button" variant="link" {...common} aria-label={`${label}. Give this time to something`} onClick={() => setFree({ userId: p.userId, start: f.start, end: f.end })}>{words}</Button>
                  : <span key={`f${f.start}`} {...common} role="img" aria-label={label}>{density === "icon" ? null : <span className="pc-block-body"><span className="pc-block-title">Free</span></span>}</span>;
              }) : null}
              {row.map((x, i) => workFor(x.g, x.b, `${p.userId}-${ri}-${i}`))}
              {ri === 0 ? breaks.map((b) => {
                const pos = at(b.start, b.end);
                if (!pos) return null;
                // A break is a line of the diary like anything else: "Break", and its time when it fits.
                const density = pos.px >= 96 ? "full" : pos.px >= 40 ? "compact" : "icon";
                const label = `${firstName(p.name)}'s ${b.pinned ? "break" : "suggested break"}, ${b.end - b.start} minutes ${b.paid ? "paid" : "unpaid"}, ${clock(b.start)} to ${clock(b.end)}. Open their day`;
                return (
                  <Button key={`b${b.start}`} type="button" variant="link" className={`pc-block rota-break ${pos.place}`} data-block="done" data-density={density} data-pinned={b.pinned ? "" : undefined}
                    aria-label={label} title={label} onClick={() => setOpenPerson(p.userId)}>
                    {density === "icon" ? <Coffee aria-hidden="true" /> : (
                      <span className="pc-block-body">
                        <span className="pc-block-title">Break</span>
                        {density === "full" ? <span className="pc-block-hint tabular-nums">{clock(b.start)}–{clock(b.end)}</span> : null}
                      </span>
                    )}
                  </Button>
                );
              }) : null}
            </div>
          </div>
        ))}
      </section>
    );
  };

  /** The Needs board: area by area, each thing that needs people and how covered it is. */
  const needsBoard = (
    <>
      {shownAreas.map((area) => (
        <section key={area.place || "-"} aria-label={area.place || "No area"} className="rota-tl-area-band">
          <h3 className="rota-tl-area">
            <span>{area.place || "No area"}</span>
            <span className="rota-count" data-gaps={area.gaps ? "" : undefined}>{area.gaps ? `${area.gaps} to fill` : "Covered"}</span>
            {area.place ? <span className="ms-auto">{addHere(area.place)}</span> : null}
          </h3>
          {area.rows.map((row) => row.kind === "classes" ? (
            // Each swim class on its own, straight from the swim school, ready to click and staff.
            <section key={row.key} aria-label={`${row.label}, ${row.group.place}`} className="rota-tl-band">
              {pack(row.blocks).map((line, li) => (
                <div key={li} className="rota-tl-row">
                  {li === 0 ? rowLabel(row) : <span aria-hidden="true" />}
                  <div className="rota-tl-track" data-row="need" {...dragHandlers}>
                    {gridLines}
                    {line.map((b, i) => classFor(row, b, `${row.key}-${li}-${i}`))}
                  </div>
                </div>
              ))}
            </section>
          ) : (
            <div key={row.key} className="rota-tl-row">
              {rowLabel(row)}
              <div className="rota-tl-track" data-row="need" {...dragHandlers}>
                {gridLines}
                {row.cover.map((c, i) => coverFor(row, c, `${row.key}-${i}`))}
              </div>
            </div>
          ))}
        </section>
      ))}
      {!rows.length ? (
        <p className="rota-tl-empty">Nothing needs people yet. Add what the day needs with Add activity; bookings, area needs and swim classes appear here on their own.</p>
      ) : null}
    </>
  );

  /** The key, in a line beside the day: what each colour means. */
  const key = (
    <ul className="rota-key" aria-label="Key">
      {mode === "people" ? <>
        <li><i className="pc-block" data-block="next" />Covering an area</li>
        <li><i className="pc-block" data-block="now" />Classes and activities</li>
        <li><i className="pc-block" data-block="assessment" />Bookings</li>
        <li><i className="pc-block rota-break" data-block="done" data-pinned="" />Break</li>
        <li><i className="pc-block rota-free-time" data-block="done" />Nothing given yet</li>
        <li><i className="pc-block" data-block="cover" />Not covered</li>
        <li><i className="pc-block" data-block="absent" />Off that day</li>
      </> : <>
        <li><i className="pc-block rota-cover" data-block="done" data-ok="" />Enough people</li>
        <li><i className="pc-block" data-block="cover" />Short of people</li>
        <li><i className="pc-block" data-block="now" />A swim class with its teacher</li>
      </>}
    </ul>
  );

  /** The moment Who's where shows: the one chosen, else now on today, else when the day starts. */
  const dayStart = Math.min(...people.flatMap((p) => p.shift.parts.map((x) => x.start)), ...rows.map((r) => r.start), bounds.to);
  const nowInDay = nowMin !== null && nowMin >= bounds.from && nowMin < bounds.to ? nowMin : null;
  const moment = whereAt ?? nowInDay ?? Math.floor(Math.min(dayStart, bounds.to - 30) / 30) * 30;
  const moments = Array.from({ length: Math.max(0, Math.ceil((bounds.to - bounds.from) / 30)) }, (_, i) => bounds.from + i * 30);
  const where = whoIsWhere(shownRows, moment);
  const onBreak = shownPeople.filter((p) => p.shift.parts.some((x) => x.breaks.some((b) => b.start <= moment && moment < b.end)));
  const next = nextChange(shownPeople, allGroups, moment);
  const nextWords = next ? [
    next.starts.length ? `${listWords(next.starts)} ${next.starts.length === 1 ? "starts" : "start"}` : null,
    next.finishes.length ? `${listWords(next.finishes)} ${next.finishes.length === 1 ? "finishes" : "finish"}` : null,
    next.breaks.length ? `${listWords(next.breaks)} ${next.breaks.length === 1 ? "goes" : "go"} on a break` : null,
    ...next.moves.map((m) => `${m.name} moves to ${m.to}`),
  ].filter(Boolean).join(", ") : "";
  const SHOW_GAPS = 4;

  /** The top of the day: what is not covered yet, and who's where at one moment. */
  const glance = (
    <div className="rota-glance">
      <section aria-labelledby={`rota-holes-${date}`} className="rota-glance-panel">
        <h3 id={`rota-holes-${date}`} className="rota-glance-title">
          {openGaps.length ? <>Not covered yet <span className="rota-count" data-gaps="">{openGaps.length}</span></> : <><CircleCheck aria-hidden="true" className="text-ui-success" />Every need is filled</>}
        </h3>
        {openGaps.length ? <>
          <GapList gaps={openGaps.slice(0, SHOW_GAPS)} canChange={canChange} whereOf={(x) => whereOf(x.row.group, x.row.need, x.block)} onFill={fillOpen} />
          {openGaps.length > SHOW_GAPS ? <Button type="button" variant="ghost" className="self-start" onClick={() => setSheet("gaps")}>See all {openGaps.length}</Button> : null}
        </> : <p className="rota-glance-note">{rows.length ? "Everything the day needs has someone on it." : "Nothing needs people on this day yet. Add what it needs with Add activity; bookings, area needs and swim classes appear on their own."}</p>}
      </section>
      <section aria-labelledby={`rota-where-${date}`} className="rota-glance-panel">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={`rota-where-${date}`} className="rota-glance-title">Who&apos;s where</h3>
          <Select value={whereAt === null ? (nowInDay !== null ? "now" : String(moment)) : String(whereAt)} onValueChange={(v) => setWhereAt(v === "now" ? null : Number(v))}>
            <SelectTrigger className="rota-select" aria-label="At what time"><Clock3 aria-hidden="true" /><SelectValue /></SelectTrigger>
            <SelectContent>
              {nowInDay !== null ? <SelectItem value="now">Now, {clock(nowInDay)}</SelectItem> : null}
              {moments.map((m) => <SelectItem key={m} value={String(m)}>At {clock(m)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {where.length || onBreak.length ? (
          <dl className="rota-where">
            {where.map((x) => (
              <div key={x.row.key}>
                <dt>{x.row.kind === "area" ? x.row.group.place || x.row.label : x.row.label}{x.row.kind !== "area" && x.row.group.place ? <small>{x.row.group.place}</small> : null}</dt>
                <dd>
                  {x.names.length ? <span>{listWords(x.names)}</span> : null}
                  {x.short ? <span className="rota-where-short">{x.names.length ? `${x.short} more needed` : x.short === 1 ? "Nobody yet" : `Needs ${x.short}`}</span> : null}
                </dd>
              </div>
            ))}
            {onBreak.length ? <div><dt>On a break</dt><dd><span>{listWords(onBreak.map((p) => p.name))}</span></dd></div> : null}
          </dl>
        ) : <p className="rota-glance-note">Nobody is on anything at {clock(moment)}.</p>}
        {next ? <p className="rota-where-next"><strong>Next change</strong><span className="tabular-nums">{clock(next.at)} · {nextWords}</span></p> : null}
      </section>
    </div>
  );

  return (
    <div className="rota-board">
      <header className="rota-day-head">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={`rota-day-${date}`} className="rota-day-title">{heading}</h2>
          <dl className="rota-day-stats tabular-nums">
            <div><dt>On</dt><dd>{shownPeople.length} {shownPeople.length === 1 ? "person" : "people"}</dd></div>
            <div><dt>Paid</dt><dd>{duration(paid)}</dd></div>
            <div><dt>Unpaid breaks</dt><dd>{duration(unpaid)}</dd></div>
          </dl>
        </div>
        <div className="rota-day-actions">
          {toCheck.length ? (
            <Button type="button" variant="outline" data-tone="warning" onClick={() => setSheet("checks")}><Coffee aria-hidden="true" />{toCheck.length} to check</Button>
          ) : null}
          {actions}
        </div>
        {note ? <p className="rota-day-note">{note}</p> : null}
      </header>

      {glance}

      <div className="rota-sheet-head">
        <h3 className="rota-glance-title">{mode === "people" ? "The day, person by person" : "The day, area by area"}</h3>
        <span className="rota-wide-only">{key}</span>
      </div>
      <div className="rota-toolbar">
        <SegmentedChoice aria-label="Show the day by" value={mode} onValueChange={(v) => chooseMode(v as Mode)}
          options={[{ value: "people", label: "By person", icon: Users, count: shownPeople.length }, { value: "needs", label: "By area", icon: LayoutList, count: openGaps.length || undefined }]} />
        {areas.length > 1 ? (
          <Select value={areaKey || ALL} onValueChange={(v) => setArea(v === ALL ? "" : v)}>
            <SelectTrigger className="rota-select" aria-label="Area"><MapPin aria-hidden="true" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All areas</SelectItem>
              {areas.filter((a) => a.place).map((a) => <SelectItem key={a.place} value={a.place.toLowerCase()}>{a.place}{a.gaps ? ` · ${a.gaps} to fill` : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : null}
        <span className="rota-wide-only rota-toolbar-time">
          <Select value={win || CUSTOM} onValueChange={(v) => { if (v !== CUSTOM) setView({ from: wins[v as WindowKey].from, to: wins[v as WindowKey].to }); }}>
            <SelectTrigger className="rota-select" aria-label="Time of day"><Clock3 aria-hidden="true" /><SelectValue /></SelectTrigger>
            <SelectContent>
              {WINDOW_KEYS.map((k) => <SelectItem key={k} value={k}>{k === "day" ? wins[k].label : `${wins[k].label} ${clock(wins[k].from).slice(0, 2)}–${clock(wins[k].to).slice(0, 2)}`}</SelectItem>)}
              {!win ? <SelectItem value={CUSTOM}>{`${clock(Math.round(from))}–${clock(Math.round(to))}`}</SelectItem> : null}
            </SelectContent>
          </Select>
          <span className="rota-tl-zoom-buttons" role="group" aria-label="Zoom the day">
            <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Zoom out" disabled={!zoomed} onClick={() => zoomBy(ZOOM_STEP)}><ZoomOut aria-hidden="true" /></Button>
            <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Zoom in" disabled={zoomedIn} onClick={() => zoomBy(1 / ZOOM_STEP)}><ZoomIn aria-hidden="true" /></Button>
            {zoomed ? <>
              <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="Earlier" disabled={from <= bounds.from + 0.5} onClick={() => moveBy(-MOVE_BY)}><ChevronLeft aria-hidden="true" /></Button>
              <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="Later" disabled={to >= bounds.to - 0.5} onClick={() => moveBy(MOVE_BY)}><ChevronRight aria-hidden="true" /></Button>
            </> : null}
          </span>
          <span className="rota-tl-hint" aria-live="polite">{zoomed ? "Drag the day to move" : ""}</span>
        </span>
        <span className="ms-auto flex flex-wrap items-center gap-2">
          {mode === "needs" && !everyDepartment ? (
            <span className="flex min-h-11 items-center gap-2">
              <Switch id={`rota-others-${date}`} checked={others} onCheckedChange={setOthers} />
              <Label htmlFor={`rota-others-${date}`} className="font-normal">Other departments</Label>
            </span>
          ) : null}
        </span>
      </div>

      <div className="rota-tl" ref={timeline} data-zoomed={zoomed ? "" : undefined} data-dragging={dragging ? "" : undefined}>
        {ruler}
        {mode === "people" ? <>
          {openRow}
          {shownPeople.map(personRow)}
          {!people.length ? <p className="rota-tl-empty">Nobody is on yet. Add staff gives someone a shift; then give its time to what needs people.</p> : null}
        </> : needsBoard}
      </div>

      <div className="rota-agenda">
        {mode === "people" ? <>
          <section aria-labelledby={`rota-people-${date}`} className="flex flex-col gap-3">
            <h3 id={`rota-people-${date}`} className="rota-agenda-title">Who&apos;s working <span className="rota-count">{shownPeople.length}</span></h3>
            {shownPeople.length ? (
              <PeoplePlan people={shownPeople} groups={allGroups} today={today} siteId={siteId} departmentId={departmentId} everyDepartment={everyDepartment} departmentNames={departmentNames} date={date} dateLabel={dateLabel} live={live} canChange={canChange} anyTypes={anyTypes} areaList={areaList} />
            ) : <EmptyState compact icon="users" title="Nobody on a shift yet" hint="Add staff gives someone a shift; then give its time to what needs people." />}
          </section>
        </> : zones.length ? zones.map((z) => (
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
                      const level = b.classRef ? b.detail : null;
                      const what = `${level ?? g.name} in ${g.place}, ${clock(b.start)} to ${clock(b.end)}`;
                      const who = b.kind === "gap" ? "Nobody yet" : off ? `${b.name} is off` : b.name;
                      const text = level
                        ? <span className="pc-row-body"><span className="pc-row-title">{level}</span>
                            <span className="pc-row-hint tabular-nums">{clock(b.start)} to {clock(b.end)} · {who}{b.count > 1 ? ` · ${b.count} classes` : ""}</span></span>
                        : <span className="pc-row-body"><span className="pc-row-title tabular-nums">{clock(b.start)} to {clock(b.end)}</span>
                            <span className="pc-row-hint">{who}{b.count > 1 ? ` · ${b.count} classes` : b.detail ? ` · ${b.detail}` : ""}</span></span>;
                      const trail = <span className="pc-row-trail">{needsCover(b) ? <Tag meta={ROTA_DAY_META.gaps} label={off ? "Cover needed" : "Gap"} /> : null}{canChange ? <ChevronRight aria-hidden="true" className="pc-row-chevron" /> : null}</span>;
                      if (!canChange || g.href) return <li key={i}><div className="pc-row" {...(needsCover(b) ? { "data-first": "" } : {})}>{text}{trail}</div></li>;
                      if (needsCover(b) || b.classRef) {
                        return <li key={i}><Button type="button" variant="outline" className={ROW} onClick={() => openGap(g, b, b.refs)} aria-label={`${what}. ${needsCover(b) ? "Choose someone" : "Change who teaches"}`} {...(needsCover(b) ? { "data-first": "" } : {})}>{text}{trail}</Button></li>;
                      }
                      return <li key={i}>{b.assignmentId ? (
                        <AssignmentDialog live={live} assignment={{ id: b.assignmentId, needId: b.needId!, place: b.place!, userId: b.userId!, name: b.name ?? "", start: b.start, end: b.end, what: `${g.name} in ${g.place}` }}
                          change={changeOf(b)} onHandOver={handOverOf(g, b)} trigger={<Button type="button" variant="outline" className={ROW} aria-label={`${b.name}, ${what}`}>{text}{trail}</Button>} />
                      ) : <div className="pc-row">{text}</div>}</li>;
                    })}
                  </ul>
                </div>
              );
            })}
          </section>
        )) : <EmptyState compact icon="calendarDays" title="Nothing needs people yet" hint="Add what the day needs with Add activity; bookings, area needs and swim classes appear on their own." />}
      </div>

      <Sheet open={sheet !== null} onOpenChange={(o) => { if (!o) setSheet(null); }}>
        <SheetContent portalClassName="turnfin-module" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
          {sheet === "gaps" ? <>
            <SheetHeader className="p-6 pb-4">
              <SheetTitle>{openGaps.length ? `${openGaps.length} ${openGaps.length === 1 ? "place" : "places"} to fill` : "Everything is covered"}</SheetTitle>
              <SheetDescription>{dateLabel}{areaKey ? `, ${shownAreas[0]?.place}` : ""}. Soonest first. Choose one to see who could do it, best fit first.</SheetDescription>
            </SheetHeader>
            <div className="px-6 pb-6">
              {openGaps.length ? <GapList gaps={openGaps} canChange={canChange} whereOf={(x) => whereOf(x.row.group, x.row.need, x.block)} onFill={fillOpen} />
                : <p className="text-sm">Every place on the day has someone on it.</p>}
            </div>
          </> : sheet === "checks" ? <>
            <SheetHeader className="p-6 pb-4">
              <SheetTitle>{toCheck.length} {toCheck.length === 1 ? "person" : "people"} to check</SheetTitle>
              <SheetDescription>{dateLabel}. Breaks to place, a break that needs cover, under-18 rest or a warning on what they are on. Nothing here stops the plan.</SheetDescription>
            </SheetHeader>
            <ul className="pc-rows px-6 pb-6" aria-label="People to check">
              {toCheck.map((p) => (
                <li key={p.userId}>
                  <Button type="button" variant="outline" className={ROW} onClick={() => { setSheet(null); setOpenPerson(p.userId); }} aria-label={`${p.name}: ${checkLabel(p)}. Open their shift`}>
                    <Avatar size="lg" aria-hidden="true"><AvatarFallback>{initials(p.name)}</AvatarFallback></Avatar>
                    <span className="pc-row-body"><span className="pc-row-title">{p.name}</span>
                      <span className="pc-row-hint tabular-nums">{p.shift.parts.map((x) => `${clock(x.start)}–${clock(x.end)}`).join(", ")}</span></span>
                    <span className="pc-row-trail"><Tag meta={p.rest.length ? ROTA_SHIFT_NOTE_META.young : ROTA_SHIFT_NOTE_META.noBreak} label={checkLabel(p)} /><ChevronRight aria-hidden="true" className="pc-row-chevron" /></span>
                  </Button>
                </li>
              ))}
            </ul>
          </> : null}
        </SheetContent>
      </Sheet>
      <FillSheet gap={gap} live={live} onClose={() => { setGap(null); setSelected(null); }} />
      <ShiftSheet person={person} groups={allGroups} today={today} onClose={() => setOpenPerson(null)} siteId={siteId} departmentId={person ? forPerson(person) : departmentId} departmentNames={departmentNames} date={date} dateLabel={dateLabel} live={live} canChange={canChange} anyTypes={anyTypes} areaList={areaList} />
      <Sheet open={!!free && !!freePerson} onOpenChange={(o) => { if (!o) setFree(null); }}>
        <SheetContent portalClassName="turnfin-module" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
          {free && freePerson ? (
            <FreeBody key={`${free.userId}-${free.start}`} person={freePerson} free={free} siteId={siteId} departmentId={forPerson(freePerson)} departmentNames={departmentNames} anyTypes={anyTypes} areaList={areaList}
              date={date} dateLabel={dateLabel} live={live} canChange={canChange}
              onDone={() => { setFree(null); router.refresh(); }} onOpenDay={() => { setFree(null); setOpenPerson(freePerson.userId); }} />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Places to fill as a list: what, where, when and why, each opening who could do it. */
function GapList({ gaps, canChange, whereOf, onFill }: { gaps: OpenGap[]; canChange: boolean; whereOf: (x: OpenGap) => string; onFill: (x: OpenGap) => void }) {
  return (
    <ul className="pc-rows" aria-label="Places to fill, soonest first">
      {gaps.map((x) => {
        const Icon = activityIcon(x.row.group.icon);
        const body = <>
          <span className="pc-tile-icon" aria-hidden="true"><Icon /></span>
          <span className="pc-row-body">
            <span className="pc-row-title">{x.what}</span>
            <span className="pc-row-hint tabular-nums">{clock(x.start)}–{clock(x.end)} · {whereOf(x)}</span>
            <span className="pc-row-hint">{x.why}</span>
          </span>
        </>;
        return (
          <li key={x.key}>{canChange ? (
            <Button type="button" variant="outline" className={ROW} onClick={() => onFill(x)} aria-label={`${x.what}, ${clock(x.start)} to ${clock(x.end)}, ${whereOf(x)}: ${x.why}. Choose someone`}>
              {body}<span className="pc-row-trail"><span className="rota-fill-cta">Choose<ChevronRight aria-hidden="true" /></span></span>
            </Button>
          ) : <div className="pc-row">{body}</div>}</li>
        );
      })}
    </ul>
  );
}

/** The unpaid time between the parts of a split shift. */
function splitGaps(p: Person) {
  return p.shift.parts.slice(1).map((x, i) => ({ start: p.shift.parts[i].end, end: x.start })).filter((x) => x.end > x.start);
}

/** Back-to-back swim classes on someone's row as one block when the day is too narrow to read them. */
function mergeRuns(list: { g: Group; b: Shown }[]) {
  const out: { g: Group; b: Shown }[] = [];
  for (const x of list) {
    const last = out[out.length - 1];
    if (last && last.g.key === x.g.key && x.b.classRef && last.b.classRef && last.b.end === x.b.start) {
      last.b = { ...last.b, end: x.b.end, count: last.b.count + 1, refs: [...last.b.refs, x.b.classRef], detail: levels(last.b.detail, x.b.detail), warnings: [...new Set([...last.b.warnings, ...x.b.warnings])] };
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
              <OptionRow key={o.key} option={o} person={p} siteId={ctx.siteId} date={ctx.date} live={ctx.live} canChange={ctx.canChange} onDone={onDone} within={free} departmentId={departmentId}
                lentTo={o.departmentId !== departmentId && o.departmentId !== ANY_DEPARTMENT ? departmentNames[o.departmentId] ?? "another department" : null} />
            ))}
          </ul>
        ) : <p className="text-sm">Nothing on the day needs someone then.</p>}
        {ctx.canChange && anyTypes.length ? <AnyActivity person={p} within={free} types={anyTypes} areas={areaList} siteId={ctx.siteId} departmentId={departmentId} date={ctx.date} live={ctx.live} onDone={onDone} /> : null}
        <Button type="button" variant="outline" className="self-start" onClick={onOpenDay}>Open {firstName(p.name)}&apos;s shift and breaks</Button>
      </div>
    </>
  );
}
