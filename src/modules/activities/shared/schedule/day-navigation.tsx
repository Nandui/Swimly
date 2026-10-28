"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { shiftWeeks } from "@/modules/activities/shared/attendance/dates";
import { formatDay, formatWeekday, parseDateOnly } from "@/lib/format";
import { scheduleWeek } from "@/modules/activities/shared/schedule/dates";

/** A week of days to pick from. Schedule allows any day; Duty manager passes `min` and `max`
 *  (today to four weeks ahead), and days outside them are disabled. */
export function ScheduleDayNavigation({ iso, todayIso, pending, onSelect, min, max, label = "Schedule dates" }: {
  iso: string; todayIso: string; pending: boolean; onSelect: (date?: string) => void; min?: string; max?: string; label?: string;
}) {
  const days = scheduleWeek(iso), outside = (date: string) => (min !== undefined && date < min) || (max !== undefined && date > max);
  const previous = shiftWeeks(days[0], -1), next = shiftWeeks(days[0], 1);
  // Moving a week keeps within the limits: to the first or last allowed day if the same weekday is outside.
  const clamp = (date: string) => min !== undefined && date < min ? min : max !== undefined && date > max ? max : date;
  // Wide: previous, the seven days, next, Today on one row. Below 1024px: the buttons on a row of
  // their own and the seven days as a full-width grid below, so no day is ever hidden in a scroll.
  return <nav aria-label={label} className="flex min-w-0 flex-wrap items-center gap-2 max-lg:w-full">
    <Button variant="outline" size="icon" aria-label="Previous week" disabled={pending || (min !== undefined && days[0] <= min)} onClick={() => onSelect(clamp(previous))}><ChevronLeft aria-hidden /></Button>
    <div className="pc-days grid w-full grid-cols-7 gap-0 max-lg:order-last lg:flex lg:w-auto">
      {days.map(date => {
        const weekday = date === todayIso ? "Today" : formatWeekday(date, "short");
        return <Button key={date} variant="ghost" className="pc-day" disabled={pending || outside(date)}
          aria-pressed={date === iso} aria-current={date === todayIso ? "date" : undefined} aria-label={`${weekday}, ${formatDay(date)}`}
          onClick={() => onSelect(date)}>
          {weekday}<small className="tabular-nums">{parseDateOnly(date).getUTCDate()}</small>
        </Button>;
      })}
    </div>
    <Button variant="outline" size="icon" aria-label="Next week" disabled={pending || (max !== undefined && days[6] >= max)} onClick={() => onSelect(clamp(next))}><ChevronRight aria-hidden /></Button>
    <Button variant="outline" disabled={pending} onClick={() => onSelect()}>Today</Button>
  </nav>;
}
