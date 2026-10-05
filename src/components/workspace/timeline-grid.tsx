import Link from "next/link";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn/tooltip";
import { TimelineReadout } from "@/components/workspace/timeline-readout";
import { formatTime, formatTimeRange } from "@/lib/format";

/** The one day-at-a-glance timeline (DESIGN.md, "Poolside Clear v2"): the home page's classes
 *  and Rota's Day plan and Today. Each lane is one rounded row like any list row: its name (an
 *  optional icon, a label, a caption and a 44px action) and its time track, with faint hour
 *  lines and the past shaded. Hours read along the top, blocks sit to the minute on 5-minute
 *  columns, and one dashed line under a "now" pill marks the time now. A planning timeline
 *  (`readout`) reads out the exact quarter hour under the pointer on the time bar. Nothing scrolls
 *  sideways: from 1280px the grid shows; below it the same blocks become an agenda in time
 *  order with the same links and dialog triggers. Server-safe, and free of any module. */

/** A block's state picks its fill (`--pc-block-*`) and text (`--pc-on-block-*`). */
export type TimelineState = "done" | "now" | "next" | "cover" | "off" | "absent" | "open" | "assessment" | "shift";
/** Every block says its state in words and an icon, so colour is never the only signal. */
export type TimelineTag = { icon: LucideIcon; label: string };
/** What a dialog trigger needs to become a block: the caller hands these to its trigger. */
export type TimelineDensity = "full" | "compact" | "icon" | "mark";
export type TimelineTriggerParts = { label: string; className: string; style?: CSSProperties; children: ReactNode; block: { state: TimelineState; density: TimelineDensity } };

export type TimelineLane = {
  key: string;
  label: string;
  caption?: string;
  icon?: LucideIcon;
  /** A 44px way in that belongs to the whole lane (edit, assign, change the duty). */
  action?: ReactNode;
  /** A group heading (a department, Activities): a tile in ink with no time track. */
  header?: boolean;
  /** The lane's name as a button that opens its editor (`.pc-timeline-lane-link`): the whole
   *  name tile is the target, so a lane needs no separate edit icon. Its text is the label. */
  edit?: ReactNode;
};

export type TimelineBlock = {
  key: string;
  lane: string;
  /** A second line in the lane when blocks overlap (0 first). */
  row?: number;
  start: number;
  end: number;
  state: TimelineState;
  title: string;
  hint?: string;
  tag: TimelineTag;
  /** More tags beside it when there is room (teaching inside a shift, say). Not interactive. */
  extra?: TimelineTag[];
  /** Thin marks along the block's bottom: what happens inside it (activities and breaks). */
  strip?: { start: number; end: number; label: string; kind: "activity" | "break" }[];
  /** The agenda's line under the title; the lane's label when not given. */
  agendaHint?: string;
  /** Spoken name; the title, times and state when not given. */
  label?: string;
  href?: string;
  /** A dialog trigger built from the parts (it must render them on a shadcn Button). */
  render?: (parts: TimelineTriggerParts) => ReactNode;
};

/** The width the time track has at the narrowest screen showing the grid (1280px). */
const TRACK_PX = 790;
const STEP = 5;
/** Whether the "now" pill (centred on the time, about 52px wide) would cover an hour's label
 *  (about 40px from its tick), given how far past the hour now is, in pixels. */
const overlapsNow = (px: number) => px > -34 && px < 74;

