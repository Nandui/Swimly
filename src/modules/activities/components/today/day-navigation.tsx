"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { shiftWeeks } from "@/modules/activities/lib/attendance/dates";
import { formatDay, formatWeekday, parseDateOnly } from "@/lib/format";
import { scheduleWeek } from "@/modules/activities/lib/schedule/dates";

export function ScheduleDayNavigation({ iso, todayIso, pending, onSelect }: {
  iso: string; todayIso: string; pending: boolean; onSelect: (date?: string) => void;
}) {
  const days = scheduleWeek(iso);
  // Wide: previous, the seven days, next, Today on one row. Below 1024px: the buttons on a row of
  // their own and the seven days as a full-width grid below, so no day is ever hidden in a scroll.
  return <nav aria-label="Schedule dates" className="flex min-w-0 flex-wrap items-center gap-2 max-lg:w-full">
    <Button variant="outline" size="icon" aria-label="Previous week" disabled={pending} onClick={() => onSelect(shiftWeeks(days[0], -1))}><ChevronLeft aria-hidden /></Button>
    <div className="grid w-full grid-cols-7 gap-0 max-lg:order-last md:gap-2 lg:flex lg:w-auto">
      {days.map(date => {
        const weekday = date === todayIso ? "Today" : formatWeekday(date, "short");
        return <Button key={date} variant={date === iso ? "default" : "outline"} className="pc-day" disabled={pending}
          aria-pressed={date === iso} aria-current={date === todayIso ? "date" : undefined} aria-label={`${weekday}, ${formatDay(date)}`}
          onClick={() => onSelect(date)}>
          {weekday}<small className="tabular-nums">{parseDateOnly(date).getUTCDate()}</small>
        </Button>;
      })}
    </div>
    <Button variant="outline" size="icon" aria-label="Next week" disabled={pending} onClick={() => onSelect(shiftWeeks(days[0], 1))}><ChevronRight aria-hidden /></Button>
    <Button variant="outline" disabled={pending} onClick={() => onSelect()}>Today</Button>
  </nav>;
}
