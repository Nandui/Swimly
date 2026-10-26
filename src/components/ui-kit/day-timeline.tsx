import Link from "next/link";
import { Button } from "@/components/shadcn/button";
import { leftOf, stretchOf } from "@/components/ui-kit/scale";

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
};

/** The day as Calendar-style lanes of blocks with the red now line (DESIGN.md, DayTimeline). The
 *  caller places it in a card with its title and decides every word; the kit only draws. Times are
 *  minutes after midnight, `from` to `to`; `now` outside that range draws no line. With
 *  `onSelect` (a client caller) every block is a button that hands back its key, for an
 *  Inspector; `selected` rings the one that is open. */
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
  return (
    <div role="group" aria-label={label} className="day-tl">
      <span aria-hidden="true" className="day-tl-corner" />
      <div aria-hidden="true" className="day-tl-axis">
        {hours.map((hour, index) => (
          <span key={hour.at} className={`day-tl-hour ${leftOf(at(hour.at))}`} data-edge={index === 0 ? "start" : index === hours.length - 1 ? "end" : undefined}>{hour.label}</span>
        ))}
        {showNow ? <span className={`day-tl-pill ${leftOf(at(now))}`}>{nowLabel}</span> : null}
      </div>
      <div aria-hidden="true" className="day-tl-labels">
        {lanes.map((lane) => <span key={lane.key} className="day-tl-label">{lane.label}</span>)}
      </div>
      <div className="day-tl-lanes">
        {hours.slice(1, -1).map((hour) => <span key={hour.at} aria-hidden="true" className={`day-tl-line ${leftOf(at(hour.at))}`} />)}
        {lanes.map((lane) => (
          <div key={lane.key} role="list" aria-label={lane.label} className="day-tl-lane">
            {blocks.filter((block) => block.lane === lane.key).map((block) => {
              const place = stretchOf(at(Math.max(block.start, from)), at(Math.min(block.end, to)));
              const body = <>{block.label}{block.sub ? <span>{block.sub}</span> : null}</>;
              return (
                <span key={block.key} role="listitem" className="contents">
                  {onSelect
                    ? <Button type="button" variant="ghost" className={`day-tl-block ${place}`} data-kind={block.kind} aria-label={block.ariaLabel}
                        aria-haspopup="dialog" aria-expanded={selected === block.key} onClick={() => onSelect(block.key)}>{body}</Button>
                    : block.href
                    ? <Link href={block.href} className={`day-tl-block ${place}`} data-kind={block.kind} aria-label={block.ariaLabel}>{body}</Link>
                    : <span className={`day-tl-block ${place}`} data-kind={block.kind} aria-label={block.ariaLabel} role="img">{body}</span>}
                </span>
              );
            })}
          </div>
        ))}
        {showNow ? <span aria-hidden="true" className={`day-tl-now ${leftOf(at(now))}`} /> : null}
      </div>
    </div>
  );
}