export function TimelineGrid({ from, to, now, lanes, blocks, laneHeading, label, agenda, readout }: {
  /** Minutes after midnight; `from` on the hour. */
  from: number;
  to: number;
  /** Minutes after midnight, or null when the day shown is not today. */
  now: number | null;
  lanes: TimelineLane[];
  blocks: TimelineBlock[];
  /** Over the lane column, e.g. "Pool area". */
  laneHeading?: string;
  /** Names the grid and the agenda for screen readers. */
  label: string;
  /** Which blocks the agenda lists, how many, and what it says when it lists none. */
  agenda?: { show?: (block: TimelineBlock) => boolean; limit?: number; empty?: string };
  /** A planning timeline: the time bar reads out the exact quarter hour under the pointer. */
  readout?: boolean;
}) {
  const range = Math.max(STEP, to - from);
  // How wide a minute is at the narrowest screen showing the grid.
  const pxPerMinute = TRACK_PX / range;
  const cols = Math.ceil(range / STEP);
  const col = (m: number) => 2 + Math.floor((Math.min(Math.max(m, from), to) - from) / STEP);
  const colEnd = (m: number) => 2 + Math.ceil((Math.min(Math.max(m, from), to) - from) / STEP);
  // Hour tiles every hour, or every two when the day is long.
  const hourStep = range > 12 * 60 ? 120 : 60;
  const hours: number[] = [];
  for (let h = from; h < to; h += hourStep) hours.push(h);
  // The track as drawn (whole 5-minute columns), for its hour lines and its shaded past.
  const span = cols * STEP;
  const pct = (m: number) => `${((Math.min(Math.max(m, 0), span) / span) * 100).toFixed(3)}%`;
  const trackStyle = { ["--tl-hour" as string]: pct(hourStep), ["--tl-past" as string]: now === null ? "0%" : pct(now - from) };

  // Each lane takes as many lines as its blocks need.
  const sizes = lanes.map((lane) => lane.header ? 1 : Math.max(1, ...blocks.filter((b) => b.lane === lane.key).map((b) => (b.row ?? 0) + 1)));
  const placed = lanes.map((lane, i) => ({ lane, lines: sizes[i], at: 2 + sizes.slice(0, i).reduce((n, s) => n + s, 0) }));
  const rowOf = new Map(placed.map((p) => [p.lane.key, p.at]));
  const lastRow = 2 + sizes.reduce((n, s) => n + s, 0);
  const nowShown = now !== null && now >= from && now <= to;
  // Stretches of rows between group headings, for the now line.
  const runs: [number, number][] = [];
  for (const p of placed) {
    if (p.lane.header) continue;
    const last = runs.at(-1);
    if (last && last[1] === p.at) last[1] = p.at + p.lines; else runs.push([p.at, p.at + p.lines]);
  }

  return (
    <>
      <TimelineReadout className="pc-timeline-wide" range={readout ? { from, span } : null}>
        <div role="group" aria-label={label} className="pc-timeline" style={{ ["--tl-cols" as string]: cols, gridTemplateRows: `var(--tl-head) repeat(${lastRow - 2}, var(--tl-row))` }}>
          {laneHeading ? <span className="pc-timeline-heading" style={{ gridColumn: 1, gridRow: 1 }}>{laneHeading}</span> : null}
          {hours.map((hour) => (
            <span key={hour} className="pc-timeline-hour" style={{ gridColumn: `${col(hour)} / ${colEnd(Math.min(hour + hourStep, to))}`, gridRow: 1 }}
              data-past={now !== null && hour + hourStep <= now ? "" : undefined}>
              {/* The "now" pill takes the place of an hour it would sit on. */}
              {nowShown && overlapsNow((now - hour) * pxPerMinute) ? null : formatTime(hour)}
            </span>
          ))}
          {nowShown ? (
            <span className="pc-timeline-now-label" style={{ gridColumn: col(now), gridRow: 1, ["--at" as string]: `${(((now - from) % STEP) / STEP) * 100}%` }}>
              <span className="sr-only">Now, </span>{formatTime(now)}
            </span>
          ) : null}
          {/* A lane is one row: its name, then its track with hour lines and the past shaded. */}
          {placed.map(({ lane, at, lines }) => lane.header ? (
            <LaneTile key={lane.key} lane={lane} style={{ gridColumn: "1 / -1", gridRow: at }} />
          ) : (
            <Fragment key={lane.key}>
              <span aria-hidden="true" className="pc-timeline-row" style={{ gridColumn: "1 / -1", gridRow: `${at} / span ${lines}` }} />
              <span aria-hidden="true" className="pc-timeline-track" style={{ ...trackStyle, gridColumn: "2 / -1", gridRow: `${at} / span ${lines}` }} />
              <LaneTile lane={lane} style={{ gridColumn: 1, gridRow: `${at} / span ${lines}` }} />
            </Fragment>
          ))}
          {blocks.map((block) => {
            const at = rowOf.get(block.lane);
            if (at === undefined) return null;
            const width = (Math.min(block.end, to) - Math.max(block.start, from)) * pxPerMinute;
            return <Block key={block.key} block={block} roomy={width >= 240} density={width >= 120 ? "full" : width >= 44 ? "compact" : width >= 24 ? "icon" : "mark"}
              style={{ gridColumn: `${col(block.start)} / ${Math.max(colEnd(block.end), col(block.start) + 1)}`, gridRow: at + (block.row ?? 0) }} />;
          })}
          {/* One dashed line, broken only where a group heading crosses the track. */}
          {nowShown ? runs.map(([a, z]) => (
            <span key={a} aria-hidden="true" className="pc-timeline-now"
              style={{ gridColumn: col(now), gridRow: `${a} / ${z}`, ["--at" as string]: `${(((now - from) % STEP) / STEP) * 100}%` }} />
          )) : null}
        </div>
      </TimelineReadout>
      <Agenda lanes={lanes} blocks={blocks} label={label} show={agenda?.show} limit={agenda?.limit} empty={agenda?.empty} />
    </>
  );
}

