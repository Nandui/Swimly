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

/** The day as Calendar-style lanes of blocks with the red now line (DESIGN.md, DayTimeline). The
 *  caller places it in a card with its title and decides every word; the kit only draws. Times are
 *  minutes after midnight, `from` to `to`; `now` outside that range draws no line. With
 *  `onSelect` (a client caller) every block is a button that hands back its key, for an
 *  Inspector; `selected` rings the one that is open. Blocks that overlap in time take rows of their
 *  own within their lane, as Calendar stacks them, so no two are ever drawn over each other. */
export function DayTimeline({ from, to, now, nowLabel, hours, lanes, blocks, label, onSelect, selected = null }: {
  from: number;
  to: number;
  now: number;
  nowLabel: string;
  /** The hour marks along the top: where and what they say ("15:00"). */
  hours: { at: number; label: string }[];
  lanes: { key: string; label: string }[];
  blocks: DayTimelineBlock[];
  /** Names the timeline for screen readers: "Riverside today". */
  label: string;
  onSelect?: (key: string) => void;
  selected?: string | null;
}) {
  const span = Math.max(1, to - from);
  const at = (minutes: number) => (minutes - from) / span;
  const showNow = now >= from && now <= to;
  const block = (b: DayTimelineBlock) => {
    const place = stretchOf(at(Math.max(b.start, from)), at(Math.min(b.end, to)));
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
    return (
      <span key={b.key} role="listitem" className="contents">
        {onSelect
          ? <Button type="button" variant="ghost" className={`day-tl-block ${place}`} data-kind={b.kind} aria-label={b.ariaLabel}
              aria-haspopup="dialog" aria-expanded={selected === b.key} onClick={() => onSelect(b.key)}>{body}</Button>
          : b.href
          ? <Link href={b.href} className={`day-tl-block ${place}`} data-kind={b.kind} aria-label={b.ariaLabel}>{body}</Link>
          : <span className={`day-tl-block ${place}`} data-kind={b.kind} aria-label={b.ariaLabel} role="img">{body}</span>}
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
      {lanes.map((lane) => (
        <Fragment key={lane.key}>
          <span aria-hidden="true" className="day-tl-label">{lane.label}</span>
          <div role="list" aria-label={lane.label} className="day-tl-lane">
            {hours.slice(1, -1).map((hour) => <span key={hour.at} aria-hidden="true" className={`day-tl-line ${leftOf(at(hour.at))}`} />)}
            {rowsOf(blocks.filter((b) => b.lane === lane.key)).map((row, index) => <div key={index} className="day-tl-row">{row.map(block)}</div>)}
            {showNow ? <span aria-hidden="true" className={`day-tl-now ${leftOf(at(now))}`} /> : null}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

/** A lane's blocks on as few rows as hold them without overlap: each goes on the first row that is
 *  free by its start. An empty lane keeps one row. */
export function rowsOf(blocks: DayTimelineBlock[]): DayTimelineBlock[][] {
  const rows: DayTimelineBlock[][] = [];
  for (const b of [...blocks].sort((x, y) => x.start - y.start || x.end - y.end)) {
    const row = rows.find((r) => r[r.length - 1].end <= b.start);
    if (row) row.push(b);
    else rows.push([b]);
  }
  return rows.length ? rows : [[]];
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
