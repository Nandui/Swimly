"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleDashed, Plus } from "lucide-react";
import { Avatar, AvatarFallback, initials } from "@/components/shadcn/avatar";
import { Button } from "@/components/shadcn/button";
import { CancelShift, ShiftDialog, type PlanOptions } from "@/components/rota/actions";
import { ShiftPlanSheet, type SegmentShift } from "@/components/rota/segments";
import { Tag } from "@/components/ui-kit/tag";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format";
import { ROTA_SHIFT_META, ROTA_WARNING_META, weekStarted, type RotaShiftKind } from "@/lib/rota/constants";
import { hours } from "@/lib/rota/plan";
import type { RosterCell, RosterData, RosterFill, RosterPerson } from "@/lib/rota/roster";

type Day = { iso: string; weekday: string; date: string; today: boolean };
export type RosterShiftDetail = SegmentShift & {
  date: Date; startMinutes: number; endMinutes: number; note: string; userId: string | null;
  requiredTypeId: string | null; departmentId: string | null; department: string | null; editable: boolean;
};

/** The week plan as a roster sheet (V2Rota): one white panel, people down the side as lane
 *  tiles by department, day tiles across (today filled, each opening its Day plan), paid hours
 *  at the end, and above everyone what still needs a person. Each shift is a block in its
 *  state (ROTA_SHIFT_META): choose one to plan that person's day in the side panel; managers
 *  choose an empty day ("Off") to give them a shift. Below 1280px (the shared timeline's
 *  breakpoint) the same blocks are an agenda, a list per day, so no day hides in a sideways scroll. */
