import { Fragment } from "react";
import Link from "next/link";
import { Button } from "@/components/shadcn/button";
import { heightOf, leftOf, stretchOf, topOf } from "@/components/ui-kit/scale";

/** A block's look (DESIGN.md, DayTimeline): done in the quiet fill, on now in the fin blue, next in
 *  grey, a gap to fill in orange, covered in green, a booking hatched, cancelled struck through.
 *  The words carry the meaning too; the colour only repeats it. */
export type DayTimelineKind = "done" | "now" | "next" | "gap" | "ok" | "book" | "off";

export type DayTimelineBlock = {
  key: string;
  lane: string;
  /** More lanes it takes at once, in the same group as `lane`: two lanes of a pool, or all of
   *  them. It is drawn as one block across the ones that sit together. */
  lanes?: string[];
  /** Minutes after midnight. */
  start: number;
  end: number;
  kind: DayTimelineKind;
  label: string;
  /** A second line, such as "6 booked". */
  sub?: string;
  /** Where the block opens; without one (and without `onSelect`) it is plain. */
  href?: string;
  /** The whole sentence a screen reader reads: "Starfish, 16:00 to 16:30, finished". */
  ariaLabel: string;
  /** Named stretches inside the block, such as a duty's tasks, drawn as segments within it. The
   *  block's own name moves to the widest stretch they leave free, and goes when they leave none
   *  (owner, 12 November 2026); `ariaLabel` still says it all. */
  parts?: DayTimelinePart[];
};

/** A stretch inside a block: minutes after midnight, and what it says ("Till 2"). */
export type DayTimelinePart = { start: number; end: number; label: string };

/** A lane. One with `under` is a part of the lane with that key (a pool's lane, an area's part)
 *  and is drawn beneath it, in the order given; the lane it is under heads the group. */
export type DayTimelineLane = { key: string; label: string; under?: string };

/** The day as Calendar-style lanes of blocks with the red now line (DESIGN.md, DayTimeline). The
 *  caller places it in a card with its title and decides every word; the kit only draws. Times are
 *  minutes after midnight, `from` to `to`; `now` outside that range draws no line. With
 *  `onSelect` (a client caller) every block is a button that hands back its key, for an
 *  Inspector; `selected` rings the one that is open. Blocks that overlap in time take rows of their
 *  own within their lane, as Calendar stacks them, so no two are ever drawn over each other. Lanes
 *  can be grouped (`under`): the group's own lane first, its parts beneath, and a block that takes
 *  several of them grows to fill them (owner, 11 November 2026). */
