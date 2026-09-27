import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Label } from "@/components/shadcn/label";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { CancelShift, ShiftDialog } from "@/components/rota/actions";
import { RotaWarningTag } from "@/components/rota/status";
import { formatDate, today } from "@/lib/format";
import { addDaysIso, clock, WEEKDAY_LABELS } from "@/lib/rota/constants";
import { rotaWeek } from "@/lib/rota/data";

export const metadata: Metadata = { title: { absolute: "Turnfin Rota" } };

export default async function RotaPage({ searchParams }: { searchParams: Promise<{ site?: string; week?: string }> }) {
  const input = await searchParams;
  const data = await rotaWeek(input.site, input.week);
  const { site, monday } = data;
  const link = (week: string) => `/rota?${new URLSearchParams({ ...(site ? { site: site.id } : {}), week })}`;
  const warnings = data.days.reduce((sum, d) => sum + d.shifts.filter((s) => s.warnings.some((w) => w !== "open")).length, 0);
  const open = data.days.reduce((sum, d) => sum + d.shifts.filter((s) => !s.userId).length, 0);
  return (
    <div className="space-y-6">
      <div className="module-heading">
        <div className="space-y-2">
          <h1>Rota{site ? `: ${site.name}` : ""}</h1>
          <p className="text-sm">Week of {formatDate(new Date(`${monday}T00:00:00Z`))}. {warnings === 0 ? "No qualification problems." : `${warnings} ${warnings === 1 ? "shift needs" : "shifts need"} a look.`}{open ? ` ${open} unfilled.` : ""}</p>
        </div>
      </div>
      {data.sites.length === 0 ? (
        <div className="module-empty"><CalendarDays aria-hidden="true" /><h2 className="font-semibold">No sites to show</h2><p className="mt-2 text-sm text-ui-muted-foreground">Your rota role does not cover a site yet.</p></div>
      ) : (
        <>
          <form method="get" className="module-filters flex flex-wrap items-end gap-3" aria-label="Choose a site and week">
            {data.sites.length > 1 ? (
              <div className="min-w-0 flex-1 space-y-2"><Label htmlFor="rota-site">Site</Label>
                <NativeSelect id="rota-site" name="site" defaultValue={site?.id} className="min-h-11 w-full">
                  {data.sites.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
                </NativeSelect>
              </div>
            ) : <input type="hidden" name="site" value={site?.id} />}
            <input type="hidden" name="week" value={monday} />
            {data.sites.length > 1 ? <Button type="submit" className="min-h-11">Show</Button> : null}
            <nav aria-label="Weeks" className="flex gap-2">
              <Button asChild variant="outline" className="min-h-11"><Link href={link(addDaysIso(monday, -7))}><ChevronLeft aria-hidden="true" />Previous</Link></Button>
              <Button asChild variant="ghost" className="min-h-11"><Link href={link(today())}>This week</Link></Button>
              <Button asChild variant="outline" className="min-h-11"><Link href={link(addDaysIso(monday, 7))}>Next<ChevronRight aria-hidden="true" /></Link></Button>
            </nav>
          </form>
          <div className="space-y-4">
            {data.days.map((day, i) => (
              <section key={day.iso} className="module-panel" aria-labelledby={`day-${day.iso}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 id={`day-${day.iso}`}>{WEEKDAY_LABELS[i]} <span className="font-normal text-ui-muted-foreground">{formatDate(new Date(`${day.iso}T00:00:00Z`))}</span></h2>
                  {site?.manage ? <ShiftDialog siteId={site.id} date={day.iso} people={data.people} types={data.types} /> : null}
                </div>
                {day.shifts.length === 0 ? <p className="text-sm text-ui-muted-foreground">No shifts.</p> : (
                  <ul className="mt-2">
                    {day.shifts.map((s) => (
                      <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          <p><span className="font-semibold tabular-nums">{clock(s.startMinutes)}–{clock(s.endMinutes)}</span> · {s.role}{s.user ? ` · ${s.user.name}` : ""}</p>
                          {s.requiredType || s.note ? <p className="text-xs text-ui-muted-foreground">{[s.requiredType ? `Needs ${s.requiredType.name}` : null, s.note || null].filter(Boolean).join(" · ")}</p> : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {s.warnings.map((w) => <RotaWarningTag key={w} warning={w} />)}
                          {site?.manage ? <><ShiftDialog siteId={site.id} date={day.iso} shift={s} people={data.people} types={data.types} /><CancelShift id={s.id} label={`${s.role} ${clock(s.startMinutes)}`} /></> : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
