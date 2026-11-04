"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { shiftWeeks } from "@/modules/activities/shared/attendance/dates";
import { formatDateRange, formatDay, formatWeekday, parseDateOnly } from "@/lib/format";
import { scheduleWeek } from "@/modules/activities/shared/schedule/dates";

export function ScheduleDayNavigation({ iso, todayIso, pending, onSelect }: {
  iso: string; todayIso: string; pending: boolean; onSelect: (date?: string) => void;
}) {
  const days = scheduleWeek(iso);
  // Wide: previous, the seven days, next (and Today when this week lacks it) on one row. Below
  // 1024px: the buttons around the week's dates on a row of their own, and the seven days as a
  // full-width grid below, so no day is ever hidden in a scroll.
  return <nav aria-label="Schedule dates" className="flex min-w-0 flex-wrap items-center gap-2 max-lg:w-full">
    <Button variant="outline" size="icon" aria-label="Previous week" disabled={pending} onClick={() => onSelect(shiftWeeks(days[0], -1))}><ChevronLeft aria-hidden /></Button>
    {/* Below 1024px the arrows have a row of their own: name the week between them. */}
    <span className="flex-1 text-center font-semibold tabular-nums lg:hidden">{formatDateRange(days[0], days[6])}</span>
    <div className="pc-days grid w-full grid-cols-7 gap-0 max-lg:order-last lg:flex lg:w-auto">
      {days.map(date => {
        const weekday = date === todayIso ? "Today" : formatWeekday(date, "short");
        return <Button key={date} variant="ghost" className="pc-day" disabled={pending}
          aria-pressed={date === iso} aria-current={date === todayIso ? "date" : undefined} aria-label={`${weekday}, ${formatDay(date)}`}
          onClick={() => onSelect(date)}>
          {weekday}<small className="tabular-nums">{parseDateOnly(date).getUTCDate()}</small>
        </Button>;
      })}
    </div>
    <Button variant="outline" size="icon" aria-label="Next week" disabled={pending} onClick={() => onSelect(shiftWeeks(days[0], 1))}><ChevronRight aria-hidden /></Button>
    {/* The way back to today, only when this week has no "Today" day of its own. */}
    {days.includes(todayIso) ? null : <Button variant="outline" disabled={pending} onClick={() => onSelect()}>Today</Button>}
  </nav>;
}