export function DayTimeline({ from, to, now, nowLabel, hours, lanes, blocks, label, onSelect, selected = null }: {
  from: number;
  to: number;
  now: number;
  nowLabel: string;
  /** The hour marks along the top: where and what they say ("15:00"). */
  hours: { at: number; label: string }[];
  lanes: DayTimelineLane[];
  blocks: DayTimelineBlock[];
  /** Names the timeline for screen readers: "Riverside today". */
  label: string;
  onSelect?: (key: string) => void;
  selected?: string | null;
}) {
  const span = Math.max(1, to - from);
  const at = (minutes: number) => (minutes - from) / span;
  const showNow = now >= from && now <= to;
  const piece = ({ block: b, row, span: rows, first }: DayTimelinePiece) => {
    const place = `${stretchOf(at(Math.max(b.start, from)), at(Math.min(b.end, to)))} row-start-${row} row-end-${row + rows}`;
    const name = <><span className="day-tl-name">{b.label}</span>{b.sub ? <span className="day-tl-sub">{b.sub}</span> : null}</>;
    const laid = partsIn(b);
    // Parts sit by their share of the block; the name needs a free stretch wide enough to read.
    const within = (minutes: number) => (minutes - b.start) / Math.max(1, b.end - b.start);
    const room = laid.free && (laid.free.end - laid.free.start) / span >= 0.06 ? laid.free : null;
    const body = laid.parts.length === 0 ? name : <>
      <span className="day-tl-parts" data-rows={laid.rows > 2 ? "many" : undefined}>
        {laid.parts.map((p, index) => (
          <span key={index} className={`day-tl-part ${stretchOf(within(p.start), within(p.end))} ${topOf(p.row / laid.rows)} ${heightOf(1 / laid.rows)}`}><span className="day-tl-part-name">{p.label}</span></span>
        ))}
      </span>
      {room ? <span className={`day-tl-room ${stretchOf(within(room.start), within(room.end))}`}>{name}</span> : null}
    </>;
    const tall = rows > 1 ? "" : undefined;
    // A block in two pieces (lanes that don't sit together) is read, and tabbed to, once.
    return (
      <span key={`${b.key}#${row}`} role={first ? "listitem" : undefined} aria-hidden={first ? undefined : true} className="contents">
        {onSelect
          ? <Button type="button" variant="ghost" className={`day-tl-block ${place}`} data-kind={b.kind} data-tall={tall} aria-label={b.ariaLabel} tabIndex={first ? undefined : -1}
              aria-haspopup="dialog" aria-expanded={selected === b.key} onClick={() => onSelect(b.key)}>{body}</Button>
          : b.href
          ? <Link href={b.href} className={`day-tl-block ${place}`} data-kind={b.kind} data-tall={tall} aria-label={b.ariaLabel} tabIndex={first ? undefined : -1}>{body}</Link>
          : <span className={`day-tl-block ${place}`} data-kind={b.kind} data-tall={tall} aria-label={b.ariaLabel} role="img">{body}</span>}
      </span>
    );
  };
  return (
    <div role="group" aria-label={label} className="day-tl">
      <span aria-hidden="true" className="day-tl-corner" />
      <div aria-hidden="true" className="day-tl-axis">
        {hours.map((hour, index) => (
          <span key={hour.at} className={`day-tl-hour ${leftOf(at(hour.at))}`} data-edge={index === 0 ? "start" : index === hours.length - 1 ? "end" : undefined}>{hour.label}</span>
        ))}
        {showNow ? <span className={`day-tl-pill ${leftOf(at(now))}`}>{nowLabel}</span> : null}
      </div>
      {bandsOf(lanes, blocks).map((band) => (
        <Fragment key={band.key}>
          <div aria-hidden="true" className="day-tl-labels">
            {band.lanes.map((lane) => <span key={lane.key} className={`day-tl-label row-start-${lane.row} row-end-${lane.row + lane.span}`} data-role={lane.role}>{lane.label}</span>)}
          </div>
          <div role="list" aria-label={band.label} className="day-tl-lane">
            {Array.from({ length: band.rows }, (_, index) => (
              <span key={index} aria-hidden="true" className="day-tl-row" data-edge={index > 0 && band.lanes.some((lane) => lane.row === index + 1) ? "lane" : undefined} />
            ))}
            {hours.slice(1, -1).map((hour) => <span key={hour.at} aria-hidden="true" className={`day-tl-line ${leftOf(at(hour.at))}`} />)}
            {band.pieces.map(piece)}
            {showNow ? <span aria-hidden="true" className={`day-tl-now ${leftOf(at(now))}`} /> : null}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

/** One drawn block: the grid row it starts on (from 1) and how many rows it fills. A block whose
 *  lanes don't sit together is drawn in pieces; `first` marks the one that is read out. */
export type DayTimelinePiece = { block: DayTimelineBlock; row: number; span: number; first: boolean };
/** A lone lane, or a group: the lane that heads it and its parts, as rows of one grid. */
export type DayTimelineBand = {
  key: string;
  label: string;
  rows: number;
  lanes: { key: string; label: string; role: "lone" | "head" | "part"; row: number; span: number }[];
  pieces: DayTimelinePiece[];
};

const meet = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && b.start < a.end;

/** Where everything is drawn. Each lane holds as few rows as its blocks need without overlap (each
 *  block on the first row free for it; an empty lane keeps one). A block then grows over every row
 *  that is free for its whole time in the lanes it takes, so one that takes two lanes fills both
 *  and one alone in a lane of two rows fills the lane; the rows it holds that sit together are one
 *  piece. Nothing is ever drawn over anything else. */
export function bandsOf(lanes: readonly DayTimelineLane[], blocks: readonly DayTimelineBlock[]): DayTimelineBand[] {
  const known = new Set(lanes.map((l) => l.key));
  const heads = lanes.filter((l) => !l.under || l.under === l.key || !known.has(l.under));
  return heads.map((head) => {
    const parts = lanes.filter((l) => l.under === head.key && l.key !== head.key);
    const members = [head, ...parts];
    const index = new Map(members.map((l, i) => [l.key, i]));
    const mine = blocks.filter((b) => index.has(b.lane))
      .map((block) => ({ block, at: [...new Set([block.lane, ...(block.lanes ?? [])].flatMap((k) => index.get(k) ?? []))].sort((x, y) => x - y), cells: [] as [number, number][] }))
      .sort((x, y) => x.block.start - y.block.start || y.at.length - x.at.length || x.block.end - y.block.end);
    // taken[lane][row]: the times already held there.
    const taken: { start: number; end: number }[][][] = members.map(() => [[]]);
    const free = (lane: number, row: number, b: DayTimelineBlock) => !taken[lane][row].some((s) => meet(s, b));
    for (const m of mine) for (const lane of m.at) {
      let row = taken[lane].findIndex((_, r) => free(lane, r, m.block));
      if (row < 0) row = taken[lane].push([]) - 1;
      taken[lane][row].push(m.block);
      m.cells.push([lane, row]);
    }
    for (const m of mine) for (const lane of m.at) taken[lane].forEach((spans, row) => {
      if (m.cells.some(([l, r]) => l === lane && r === row) || !free(lane, row, m.block)) return;
      spans.push(m.block);
      m.cells.push([lane, row]);
    });
    const first = members.map((_, i) => taken.slice(0, i).reduce((sum, rows) => sum + rows.length, 0));
    const pieces = mine.flatMap((m) => {
      const rows = m.cells.map(([lane, row]) => first[lane] + row).sort((x, y) => x - y);
      const runs: { row: number; span: number }[] = [];
      for (const r of rows) {
        const last = runs[runs.length - 1];
        if (last && last.row + last.span === r) last.span += 1;
        else runs.push({ row: r, span: 1 });
      }
      return runs.map((run, i) => ({ block: m.block, row: run.row + 1, span: run.span, first: i === 0 }));
    });
    return {
      key: head.key, label: head.label, rows: taken.reduce((sum, rows) => sum + rows.length, 0), pieces,
      lanes: members.map((l, i) => ({ key: l.key, label: l.label, role: parts.length === 0 ? "lone" as const : i === 0 ? "head" as const : "part" as const, row: first[i] + 1, span: taken[i].length })),
    };
  });
}

/** A block's parts laid out: each kept inside the block and put on the first row free by its start
 *  (parts at the same time share the block's height), and the widest stretch no part covers, where
 *  the block's own name can go. */
export function partsIn(block: Pick<DayTimelineBlock, "start" | "end" | "parts">): {
  rows: number;
  parts: (DayTimelinePart & { row: number })[];
  free: { start: number; end: number } | null;
} {
  const inside = (block.parts ?? []).map((p) => ({ ...p, start: Math.max(p.start, block.start), end: Math.min(p.end, block.end) }))
    .filter((p) => p.end > p.start).sort((x, y) => x.start - y.start || x.end - y.end);
  const ends: number[] = [];
  const parts = inside.map((p) => {
    let row = ends.findIndex((end) => end <= p.start);
    if (row < 0) row = ends.push(p.end) - 1;
    else ends[row] = p.end;
    return { ...p, row };
  });
  const gaps: { start: number; end: number }[] = [];
  let at = block.start;
  for (const p of inside) { gaps.push({ start: at, end: p.start }); at = Math.max(at, p.end); }
  gaps.push({ start: at, end: block.end });
  const free = gaps.filter((g) => g.end > g.start).reduce<{ start: number; end: number } | null>((best, g) => (best && best.end - best.start >= g.end - g.start ? best : g), null);
  return { rows: Math.max(1, ends.length), parts, free };
}
