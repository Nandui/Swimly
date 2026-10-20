"use client";

import Link from "next/link";
import * as React from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/shadcn/collapsible";

/** The few choices a dashboard reader makes in place, drawn on the server and switched here (owner, 20
 *  October 2026: "very confusing" of cards with six figures each). One thing at a time: a row of
 *  headline tiles that each open their own chart, or a row of pills that each show one comparison. */

export type Tile = {
  key: string; label: string; value: string;
  /** How it moved against the period before, in words; "good" or "bad" colours it. */
  change?: { text: string; tone?: "good" | "bad" };
  note?: string;
  /** A tile with no chart of its own opens the part of the page that has it. */
  href?: string;
};

/** Headline figures as tiles; picking one shows its chart and one plain sentence beneath. */
export function TileSwitch({ label, tiles, panels, initial }: {
  label: string; tiles: Tile[]; panels: Record<string, React.ReactNode>; initial?: string;
}) {
  const first = initial ?? tiles.find(t => !t.href)?.key ?? "";
  const [current, setCurrent] = React.useState(first);
  const id = React.useId();
  return <div className="ins-tiles-wrap">
    <ul className="ins-tiles" aria-label={label} data-count={tiles.length}>
      {tiles.map(t => {
        const body = <>
          <span className="ins-tile-label">{t.label}{t.href ? <ArrowRight aria-hidden="true" /> : null}</span>
          <span className="ins-tile-value">{t.value}</span>
          {t.change ? <span className="ins-tile-change" data-tone={t.change.tone}>{t.change.text}</span> : null}
          {t.note ? <span className="ins-tile-note">{t.note}</span> : null}
        </>;
        return <li key={t.key}>
          {t.href
            ? <Link href={t.href} className="ins-tile">{body}</Link>
            : <Button type="button" variant="ghost" className="ins-tile" aria-pressed={current === t.key} aria-controls={`${id}-panel`} onClick={() => setCurrent(t.key)}>{body}</Button>}
        </li>;
      })}
    </ul>
    <div id={`${id}-panel`} className="ins-tile-panel" aria-live="polite">{panels[current]}</div>
  </div>;
}

/** A row of pills, each showing one view of the same panel: who left by reason or by level, or the
 *  team compared on one measure. */
export function PillSwitch({ label, options, panels, initial }: {
  label: string; options: { key: string; label: string }[]; panels: Record<string, React.ReactNode>; initial?: string;
}) {
  const [current, setCurrent] = React.useState(initial ?? options[0]?.key ?? "");
  return <div className="ins-pills-wrap">
    <div role="group" aria-label={label} className="ins-pills">
      {options.map(o => <Button key={o.key} type="button" variant="ghost" className="ins-pill" aria-pressed={current === o.key} onClick={() => setCurrent(o.key)}>{o.label}</Button>)}
    </div>
    <div aria-live="polite">{panels[current]}</div>
  </div>;
}

/** The full table behind a comparison, folded away for those who want every figure at once. */
export function ShowTable({ label, children }: { label: string; children: React.ReactNode }) {
  return <Collapsible className="ins-more">
    <CollapsibleTrigger asChild>
      <Button type="button" variant="ghost" className="ins-more-trigger">{label}<ChevronDown aria-hidden="true" /></Button>
    </CollapsibleTrigger>
    <CollapsibleContent className="ins-more-body">{children}</CollapsibleContent>
  </Collapsible>;
}