function LaneTile({ lane, style }: { lane: TimelineLane; style?: CSSProperties }) {
  const Icon = lane.icon;
  return (
    <div className="pc-timeline-lane" data-header={lane.header ? "" : undefined} style={style}>
      {Icon ? <span className="pc-tile-icon"><Icon aria-hidden="true" /></span> : null}
      <span className="pc-timeline-lane-body">
        {lane.header ? <h3 className="pc-timeline-lane-label">{lane.label}</h3> : lane.edit ? <span className="pc-timeline-lane-label">{lane.edit}</span> : <span className="pc-timeline-lane-label">{lane.label}</span>}
        {lane.caption ? <span className="pc-timeline-lane-caption">{lane.caption}</span> : null}
      </span>
      {lane.action ? <span className="pc-timeline-lane-action">{lane.action}</span> : null}
    </div>
  );
}

/** `withHint` when the block shows its title alone, so the words it leaves out are still said. */
function spoken(block: TimelineBlock, withHint = false) {
  const extra = block.extra?.map((tag) => tag.label) ?? [];
  const hint = withHint && !block.label && block.hint && block.hint !== formatTimeRange(block.start, block.end) ? [block.hint] : [];
  return [block.label ?? `${block.title}, ${formatTimeRange(block.start, block.end)}, ${block.tag.label}`, ...hint, ...extra].join(", ");
}

function TagMark({ tag, iconOnly }: { tag: TimelineTag; iconOnly?: boolean }) {
  return <span className="pc-block-tag"><tag.icon aria-hidden="true" />{iconOnly ? <span className="sr-only">{tag.label}</span> : <span className="pc-block-tag-label">{tag.label}</span>}</span>;
}

function Strip({ block }: { block: TimelineBlock }) {
  if (!block.strip?.length) return null;
  const span = Math.max(1, block.end - block.start);
  const pct = (m: number) => `${(((m - block.start) / span) * 100).toFixed(3)}%`;
  return (
    <span className="pc-block-strip" aria-hidden="true">
      {block.strip.map((piece, i) => (
        <span key={i} className={piece.kind === "break" ? "rota-break" : undefined} data-kind={piece.kind} title={`${piece.label}, ${formatTimeRange(piece.start, piece.end)}`}
          style={{ left: pct(Math.max(piece.start, block.start)), width: `calc(${pct(Math.min(piece.end, block.end))} - ${pct(Math.max(piece.start, block.start))})` }} />
      ))}
    </span>
  );
}

/** One block, as dense as its width allows: its words and tag (labelled when `roomy`), the title
 *  alone, the icon alone (named and with a tooltip), or a plain mark too narrow to press, whose
 *  lane action and the agenda are the way in. Whatever is not shown is in the spoken label. */
