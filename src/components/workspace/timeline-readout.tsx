"use client";

import { useRef, useState, type ReactNode } from "react";
import { formatTime } from "@/lib/format";

/** The box around a timeline grid. With `range`, it reads out the exact time under the pointer
 *  (to the quarter hour) as a pill on the time bar, so the bar can show hours alone and still
 *  answer "what time is this?" (owner, 5 October 2026). Pointer only: every block also says its
 *  times in words, which is what keyboard and screen-reader users get. */
export function TimelineReadout({ className, range, children }: { className: string; range: { from: number; span: number } | null; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ x: number; minutes: number } | null>(null);
  const move = (event: React.PointerEvent) => {
    const box = ref.current;
    const track = box?.querySelector(".pc-timeline-track");
    if (!box || !track || !range) return;
    const t = track.getBoundingClientRect();
    if (event.clientX < t.left || event.clientX > t.right) { setAt(null); return; }
    const minutes = range.from + Math.round((((event.clientX - t.left) / t.width) * range.span) / 15) * 15;
    setAt({ x: t.left - box.getBoundingClientRect().left + ((minutes - range.from) / range.span) * t.width, minutes });
  };
  return (
    <div ref={ref} className={className} onPointerMove={range ? move : undefined} onPointerLeave={range ? () => setAt(null) : undefined}>
      {children}
      {at ? <span aria-hidden="true" className="pc-timeline-readout" style={{ left: at.x }}>{formatTime(at.minutes)}</span> : null}
    </div>
  );
}
