import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, CalendarX2, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import { Progress } from "@/components/shadcn/progress";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { PageHeader } from "@/components/ui-kit/page-header";
import { AnalyticsRefresh } from "./refresh";
import type { AnalyticsData } from "@/lib/analytics/data";
import { formatDateTime, parseDateOnly } from "@/lib/format";

const number = new Intl.NumberFormat("en-IE");
const percent = new Intl.NumberFormat("en-IE", { maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat("en-IE", { day: "numeric", month: "short", timeZone: "UTC" });
const monthDate = new Intl.DateTimeFormat("en-IE", { month: "long", year: "numeric", timeZone: "UTC" });
const weekday = new Intl.DateTimeFormat("en-IE", { weekday: "short", timeZone: "UTC" });

export function AnalyticsDashboard({ data }: { data: AnalyticsData }) {
  const period = `${shortDate.format(parseDateOnly(data.period.weekStart))} – ${shortDate.format(parseDateOnly(data.period.date))}`;
  const month = monthDate.format(parseDateOnly(data.period.monthStart));
  return <div className="flex min-w-0 flex-col gap-6">
    <PageHeader title="Analytics" description={`${data.siteName} · Enrolment and class activity`} actions={<AnalyticsRefresh />} />
    <div className="grid min-w-0 grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-12">
      <Card className="h-full border-ui-brand-border bg-ui-brand-soft sm:col-span-2 xl:col-span-4">
        <CardHeader className="gap-3"><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-medium">Total swimmers enrolled</h2><Users className="size-5 text-ui-brand-ink" aria-hidden /></div><CardDescription>Current enrolments · {shortDate.format(parseDateOnly(data.period.date))}</CardDescription></CardHeader>
        <CardContent className="space-y-3"><p className="text-5xl font-semibold tracking-tight tabular-nums">{number.format(data.swimmers)}</p><p className="text-sm text-ui-muted-foreground">Across {number.format(data.places)} class places. Each swimmer counted once.</p></CardContent>
      </Card>
      <Card className="h-full xl:col-span-4">
        <CardHeader className="gap-3"><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-medium">Enrolments</h2><ArrowUpRight className="size-5 text-ui-primary" aria-hidden /></div><CardDescription>Last 7 days · {period}</CardDescription></CardHeader>
        <CardContent className="space-y-3"><p className="text-5xl font-semibold tracking-tight tabular-nums">{number.format(data.enrolled)}</p><p className="text-sm text-ui-muted-foreground">New class enrolments and waitlist promotions recorded.</p></CardContent>
      </Card>
      <Card className="h-full xl:col-span-4">
        <CardHeader className="gap-3"><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-medium">Unenrolments</h2><ArrowDownLeft className="size-5 text-ui-muted-foreground" aria-hidden /></div><CardDescription>Last 7 days · {period}</CardDescription></CardHeader>
        <CardContent className="space-y-3"><p className="text-5xl font-semibold tracking-tight tabular-nums">{number.format(data.withdrawn)}</p><p className="text-sm text-ui-muted-foreground">Class withdrawals recorded, including scheduled unenrolments.</p></CardContent>
      </Card>
      <Card className="min-w-0 sm:col-span-2 xl:col-span-8 xl:row-span-2">
        <CardHeader><h2 className="text-lg font-semibold tracking-tight">Enrolled by level</h2><CardDescription>Current enrolled places / total capacity across each level’s weekly classes. Each bar shows how full that level is.</CardDescription></CardHeader>
        <CardContent className="space-y-7">
          {data.swimmers === 0 ? <p className="rounded-ui-lg bg-ui-muted p-4 text-sm text-ui-muted-foreground">No swimmers are currently enrolled in this view.</p> : null}
          {data.groups.length === 0 ? <p className="text-sm text-ui-muted-foreground">Levels will appear here once the curriculum is set up.</p> : data.groups.map(group => <section key={group.id} aria-labelledby={`programme-${group.id}`} className="space-y-4">
            <h3 id={`programme-${group.id}`} className="text-sm font-semibold">{group.name}</h3>
            <dl className="space-y-4">{group.levels.map(level => <div key={level.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2">
              <dt className="min-w-0 text-sm">{level.name}{level.archived ? <span className="ml-2 text-xs text-ui-muted-foreground">Archived</span> : null}</dt>
              <dd className="text-sm font-semibold tabular-nums">
                {number.format(level.count)}<span className="sr-only"> enrolled places</span>
                <span className="font-normal text-ui-muted-foreground"> / {level.capacity === null ? "Uncapped" : number.format(level.capacity)}</span>
                {level.capacity !== null ? <span className="sr-only"> total places</span> : null}
              </dd>
              {level.percentage !== null ? <dd className="col-span-2 flex items-center gap-3">
                <div className="min-w-0 flex-1" aria-hidden="true"><Progress value={Math.min(100, level.percentage)} className="h-2 bg-ui-muted" /></div>
                <span className="shrink-0 text-xs tabular-nums text-ui-muted-foreground">{percent.format(level.percentage)}% filled</span>
                {level.capacity !== null && level.count > level.capacity ? <span className="sr-only"> · {number.format(level.count - level.capacity)} over capacity</span> : null}
              </dd> : <dd className="col-span-2 text-xs text-ui-muted-foreground">
                {level.capacity === null ? "Includes uncapped classes" : level.classes === 0 ? "No classes" : level.count > 0 ? `${number.format(level.count)} over capacity` : "No places configured"}
              </dd>}
            </div>)}</dl>
          </section>)}
        </CardContent>
      </Card>
      <Card className="h-full xl:col-span-4">
        <CardHeader><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold tracking-tight">Class cancellations</h2><CalendarX2 className="size-5 shrink-0 text-ui-muted-foreground" aria-hidden /></div><CardDescription>{month} · Cancelled sessions</CardDescription></CardHeader>
        <CardContent className="space-y-5"><div className="space-y-2"><p className="text-4xl font-semibold tracking-tight tabular-nums">{number.format(data.cancellations.sessions)}</p><p className="text-sm text-ui-muted-foreground">{number.format(data.cancellations.affectedPlaces)} swimmer bookings affected</p></div>
          <dl className="space-y-3 border-t border-ui-border pt-4"><div className="flex items-center justify-between gap-4 text-sm"><dt>Awaiting billing</dt><dd className="font-semibold tabular-nums">{number.format(data.cancellations.pending)}</dd></div><div className="flex items-center justify-between gap-4 text-sm"><dt>Billing notified</dt><dd className="font-semibold tabular-nums">{number.format(data.cancellations.notified)}</dd></div></dl>
          {data.canOpenCancellations ? <Button asChild variant="outline" className="min-h-11 w-full"><Link href="/cancellations">Open billing follow-up<ArrowUpRight className="size-4" aria-hidden /></Link></Button> : null}
        </CardContent>
      </Card>
      <Card className="h-full xl:col-span-4">
        <CardHeader><h2 className="text-lg font-semibold tracking-tight">Daily activity</h2><CardDescription>{period} · Includes today so far</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableCaption className="sr-only">Enrolments and unenrolments recorded each day in the last seven days</TableCaption>
            <TableHeader><TableRow>
              <TableHead scope="col" className="px-0 text-xs text-ui-muted-foreground">Day</TableHead>
              <TableHead scope="col" className="px-0 text-right text-xs text-ui-muted-foreground">Enrolled</TableHead>
              <TableHead scope="col" className="px-0 text-right text-xs text-ui-muted-foreground">Unenrolled</TableHead>
            </TableRow></TableHeader>
            <TableBody>{data.daily.map(row => <TableRow key={row.day}>
              <TableHead scope="row" className="px-0 py-3 font-normal">{row.day === data.period.date ? "Today" : weekday.format(parseDateOnly(row.day))}<span className="sr-only"> {shortDate.format(parseDateOnly(row.day))}</span></TableHead>
              <TableCell className="px-0 py-3 text-right font-medium tabular-nums">{number.format(row.enrolled)}</TableCell>
              <TableCell className="px-0 py-3 text-right tabular-nums">{number.format(row.withdrawn)}</TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
    <footer className="space-y-1 text-xs leading-relaxed text-ui-muted-foreground"><p>Updated {formatDateTime(new Date(data.updatedAt))} · Europe/Dublin</p><p>Current totals exclude waitlists, future starts, inactive swimmers and archived classes. Seven-day figures count recorded actions, excluding moves, imports and waitlist removals; they are not a net change in swimmers. Cancellation totals use the session date.</p></footer>
  </div>;
}
