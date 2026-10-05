"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, TriangleAlert, UserX } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/shadcn/sheet";
import { CancelShift, ShiftDialog, type PlanOptions } from "@/components/rota/actions";
import { SegmentsFields, useSegments, type SegmentShift } from "@/components/rota/segments";
import { Tag } from "@/components/ui-kit/tag";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { ROTA_WARNING_META, weekStarted } from "@/lib/rota/constants";
import { hours } from "@/lib/rota/plan";
import type { RosterCell, RosterData, RosterPerson } from "@/lib/rota/roster";

const THEME = "turnfin-module";
type Day = { iso: string; weekday: string; date: string; today: boolean };
export type RosterShiftDetail = SegmentShift & {
  date: Date; startMinutes: number; endMinutes: number; note: string; userId: string | null;
  requiredTypeId: string | null; departmentId: string | null; department: string | null; editable: boolean;
};

/** The week plan as a roster sheet: people down the side by department,
 *  days across, paid hours at the end, and above everyone what still needs a
 *  person. Click a shift to plan that person's day in a side panel (shift,
 *  activities, breaks); click an empty day to give them a shift; a day's
 *  heading opens its Day plan. */
export function RosterWeek({ roster, days, today, siteId, manage, shifts, activities, options, siteChooser }: {
  roster: RosterData;
  days: Day[];
  today: string;
  siteId: string;
  manage: boolean;
  /** Each shift on the roster, by id, for the side panel. */
  shifts: Record<string, RosterShiftDetail>;
  activities: string[];
  options: PlanOptions;
  siteChooser?: ReactNode;
}) {
  const [group, setGroup] = useState("");
  const [open, setOpen] = useState<{ id: string; person: RosterPerson; day: Day } | null>(null);
  const shown = useMemo(() => roster.groups.filter((g) => !group || g.key === group), [roster.groups, group]);
  const t = roster.tiles;
  const cols = "grid-cols-[minmax(8.5rem,12rem)_repeat(7,minmax(6.25rem,1fr))_3.5rem]";

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="On the plan" value={`${t.people} ${t.people === 1 ? "person" : "people"} · ${hours(t.minutes)}h`} />
        <Tile label="To fill" value={`${t.toFill} ${t.toFill === 1 ? "place" : "places"}`} tone={t.toFill ? "warning" : undefined} href={t.toFill ? "#to-fill" : undefined} />
        <Tile label="Off" value={t.offPeople ? `${t.offPeople} ${t.offPeople === 1 ? "person" : "people"}, ${t.offShifts} ${t.offShifts === 1 ? "shift" : "shifts"}` : "Nobody"} tone={t.offPeople ? "danger" : undefined} />
        <Tile label="Warnings" value={t.warnings ? `${t.warnings} to check` : "None"} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {siteChooser}
        <div className="w-full sm:w-56"><NativeSelect aria-label="Department" value={group} onChange={(e) => setGroup(e.target.value)}>
          <NativeSelectOption value="">All departments</NativeSelectOption>
          {roster.groups.map((g) => <NativeSelectOption key={g.key} value={g.key}>{g.label}</NativeSelectOption>)}
        </NativeSelect></div>
      </div>

      <section aria-label="The week, person by person" className="overflow-x-auto rounded-[var(--pc-radius-panel)] border border-ui-border bg-ui-card">
        <div role="table" className="min-w-[58rem]">
          <div role="row" className={cn("grid border-b border-ui-border bg-[var(--pc-surface-sunken)] text-sm font-semibold", cols)}>
            <div role="columnheader" className="sticky left-0 z-10 bg-[var(--pc-surface-sunken)] px-3 py-2 text-ui-muted-foreground">Person</div>
            {days.map((d) => (
              <div role="columnheader" key={d.iso} aria-current={d.today ? "date" : undefined} className={cn("border-l border-ui-border", d.today && "bg-[var(--pc-primary-soft)]")}>
                <Link href={`/rota/day?site=${siteId}&date=${d.iso}`} className="block px-2 py-1.5 hover:underline">
                  <span className={cn("block", d.today && "text-[var(--pc-primary-ink)]")}>{d.weekday}</span>
                  <span className="block text-xs font-normal text-ui-muted-foreground">{d.date}{d.today ? " · today" : ""} · day ›</span>
                </Link>
              </div>
            ))}
            <div role="columnheader" className="border-l border-ui-border px-2 py-2 text-right text-ui-muted-foreground">Hours</div>
          </div>

          {roster.tiles.toFill ? (
            <div role="row" id="to-fill" className={cn("grid border-b-2 border-ui-border bg-[color-mix(in_oklab,var(--pc-warning-soft)_45%,transparent)]", cols)}>
              <div role="rowheader" className="sticky left-0 z-10 bg-ui-card px-3 py-2">
                <span className="block font-semibold">To fill</span>
                <span className="block text-xs text-ui-muted-foreground">{manage ? "Choose one to give it to someone" : "Still needs someone"}</span>
              </div>
              {roster.fill.map((list, i) => (
                <div role="cell" key={days[i].iso} className="flex flex-col gap-1 border-l border-ui-border p-1.5">
                  {list.map((f) => {
                    const s = shifts[f.id];
                    const body = (
                      <span className="block min-w-0 text-left leading-tight">
                        <span className="block truncate text-xs font-semibold">{f.cover ? `Cover ${f.cover}` : f.what}</span>
                        <span className="block text-xs tabular-nums whitespace-nowrap text-ui-muted-foreground">{f.time}</span>
                      </span>
                    );
                    const cls = "h-auto w-full justify-start whitespace-normal rounded-[var(--pc-radius-control)] border border-dashed border-[var(--pc-warning)] bg-ui-card px-2 py-1 font-normal";
                    return manage && s?.editable
                      ? <ShiftDialog key={f.id} siteId={siteId} date={days[i].iso} today={today} options={options} suggested={f.cover ? "cover" : undefined}
                          shift={{ id: s.id, date: s.date, startMinutes: s.startMinutes, endMinutes: s.endMinutes, role: s.role, note: s.note, userId: f.cover ? null : s.userId, requiredTypeId: s.requiredTypeId, departmentId: s.departmentId }}
                          trigger={{ label: `${f.cover ? `Cover for ${f.cover}` : `Fill ${f.what}`}, ${days[i].weekday} ${f.time}`, variant: "ghost", className: cls, children: body }} />
                      : <div key={f.id} className={cls}>{body}</div>;
                  })}
                </div>
              ))}
              <div role="cell" className="border-l border-ui-border" />
            </div>
          ) : null}

          {shown.map((g) => (
            <div key={g.key} role="rowgroup">
              <div role="row" className="border-b border-ui-border bg-[var(--pc-surface-sunken)] px-3 py-1.5 text-sm font-semibold text-[var(--pc-primary-ink)]">{g.label}</div>
              {g.people.map((p) => (
                <div role="row" key={p.key} className={cn("grid border-b border-ui-border", cols)}>
                  <div role="rowheader" className="sticky left-0 z-10 min-w-0 bg-ui-card px-3 py-2">
                    <span className="block truncate font-medium" title={p.name}>{p.name}</span>
                    {options.people.find((x) => x.id === p.userId)?.jobTitle ? <span className="block truncate text-xs text-ui-muted-foreground">{options.people.find((x) => x.id === p.userId)?.jobTitle}</span> : null}
                  </div>
                  {p.days.map((cells, i) => (
                    <div role="cell" key={days[i].iso} className={cn("flex min-h-14 flex-col gap-1 border-l border-ui-border p-1", days[i].today && "bg-[color-mix(in_oklab,var(--pc-primary-soft)_40%,transparent)]")}>
                      {cells.map((c) => <Cell key={c.id} cell={c} onOpen={() => setOpen({ id: c.id, person: p, day: days[i] })} />)}
                      {!cells.length && manage && p.userId ? (
                        <ShiftDialog siteId={siteId} date={days[i].iso} today={today} options={options} person={p.userId}
                          trigger={{ label: `Add a shift for ${p.name} on ${days[i].weekday} ${days[i].date}`, variant: "ghost", className: "h-full min-h-11 w-full text-ui-muted-foreground opacity-40 hover:opacity-100 focus-visible:opacity-100", children: <Plus aria-hidden="true" /> }} />
                      ) : null}
                    </div>
                  ))}
                  <div role="cell" className="border-l border-ui-border px-2 py-2 text-right text-sm font-semibold tabular-nums">{hours(p.minutes)}</div>
                </div>
              ))}
            </div>
          ))}
          {shown.length === 0 ? <p className="px-4 py-10 text-center text-sm text-ui-muted-foreground">Nobody is planned this week{manage ? ". Add a shift, or copy a week to start from." : "."}</p> : null}
        </div>
      </section>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ui-muted-foreground" aria-label="Key">
        <li className="flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded-sm bg-[var(--pc-primary-soft)]" />Shift</li>
        <li className="flex items-center gap-1.5"><UserX aria-hidden="true" className="size-3.5 text-[var(--pc-danger)]" />Off, needs cover</li>
        <li className="flex items-center gap-1.5"><TriangleAlert aria-hidden="true" className="size-3.5 text-[var(--pc-warning)]" />Something to check</li>
        <li>Choose a shift to plan that person&apos;s day; choose an empty day to give them a shift.</li>
      </ul>

      <Sheet open={!!open} onOpenChange={(v) => { if (!v) setOpen(null); }}>
        <SheetContent portalClassName={THEME} className="w-full overflow-y-auto sm:max-w-xl">
          {open && shifts[open.id] ? <DayPanel key={open.id} shift={shifts[open.id]} person={open.person} day={open.day} cell={open.person.days.flat().find((c) => c.id === open.id)!}
            today={today} siteId={siteId} manage={manage} activities={activities} options={options} onDone={() => setOpen(null)} /> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Tile({ label, value, tone, href }: { label: string; value: string; tone?: "warning" | "danger"; href?: string }) {
  const cls = cn("block rounded-[var(--pc-radius-panel)] border px-4 py-3",
    tone === "warning" ? "border-[var(--pc-warning)] bg-[var(--pc-warning-soft)]" : tone === "danger" ? "border-[var(--pc-danger)] bg-[var(--pc-danger-soft)]" : "border-ui-border bg-ui-card");
  const body = <><span className="block text-xs text-ui-muted-foreground">{label}</span><span className="block text-lg font-semibold">{value}</span></>;
  return href ? <a href={href} className={cn(cls, "hover:underline")}>{body}</a> : <div className={cls}>{body}</div>;
}

/** One shift in a day's cell: the time in bold, what they mainly do under it.
 *  Off is red and struck through; a warning is amber with its icon. */
function Cell({ cell, onOpen }: { cell: RosterCell; onOpen: () => void }) {
  const warn = !cell.absent && cell.warnings.length > 0;
  const tone = cell.absent ? "border-[var(--pc-danger)] bg-[var(--pc-danger-soft)]"
    : warn ? "border-[var(--pc-warning)] bg-[var(--pc-warning-soft)]"
    : "border-transparent bg-[var(--pc-primary-soft)] text-[var(--pc-primary-ink)]";
  const label = [cell.time, cell.what, cell.absent ? "off, needs cover" : null, warn ? `${cell.warnings.length} to check` : null].filter(Boolean).join(", ");
  return (
    <Button type="button" variant="ghost" onClick={onOpen} aria-label={label}
      className={cn("flex h-auto min-h-11 w-full flex-col items-start justify-start gap-0 whitespace-normal rounded-[var(--pc-radius-control)] border px-1.5 py-1 text-left font-normal leading-tight hover:border-[var(--pc-primary)]", tone)}>
      <span className="flex w-full items-center gap-1">
        <span className={cn("text-[13px] font-semibold tabular-nums whitespace-nowrap", cell.absent && "line-through decoration-[var(--pc-danger)]")}>{cell.time}</span>
        {cell.absent ? <UserX aria-hidden="true" className="ml-auto size-3.5 shrink-0 text-[var(--pc-danger)]" /> : warn ? <TriangleAlert aria-hidden="true" className="ml-auto size-3.5 shrink-0 text-[var(--pc-warning)]" /> : null}
      </span>
      <span className="w-full truncate text-xs">{cell.absent ? "Off · find cover" : cell.what}</span>
    </Button>
  );
}

/** A person's day in the side panel: their shift and its warnings, what they
 *  do when inside it (activities and breaks, saved together), and changing or
 *  removing the shift. */
function DayPanel({ shift, person, day, cell, today, siteId, manage, activities, options, onDone }: {
  shift: RosterShiftDetail; person: RosterPerson; day: Day; cell: RosterCell; today: string; siteId: string; manage: boolean;
  activities: string[]; options: PlanOptions; onDone: () => void;
}) {
  const router = useRouter();
  const plan = useSegments(shift);
  const [pending, start] = useTransition();
  const live = weekStarted(day.iso, today);
  const editable = manage && shift.editable;
  function save() {
    start(async () => {
      const result = await plan.save();
      if (!result.ok) { toast.error(result.error); return; }
      toast.success(`${person.name}'s ${day.weekday} is planned`);
      router.refresh();
      onDone();
    });
  }
  return (
    <div className="flex flex-col gap-4 p-4">
      <SheetHeader className="p-0">
        <SheetTitle>{person.name} · {day.weekday} {day.date}</SheetTitle>
        <SheetDescription>{shift.role}{shift.department ? ` · ${shift.department}` : ""} · {cell.time}</SheetDescription>
      </SheetHeader>
      {cell.absent || cell.warnings.length ? (
        <div className="flex flex-wrap gap-2">
          {cell.absent ? <Tag meta={ROTA_WARNING_META.absent} /> : null}
          {cell.warnings.map((w) => <Tag key={w} meta={ROTA_WARNING_META[w]} />)}
        </div>
      ) : null}
      {editable ? (
        <>
          <SegmentsFields shift={shift} activities={activities} plan={plan} />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ui-border pt-4">
            <div className="flex flex-wrap gap-2">
              <ShiftDialog siteId={siteId} date={day.iso} today={today} options={options} label={cell.absent ? "Give cover" : "Change shift"} suggested={cell.absent ? "cover" : undefined}
                shift={{ id: shift.id, date: shift.date, startMinutes: shift.startMinutes, endMinutes: shift.endMinutes, role: shift.role, note: shift.note, userId: shift.userId, requiredTypeId: shift.requiredTypeId, departmentId: shift.departmentId }} />
              <CancelShift id={shift.id} label={`${shift.role} ${cell.time}`} live={live} withText />
            </div>
            <Button type="button" className="min-h-11" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save day"}</Button>
          </div>
        </>
      ) : (
        <ul className="space-y-1 text-sm">
          {shift.segments.length ? shift.segments.map((g, i) => <li key={i}>{g.label}</li>) : <li className="text-ui-muted-foreground">Nothing planned inside this shift.</li>}
          {!shift.editable ? <li className="text-ui-muted-foreground">From the old roster upload, so it cannot be changed here.</li> : null}
        </ul>
      )}
    </div>
  );
}
