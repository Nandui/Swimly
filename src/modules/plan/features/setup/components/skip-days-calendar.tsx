"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { cn } from "@/lib/utils";
import { weekdayOfIso } from "@/modules/plan/shared/model";
import { WEEKDAYS } from "@/modules/plan/shared/rules";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const say = (iso: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(utc(iso));
const shiftMonth = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};
const daysIn = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/** The days something runs, a month at a time: press a day to take it off, press again to put it back.
 *  Only days between the first and last day, on the chosen days of the week, can be pressed. */
export function SkipDaysCalendar({ firstDay, lastDay, weekdays, skipDays, today, onChange }: {
  firstDay: string; lastDay: string; weekdays: number[]; skipDays: string[]; today: string; onChange: (skipDays: string[]) => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  if (!ISO_DAY.test(firstDay) || !ISO_DAY.test(lastDay) || lastDay < firstDay || !weekdays.length) {
    return <p className="text-sm text-ui-muted-foreground">Choose the days of the week and the first and last day, then take off any day it doesn&apos;t run.</p>;
  }
  const first = firstDay.slice(0, 7), last = lastDay.slice(0, 7);
  const start = today >= firstDay && today <= lastDay ? today.slice(0, 7) : first;
  const month = chosen && chosen >= first && chosen <= last ? chosen : start;
  const runs = (iso: string) => iso >= firstDay && iso <= lastDay && weekdays.includes(weekdayOfIso(iso));
  const off = skipDays.filter(runs);
  const days = Array.from({ length: daysIn(month) }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  const toggle = (iso: string) => onChange(skipDays.includes(iso) ? skipDays.filter((d) => d !== iso) : [...skipDays, iso].sort());

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-ui-muted-foreground">Press a day to take it off. Press it again to put it back.</p>
      <div className="flex max-w-sm flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="Month before" disabled={month <= first} onClick={() => setChosen(shiftMonth(month, -1))}><ChevronLeft aria-hidden="true" /></Button>
          <p className="font-semibold" aria-live="polite">{say(`${month}-01`, { month: "long", year: "numeric" })}</p>
          <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="Month after" disabled={month >= last} onClick={() => setChosen(shiftMonth(month, 1))}><ChevronRight aria-hidden="true" /></Button>
        </div>
        <div className="grid grid-cols-7 justify-items-center gap-1">
          {WEEKDAYS.map((d) => <span key={d} aria-hidden="true" className="text-sm text-ui-muted-foreground">{d.slice(0, 2)}</span>)}
          {Array.from({ length: weekdayOfIso(days[0]) }, (_, i) => <span key={i} aria-hidden="true" />)}
          {days.map((iso) => {
            const n = Number(iso.slice(8));
            if (!runs(iso)) return <span key={iso} aria-hidden="true" className="grid size-11 place-items-center text-sm tabular-nums text-ui-muted-foreground opacity-60">{n}</span>;
            const on = !skipDays.includes(iso);
            return (
              <Button key={iso} type="button" variant={on ? "default" : "outline"} size="icon" aria-pressed={on}
                aria-label={`${say(iso, { weekday: "long", day: "numeric", month: "long" })}: ${on ? "runs" : "doesn't run"}`}
                className={cn("size-11 tabular-nums", !on && "text-ui-muted-foreground line-through")} onClick={() => toggle(iso)}>{n}</Button>
            );
          })}
        </div>
      </div>
      <p className="text-sm" role="status">
        {off.length ? `Doesn't run on ${off.map((d) => say(d, { weekday: "short", day: "numeric", month: "short", ...(first.slice(0, 4) !== last.slice(0, 4) && { year: "numeric" }) })).join(", ")}.` : "Runs on every one of its days."}
      </p>
    </div>
  );
}
