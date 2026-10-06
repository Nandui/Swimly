"use client";

import { Frame } from "@/components/frame";
import { EmptyRows, LoadError, Loading, Notice, Tag, useLoad } from "@/components/ui";
import { clock, day } from "@/lib/format";
import { DAY_META, SHIFT_WARNING_META } from "@/lib/meta";

type Block = { kind: "activity" | "break"; startMinutes: number; endMinutes: number; label: string; place: string; needs: string | null; warning: string | null };
type Day = { id: string; date: string; site: string; changed: boolean; startMinutes: number; endMinutes: number; paidMinutes: number; breaksToArrange: number; blocks: Block[] };

const hours = (m: number) => { const h = Math.floor(m / 60), r = m % 60; return h ? `${h}h${r ? ` ${r}m` : ""}` : `${r}m`; };

/** Your days on the rota (owner decision, 6 October 2026: "their day as activities"): each day's
 *  activities in order with the breaks placed for you, and the shift that comes from them. Only
 *  weeks your department has shared appear; a day that changed since says so. */
export default function ShiftsPage() {
  const { data, error, reload } = useLoad<{ items: Day[] }>("shifts?days=28");
  const problems = data?.items.filter((d) => d.blocks.some((b) => b.warning)).length ?? 0;
  return (
    <Frame title="My shifts">
      <div className="stack">
        <div className="stack-sm"><h1>My shifts</h1><p className="muted">The next four weeks, as your days are shared.</p></div>
        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : (
          <>
            {problems > 0 ? <Notice title="An activity needs a qualification you don't hold" tone="warning">Tell your manager before the day, or upload your new certificate under More, then Qualifications.</Notice> : null}
            {data.items.length === 0 ? <section className="pc-panel" aria-label="Shifts"><EmptyRows>Nothing shared for the next four weeks yet.</EmptyRows></section> : data.items.map((d) => (
              <section key={d.id} className="pc-panel" aria-labelledby={`day-${d.id}`}>
                <div className="stack-sm">
                  <h2 id={`day-${d.id}`}>{day(d.date)}</h2>
                  <p className="muted">{clock(d.startMinutes)} to {clock(d.endMinutes)} · {hours(d.paidMinutes)} paid · {d.site}</p>
                  {d.changed || d.breaksToArrange ? <p>{d.changed ? <Tag meta={DAY_META.changed} /> : null} {d.breaksToArrange ? <Tag meta={DAY_META.breaks} /> : null}</p> : null}
                </div>
                <ul className="pc-rows">{d.blocks.map((b, i) => (
                  <li key={i} className="pc-row" {...(b.kind === "break" ? { "data-muted": "" } : {})}>
                    <span className="pc-row-body">
                      <span className="pc-row-title">{clock(b.startMinutes)} to {clock(b.endMinutes)} · {b.label}</span>
                      <span className="pc-row-hint">{b.kind === "break" ? `${b.endMinutes - b.startMinutes} minutes` : [b.place || null, b.needs ? `needs ${b.needs}` : null].filter(Boolean).join(" · ") || d.site}</span>
                    </span>
                    {b.warning ? <span className="pc-row-trail"><Tag meta={SHIFT_WARNING_META[b.warning]} /></span> : null}
                  </li>
                ))}</ul>
                {d.breaksToArrange ? <p className="muted">You are owed {d.breaksToArrange} minutes of breaks with no free time planned for them. Your duty manager arranges them on the day.</p> : null}
              </section>
            ))}
          </>
        )}
      </div>
    </Frame>
  );
}
