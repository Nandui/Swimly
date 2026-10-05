"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { shiftWeeks } from "@/modules/activities/lib/attendance/dates";
import { formatDateRange, formatDay, formatWeekday, parseDateOnly } from "@/lib/format";
import { scheduleWeek } from "@/modules/activities/lib/schedule/dates";

export function ScheduleDayNavigation({ iso, todayIso, pending, onSelect }: {
  iso: string; todayIso: string; pending: boolean; onSelect: (date?: string) => void;
}) {
  const days = scheduleWeek(iso);
  return <nav aria-label="Schedule dates" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm font-medium">{formatDateRange(days[0], days[6])}</p>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="size-11" aria-label="Previous week" disabled={pending} onClick={() => onSelect(shiftWeeks(days[0], -1))}><ChevronLeft aria-hidden /></Button>
        <Button variant="outline" className="min-h-11" disabled={pending} onClick={() => onSelect()}>Today</Button>
        <Button variant="ghost" size="icon" className="size-11" aria-label="Next week" disabled={pending} onClick={() => onSelect(shiftWeeks(days[0], 1))}><ChevronRight aria-hidden /></Button>
      </div>
    </div>
    <div className="overflow-x-auto">
      <div className="grid min-w-84 grid-cols-7 gap-1">
        {days.map(date => <Button key={date} variant={date === iso ? "default" : "outline"}
          className="h-16 min-w-11 flex-col gap-1 px-0 focus-visible:ring-inset" disabled={pending}
          aria-pressed={date === iso} aria-label={`${formatDay(date)}${date === todayIso ? ", today" : ""}`}
          onClick={() => onSelect(date)}>
          <span className="text-xs">{date === todayIso ? "Today" : formatWeekday(date, "short")}</span>
          <span className="text-base font-semibold tabular-nums">{parseDateOnly(date).getUTCDate()}</span>
        </Button>)}
      </div>
    </div>
  </nav>;
}
