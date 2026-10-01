"use client";

import { useMemo, useState, type ReactNode } from "react";
import { TriangleAlert, UserX } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { CancelShift, ShiftDialog, type PlanOptions } from "@/components/rota/actions";
import { RotaWarningTag } from "@/components/rota/status";
import { cn } from "@/lib/utils";
import { weekStarted } from "@/lib/rota/constants";
import { hours, type PlanEntry, type PlanRow, type RotaPlanData } from "@/lib/rota/plan";

const THEME = "turnfin-docs turnfin-module";
type EditableShift = { id: string; date: Date; startMinutes: number; endMinutes: number; role: string; note: string; userId: string | null; requiredTypeId: string | null; departmentId: string | null };
type Day = { iso: string; weekday: string; date: string; today: boolean };

/** The week plan: duties down the side, grouped by department, days across.
 *  Each entry says when and who; an unfilled one says so. The duty column and
 *  the day headings stay put while scrolling. Any entry opens its details,
 *  where a duty planned in Turnfin can be changed or cancelled. */
export function RotaPlan({ plan, days, today, siteId, manage, editable, options, siteChooser }: {
  plan: RotaPlanData;
  days: Day[];
  today: string;
  siteId: string;
  manage: boolean;
  editable: Record<string, EditableShift>;
  options: PlanOptions;
  /** The site picker, when there is more than one site. */
  siteChooser?: ReactNode;
}) {
  const [group, setGroup] = useState("");
  const [open, setOpen] = useState<{ entry: PlanEntry; row: PlanRow; day: Day } | null>(null);
  const shown = useMemo(() => plan.groups.filter((g) => !group || g.key === group), [plan.groups, group]);
  const shift = open ? editable[open.entry.id] : undefined;
  const live = open ? weekStarted(open.day.iso, today) : false;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {siteChooser}
        <div className="w-full sm:w-56"><NativeSelect aria-label="Department" value={group} onChange={(e) => setGroup(e.target.value)}>
          <NativeSelectOption value="">Every department</NativeSelectOption>
          {plan.groups.map((g) => <NativeSelectOption key={g.key} value={g.key}>{g.label}</NativeSelectOption>)}
        </NativeSelect></div>
      </div>

      <Table containerClassName="max-h-[calc(100dvh-14rem)] min-h-64 overflow-auto rounded-[var(--pc-radius-panel)] border border-ui-border bg-ui-card"
        className="min-w-[60rem] border-separate border-spacing-0" tabIndex={0} aria-label="Week plan">
        <TableCaption className="sr-only">Duties for the week, one row per duty grouped by department, a column per day.</TableCaption>
        <TableHeader>
          <TableRow className="border-0 hover:bg-transparent">
            <TableHead scope="col" className="sticky top-0 left-0 z-30 w-36 min-w-36 sm:w-56 sm:min-w-48 border-r border-b border-ui-border bg-[var(--pc-surface-sunken)] px-3 py-2 text-left text-xs font-semibold text-ui-muted-foreground">Duty</TableHead>
            {days.map((d) => (
              <TableHead key={d.iso} scope="col" aria-current={d.today ? "date" : undefined}
                className={cn("sticky top-0 z-20 min-w-28 border-b border-ui-border px-2 py-2 text-left font-semibold", d.today ? "bg-[var(--pc-primary-soft)] text-[var(--pc-primary-ink)]" : "bg-[var(--pc-surface-sunken)]")}>
                <span className="block text-xs">{d.weekday}</span>
                <span className={cn("block text-xs font-normal", d.today ? "" : "text-ui-muted-foreground")}>{d.date}{d.today ? " · today" : ""}</span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        {shown.map((g) => (
          <TableBody key={g.key}>
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead colSpan={8} scope="colgroup" className="border-b border-ui-border bg-ui-card p-0 text-left">
                <span className="sticky left-0 inline-flex items-baseline gap-2 px-3 pt-4 pb-1.5 text-sm font-semibold text-[var(--pc-primary-ink)]">{g.label}</span>
              </TableHead>
            </TableRow>
            {g.rows.map((r) => (
              <TableRow key={r.key} className="group/row border-0 hover:bg-transparent">
                <TableHead scope="row" className="sticky left-0 z-10 border-r border-b border-ui-border bg-ui-card px-3 py-1.5 text-left align-top font-normal group-hover/row:bg-[var(--pc-hover)]">
                  <span className="block max-w-32 truncate font-medium sm:max-w-52" title={r.duty}>{r.duty}</span>
                  {r.needs ? <span className="block text-xs text-ui-muted-foreground">{r.needs}</span> : null}
                </TableHead>
                {r.days.map((cell, i) => (
                  <TableCell key={days[i].iso} className={cn("border-b border-ui-border px-1.5 py-1.5 align-top group-hover/row:bg-[var(--pc-hover)]", days[i].today && "bg-[color-mix(in_oklab,var(--pc-primary-soft)_45%,transparent)]")}>
                    <div className="flex flex-col gap-1">
                      {cell.map((e) => <Entry key={e.id} entry={e} onPick={() => setOpen({ entry: e, row: r, day: days[i] })} />)}
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        ))}
        {shown.length === 0 ? (
          <TableBody><TableRow className="border-0 hover:bg-transparent"><TableCell colSpan={8} className="px-3 py-10 text-center text-ui-muted-foreground">No duties planned this week{manage ? ". Add a duty, or copy last week's." : "."}</TableCell></TableRow></TableBody>
        ) : null}
        <TableFooter className="border-0 bg-transparent">
          <TableRow className="border-0 hover:bg-transparent">
            <TableHead scope="row" className="sticky bottom-0 left-0 z-30 border-t border-r border-ui-border bg-[var(--pc-surface-sunken)] px-3 py-2 text-left text-xs font-semibold">On duty</TableHead>
            {days.map((d, i) => (
              <TableCell key={d.iso} className={cn("sticky bottom-0 z-20 border-t border-ui-border px-2 py-2 text-xs tabular-nums", d.today ? "bg-[var(--pc-primary-soft)]" : "bg-[var(--pc-surface-sunken)]")}>
                <span className="font-semibold">{plan.onShift[i]}</span> <span className="text-ui-muted-foreground">· {hours(plan.dayMinutes[i])}h{plan.unfilled[i] ? ` · ${plan.unfilled[i]} unfilled` : ""}</span>
              </TableCell>
            ))}
          </TableRow>
        </TableFooter>
      </Table>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ui-muted-foreground" aria-label="Key">
        <li className="flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded-sm border border-ui-border bg-ui-card" />Planned</li>
        <li className="flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded-sm border border-dashed border-ui-muted-foreground" />Unfilled</li>
        <li className="flex items-center gap-1.5"><UserX aria-hidden="true" className="size-3.5 text-[var(--pc-danger)]" />Off, needs cover</li>
        <li className="flex items-center gap-1.5"><TriangleAlert aria-hidden="true" className="size-3.5 text-[var(--pc-warning)]" />Qualification or double-booking</li>
        <li>Select any entry for its details.</li>
      </ul>

      <Dialog open={!!open} onOpenChange={(v) => { if (!v) setOpen(null); }}>
        {open ? (
          <DialogContent portalClassName={THEME} className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{open.row.duty}</DialogTitle>
              <DialogDescription>{open.day.weekday} {open.day.date} · {open.entry.text}</DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
              <dt className="text-ui-muted-foreground">Who</dt>
              <dd className="font-semibold">{open.entry.who ?? "Unfilled"}</dd>
              <dt className="text-ui-muted-foreground">Hours</dt>
              <dd className="tabular-nums">{hours(open.entry.minutes)}</dd>
              {open.entry.detail ? <><dt className="text-ui-muted-foreground">Details</dt><dd>{open.entry.detail}</dd></> : null}
              {!open.entry.editable ? <><dt className="text-ui-muted-foreground">Came from</dt><dd>The old roster upload, so it cannot be changed here.</dd></> : null}
            </dl>
            {open.entry.absent || open.entry.warnings.length ? (
              <div className="flex flex-wrap gap-2">
                {open.entry.absent ? <RotaWarningTag warning="absent" /> : null}
                {open.entry.warnings.map((w) => <RotaWarningTag key={w} warning={w} />)}
              </div>
            ) : null}
            {manage && shift ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-ui-border pt-4">
                <ShiftDialog siteId={siteId} date={open.day.iso} today={today} shift={shift} options={options} label={open.entry.absent ? "Give cover" : "Change duty"} suggested={open.entry.absent ? "cover" : undefined} />
                <CancelShift id={shift.id} label={`${shift.role} ${open.entry.text}`} live={live} withText />
              </div>
            ) : null}
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

/** One duty in a cell: when, and who (or "Unfilled", dashed). Colour is never
 *  the only signal: an absence and a warning each carry an icon and a label. */
function Entry({ entry, onPick }: { entry: PlanEntry; onPick: () => void }) {
  const tone = entry.absent
    ? "border-[var(--pc-danger)] bg-[var(--pc-danger-soft)] text-ui-foreground"
    : !entry.who ? "border-dashed border-ui-muted-foreground bg-ui-card text-ui-foreground hover:border-[var(--pc-primary)]"
    : "border-ui-border bg-ui-card text-ui-foreground hover:border-[var(--pc-primary)]";
  const label = [entry.text, entry.who ?? "unfilled", entry.absent ? "absent, needs cover" : null, entry.warnings.length ? `${entry.warnings.length} warning${entry.warnings.length === 1 ? "" : "s"}` : null].filter(Boolean).join(", ");
  return (
    <Button type="button" variant="ghost" onClick={onPick} aria-label={label}
      className={cn("flex h-auto min-h-8 w-full flex-col items-start justify-start gap-0 rounded-[var(--pc-radius-inner)] border px-1.5 py-1 text-left font-normal leading-tight whitespace-normal transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--pc-focus)] pointer-coarse:min-h-11", tone)}>
      <span className="flex w-full items-center gap-1">
        <span className="text-xs tabular-nums whitespace-nowrap text-ui-muted-foreground">{entry.text}</span>
        {entry.absent ? <UserX aria-hidden="true" className="ml-auto size-3.5 shrink-0 text-[var(--pc-danger)]" /> : null}
        {!entry.absent && entry.warnings.length ? <TriangleAlert aria-hidden="true" className="ml-auto size-3.5 shrink-0 text-[var(--pc-warning)]" /> : null}
      </span>
      <span className={cn("w-full truncate text-xs font-semibold", entry.absent && "line-through decoration-[var(--pc-danger)]")}>{entry.who ?? "Unfilled"}</span>
    </Button>
  );
}
