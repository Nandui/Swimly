import Link from "next/link";
import * as React from "react";
import { Progress } from "@/components/shadcn/progress";
import { leftOf, widthOf } from "@/components/ui-kit/scale";
import { ChevronRight } from "lucide-react";
import { formatCount, nameInitials } from "@/lib/format";

/** The plain-language pieces the three dashboards share (owner, 20 October 2026: "the overall user is not a
 *  SaaS engineer or expected to be hyper tech savvy"). Each figure comes with a sentence saying what it
 *  means, and comparisons show one thing at a time. */

/** One plain sentence under a chart saying what it shows. */
export function Sentence({ children }: { children: React.ReactNode }) {
  return <p className="ins-sentence">{children}</p>;
}

/** A chart's heading inside a tile switch: what it is and the sentence. */
export function ChartHead({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="ins-chart-head"><h3>{title}</h3><Sentence>{children}</Sentence></div>;
}

export type CompareRow = {
  key: string; name: string; sub?: string; href?: string;
  value: number | null; text: string;
  /** Said under the bar, and the bar turns orange, when this person is worth a word. */
  note?: string | null;
};

/** Everyone on one measure: a bar each to one scale, the team or school average as a line through
 *  them all, orange with a plain reason where it is worth a word. Highest first. */
export function CompareList({ label, help, average, averageText, max, rows, word }: {
  label: string; help: string; average: number | null; averageText: string; max?: number; rows: CompareRow[]; word: "team" | "school";
}) {
  const top = max ?? Math.max(1, ...rows.map(r => r.value ?? 0), average ?? 0) * 1.1;
  const share = (v: number) => Math.min(1, Math.max(0, v / top));
  const sorted = [...rows].sort((a, b) => (b.value ?? -1) - (a.value ?? -1) || a.name.localeCompare(b.name));
  const flagged = sorted.filter(r => r.note).map(r => r.name.split(" ")[0]);
  const both = flagged.length > 1 ? `${flagged.slice(0, -1).join(", ")} and ${flagged.at(-1)}` : flagged[0];
  return <div className="ins-board">
    <div className="ins-board-head">
      <p className="ins-board-help">{help}{average !== null ? ` The line is the ${word} average, ${averageText}.` : ""}</p>
      <p className="ins-board-worth" data-tone={flagged.length ? "warn" : undefined}>{flagged.length ? `Worth a word: ${both}` : "Nobody stands out on this one"}</p>
    </div>
    {sorted.length ? <ul className="ins-board-rows" aria-label={label}>
      {average !== null ? <li aria-hidden="true" className="ins-board-scale"><span /><span><span className={`ins-board-avg-label ${leftOf(share(average))}`}>{word === "team" ? "Team" : "School"} {averageText}</span></span><span /></li> : null}
      {sorted.map(r => {
        const body = <>
          <span className="ins-board-who">
            <span className="ins-board-initials" aria-hidden="true">{nameInitials(r.name)}</span>
            <span className="min-w-0"><span className="ins-board-name">{r.name}</span>{r.sub ? <span className="ins-board-sub">{r.sub}</span> : null}</span>
          </span>
          <span className="ins-board-bar">
            <span className="ins-board-track" aria-hidden="true"><Progress value={r.value === null ? 0 : share(r.value) * 100} data-tone={r.note ? "warn" : undefined} className="ins-board-fill" />{average !== null ? <span className={`ins-board-line ${leftOf(share(average))}`} /> : null}</span>
            {r.note ? <span className="ins-board-note">{r.note}</span> : null}
          </span>
          <span className="ins-board-value">{r.text}{r.href ? <ChevronRight aria-hidden="true" /> : null}</span>
        </>;
        return <li key={r.key}>{r.href
          ? <Link href={r.href} className="ins-board-row" aria-label={`${r.name}, ${r.text}${r.note ? `. ${r.note}` : ""}. Open their page.`}>{body}</Link>
          : <div className="ins-board-row">{body}</div>}</li>;
      })}
    </ul> : <p className="ins-sub">Nobody to compare in this period.</p>}
  </div>;
}

/** One whole split into its parts as a single bar, with each part named and counted beneath. */
export function SplitBar({ label, parts }: { label: string; parts: { key: string; label: string; value: number; tone?: "a" | "b" | "warn" | "muted" }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return <div className="ins-split">
    <div className="ins-split-bar" role="img" aria-label={`${label}: ${parts.map(p => `${p.label} ${formatCount(p.value)}`).join(", ")}`}>
      {total ? parts.filter(p => p.value).map(p => <span key={p.key} data-tone={p.tone ?? "a"} className={widthOf(p.value / total)} />) : <span data-tone="muted" className="w-full" />}
    </div>
    <ul className="ins-split-key">
      {parts.map(p => <li key={p.key}><span className="ins-split-dot" data-tone={p.tone ?? "a"} aria-hidden="true" /><strong>{formatCount(p.value)}</strong>{p.label}</li>)}
    </ul>
  </div>;
}

/** Places at each level as one bar: filled, free and, beyond it, those waiting. */
export function LevelPlaces({ rows }: { rows: { key: string; name: string; group?: string; filled: number; free: number; waiting: number; classes: number }[] }) {
  if (!rows.length) return <p className="ins-sub">No classes with a limit in this view.</p>;
  const max = Math.max(1, ...rows.map(r => r.filled + r.free + r.waiting));
  return <>
    <ul className="ins-legend" aria-hidden="true"><li><span className="ins-swatch" />Filled</li><li><span className="ins-swatch" data-series="free" />Free</li><li><span className="ins-swatch" data-series="b" />Waiting</li></ul>
    <ul className="ins-levels">
      {rows.map(r => <li key={r.key}>
        <span className="ins-levels-name"><strong>{r.name}</strong>{r.group ? <span>{r.group}</span> : null}</span>
        <span className="ins-levels-bar" aria-hidden="true">
          {r.filled ? <span data-part="filled" className={widthOf(r.filled / max)} /> : null}
          {r.free ? <span data-part="free" className={widthOf(r.free / max)} /> : null}
          {r.waiting ? <span data-part="waiting" className={widthOf(r.waiting / max)} /> : null}
        </span>
        <span className="ins-levels-text">{formatCount(r.filled)} filled, {formatCount(r.free)} free{r.waiting ? <>, <strong>{formatCount(r.waiting)} waiting</strong></> : null}<span className="ins-muted"> · {r.classes} {r.classes === 1 ? "class" : "classes"}</span></span>
      </li>)}
    </ul>
  </>;
}

/** Horizontal bars with the period before marked on each as a thin line. */
export function BarsVersus({ label, rows, previousLabel }: { label: string; rows: { key: string; label: string; value: number; previous: number }[]; previousLabel: string }) {
  const max = Math.max(1, ...rows.flatMap(r => [r.value, r.previous]));
  return <>
    <ul className="ins-legend" aria-hidden="true"><li><span className="ins-swatch" />This period</li><li><span className="ins-swatch" data-series="marker" />{previousLabel}</li></ul>
    <ul className="ins-bars" aria-label={label}>
      {rows.map(r => <li key={r.key} className="ins-bar-row">
        <span className="ins-bar-label">{r.label}</span>
        <span className="ins-bar-versus" aria-hidden="true"><Progress value={Math.min(100, r.value / max * 100)} className="ins-bar-track" /><span className={`ins-bar-marker ${leftOf(r.previous / max)}`} /></span>
        <span className="ins-bar-value">{formatCount(r.value)}<span className="ins-bar-share">was {formatCount(r.previous)}</span></span>
      </li>)}
    </ul>
  </>;
}

/** A short list of named rows inside a card: what, a hint, and a figure at the end. */
export function MiniList({ label, rows, empty }: { label: string; rows: { key: string; title: React.ReactNode; hint?: React.ReactNode; value?: React.ReactNode; href?: string; tone?: "warn" }[]; empty: string }) {
  if (!rows.length) return <p className="ins-sub">{empty}</p>;
  return <ul className="ins-mini" aria-label={label}>
    {rows.map(r => {
      const body = <><span className="min-w-0"><span className="ins-mini-title">{r.title}</span>{r.hint ? <span className="ins-mini-hint">{r.hint}</span> : null}</span>{r.value !== undefined ? <span className="ins-mini-value" data-tone={r.tone}>{r.value}</span> : null}</>;
      return <li key={r.key}>{r.href ? <Link href={r.href} className="ins-mini-row">{body}</Link> : <div className="ins-mini-row">{body}</div>}</li>;
    })}
  </ul>;
}
