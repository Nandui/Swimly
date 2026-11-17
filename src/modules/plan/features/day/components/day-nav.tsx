"use client";

import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { formatDay } from "@/lib/format";
import { shiftIso } from "@/modules/plan/shared/model";

/** Moving between days on a Day: the day before, any day in one go (owner, 4 November 2026: the
 *  date opens the device's own date picker), the day after, and back to today. `href` says where a
 *  day opens, so each view of the Day keeps its own page and department. */
export function DayNav({ date, today, href }: { date: string; today: string; href: (date: string) => string }) {
  const router = useRouter();
  const dateInput = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline" size="icon" className="min-h-11 min-w-11"><Link href={href(shiftIso(date, -1))} aria-label="The day before"><ChevronLeft aria-hidden="true" /></Link></Button>
      <div className="relative">
        <Button variant="outline" className="min-h-11 font-semibold" aria-label={`${formatDay(date)}. Choose another day`}
          onClick={() => { const input = dateInput.current; if (!input) return; try { input.showPicker(); } catch { input.focus(); } }}>
          <CalendarDays aria-hidden="true" />{formatDay(date)}
        </Button>
        <Input ref={dateInput} type="date" value={date} aria-label="Go to day" tabIndex={-1}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
          onChange={(e) => { if (e.target.value && e.target.value !== date) router.push(href(e.target.value)); }} />
      </div>
      <Button asChild variant="outline" size="icon" className="min-h-11 min-w-11"><Link href={href(shiftIso(date, 1))} aria-label="The day after"><ChevronRight aria-hidden="true" /></Link></Button>
      {date === today ? null : <Button asChild variant="ghost" className="min-h-11"><Link href={href(today)}>Today</Link></Button>}
    </div>
  );
}
