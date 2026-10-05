"use client";

import { Frame } from "@/components/frame";
import { EmptyRows, LoadError, Loading, Notice, Tag, useLoad } from "@/components/ui";
import { clock, day } from "@/lib/format";
import { SHIFT_WARNING_META } from "@/lib/meta";

type Shift = { id: string; date: string; startMinutes: number; endMinutes: number; role: string; site: string; needs: string | null; note: string; warnings: string[] };

export default function ShiftsPage() {
  const { data, error, reload } = useLoad<{ items: Shift[] }>("shifts?days=28");
  const problems = data?.items.filter((s) => s.warnings.length > 0).length ?? 0;
  return (
    <Frame title="My shifts">
      <div className="stack">
        <div className="stack-sm"><h1>My shifts</h1><p className="muted">The next four weeks.</p></div>
        {error ? <LoadError error={error} retry={reload} /> : !data ? <Loading /> : (
          <>
            {problems > 0 ? <Notice title="A shift needs a qualification you don't hold" tone="warning">Tell your manager before the day, or upload your new certificate under More, then Qualifications.</Notice> : null}
            <section className="pc-panel" aria-label="Shifts">
              {data.items.length === 0 ? <EmptyRows>No shifts in the next four weeks.</EmptyRows> : (
                <ul className="pc-rows">{data.items.map((s) => (
                  <li key={s.id} className="pc-row">
                    <span className="pc-row-body">
                      <span className="pc-row-title">{day(s.date)} · {clock(s.startMinutes)} to {clock(s.endMinutes)}</span>
                      <span className="pc-row-hint">{[`${s.role} at ${s.site}`, s.needs ? `needs ${s.needs}` : null, s.note || null].filter(Boolean).join(" · ")}</span>
                    </span>
                    {s.warnings.length > 0 ? <span className="pc-row-trail">{s.warnings.map((w) => <Tag key={w} meta={SHIFT_WARNING_META[w]} />)}</span> : null}
                  </li>
                ))}</ul>
              )}
            </section>
          </>
        )}
      </div>
    </Frame>
  );
}
