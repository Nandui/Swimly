import { Button } from "@/components/shadcn/button";
import { heightOf, spanOf, topOf } from "@/components/ui-kit/scale";

/** A block's look (DESIGN.md, DayCalendar): someone on something in the fin blue, a place to fill
 *  in orange with a dashed edge, a break in the quiet fill, free time as a dashed outline. The
 *  words carry the meaning too; the colour only repeats it. */
export type DayCalendarKind = "on" | "gap" | "break" | "free";

export type DayCalendarBlock = {
  key: string;
  /** What `onSelect` hands back, where two blocks open the same thing; else the key. */
  pick?: string;
  /** Minutes after midnight. */
  start: number;
  end: number;
  kind: DayCalendarKind;
  label: string;
  /** A second line, such as "14:00 to 17:00"; a short block leaves it out. */
  sub?: string;
  /** A third line, such as what is on there ("Public swim"); a short block leaves it out. */
  detail?: string;
  /** The whole sentence a screen reader reads: "Main pool, Lifeguard: Ann Example, 07:00 to 11:00". */
  ariaLabel: string;
  /** Named stretches inside the block, such as a duty's tasks: a deeper strip down its leading
   *  edge from each one's start to its end, and its words beneath the block's own where there is room. */
  parts?: { start: number; end: number; label: string }[];
};
export type DayCalendarColumn = { key: string; label: string; blocks: DayCalendarBlock[] };
/** Columns that belong together (an area), under one name with a note beside it ("1 needs someone"). */
export type DayCalendarGroup = { key: string; label: string; note?: React.ReactNode; columns: DayCalendarColumn[] };

/** The day as a calendar (DESIGN.md, DayCalendar): time runs down, each column is a place someone
 *  must be, and the red now line runs across, so reading along it says who is where. The caller
 *  decides every word and what goes in which column; the kit only draws. Times are minutes after
 *  midnight, `from` to `to`, with an hour mark for each hour between them; `now` outside that
 *  range draws no line. With `onSelect` (a client caller) every block is a button that hands back
 *  its `pick`, for an Inspector; `selected` rings the ones that are open. On phones `only` shows
 *  one group at a time (the caller offers the choice); wider, every group shows and the calendar
 *  scrolls sideways when its columns need more room. */
export function DayCalendar({ from, to, now, nowLabel, hours, groups, label, onSelect, selected = null, only }: {
  from: number;
  to: number;
  now: number;
  nowLabel: string;
  /** The hour marks down the side, both ends included: where and what they say ("15:00"). */
  hours: { at: number; label: string }[];
  groups: DayCalendarGroup[];
  /** Names the calendar for screen readers: "Riverside today, place by place". */
  label: string;
  onSelect?: (pick: string) => void;
  selected?: string | null;
  /** The key of the one group phones show. */
  only?: string;
}) {
  const span = Math.max(1, to - from);
  const at = (minutes: number) => (Math.min(Math.max(minutes, from), to) - from) / span;
  const showNow = now >= from && now <= to;
  const block = (b: DayCalendarBlock) => {
    const place = spanOf(at(b.start), at(b.end));
    const within = (minutes: number) => (Math.min(Math.max(minutes, b.start), b.end) - b.start) / Math.max(1, b.end - b.start);
    const parts = (b.parts ?? []).filter((p) => p.end > b.start && p.start < b.end);
    const short = b.end - b.start < 45 ? "" : undefined;
    const body = <>
      <span className="day-cal-name">{b.label}</span>
      {b.sub ? <span className="day-cal-sub">{b.sub}</span> : null}
      {b.detail ? <span className="day-cal-sub">{b.detail}</span> : null}
      {parts.map((p, index) => <span key={index} className="day-cal-task">{p.label}</span>)}
      {parts.map((p, index) => <span key={`strip${index}`} aria-hidden="true" className={`day-cal-strip ${topOf(within(p.start))} ${heightOf(within(p.end) - within(p.start))}`} />)}
    </>;
    const pick = b.pick ?? b.key;
    return (
      <span key={b.key} role="listitem" className="contents">
        {onSelect
          ? <Button type="button" variant="ghost" className={`day-cal-block ${place}`} data-kind={b.kind} data-short={short} aria-label={b.ariaLabel}
              aria-haspopup="dialog" aria-expanded={selected === pick} onClick={() => onSelect(pick)}>{body}</Button>
          : <span className={`day-cal-block ${place}`} data-kind={b.kind} data-short={short} aria-label={b.ariaLabel} role="img">{body}</span>}
      </span>
    );
  };
  return (
    <div role="group" aria-label={label} className="day-cal" data-only={only === undefined ? undefined : ""}>
      <div className="day-cal-grid">
        <div aria-hidden="true" className="day-cal-axis">
          <div className="day-cal-hours">
            {hours.slice(0, -1).map((hour, index) => <span key={hour.at} className="day-cal-hour" data-edge={index === 0 ? "start" : undefined}>{hour.label}</span>)}
            {showNow ? <span className={`day-cal-pill ${topOf(at(now))}`}>{nowLabel}</span> : null}
          </div>
        </div>
        {groups.map((group) => (
          <section key={group.key} aria-label={group.label} className={`day-cal-group col-span-${Math.max(1, group.columns.length)}`} data-on={only === group.key ? "" : undefined}>
            <div className="day-cal-head"><h3>{group.label}</h3>{group.note}</div>
            {group.columns.map((column) => <div key={column.key} aria-hidden="true" className="day-cal-col-name">{column.label}</div>)}
            {group.columns.map((column, index) => {
              const same = group.columns.filter((c) => c.label === column.label);
              const name = same.length > 1 ? `${column.label} ${same.indexOf(column) + 1}` : column.label;
              return (
                <div key={column.key} role="list" aria-label={`${group.label}, ${name}`} className="day-cal-col" data-edge={index === 0 ? "group" : undefined}>
                  {column.blocks.map(block)}
                  {showNow ? <span aria-hidden="true" className={`day-cal-now ${topOf(at(now))}`} /> : null}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
