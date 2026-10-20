"use client";

import { useMemo, useState } from "react";
import { CircleCheck, Coffee, TriangleAlert, UserRound } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { Notice } from "@/components/ui-kit/notice";
import { leftOf, stretchOf } from "@/components/ui-kit/scale";
import { Select } from "@/components/ui/select";
import { clock } from "@/modules/rota/shared/constants";
import { nextChange, stepsOf, whoIsWhere, type Hole, type PersonDay, type Span, type WhereAt } from "@/modules/rota/features/diary/model";
import { DiaryContext, useDiary, type DiaryData, type DiaryState } from "@/modules/rota/features/diary/components/context";
import { AddSomeone, AddToDay } from "@/modules/rota/features/diary/components/day-forms";
import { FillSheet, type FillTarget } from "@/modules/rota/features/diary/components/fill-sheet";
import { useNowMinute } from "@/modules/rota/features/diary/components/now";
import { PersonSheet } from "@/modules/rota/features/diary/components/person-sheet";
import { firstName, hoursWords, lineTitle, subsWords, listWords, needWords, partsWords, span as spanWords, toneOf } from "@/modules/rota/features/diary/components/words";

/** The day's diary (owner, 20 October 2026: "the plan, the diary, the actual guide for the day
 *  ... readable and understood by anyone"): what is not covered yet, who's where at a moment,
 *  then the day person by person in plain words. Tap a person for their day as a list; tap
 *  anything not covered to choose someone. */
export function Diary(props: DiaryData) {
  const [fill, setFill] = useState<FillTarget | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const state = useMemo<DiaryState>(() => ({
    ...props,
    needs: new Map(props.diary.needs.map((n) => [n.key, n])),
    candidateInput: { staff: props.pool.staff, held: props.pool.held, off: new Set(props.pool.off), elsewhere: new Map(Object.entries(props.pool.elsewhere)), departmentId: props.departmentId, date: props.date },
    hoursMap: new Map(Object.entries(props.hours)),
    fill: (needKey, span, why = null) => { setPerson(null); setFill({ needKey, span, why }); },
    person: (userId) => { setFill(null); setPerson(userId); },
  }), [props]);
  return (
    <DiaryContext.Provider value={state}>
      <div className="diary">
        <div className="diary-glance">
          <NotCovered />
          <WhosWhere />
        </div>
        <TheDay />
      </div>
      <FillSheet target={fill} onClose={() => setFill(null)} />
      <PersonSheet userId={person} onClose={() => setPerson(null)} />
    </DiaryContext.Provider>
  );
}

/* ---------- Not covered yet ---------- */

function NotCovered() {
  const { diary, needs, canChange, departmentFor, fill } = useDiary();
  const holes = diary.holes;
  return (
    <section className="diary-panel" aria-labelledby="diary-holes">
      <h3 id="diary-holes" className="diary-panel-title">Not covered yet{holes.length ? <span className="diary-count tabular-nums">{holes.length}</span> : null}</h3>
      {!diary.needs.length ? <p className="diary-muted">Nothing on this day needs people yet. Add to the day, or set areas&apos; staff in Admin, Areas.</p>
        : !holes.length ? <Notice tone="success" icon={CircleCheck} title="Every need is filled" description="This day is done. Warnings on people's days are still worth a look." />
        : (
          <ul className="diary-holes">
            {holes.map((h) => {
              const need = needs.get(h.needKey);
              if (!need) return null;
              return (
                <li key={h.key} className="diary-hole" data-empty={h.empty ? "" : undefined}>
                  <span className="diary-hole-time tabular-nums">{spanWords(h)}</span>
                  <div className="diary-hole-text">
                    <span className="diary-hole-title">{needWords(need)}</span>
                    <span className="diary-muted">{h.why}{h.short > 1 && !h.why.includes("more") ? `, ${h.short} short` : ""}</span>
                  </div>
                  {canChange && departmentFor ? <Button variant="outline" onClick={() => fill(h.needKey, h, h.why)}>Choose someone</Button> : null}
                </li>
              );
            })}
          </ul>
        )}
    </section>
  );
}

/* ---------- Who's where ---------- */

