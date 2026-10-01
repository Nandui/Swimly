"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search, TriangleAlert, UserX } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { CancelShift, ShiftDialog } from "@/components/rota/actions";
import { RotaWarningTag } from "@/components/rota/status";
import { cn } from "@/lib/utils";
import { ROSTER_LEAVE_META } from "@/lib/rota/constants";
import { hours, type RotaSheetData, type SheetEntry, type SheetRow } from "@/lib/rota/sheet";

const THEME = "turnfin-docs turnfin-module";
type Option = { id: string; name: string };
type EditableShift = { id: string; date: Date; startMinutes: number; endMinutes: number; role: string; note: string; userId: string | null; requiredTypeId: string | null };
type Day = { iso: string; weekday: string; date: string; today: boolean };

/** The week as a roster sheet: people down the side, grouped by department,
 *  days across, hours at the end. The name column and the day headings stay
 *  put while scrolling. Any entry opens its details; one added by hand can be
 *  changed or cancelled from there. */
export function RotaSheet({ sheet, days, siteId, manage, editable, people, types, siteChooser }: {
  sheet: RotaSheetData;
  days: Day[];
  siteId: string;
  manage: boolean;
  editable: Record<string, EditableShift>;
  people: (Option & { jobTitle: string | null })[];
  types: Option[];
  /** The site picker, when there is more than one site. */
  siteChooser?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [open, setOpen] = useState<{ entry: SheetEntry; row: SheetRow; day: Day } | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sheet.groups
      .filter((g) => !group || g.key === group)
      .map((g) => ({ ...g, rows: q ? g.rows.filter((r) => r.name.toLowerCase().includes(q) || r.sub.toLowerCase().includes(q)) : g.rows }))
      .filter((g) => g.rows.length);
  }, [sheet.groups, query, group]);
  const rowsShown = shown.reduce((n, g) => n + g.rows.length, 0);
  const showOpen = sheet.open && !query && !group;

  const pick = (entry: SheetEntry, row: SheetRow, day: Day) => setOpen({ entry, row, day });
  const shift = open ? editable[open.entry.id] : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {siteChooser}
        <div className="relative min-w-0 flex-1 basis-48 sm:max-w-72">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ui-muted-foreground" />
          <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a person or number" aria-label="Find a person on the rota" className="pl-9" />
        </div>
        <div className="w-full sm:w-52"><NativeSelect aria-label="Department" value={group} onChange={(e) => setGroup(e.target.value)}>
          <NativeSelectOption value="">Every department</NativeSelectOption>
          {sheet.groups.map((g) => <NativeSelectOption key={g.key} value={g.key}>{g.label} ({g.rows.length})</NativeSelectOption>)}
        </NativeSelect></div>
        <p className="text-xs text-ui-muted-foreground sm:ml-auto" aria-live="polite">{rowsShown} of {sheet.people} {sheet.people === 1 ? "person" : "people"}</p>
      </div>

      <Table containerClassName="max-h-[calc(100dvh-14rem)] min-h-64 overflow-auto rounded-[var(--pc-radius-panel)] border border-ui-border bg-ui-card"
        className="min-w-[60rem] border-separate border-spacing-0" tabIndex={0} aria-label="Roster sheet">
          <TableCaption className="sr-only">Shifts for the week, one row per person, a column per day.</TableCaption>
          <TableHeader>
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead scope="col" className="sticky top-0 left-0 z-30 w-32 min-w-32 sm:w-56 sm:min-w-44 border-r border-b border-ui-border bg-[var(--pc-surface-sunken)] px-3 py-2 text-left text-xs font-semibold text-ui-muted-foreground">Person</TableHead>
              {days.map((d) => (
                <TableHead key={d.iso} scope="col" aria-current={d.today ? "date" : undefined}
                  className={cn("sticky top-0 z-20 min-w-28 border-b border-ui-border px-2 py-2 text-left font-semibold", d.today ? "bg-[var(--pc-primary-soft)] text-[var(--pc-primary-ink)]" : "bg-[var(--pc-surface-sunken)]")}>
                  <span className="block text-xs">{d.weekday}</span>
                  <span className={cn("block text-xs font-normal", d.today ? "" : "text-ui-muted-foreground")}>{d.date}{d.today ? " · today" : ""}</span>
                </TableHead>
              ))}
              <TableHead scope="col" className="sticky top-0 z-20 w-16 border-b border-l border-ui-border bg-[var(--pc-surface-sunken)] px-2 py-2 text-right text-xs font-semibold text-ui-muted-foreground">Hours</TableHead>
            </TableRow>
          </TableHeader>
          {showOpen ? (
            <TableBody>
              <GroupHeading label="Unfilled shifts" count={null} />
              <Row row={sheet.open!} days={days} onPick={pick} unfilled />
            </TableBody>
          ) : null}
          {shown.map((g) => (
            <TableBody key={g.key}>
              <GroupHeading label={g.label} count={g.rows.length} />
              {g.rows.map((r) => <Row key={r.key} row={r} days={days} onPick={pick} />)}
            </TableBody>
          ))}
          {rowsShown === 0 && !showOpen ? (
            <TableBody><TableRow className="border-0 hover:bg-transparent"><TableCell colSpan={9} className="px-3 py-10 text-center text-ui-muted-foreground">{query || group ? "Nobody matches. Clear the search to see everyone." : "No shifts this week."}</TableCell></TableRow></TableBody>
          ) : null}
          <TableFooter className="border-0 bg-transparent">
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead scope="row" className="sticky bottom-0 left-0 z-30 border-t border-r border-ui-border bg-[var(--pc-surface-sunken)] px-3 py-2 text-left text-xs font-semibold">On shift</TableHead>
              {days.map((d, i) => (
                <TableCell key={d.iso} className={cn("sticky bottom-0 z-20 border-t border-ui-border px-2 py-2 text-xs tabular-nums", d.today ? "bg-[var(--pc-primary-soft)]" : "bg-[var(--pc-surface-sunken)]")}>
                  <span className="font-semibold">{sheet.onShift[i]}</span> <span className="text-ui-muted-foreground">· {hours(sheet.dayMinutes[i])}h</span>
                </TableCell>
              ))}
              <TableCell className="sticky bottom-0 z-20 border-t border-l border-ui-border bg-[var(--pc-surface-sunken)] px-2 py-2 text-right text-xs font-semibold tabular-nums">{hours(sheet.dayMinutes.reduce((a, b) => a + b, 0))}</TableCell>
            </TableRow>
          </TableFooter>
      </Table>
      <Legend />

      <Dialog open={!!open} onOpenChange={(v) => { if (!v) setOpen(null); }}>
        {open ? (
          <DialogContent portalClassName={THEME} className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{open.row.name}</DialogTitle>
              <DialogDescription>{open.day.weekday} {open.day.date}</DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
              <dt className="text-ui-muted-foreground">{open.entry.kind === "shift" ? "Time" : "Day"}</dt>
              <dd className="font-semibold tabular-nums">{open.entry.text}{open.entry.kind === "shift" ? ` (${hours(open.entry.minutes)}h)` : ""}</dd>
              {open.entry.detail ? <><dt className="text-ui-muted-foreground">Department</dt><dd>{open.entry.detail}</dd></> : null}
              {open.row.sub ? <><dt className="text-ui-muted-foreground">Employee</dt><dd className="tabular-nums">{open.row.sub}</dd></> : null}
              <dt className="text-ui-muted-foreground">Came from</dt>
              <dd>{open.entry.editable ? "Added by hand" : "The roster upload. Upload the week again to change it."}</dd>
            </dl>
            {open.entry.absent || open.entry.warnings.length ? (
              <div className="flex flex-wrap gap-2">
                {open.entry.absent ? <RotaWarningTag warning="absent" /> : null}
                {open.entry.warnings.map((w) => <RotaWarningTag key={w} warning={w} />)}
              </div>
            ) : null}
            {manage && shift ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-ui-border pt-4">
                <ShiftDialog siteId={siteId} date={open.day.iso} shift={shift} people={people} types={types} label="Change shift" />
                <CancelShift id={shift.id} label={`${shift.role} ${open.entry.text}`} withText />
              </div>
            ) : null}
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function GroupHeading({ label, count }: { label: string; count: number | null }) {
  return (
    <TableRow className="border-0 hover:bg-transparent">
      <TableHead colSpan={9} scope="colgroup" className="border-b border-ui-border bg-ui-card p-0 text-left">
        <span className="sticky left-0 inline-flex items-baseline gap-2 px-3 pt-4 pb-1.5">
          <span className="text-xs font-bold tracking-wide text-[var(--pc-primary-ink)] uppercase">{label}</span>
          {count !== null ? <span className="text-xs text-ui-muted-foreground">{count}</span> : null}
        </span>
      </TableHead>
    </TableRow>
  );
}

function Row({ row, days, onPick, unfilled = false }: { row: SheetRow; days: Day[]; onPick: (e: SheetEntry, r: SheetRow, d: Day) => void; unfilled?: boolean }) {
  return (
    <TableRow className="group/row border-0 hover:bg-transparent">
      <TableHead scope="row" className="sticky left-0 z-10 border-r border-b border-ui-border bg-ui-card px-3 py-1.5 text-left align-top font-normal group-hover/row:bg-[var(--pc-hover)]">
        <span className={cn("block max-w-28 truncate font-medium sm:max-w-52", unfilled && "text-[var(--pc-warning)]")} title={row.name}>{row.name}</span>
        {row.sub ? <span className="block text-xs text-ui-muted-foreground tabular-nums">{row.sub}</span> : null}
      </TableHead>
      {row.days.map((cell, i) => (
        <TableCell key={days[i].iso} className={cn("border-b border-ui-border px-1.5 py-1.5 align-top group-hover/row:bg-[var(--pc-hover)]", days[i].today && "bg-[color-mix(in_oklab,var(--pc-primary-soft)_45%,transparent)]")}>
          <div className="flex flex-col gap-1">
            {cell.map((e) => <Entry key={e.id} entry={e} onPick={() => onPick(e, row, days[i])} />)}
          </div>
        </TableCell>
      ))}
      <TableCell className="border-b border-l border-ui-border px-2 py-1.5 text-right align-top text-sm font-semibold tabular-nums group-hover/row:bg-[var(--pc-hover)]">
        {row.shifts ? hours(row.minutes) : <span className="font-normal text-ui-muted-foreground">–</span>}
      </TableCell>
    </TableRow>
  );
}

/** One shift, holiday or leave in a cell. Colour is never the only signal:
 *  an absence and a warning each carry an icon and a label for screen readers. */
function Entry({ entry, onPick }: { entry: SheetEntry; onPick: () => void }) {
  const leave = entry.kind !== "shift";
  const tone = entry.absent
    ? "border-[var(--pc-danger)] bg-[var(--pc-danger-soft)] text-ui-foreground"
    : entry.kind === "holiday" ? "border-transparent bg-[var(--pc-aqua-soft)] text-[var(--pc-aqua-ink)]"
    : leave ? "border-transparent bg-[var(--pc-neutral-soft)] text-ui-foreground"
    : "border-ui-border bg-ui-card text-ui-foreground hover:border-[var(--pc-primary)]";
  const label = [entry.text, entry.department, entry.absent ? "absent, needs cover" : null, entry.warnings.length ? `${entry.warnings.length} warning${entry.warnings.length === 1 ? "" : "s"}` : null].filter(Boolean).join(", ");
  return (
    <Button type="button" variant="ghost" onClick={onPick} aria-label={label} title={entry.detail || undefined}
      className={cn("flex h-auto min-h-8 w-full flex-col items-start justify-start gap-0 rounded-[var(--pc-radius-inner)] border px-1.5 py-1 text-left font-normal leading-tight whitespace-normal transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--pc-focus)] pointer-coarse:min-h-11", tone)}>
      <span className="flex w-full items-center gap-1">
        <span className={cn("text-xs font-semibold tabular-nums whitespace-nowrap", entry.absent && "line-through decoration-[var(--pc-danger)]")}>{entry.text}</span>
        {entry.absent ? <UserX aria-hidden="true" className="ml-auto size-3.5 shrink-0 text-[var(--pc-danger)]" /> : null}
        {!entry.absent && entry.warnings.length ? <TriangleAlert aria-hidden="true" className="ml-auto size-3.5 shrink-0 text-[var(--pc-warning)]" /> : null}
      </span>
      {entry.department ? <span className="w-full truncate text-[11px] text-ui-muted-foreground">{entry.department}</span> : null}
    </Button>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ui-muted-foreground" aria-label="Key">
      <li className="flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded-sm border border-ui-border bg-ui-card" />Shift</li>
      <li className="flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded-sm bg-[var(--pc-aqua-soft)]" />{ROSTER_LEAVE_META.holiday.label}</li>
      <li className="flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded-sm bg-[var(--pc-neutral-soft)]" />Other leave</li>
      <li className="flex items-center gap-1.5"><UserX aria-hidden="true" className="size-3.5 text-[var(--pc-danger)]" />Off, needs cover</li>
      <li className="flex items-center gap-1.5"><TriangleAlert aria-hidden="true" className="size-3.5 text-[var(--pc-warning)]" />Qualification or double-booking</li>
      <li>Select any entry for its details.</li>
    </ul>
  );
}