function Block({ block, density, roomy, style }: { block: TimelineBlock; density: TimelineDensity; roomy: boolean; style: CSSProperties }) {
  if (density === "mark") {
    return <span aria-hidden="true" className="pc-block" data-block={block.state} data-density="mark" style={style} />;
  }
  // Compact blocks keep their room for the title; the hint and tag go into the spoken label.
  const children = density === "icon" ? <block.tag.icon aria-hidden="true" /> : density === "compact" ? (
    <>
      <span className="pc-block-body"><span className="pc-block-title">{block.title}</span></span>
      <Strip block={block} />
    </>
  ) : (
    <>
      <span className="pc-block-body"><span className="pc-block-title">{block.title}</span>{block.hint ? <span className="pc-block-hint tabular-nums">{block.hint}</span> : null}</span>
      <TagMark tag={block.tag} iconOnly={!roomy} />
      {roomy ? block.extra?.map((tag) => <TagMark key={tag.label} tag={tag} iconOnly />) : null}
      <Strip block={block} />
    </>
  );
  const className = "pc-block";
  const label = spoken(block, density === "compact");
  const element = block.render
    ? block.render({ label, className, style, children, block: { state: block.state, density } })
    : block.href
      ? <Link href={block.href} aria-label={label} className={className} data-block={block.state} data-density={density} style={style}>{children}</Link>
      : <span role="img" aria-label={label} className={className} data-block={block.state} data-density={density} style={style}>{children}</span>;
  // Blocks that leave words out (an icon, or a title alone that may be cut short) say all of it on hover.
  if (density === "full" || block.render) return element;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{element}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Below 1280px: the blocks in time order, under their group headings, each with its times,
 *  its words and a labelled tag, and its lane's action beside the lane's first block. */
function Agenda({ lanes, blocks, label, show, limit, empty }: {
  lanes: TimelineLane[]; blocks: TimelineBlock[]; label: string;
  show?: (block: TimelineBlock) => boolean; limit?: number; empty?: string;
}) {
  // Groups run from one header lane to the next.
  const groups: { head: TimelineLane | null; lanes: TimelineLane[] }[] = [{ head: null, lanes: [] }];
  for (const lane of lanes) {
    if (lane.header) groups.push({ head: lane, lanes: [] });
    else groups.at(-1)!.lanes.push(lane);
  }
  let left = limit ?? Infinity;
  const sections = groups.map((group) => {
    const keys = new Set(group.lanes.map((l) => l.key));
    const items = blocks.filter((b) => keys.has(b.lane) && (!show || show(b))).sort((a, b) => a.start - b.start || a.end - b.end).slice(0, Math.max(0, left));
    left -= items.length;
    // A lane with an action and nothing listed still offers it.
    const bare = group.lanes.filter((l) => l.action && !items.some((b) => b.lane === l.key));
    return { ...group, items, bare };
  }).filter((g) => g.items.length || g.bare.length || (g.head?.action));
  const byKey = new Map(lanes.map((l) => [l.key, l]));
  const actionShown = new Set<string>();

  return (
    <div className="pc-timeline-narrow" role="group" aria-label={label}>
      {sections.length === 0 ? <p className="text-sm text-ui-muted-foreground">{empty ?? "Nothing on this day."}</p> : sections.map((section, index) => (
        <section key={section.head?.key ?? `top${index}`} className="flex flex-col gap-2" aria-label={section.head?.label}>
          {section.head ? <LaneTile lane={section.head} /> : null}
          {section.items.length || section.bare.length ? (
            <ul className="flex flex-col gap-2">
              {section.items.map((block) => {
                const lane = byKey.get(block.lane);
                const action = lane?.action && !actionShown.has(lane.key) ? (actionShown.add(lane.key), lane.action) : null;
                return (
                  <li key={block.key} className="pc-agenda-item">
                    <AgendaBlock block={{ ...block, hint: block.agendaHint ?? lane?.label }} />
                    {action ? <span className="pc-timeline-lane-action">{action}</span> : null}
                  </li>
                );
              })}
              {section.bare.map((lane) => <li key={`${lane.key}:lane`}><LaneTile lane={lane} /></li>)}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  );
}

function AgendaBlock({ block }: { block: TimelineBlock }) {
  const children = (
    <>
      <span className="pc-block-time">{formatTime(block.start)}<small>to {formatTime(block.end)}</small></span>
      <span className="pc-block-body"><span className="pc-block-title">{block.title}</span>{block.hint ? <span className="pc-block-hint">{block.hint}</span> : null}</span>
      <TagMark tag={block.tag} />
      {block.extra?.map((tag) => <TagMark key={tag.label} tag={tag} iconOnly />)}
      <Strip block={block} />
    </>
  );
  const label = spoken(block);
  if (block.render) return block.render({ label, className: "pc-block", children, block: { state: block.state, density: "full" } });
  if (block.href) return <Link href={block.href} aria-label={label} className="pc-block" data-block={block.state}>{children}</Link>;
  return <span role="img" aria-label={label} className="pc-block" data-block={block.state}>{children}</span>;
}
