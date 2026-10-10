"use client";

import { useState } from "react";

type Point = { label: string; value: number | null };

const W = 640, H = 180, PAD = { top: 12, right: 12, bottom: 8, left: 52 };

/** A site's score over the report's periods (the prototype's "Consistency over time"): one
 *  2px line in the chart blue, 8px markers, a recessive 0/50/100% grid, and a hover or focus
 *  readout of the period and its score. Periods without a score break the line. The scores table
 *  beside it is the table view. */
export function ScoreTrend({ points, site }: { points: Point[]; site: string }) {
  const [active, setActive] = useState<number | null>(null);
  const x = (i: number) => PAD.left + (points.length < 2 ? (W - PAD.left - PAD.right) / 2 : (i * (W - PAD.left - PAD.right)) / (points.length - 1));
  const y = (v: number) => PAD.top + ((100 - v) / 100) * (H - PAD.top - PAD.bottom);
  // Runs of consecutive scores, so a period with none leaves a gap rather than a false zero.
  const runs: { i: number; v: number }[][] = [];
  points.forEach((p, i) => {
    if (p.value === null) return;
    const last = runs.at(-1);
    if (last && last.at(-1)!.i === i - 1) last.push({ i, v: p.value });
    else runs.push([{ i, v: p.value }]);
  });
  const scored = points.filter((p) => p.value !== null);
  if (!scored.length) return <p className="text-sm text-ui-muted-foreground">No scores in this range yet.</p>;
  const shown = active !== null ? points[active] : null;
  const nearest = (clientX: number, rect: DOMRect) => {
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    points.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
    return best;
  };
  return (
    <figure className="flex flex-col gap-2">
      <p className="min-h-6 text-sm tabular-nums" aria-live="polite">
        {shown ? <><span className="font-semibold">{shown.label}</span><span className="text-ui-muted-foreground">: {shown.value === null ? "no score" : `${shown.value}%`}</span></> : <span className="text-ui-muted-foreground">Point at a period to read its score.</span>}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-pan-y" role="img" aria-label={`${site}'s score over time: ${scored.map((p) => `${p.label} ${p.value}%`).join(", ")}`}
        onPointerMove={(e) => setActive(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))} onPointerLeave={() => setActive(null)}>
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--pc-line)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" fill="var(--pc-ink-muted)" fontSize={12}>{v}%</text>
          </g>
        ))}
        {active !== null ? <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--pc-line-strong)" strokeWidth={1} strokeDasharray="4 4" /> : null}
        {runs.map((run, r) => (
          <polyline key={r} points={run.map((p) => `${x(p.i)},${y(p.v)}`).join(" ")} fill="none" stroke="var(--pc-chart-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {points.map((p, i) => p.value === null ? null : (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={active === i ? 6 : 4} fill="var(--pc-chart-1)" stroke="var(--pc-surface)" strokeWidth={2} />
        ))}
      </svg>
      <figcaption className="flex justify-between text-xs text-ui-muted-foreground"><span>{points[0]?.label}</span><span>{points.at(-1)?.label}</span></figcaption>
    </figure>
  );
}
