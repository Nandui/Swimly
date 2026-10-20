"use client";

import Link from "next/link";
import { widthOf } from "@/components/ui-kit/scale";
import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { formatTime, plural } from "@/lib/format";
import { DAY_META } from "@/modules/activities/shared/courses/constants";
import type { BusinessInsights } from "@/modules/activities/features/analytics/server/insights-data";

type Day = keyof typeof DAY_META;
type Capacity = Pick<BusinessInsights["capacity"], "heat" | "days">;
type Cell = Capacity["heat"][number]["cells"][number];

const whole = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const percent = (value: number | null) => value === null ? "—" : `${whole.format(value)}%`;

function band(fill: number | null) {
  if (fill === null) return undefined;
  return fill >= 100 ? "4" : fill >= 80 ? "3" : fill >= 50 ? "2" : "1";
}

/** Places filled by day and start time, an orange dot where someone waits for that slot. Picking a slot
 *  opens what it holds beneath the grid, programme by programme and level by level (owner, 20 October
 *  2026: "make it able to expand so i can see the programme / levels when i click on one of them"). */
export function TimetableHeat({ capacity, classHrefs, legend }: { capacity: Capacity; classHrefs: Record<string, string>; legend: React.ReactNode }) {
  const [open, setOpen] = React.useState<{ day: string; start: number } | null>(null);
  const id = React.useId();
  const triggers = React.useRef(new Map<string, HTMLButtonElement>());
  const close = React.useCallback(() => {
    setOpen(current => {
      if (current) triggers.current.get(`${current.day}-${current.start}`)?.focus();
      return null;
    });
  }, []);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!capacity.heat.length) return <p className="ins-sub">No weekly classes at this site.</p>;
  const cell = open ? capacity.heat.find(r => r.start === open.start)?.cells.find(c => c.day === open.day) : undefined;
  const slotName = (day: string, start: number) => `${DAY_META[day as Day].label} ${formatTime(start)}`;

  return <>
    <div className="ins-heat-wrap">
      <Table className="ins-heat" data-layout="grid">
        <TableCaption className="sr-only">Places filled by day and start time. Pick a slot to see its programmes and levels.</TableCaption>
        <TableHeader><TableRow><TableCell aria-hidden="true" data-empty="" className="ins-heat-corner" />{capacity.days.map(day => <TableHead key={day} scope="col">{DAY_META[day as Day].short}</TableHead>)}</TableRow></TableHeader>
        <TableBody>{capacity.heat.map(row => <TableRow key={row.start}>
          <TableHead scope="row">{formatTime(row.start)}</TableHead>
          {row.cells.map(c => {
            if (c.classes === 0) return <TableCell key={c.day} data-empty=""><span className="sr-only">No classes</span></TableCell>;
            const key = `${c.day}-${row.start}`;
            const selected = open?.day === c.day && open.start === row.start;
            const summary = `${plural(c.classes, "class", "classes")}, ${c.enrolled} enrolled${c.capacity ? ` of ${c.capacity}` : ""}${c.waiting ? `, ${c.waiting} waiting` : ""}`;
            return <TableCell key={c.day} data-band={band(c.fill)} data-waiting={c.waiting ? "" : undefined} data-selected={selected ? "" : undefined}>
              <Button
                type="button" variant="ghost" className="ins-heat-cell"
                ref={el => { if (el) triggers.current.set(key, el); else triggers.current.delete(key); }}
                aria-expanded={selected} aria-controls={selected ? id : undefined}
                aria-label={`${slotName(c.day, row.start)}: ${percent(c.fill)} full, ${summary}. ${selected ? "Close" : "Show"} its programmes and levels.`}
                title={`${slotName(c.day, row.start)}: ${summary}`}
                onClick={() => setOpen(selected ? null : { day: c.day, start: row.start })}
              >
                {c.waiting ? <i className="ins-heat-dot" aria-hidden="true" /> : null}<strong>{percent(c.fill)}</strong><span>{c.enrolled}{c.capacity ? ` of ${c.capacity}` : ""}{c.waiting ? `, ${c.waiting} waiting` : ""}</span>
              </Button>
            </TableCell>;
          })}
        </TableRow>)}</TableBody>
      </Table>
    </div>
    {open && cell ? <SlotDetail id={id} title={slotName(open.day, open.start)} cell={cell} classHrefs={classHrefs} onClose={close} /> : null}
    {legend}
  </>;
}

/** One slot opened: each level in it with places filled, free and waiting, and the classes behind it. */
function SlotDetail({ id, title, cell, classHrefs, onClose }: { id: string; title: string; cell: Cell; classHrefs: Record<string, string>; onClose: () => void }) {
  const max = Math.max(1, ...cell.levels.map(l => Math.max(l.capacity, l.enrolled) + l.waiting));
  const programmes = [...new Set(cell.levels.map(l => l.programmeName))];
  return <section id={id} className="ins-slot" aria-label={`${title}: programmes and levels`}>
    <div className="ins-slot-head">
      <div>
        <h3>{title}</h3>
        <p className="ins-sub">{plural(cell.classes, "class", "classes")} across {plural(cell.levels.length, "level")}: {cell.enrolled}{cell.capacity ? ` of ${cell.capacity}` : ""} places filled{cell.waiting ? `, ${cell.waiting} waiting` : ""}.</p>
      </div>
      <Button type="button" variant="ghost" size="icon" className="ins-slot-close" aria-label="Close this slot" onClick={onClose}><X aria-hidden="true" /></Button>
    </div>
    {programmes.map(programme => <div key={programme || "none"} className="ins-slot-group">
      {programmes.length > 1 || programme ? <h4>{programme || "No programme"}</h4> : null}
      <ul className="ins-levels">
        {cell.levels.filter(l => l.programmeName === programme).map(l => {
          const free = Math.max(0, l.capacity - l.enrolled);
          const filled = l.capacity ? Math.min(l.enrolled, l.capacity) : l.enrolled;
          return <li key={l.levelId}>
            <span className="ins-levels-name">
              <strong>{l.name}</strong>
              <span className="ins-slot-classes">{l.classes.map(c => {
                const text = `${formatTime(c.startMinutes)} ${c.name}`;
                const href = classHrefs[c.id];
                return <span key={c.id}>{href ? <Link href={href}>{text}</Link> : text}</span>;
              })}</span>
            </span>
            <span className="ins-levels-bar" aria-hidden="true">
              {filled ? <span data-part="filled" className={widthOf(filled / max)} /> : null}
              {free ? <span data-part="free" className={widthOf(free / max)} /> : null}
              {l.waiting ? <span data-part="waiting" className={widthOf(l.waiting / max)} /> : null}
            </span>
            <span className="ins-levels-text">{l.enrolled}{l.capacity ? ` of ${l.capacity}` : ""} filled{l.capacity ? `, ${free} free` : ""}{l.waiting ? <>, <strong>{l.waiting} waiting</strong></> : null}<span className="ins-muted"> · {percent(l.fill)} full</span></span>
          </li>;
        })}
      </ul>
    </div>)}
  </section>;
}