export function RosterWeek({ roster, days, today, siteId, manage, shifts, activities, options }: {
  roster: RosterData;
  days: Day[];
  today: string;
  siteId: string;
  manage: boolean;
  /** Each shift on the roster, by id, for the side panel. */
  shifts: Record<string, RosterShiftDetail>;
  activities: string[];
  options: PlanOptions;
}) {
  const [open, setOpen] = useState<{ id: string; person: RosterPerson; day: Day } | null>(null);
  const shown = roster.groups;
  // Job titles come from the manager's people list, so only managers see them (owner to decide on viewers).
  const jobOf = (p: RosterPerson) => options.people.find((x) => x.id === p.userId)?.jobTitle ?? null;
  const cols = "grid-cols-[minmax(9rem,12rem)_repeat(7,minmax(6.25rem,1fr))_3rem]";
  const openSheet = (c: RosterCell, person: RosterPerson, day: Day) => setOpen({ id: c.id, person, day });

  /** Something still to fill on a day: managers give it to someone, everyone else sees it. */
  const fillBlock = (f: RosterFill, d: Day, agenda: boolean) => {
    const s = shifts[f.id];
    // In a day column the role alone ("Lifeguard"), so it is never cut; the booking it is for is
    // in the spoken label and the agenda, which have the room.
    const words = f.cover ? `Cover ${f.cover}` : agenda ? f.what : f.role || "Unfilled";
    const children = <BlockParts kind="open" start={f.start} end={f.end} words={words} title={agenda ? "Unfilled" : undefined} />;
    const visible = `${agenda ? "Unfilled, " : ""}${formatTime(f.start)} to ${formatTime(f.end)}, ${f.cover ? `Cover ${f.cover}, ${f.what}` : f.what}`;
    return manage && s?.editable
      ? <ShiftDialog key={f.id} siteId={siteId} date={d.iso} today={today} options={options} suggested={f.cover ? "cover" : undefined}
          shift={{ id: s.id, date: s.date, startMinutes: s.startMinutes, endMinutes: s.endMinutes, role: s.role, note: s.note, userId: f.cover ? null : s.userId, requiredTypeId: s.requiredTypeId, departmentId: s.departmentId }}
          trigger={{ label: `${visible}, ${d.weekday} ${d.date}: give it to someone`, className: cn("pc-block w-full", d.today && !agenda && TODAY), children, block: { state: "open", density: "full", layout: agenda ? undefined : "stack" } }} />
      : <span key={f.id} role="img" aria-label={visible} className={cn("pc-block", d.today && !agenda && TODAY)} data-state="open" data-layout={agenda ? undefined : "stack"}>{children}</span>;
  };
  /** A person's shift: opens the side panel with their day. */
  const cellBlock = (c: RosterCell, p: RosterPerson, d: Day, agenda: boolean) => {
    const kind = cellKind(c);
    const words = c.absent ? ROTA_SHIFT_META.absent.label : c.what;
    const extra = c.absent ? "" : c.warnings.map((w) => `, ${ROTA_WARNING_META[w].label.toLowerCase()}`).join("");
    const visible = `${agenda ? `${p.name}, ` : ""}${formatTime(c.start)} to ${formatTime(c.end)}, ${words}`;
    return (
      <Button key={c.id} type="button" variant="link" onClick={() => openSheet(c, p, d)} aria-label={`${visible}${extra}`}
        className={cn("pc-block w-full", d.today && !agenda && TODAY)} data-block={ROTA_SHIFT_META[kind].state} data-density="full" data-layout={agenda ? undefined : "stack"}>
        <BlockParts kind={kind} start={c.start} end={c.end} words={words} title={agenda ? p.name : undefined} />
      </Button>
    );
  };
  /** A day with nothing for them: "Off"; for managers, the way to give them a shift. */
  const emptyDay = (p: RosterPerson, d: Day) => manage && p.userId ? (
    <ShiftDialog siteId={siteId} date={d.iso} today={today} options={options} person={p.userId}
      trigger={{ label: `Off: add a shift for ${p.name}, ${d.weekday} ${d.date}`, variant: "ghost", style: { borderRadius: "var(--pc-radius-card)", color: "var(--pc-ink-muted)" },
        className: "group min-h-14 w-full flex-col gap-0 border border-dashed border-[var(--pc-line-strong)] font-normal text-ui-muted-foreground hover:text-ui-foreground",
        children: <><span>Off</span><Plus aria-hidden="true" className="text-ui-foreground [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" /></> }} />
  ) : (
    <span className="flex min-h-14 items-center justify-center rounded-[var(--pc-radius-card)] border border-dashed border-ui-border text-sm text-ui-muted-foreground">Off</span>
  );

  const sheet = open ? shifts[open.id] : undefined;
  const sheetCell = open ? open.person.days.flat().find((c) => c.id === open.id) : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* From 1280px the grid fits without a sideways scroll; below it, the agenda. */}
      <section aria-label="The week, person by person" className="pc-panel pc-timeline-wide rota-roster">
        <div>
          <div role="table" aria-label="The week, person by person" className="flex min-w-0 flex-col gap-2">
            <div role="row" className={cn("grid gap-2", cols)}>
              <div role="columnheader" className="pc-timeline-heading">Person</div>
              {days.map((d) => (
                <div role="columnheader" key={d.iso}>
                  <Link href={`/rota/day?${new URLSearchParams({ site: siteId, date: d.iso })}`} className="pc-timeline-hour h-full flex-col px-1 py-1 hover:bg-[var(--pc-surface-sunken)]"
                    data-now={d.today || undefined} aria-current={d.today ? "date" : undefined}>
                    <span>{d.weekday}</span>
                    <span className={cn("text-xs font-normal", !d.today && "text-ui-muted-foreground")}>{d.date}</span>
                    {d.today ? <span className="sr-only">, today</span> : null}
                  </Link>
                </div>
              ))}
              <div role="columnheader" className="pc-timeline-heading text-right">Hours</div>
            </div>

            {roster.tiles.toFill ? (
              <div role="row" className={cn("grid gap-2", cols)}>
                <div role="rowheader" className="pc-timeline-lane self-start">
                  <span className="pc-tile-icon" aria-hidden="true"><CircleDashed /></span>
                  <span className="pc-timeline-lane-body"><span className="pc-timeline-lane-label">To fill</span><span className="pc-timeline-lane-caption">Still needs someone</span></span>
                </div>
                {roster.fill.map((list, i) => (
                  <div role="cell" key={days[i].iso} className="flex flex-col gap-2">{list.map((f) => fillBlock(f, days[i], false))}</div>
                ))}
                <div role="cell" />
              </div>
            ) : null}

            {shown.map((g) => (
              <div key={g.key} role="rowgroup" className="flex flex-col gap-2">
                {shown.length > 1 ? <div role="row"><span role="rowheader" className="pc-timeline-heading block pt-2">{g.label}</span></div> : null}
                {g.people.map((p) => (
                  <div role="row" key={p.key} className={cn("grid gap-2", cols)}>
                    <div role="rowheader" className="pc-timeline-lane self-start" title={p.name}>
                      <Avatar size="lg" aria-hidden="true"><AvatarFallback>{initials(p.name)}</AvatarFallback></Avatar>
                      <span className="pc-timeline-lane-body">
                        <span className="pc-timeline-lane-label">{p.name}</span>
                        {jobOf(p) ? <span className="pc-timeline-lane-caption">{jobOf(p)}</span> : null}
                      </span>
                    </div>
                    {p.days.map((cells, i) => (
                      <div role="cell" key={days[i].iso} className="flex flex-col gap-2">
                        {cells.map((c) => cellBlock(c, p, days[i], false))}
                        {!cells.length ? emptyDay(p, days[i]) : null}
                      </div>
                    ))}
                    <div role="cell" className="flex items-center justify-end font-semibold tabular-nums">
                      {p.minutes ? hours(p.minutes) : <><span aria-hidden="true" className="font-normal text-ui-muted-foreground">–</span><span className="sr-only">No hours</span></>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        {shown.length === 0 ? <p className="text-sm text-ui-muted-foreground">Nobody is planned this week{manage ? ". Add a shift, or copy a week to start from." : "."}</p> : null}
        <Key today={days.some((d) => d.today)} />
      </section>

      {/* Below 1280px: the week as an agenda, a list per day (DESIGN.md, "Phones use Agenda"). */}
      <section aria-label="The week, day by day" className="pc-panel pc-timeline-narrow">
        {days.map((d, i) => {
          const fill = roster.fill[i];
          const people = shown.flatMap((g) => g.people).flatMap((p) => p.days[i].map((c) => ({ p, c }))).sort((x, y) => x.c.start - y.c.start);
          return (
            <section key={d.iso} aria-labelledby={`agenda-${d.iso}`} className="flex flex-col gap-2">
              <h2 id={`agenda-${d.iso}`} className="text-sm">
                <Link href={`/rota/day?${new URLSearchParams({ site: siteId, date: d.iso })}`} aria-current={d.today ? "date" : undefined}
                  className="inline-flex min-h-11 items-center gap-2 font-semibold underline-offset-4 hover:underline">
                  {d.weekday} {d.date}{d.today ? " · today" : ""}
                </Link>
              </h2>
              {fill.length || people.length ? (
                <ul className="pc-rows">
                  {fill.map((f) => <li key={f.id} className="flex">{fillBlock(f, d, true)}</li>)}
                  {people.map(({ p, c }) => <li key={c.id} className="flex">{cellBlock(c, p, d, true)}</li>)}
                </ul>
              ) : <p className="text-sm text-ui-muted-foreground">Nobody planned.</p>}
            </section>
          );
        })}
        <Key />
      </section>

      {open && sheet && sheetCell ? (
        <ShiftPlanSheet key={open.id} open onOpenChange={(v) => { if (!v) setOpen(null); }}
          shift={sheet} activities={activities} editable={manage && sheet.editable}
          title={`${open.person.name} · ${open.day.weekday} ${open.day.date}`}
          description={`${sheet.role}${sheet.department ? ` · ${sheet.department}` : ""} · ${formatTime(sheetCell.start)} to ${formatTime(sheetCell.end)}`}
          warnings={[...(sheetCell.absent ? ["absent" as const] : []), ...sheetCell.warnings]}
          readOnlyNote={sheet.editable ? undefined : "Imported from the old roster, so it is read-only here."}
          actions={manage && sheet.editable ? <>
            <ShiftDialog siteId={siteId} date={open.day.iso} today={today} options={options} label={sheetCell.absent ? "Give cover" : "Change shift"} suggested={sheetCell.absent ? "cover" : undefined}
              shift={{ id: sheet.id, date: sheet.date, startMinutes: sheet.startMinutes, endMinutes: sheet.endMinutes, role: sheet.role, note: sheet.note, userId: sheet.userId, requiredTypeId: sheet.requiredTypeId, departmentId: sheet.departmentId }} />
            <CancelShift id={sheet.id} label={`${sheet.role} ${formatTime(sheetCell.start)} to ${formatTime(sheetCell.end)}`} live={weekStarted(open.day.iso, today)} withText />
          </> : undefined} />
      ) : null}
    </div>
  );
}

/** Today's column: a 2px primary edge inside each block (V2Rota, "Today, outlined"). */
const TODAY = "outline-2 -outline-offset-2 outline-[var(--pc-primary)]";

function cellKind(c: RosterCell): RotaShiftKind {
  return c.absent ? "absent" : c.warnings.length ? "check" : "planned";
}

/** Inside a block: the time, then what it is (wrapping to two lines in a day column), with the
 *  state's icon when it is not a plain shift. In the agenda the person's name leads. */
function BlockParts({ kind, start, end, words, title }: { kind: RotaShiftKind; start: number; end: number; words: string; title?: string }) {
  const Icon = ROTA_SHIFT_META[kind].icon;
  const icon = kind === "planned" ? null : <Icon aria-hidden="true" className="mr-1 inline size-3.5 align-text-bottom" />;
  if (title) return (
    <>
      <span className="pc-block-time">{formatTime(start)}<small>to {formatTime(end)}</small></span>
      <span className="pc-block-body"><span className="pc-block-title">{title}</span><span className="pc-block-hint">{icon}{words}</span></span>
    </>
  );
  return (
    <>
      <span className="pc-block-time">{formatTime(start)} to {formatTime(end)}</span>
      <span className="pc-block-body"><span className="pc-block-hint line-clamp-2">{icon}{words}</span></span>
    </>
  );
}

/** What each block means, in words and icons (the tags), never colour alone. */
function Key({ today = false }: { today?: boolean }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Key">
      {(Object.keys(ROTA_SHIFT_META) as RotaShiftKind[]).map((k) => <li key={k}><Tag meta={ROTA_SHIFT_META[k]} /></li>)}
      {/* The grid marks today's column with an outline; the agenda says "today" in words. */}
      {today ? <li><Tag meta={ROTA_SHIFT_META.planned} label="Today, outlined" className={TODAY} /></li> : null}
    </ul>
  );
}