function dayRange(people: readonly PersonDay[], needs: readonly Span[]) {
  const spans = [...people.flatMap((p) => p.parts), ...needs];
  if (!spans.length) return { from: 7 * 60, to: 22 * 60 };
  const from = Math.floor(Math.min(...spans.map((s) => s.start)) / 60) * 60;
  const to = Math.ceil(Math.max(...spans.map((s) => s.end)) / 60) * 60;
  return { from, to: Math.max(to, from + 60) };
}

/** Who's where, under the area each is in (or the area that is part of: Pool for the 25 m), and
 *  with every department, under its department too. */
function groupWhere(where: readonly WhereAt[], departments: Record<string, string> | null) {
  const out = new Map<string, WhereAt[]>();
  for (const w of where) {
    const top = w.need.group || w.need.area || "Elsewhere";
    const dept = departments && w.need.departmentId ? departments[w.need.departmentId] : null;
    const heading = dept ? `${dept} › ${top}` : top;
    out.set(heading, [...(out.get(heading) ?? []), w]);
  }
  return [...out];
}

function WhosWhere() {
  const { diary, today, departmentId, departmentNames } = useDiary();
  const now = useNowMinute(today);
  const { from, to } = dayRange(diary.people, diary.needs);
  const [picked, setPicked] = useState<string | null>(null);
  const at = picked !== null ? Number(picked) : now ?? from;
  const times = Array.from({ length: Math.floor((to - from) / 30) }, (_, i) => from + i * 30);
  const where = whoIsWhere(diary, at);
  const resting = diary.people.filter((p) => p.breaks.some((b) => b.start <= at && at < b.end)).map((p) => p.name);
  const next = nextChange(diary, at);
  const nextWords = next ? [
    next.starts.length ? `${listWords(next.starts.map(firstName))} start${next.starts.length > 1 ? "" : "s"}` : "",
    next.finishes.length ? `${listWords(next.finishes.map(firstName))} finish${next.finishes.length > 1 ? "" : "es"}` : "",
    next.breaks.length ? `${listWords(next.breaks.map(firstName))} go${next.breaks.length > 1 ? "" : "es"} on a break` : "",
    ...next.moves.map((m) => `${firstName(m.name)} moves to ${m.to}`),
  ].filter(Boolean).join(", ") : "";
  return (
    <section className="diary-panel" aria-labelledby="diary-where">
      <div className="diary-panel-head">
        <h3 id="diary-where" className="diary-panel-title">Who&apos;s where</h3>
        <Select label="At" className="diary-at" value={String(at)} onValueChange={setPicked}
          options={[...(now !== null ? [{ value: String(now), label: `Now, ${clock(now)}` }] : []), ...times.filter((t) => t !== now).map((t) => ({ value: String(t), label: clock(t) }))]} />
      </div>
      {where.length ? (
        <div className="diary-where-groups">
          {groupWhere(where, departmentId ? null : departmentNames).map(([heading, list]) => (
            <section key={heading} aria-label={heading}>
              <h4 className="diary-where-head">{heading}</h4>
              <ul className="diary-where">
                {list.map((w) => (
                  <li key={w.need.key} className="diary-where-row" data-tone={toneOf(w.need.kind)}>
                    <span className="diary-where-need">{w.need.kind === "area" ? w.need.area : w.need.title}<span className="diary-muted">{w.need.kind === "area" ? w.need.title : w.need.group ? w.need.area : ""}</span></span>
                    <span className="diary-where-names">{w.names.length ? listWords(w.names) : w.need.wants.length ? "Nobody" : "No staff needed"}</span>
                    {w.short ? <span className="diary-short"><TriangleAlert aria-hidden="true" />{w.short} more needed</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : <p className="diary-muted">Nothing is on at {clock(at)}.</p>}
      {resting.length ? <p className="diary-muted"><Coffee aria-hidden="true" className="diary-inline-icon" />On a break: {listWords(resting)}</p> : null}
      {next && nextWords ? <p className="diary-next">Next, at <span className="tabular-nums">{clock(next.at)}</span>: {nextWords}.</p> : null}
    </section>
  );
}

/* ---------- The day, person by person ---------- */

/** Holes stacked into as few rows as fit without overlapping. */
function lanes(holes: readonly Hole[]) {
  const rows: Hole[][] = [];
  for (const h of holes) {
    const row = rows.find((r) => r[r.length - 1].end <= h.start);
    if (row) row.push(h); else rows.push([h]);
  }
  return rows;
}

function TheDay() {
  const { diary, today, canChange, departmentFor } = useDiary();
  const now = useNowMinute(today);
  const { from, to } = dayRange(diary.people, diary.needs);
  const f = (t: number) => (t - from) / (to - from);
  const hours = Array.from({ length: (to - from) / 60 + 1 }, (_, i) => from + i * 60);
  return (
    <section className="diary-panel" aria-labelledby="diary-day">
      <div className="diary-panel-head">
        <h3 id="diary-day" className="diary-panel-title">The day, person by person</h3>
        {canChange && departmentFor ? <div className="diary-tools"><AddSomeone /><AddToDay /></div> : null}
      </div>
      <ul className="diary-key" aria-label="Colours">
        <li data-tone="area">Covering an area</li>
        <li data-tone="activity">Activity or class</li>
        <li data-tone="booking">Booking</li>
        <li data-tone="break">Break</li>
        <li data-tone="free">Nothing given yet</li>
        <li data-tone="hole">Not covered</li>
      </ul>
      {!diary.people.length ? (
        <EmptyState as="h3" icon="usersRound" title="Nobody on this day yet" hint="Choose someone for what is not covered yet, or add someone to the day." />
      ) : (
        <>
          <div className="diary-timeline" role="presentation">
            <div className="diary-row diary-ruler">
              <span />
              <div className="diary-track-ruler">
                {hours.map((h) => <span key={h} className={`diary-hour absolute ${leftOf(f(h))} tabular-nums`}>{clock(h)}</span>)}
              </div>
            </div>
            {diary.holes.length ? <HoleRows rows={lanes(diary.holes)} f={f} hours={hours} now={now} /> : null}
            {diary.people.map((p) => <PersonRow key={p.userId} person={p} f={f} hours={hours} now={now} />)}
          </div>
          <ul className="diary-cards">
            {diary.people.map((p) => <PersonCard key={p.userId} person={p} />)}
          </ul>
        </>
      )}
    </section>
  );
}

function Track({ f, hours, now, children }: { f: (t: number) => number; hours: number[]; now: number | null; children: React.ReactNode }) {
  return (
    <div className="diary-track">
      {hours.slice(1, -1).map((h) => <span key={h} className={`diary-hourline absolute inset-y-0 ${leftOf(f(h))}`} aria-hidden="true" />)}
      {children}
      {now !== null && f(now) >= 0 && f(now) <= 1 ? <span className={`diary-now absolute inset-y-0 ${leftOf(f(now))}`} aria-hidden="true" /> : null}
    </div>
  );
}

function HoleRows({ rows, f, hours, now }: { rows: Hole[][]; f: (t: number) => number; hours: number[]; now: number | null }) {
  const { needs, canChange, departmentFor, fill } = useDiary();
  return rows.map((row, i) => (
    <div key={i} className="diary-row">
      {i === 0 ? <span className="diary-row-label diary-row-holes">Not covered</span> : <span />}
      <Track f={f} hours={hours} now={now}>
        {row.map((h) => {
          const need = needs.get(h.needKey);
          const words = `${need ? needWords(need) : "Not covered"}, ${spanWords(h)}: ${h.why}`;
          const body = <><span className="diary-block-title">{need?.kind === "area" ? need.area : need?.title}</span><span className="diary-block-time tabular-nums">{spanWords(h)}</span></>;
          const cls = `diary-block absolute inset-y-1 ${stretchOf(f(h.start), f(h.end))}`;
          return canChange && departmentFor
            ? <Button variant="ghost" key={h.key} className={cls} data-tone={h.empty ? "hole" : "short"} aria-label={`Choose someone: ${words}`} title={words} onClick={() => fill(h.needKey, h, h.why)}>{body}</Button>
            : <span key={h.key} className={cls} data-tone={h.empty ? "hole" : "short"} title={words}>{body}</span>;
        })}
      </Track>
    </div>
  ));
}

function PersonRow({ person, f, hours, now }: { person: PersonDay; f: (t: number) => number; hours: number[]; now: number | null }) {
  const { person: open } = useDiary();
  const label = `${person.name}: ${partsWords(person)}`;
  return (
    <div className="diary-row">
      <Button variant="ghost" className="diary-row-label" onClick={() => open(person.userId)} aria-label={`${label}. Open their day`}>
        <span className="diary-row-name">{person.name}{person.warnings.length ? <TriangleAlert aria-label={`${person.warnings.length} to look at`} className="diary-warn" /> : null}</span>
        <span className="diary-caption tabular-nums">{person.off ? "Off today" : `${partsWords(person)}, ${hoursWords(person.paidMinutes)}`}</span>
      </Button>
      <Track f={f} hours={hours} now={now}>
        {person.lines.map((l) => (
          <Button variant="ghost" key={l.key} className={`diary-block absolute inset-y-1 ${stretchOf(f(l.start), f(l.end))}`} data-tone={toneOf(l.kind)}
            title={`${lineTitle(l)}, ${spanWords(l)}${l.subs.length ? `: ${subsWords(l)}` : ""}`} aria-label={`${person.name} on ${lineTitle(l)}, ${spanWords(l)}${l.subs.length ? `: ${subsWords(l)}` : ""}`} onClick={() => open(person.userId)}>
            <span className="diary-block-title">{lineTitle(l)}</span><span className="diary-block-time tabular-nums">{spanWords(l)}</span>
          </Button>
        ))}
        {person.breaks.map((b) => (
          <span key={`b${b.start}`} className={`diary-block absolute inset-y-1 ${stretchOf(f(b.start), f(b.end))}`} data-tone="break" title={`Break ${spanWords(b)}`}>
            <span className="diary-block-title">Break</span>
          </span>
        ))}
        {person.free.map((s) => (
          <Button variant="ghost" key={`f${s.start}`} className={`diary-block absolute inset-y-1 ${stretchOf(f(s.start), f(s.end))}`} data-tone="free"
            aria-label={`${person.name} has nothing given ${spanWords(s)}. Give this time`} title={`Nothing given yet, ${spanWords(s)}`} onClick={() => open(person.userId)}>
            <span className="diary-block-title">Give this time</span><span className="diary-block-time tabular-nums">{spanWords(s)}</span>
          </Button>
        ))}
      </Track>
    </div>
  );
}

/** On a phone, each person's day reads as a short list. */
function PersonCard({ person }: { person: PersonDay }) {
  const { person: open } = useDiary();
  const steps = stepsOf(person).filter((s) => s.kind !== "finish");
  return (
    <li className="diary-card">
      <Button variant="ghost" className="diary-card-head" onClick={() => open(person.userId)}>
        <UserRound aria-hidden="true" />
        <span className="diary-row-name">{person.name}{person.warnings.length ? <TriangleAlert aria-label={`${person.warnings.length} to look at`} className="diary-warn" /> : null}</span>
        <span className="diary-caption tabular-nums">{person.off ? "Off today" : partsWords(person)}</span>
      </Button>
      <ol className="diary-card-steps">
        {steps.map((s, i) => (
          <li key={i} data-tone={s.kind === "work" ? toneOf(s.line.kind) : s.kind}>
            <span className="tabular-nums">{clock(s.start)}</span>
            <span>{s.kind === "work" ? (s.count > 1 ? `${s.count} swim classes` : lineTitle(s.line)) : s.kind === "break" ? `Break, ${s.end - s.start} min` : s.kind === "free" ? "Nothing given yet" : "Off"}
              {s.kind === "work" && s.line.subs.length ? <span className="diary-subs">{subsWords(s.line)}</span> : null}</span>
          </li>
        ))}
        {person.parts.length ? <li data-tone="finish"><span className="tabular-nums">{clock(person.parts[person.parts.length - 1].end)}</span><span>Finishes</span></li> : null}
      </ol>
    </li>
  );
}
