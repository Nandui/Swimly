import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { ShiftDialog } from "@/components/rota/actions";
import { RotaSheet } from "@/components/rota/sheet";
import { today } from "@/lib/format";
import { addDaysIso, ROSTER_LEAVE_META } from "@/lib/rota/constants";
import { rotaWeek } from "@/lib/rota/data";
import { buildSheet } from "@/lib/rota/sheet";

export const metadata: Metadata = { title: { absolute: "Turnfin Rota" } };

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const at = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** One site's week as a roster sheet: people down the side, days across. */
export default async function RotaPage({ searchParams }: { searchParams: Promise<{ site?: string; week?: string }> }) {
  const input = await searchParams;
  const data = await rotaWeek(input.site, input.week);
  const { site, monday } = data;
  const link = (week: string) => `/rota?${new URLSearchParams({ ...(site ? { site: site.id } : {}), week })}`;
  const sunday = addDaysIso(monday, 6);
  const now = today();
  const all = data.days.flatMap((d) => d.shifts);
  const warnings = all.filter((s) => s.warnings.some((w) => w !== "open" && w !== "absent")).length;
  const absent = all.filter((s) => s.warnings.includes("absent")).length;
  const open = all.filter((s) => s.kind === "shift" && !s.userId && !s.rotaPersonId).length;
  const sheet = buildSheet(data.days, (s) => (s.kind === "holiday" ? "Holiday" : s.note || ROSTER_LEAVE_META.leave.label));
  const days = data.days.map((d) => ({ iso: d.iso, weekday: WEEKDAY.format(at(d.iso)), date: DAY.format(at(d.iso)), today: d.iso === now }));
  const editable = Object.fromEntries(all.filter((s) => !s.importId).map((s) => [s.id, {
    id: s.id, date: s.date, startMinutes: s.startMinutes, endMinutes: s.endMinutes, role: s.role, note: s.note, userId: s.userId, requiredTypeId: s.requiredTypeId,
  }]));
  const summary = [
    absent ? `${absent} ${absent === 1 ? "shift needs" : "shifts need"} cover` : null,
    open ? `${open} unfilled` : null,
    warnings ? `${warnings} with a qualification or double-booking warning` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="module-heading">
        <div className="space-y-1">
          <h1>Rota{site ? <span className="font-normal text-ui-muted-foreground">: {site.name}</span> : null}</h1>
          <p className="text-sm">{DAY.format(at(monday))} to {DAY.format(at(sunday))} {at(sunday).getUTCFullYear()} · {sheet.people} {sheet.people === 1 ? "person" : "people"}{summary.length ? ` · ${summary.join(" · ")}` : " · nothing needs a look"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {site ? (
            <nav aria-label="Weeks" className="flex items-center gap-1">
              <Button asChild variant="outline" size="icon" aria-label="Previous week"><Link href={link(addDaysIso(monday, -7))}><ChevronLeft aria-hidden="true" /></Link></Button>
              <Button asChild variant={monday <= now && now <= sunday ? "secondary" : "outline"}><Link href={link(now)} aria-current={monday <= now && now <= sunday ? "date" : undefined}>This week</Link></Button>
              <Button asChild variant="outline" size="icon" aria-label="Next week"><Link href={link(addDaysIso(monday, 7))}><ChevronRight aria-hidden="true" /></Link></Button>
            </nav>
          ) : null}
          {site?.manage ? <ShiftDialog siteId={site.id} date={monday <= now && now <= sunday ? now : monday} people={data.people} types={data.types} /> : null}
        </div>
      </div>
      {data.sites.length === 0 || !site ? (
        <div className="module-empty"><CalendarDays aria-hidden="true" /><h2 className="font-semibold">No sites to show</h2><p className="mt-2 text-sm text-ui-muted-foreground">Your rota role does not cover a site yet.</p></div>
      ) : (
        <>
          <RotaSheet sheet={sheet} days={days} siteId={site.id} manage={site.manage} editable={editable} people={data.people} types={data.types}
            siteChooser={data.sites.length > 1 ? (
              <form key="site" method="get" className="flex min-w-0 items-center gap-2" aria-label="Choose a site">
                <div className="w-full sm:w-60"><NativeSelect name="site" defaultValue={site.id} aria-label="Site">
                  {data.sites.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
                </NativeSelect></div>
                <input type="hidden" name="week" value={monday} />
                <Button type="submit" variant="outline">Show</Button>
              </form>
            ) : null} />
        </>
      )}
    </div>
  );
}
