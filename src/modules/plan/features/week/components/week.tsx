import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { SegmentedLinks } from "@/components/ui-kit/segmented-links";
import { Tag } from "@/components/ui-kit/tag";
import { formatDateRange, formatDayMonth, formatTimeRange, formatWeekday, plural } from "@/lib/format";
import { CopyWeekButton } from "@/modules/plan/features/week/components/copy-week";
import type { PlanWeekData } from "@/modules/plan/features/week/server/data";
import { shiftIso } from "@/modules/plan/shared/model";
import { offReasonMeta } from "@/modules/plan/shared/rules";
import { RemoveShiftDialog, ShiftDialog } from "@/modules/plan/shared/components/shift-dialog";

/** The Week: the department's people down the side, Monday to Sunday across, each day's shift (with
 *  how many duties it has), who is off, and anyone also on another department's plan that day. */
export function WeekView({ data }: { data: PlanWeekData }) {
  const { site, department, days, monday, rows, shifts, offs, otherPlans, canPlan, departments, people } = data;
  const link = (change: Record<string, string>) => `/plan?${new URLSearchParams({ site: site.id, week: monday, ...(department ? { dept: department.id } : {}), ...change })}`;
  const dayLink = (date: string) => `/plan/day?${new URLSearchParams({ site: site.id, date })}`;
  const departmentName = (id: string) => departments.all.find((d) => d.id === id)?.name ?? "another department";
  const draft = (userId: string, date: string) => ({ userId, departmentId: department?.id ?? "", date, start: 7 * 60, end: 15 * 60, note: "" });

  return (
    <div className="flex flex-col gap-(--space-6)">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon" className="min-h-11 min-w-11"><Link href={link({ week: shiftIso(monday, -7) })} aria-label="The week before"><ChevronLeft aria-hidden="true" /></Link></Button>
          <p className="font-semibold tabular-nums">{formatDateRange(monday, shiftIso(monday, 6))}</p>
          <Button asChild variant="outline" size="icon" className="min-h-11 min-w-11"><Link href={link({ week: shiftIso(monday, 7) })} aria-label="The week after"><ChevronRight aria-hidden="true" /></Link></Button>
          {data.today < monday || data.today > shiftIso(monday, 6) ? <Button asChild variant="ghost" className="min-h-11"><Link href={link({ week: data.today })}>This week</Link></Button> : null}
        </div>
        {canPlan && department ? (
          <div className="flex flex-wrap gap-2">
            <ShiftDialog siteId={site.id} draft={draft("", monday)} people={people} departments={departments.mine}
              trigger={<Button variant="outline" className="min-h-11"><UserPlus aria-hidden="true" />Add a shift</Button>} />
            <CopyWeekButton siteId={site.id} departmentId={department.id} week={monday} departmentName={department.name} />
          </div>
        ) : null}
      </div>

      {departments.all.length > 1 ? (
        <SegmentedLinks label="Department" items={departments.all.map((d) => ({ href: link({ dept: d.id }), label: d.name, current: d.id === department?.id }))} />
      ) : null}

      {!department ? <EmptyState icon="users" title="This site has no departments yet" hint="Departments are kept in Admin. Each shift is on one department's plan." />
        : rows.length === 0 ? <EmptyState icon="users" title={`Nobody at ${site.name} is in ${department.name}`} hint="Add a shift to borrow someone from another department." />
        : (
          <Table containerClassName="pc-panel">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Person</TableHead>
                {days.map((d) => (
                  <TableHead key={d} scope="col" data-today={d === data.today ? "" : undefined}>
                    <Link href={dayLink(d)} className="flex flex-col underline-offset-4 hover:underline"><span>{formatWeekday(d, "short")}</span><span className="tabular-nums text-ui-muted-foreground">{formatDayMonth(d)}</span></Link>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableHead scope="row" className="min-w-36">
                    <span className="flex flex-col"><span>{p.name}</span>{p.borrowed ? <span className="text-sm font-normal text-ui-muted-foreground">Borrowed</span> : null}</span>
                  </TableHead>
                  {days.map((date) => {
                    const shift = shifts.find((s) => s.userId === p.id && s.date === date);
                    const off = offs.find((o) => o.userId === p.id && o.firstDay <= date && o.lastDay >= date);
                    const elsewhere = otherPlans.filter((s) => s.userId === p.id && s.date === date);
                    return (
                      <TableCell key={date} className="min-w-32 align-top">
                        <div className="flex flex-col items-start gap-1">
                          {off ? <Tag meta={offReasonMeta(off.reason)} /> : null}
                          {shift ? (
                            canPlan ? (
                              <ShiftDialog siteId={site.id} draft={{ ...shift, id: shift.id }} people={people} departments={departments.mine}
                                trigger={<Button variant="outline" className="h-auto min-h-11 flex-col items-start gap-0 tabular-nums">
                                  <span>{formatTimeRange(shift.start, shift.end)}</span>
                                  <span className="text-sm font-normal">{shift.blocks.length ? plural(shift.blocks.length, "duty", "duties") : "No duties yet"}</span>
                                </Button>} />
                            ) : <span className="tabular-nums">{formatTimeRange(shift.start, shift.end)}</span>
                          ) : canPlan && !off ? (
                            <ShiftDialog siteId={site.id} draft={draft(p.id, date)} people={people} departments={departments.mine} personFixed
                              trigger={<Button variant="ghost" className="min-h-11 text-ui-muted-foreground" aria-label={`Add a shift for ${p.name} on ${formatWeekday(date)}`}><Plus aria-hidden="true" /></Button>} />
                          ) : null}
                          {shift && canPlan ? <RemoveShiftDialog id={shift.id} name={p.name} date={date}
                            trigger={<Button variant="link" className="h-auto p-0 text-sm">Remove</Button>} /> : null}
                          {elsewhere.map((s) => <span key={s.id} className="text-sm text-ui-muted-foreground tabular-nums">Also {departmentName(s.departmentId)} {formatTimeRange(s.start, s.end)}</span>)}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
    </div>
  );
}
