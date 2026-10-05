import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, GraduationCap, Pencil, TriangleAlert, UserX } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { CopyPlan, ShiftDialog } from "@/components/rota/actions";
import { DayNote } from "@/components/rota/day-note";
import { SegmentsDialog } from "@/components/rota/segments";
import { ActivityDialog, AssignDialog, RemoveActivity } from "@/components/rota/activities";
import { formatDay, minutesNow, plural, today } from "@/lib/format";
import { BOOKING_KIND_META, addDaysIso, clock, mondayOf, weekStarted, type BookingKind } from "@/lib/rota/constants";
import { rotaDay } from "@/lib/rota/data";
import { hours } from "@/lib/rota/plan";
import { buildTimeline, dayRange, type Candidate, type PersonRow, type Segment } from "@/lib/rota/timeline";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: { absolute: "Day plan · Turnfin Rota" } };

const span = (a: number, b: number) => `${clock(a)}–${clock(b)}`;
/** Each activity keeps one tone through the day, so "25m pool lifeguard" reads the same on every row. */
const TONES = [
  "bg-[var(--pc-primary-soft)] text-[var(--pc-primary-ink)]",
  "bg-[var(--pc-primary-soft)] text-[var(--pc-primary-ink)]",
  "bg-[var(--pc-success-soft)] text-[var(--pc-success)]",
  "bg-[var(--pc-cover-soft)] text-[var(--pc-cover)]",
];

/** One day of a site's plan as a timeline: everyone on their own row with
 *  their shift, what they do when inside it and their breaks; each activity's
 *  cover with its gaps; the day's bookings; and the Swim school classes. A
 *  manager opens a shift to plan its activities, or a name to change the duty. */
export default async function DayPlanPage({ searchParams }: { searchParams: Promise<{ site?: string; date?: string }> }) {
  const input = await searchParams;
  const data = await rotaDay(input.site, input.date);
  const { site, day } = data;
  const now = today();
  const link = (date: string) => `/rota/day?${new URLSearchParams({ ...(site ? { site: site.id } : {}), date })}`;
  const { rows, cover } = buildTimeline(data.shifts, data.classes, data.planned);
  const { from, to } = dayRange([...data.shifts, ...data.bookings, ...data.classes, ...data.planned]);
  const pos = (m: number) => `${(((m - from) / (to - from)) * 100).toFixed(3)}%`;
  const box = (a: number, b: number): CSSProperties => ({ left: pos(a), width: `calc(${pos(b)} - ${pos(a)})` });
  const ticks = Array.from({ length: (to - from) / 60 + 1 }, (_, i) => from + i * 60);
  const tone = new Map(cover.map((c, i) => [c.label.toLowerCase(), TONES[i % TONES.length]]));
  // Everyone on shift who could take on an activity: what they already do, and what they hold.
  const candidates: Candidate[] = rows.flatMap((r) => r.name ? r.shifts.filter((s) => s.editable).map((s) => ({
    shiftId: s.id, name: r.name!, start: s.start, end: s.end, absent: s.absent, types: r.userId ? data.held[r.userId] ?? [] : [],
    busy: [...s.segments.map((g) => ({ start: g.start, end: g.end, label: g.label })), ...r.teaching.map((t) => ({ start: t.start, end: t.end, label: "Teaching" })),
      // Their other shifts that day (a booking's place, say) keep them busy too.
      ...r.shifts.filter((o) => o.id !== s.id).map((o) => ({ start: o.start, end: o.end, label: o.part ?? o.role }))],
  })) : []);
  const options = { people: data.people, types: data.types, departments: data.departments, duties: data.duties };
  const byId = new Map(data.shifts.map((s) => [s.id, s]));
  const nowLine = day === now ? (() => { const m = minutesNow(); return m >= from && m <= to ? pos(m) : null; })() : null;
  // Swim school instructors with no duty that day still show, so the pool's day is complete.
  const onPlan = new Set(rows.flatMap((r) => (r.userId ? [r.userId] : [])));
  const teachingOnly = [...new Set(data.classes.flatMap((c) => (c.userId && !onPlan.has(c.userId) ? [c.userId] : [])))];
  const untaught = data.classes.filter((c) => !c.userId);
  const open = rows.filter((r) => !r.name).length;
  const gaps = cover.reduce((n, c) => n + c.gaps.length, 0);

  return (
    <div className="space-y-4">
      <div className="module-heading">
        <div className="space-y-1">
          <h1>Day plan{site ? <span className="font-normal text-ui-muted-foreground">: {site.name}</span> : null}</h1>
          <p className="text-sm">{formatDay(day)} · {rows.filter((r) => r.name).length} on the plan{open ? ` · ${open} unfilled` : ""}{gaps ? ` · ${plural(gaps, "gap")} in cover` : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Days" className="flex items-center gap-1">
            <Button asChild variant="outline" size="icon" aria-label="Previous day"><Link href={link(addDaysIso(day, -1))}><ChevronLeft aria-hidden="true" /></Link></Button>
            <Button asChild variant={day === now ? "secondary" : "outline"}><Link href={link(now)}>Today</Link></Button>
            <Button asChild variant="outline" size="icon" aria-label="Next day"><Link href={link(addDaysIso(day, 1))}><ChevronRight aria-hidden="true" /></Link></Button>
          </nav>
          {site ? <Button asChild variant="outline" className="min-h-11"><Link href={`/rota?${new URLSearchParams({ site: site.id, week: mondayOf(day) })}`}><CalendarDays aria-hidden="true" />Week</Link></Button> : null}
          {site?.manage && !weekStarted(day, now) ? <CopyPlan siteId={site.id} to={day} whole={false} /> : null}
          {site?.manage ? <ShiftDialog siteId={site.id} date={day} today={now} options={options} /> : null}
        </div>
      </div>
      {!site ? (
        <div className="module-empty"><CalendarDays aria-hidden="true" /><h2 className="font-semibold">No sites to show</h2><p className="mt-2 text-sm text-ui-muted-foreground">Your rota role does not cover a site yet.</p></div>
      ) : (
        <>
          {data.sites.length > 1 ? (
            <form method="get" className="flex items-center gap-2" aria-label="Choose a site">
              <div className="w-full sm:w-60"><NativeSelect name="site" defaultValue={site.id} aria-label="Site">
                {data.sites.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
              </NativeSelect></div>
              <input type="hidden" name="date" value={day} />
              <Button type="submit" variant="outline">Show</Button>
            </form>
          ) : null}
          <section aria-label="The day as a timeline" className="overflow-x-auto rounded-[var(--pc-radius-panel)] border border-ui-border bg-ui-card">
            <div className="min-w-[56rem]">
              <div className="sticky top-0 z-10 grid grid-cols-[14rem_minmax(0,1fr)] border-b border-ui-border bg-[var(--pc-surface-sunken)] text-xs font-semibold text-ui-muted-foreground">
                <div className="px-3 py-2">Who</div>
                <div className="relative h-8" aria-hidden="true">
                  {ticks.map((t, i) => i % 2 === 0 ? <span key={t} className="absolute top-2 -translate-x-1/2 first:translate-x-0 last:-translate-x-full tabular-nums" style={{ left: pos(t) }}>{clock(t)}</span> : null)}
                </div>
              </div>

              {cover.length || site.manage ? (
                <Group title="Activities" note={site.manage ? "What needs covering and who is on it. Open a gap, or the activity, to put someone on it" : "What needs covering and who is on it"}
                  action={site.manage ? <ActivityDialog siteId={site.id} date={day} types={data.types} names={data.activities} /> : null}>
                  {cover.length === 0 ? <p className="px-3 py-4 text-sm text-ui-muted-foreground">No activities planned for this day. Add one, for example the 25m pool lifeguard from opening to close.</p> : null}
                  {cover.map((c) => {
                    const a = c.activity;
                    const lanes = stack(c.spans);
                    const height = Math.max(1, lanes.count) * 26 + 12;
                    const who = { label: c.label, requiredTypeId: a?.requiredTypeId ?? null, requiredType: a?.requiredType ?? null };
                    const meta = a ? [`${a.people} at a time`, a.requiredType ? `needs ${a.requiredType}` : null, span(a.start, a.end)].filter(Boolean).join(" · ") : "Not planned, only in shifts";
                    return (
                      <Lane key={c.label} ticks={ticks} pos={pos} nowLine={nowLine} height={height} label={
                        <div className="flex items-start gap-1">
                          <div className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{c.label}</span>
                            <span className="block truncate text-xs text-ui-muted-foreground">{meta}</span>
                            <span className={cn("block text-xs", c.gaps.length ? "text-[var(--pc-danger)]" : "text-[var(--pc-success)]")}>{c.gaps.length ? `${c.gaps.length} ${c.gaps.length === 1 ? "gap" : "gaps"} to fill` : "Covered"}</span>
                          </div>
                          {site.manage && a ? <>
                            <ActivityDialog siteId={site.id} date={day} types={data.types} names={data.activities} activity={{ id: a.id, label: c.label, start: a.start, end: a.end, people: a.people, requiredTypeId: a.requiredTypeId, note: a.note }}
                              trigger={{ label: `Change ${c.label}`, className: "size-8 min-h-8 p-0 pointer-coarse:size-11", children: <Pencil aria-hidden="true" className="size-3.5" /> }} />
                            <RemoveActivity id={a.id} label={c.label} />
                          </> : null}
                        </div>}>
                        {/* The planned window: open it to put someone on any stretch of it. */}
                        {a ? (site.manage
                          ? <AssignDialog activity={who} span={{ start: a.start, end: a.end }} candidates={candidates}
                              trigger={{ label: `Put someone on ${c.label}`, className: "absolute inset-y-1 rounded-[var(--pc-radius-control)] border border-dashed border-ui-border bg-transparent p-0 hover:border-[var(--pc-primary)] hover:bg-[var(--pc-hover)]", style: box(a.start, a.end), children: <span className="sr-only">Put someone on {c.label}</span> }} />
                          : <span aria-hidden="true" className="absolute inset-y-1 rounded-[var(--pc-radius-control)] border border-dashed border-ui-border" style={box(a.start, a.end)} />) : null}
                        {c.spans.map((x, i) => (
                          <span key={i} title={`${x.who} ${span(x.start, x.end)}`} className={cn("pointer-events-none absolute flex h-[22px] items-center overflow-hidden rounded-[var(--pc-radius-control)] px-1.5 text-xs font-medium whitespace-nowrap", tone.get(c.label.toLowerCase()))}
                            style={{ ...box(x.start, x.end), top: 6 + lanes.of[i] * 26 }}>{x.who}</span>
                        ))}
                        {c.gaps.map((g, i) => {
                          const text = <><TriangleAlert aria-hidden="true" className="size-3 shrink-0" />{g.short > 1 || (a?.people ?? 1) > 1 ? `${g.short} short` : "Nobody"} {span(g.start, g.end)}</>;
                          const cls = "absolute bottom-1 z-[2] flex h-[22px] items-center gap-1 overflow-hidden rounded-[var(--pc-radius-control)] border border-dashed border-[var(--pc-danger)] bg-[var(--pc-danger-soft)] px-1.5 text-xs font-medium whitespace-nowrap text-[var(--pc-danger)]";
                          return site.manage
                            ? <AssignDialog key={`g${i}`} activity={who} span={g} candidates={candidates}
                                trigger={{ label: `Fill ${c.label} ${span(g.start, g.end)}, ${g.short} short`, className: cn(cls, "justify-start p-0 px-1.5 hover:bg-[var(--pc-danger-soft)] hover:brightness-95"), style: box(g.start, g.end), children: text }} />
                            : <span key={`g${i}`} className={cls} style={box(g.start, g.end)}>{text}</span>;
                        })}
                      </Lane>
                    );
                  })}
                </Group>
              ) : null}

              {data.bookings.length ? (
                <Group title="Bookings">
                  {data.bookings.map((b) => {
                    const short = b.filled < b.places;
                    return (
                      <Lane key={b.id} ticks={ticks} pos={pos} nowLine={nowLine} label={<><span className="block truncate font-medium">{b.title}</span><span className="block truncate text-xs text-ui-muted-foreground">{[span(b.startMinutes, b.endMinutes), BOOKING_KIND_META[b.kind as BookingKind]?.label, b.place].filter(Boolean).join(" · ")}</span></>}>
                        <Link href={`/rota/bookings?site=${site.id}`} style={box(b.startMinutes, b.endMinutes)} aria-label={`${b.title}, ${span(b.startMinutes, b.endMinutes)}, ${b.filled} of ${b.places} staffed`}
                          className={cn("absolute inset-y-1.5 flex items-center gap-1 overflow-hidden rounded-[var(--pc-radius-control)] border px-1.5 text-xs font-semibold hover:border-[var(--pc-primary)]", short ? "border-[var(--pc-warning)] bg-[var(--pc-warning-soft)]" : "border-transparent bg-[var(--pc-primary-soft)] text-[var(--pc-primary-ink)]")}>
                          {short ? <TriangleAlert aria-hidden="true" className="size-3 shrink-0 text-[var(--pc-warning)]" /> : <CalendarCheck aria-hidden="true" className="size-3 shrink-0" />}
                          <span className="truncate">{b.places ? `${b.filled}/${b.places} staffed` : "No staff needed"}</span>
                        </Link>
                      </Lane>
                    );
                  })}
                </Group>
              ) : null}

              <Group title="People" note={site.manage ? "Open a shift to plan its activities and breaks" : undefined}>
                {rows.length === 0 ? <p className="px-3 py-6 text-sm text-ui-muted-foreground">Nobody is planned this day yet.</p> : rows.map((r) => (
                  <Lane key={r.key} ticks={ticks} pos={pos} nowLine={nowLine} tall label={<PersonLabel row={r} edit={site.manage ? (s) => {
                    const x = byId.get(s)!;
                    return { id: x.id, date: x.date, startMinutes: x.startMinutes, endMinutes: x.endMinutes, role: x.role, note: x.note, userId: x.userId, requiredTypeId: x.requiredTypeId, departmentId: x.departmentId };
                  } : null} siteId={site.id} day={day} now={now} options={options} />}>
                    {r.shifts.map((s) => {
                      const inner = (
                        <>
                          {s.segments.length === 0 ? <span className="relative truncate px-1.5">{s.part ?? s.role}</span> : null}
                          {s.segments.map((g, i) => <Piece key={i} g={g} shift={s} tone={g.kind === "break" ? "rota-break text-ui-muted-foreground" : tone.get(g.label.trim().toLowerCase()) ?? TONES[0]} />)}
                        </>
                      );
                      const cls = cn("absolute top-1.5 h-7 overflow-hidden rounded-[var(--pc-radius-control)] border p-0 text-left text-xs font-normal",
                        s.absent ? "border-[var(--pc-danger)] bg-[var(--pc-danger-soft)]" : !r.name ? "border-dashed border-[var(--pc-warning)] bg-ui-card" : s.part ? "border-[var(--pc-primary)] bg-ui-card" : "border-ui-border bg-[var(--pc-surface-sunken)]");
                      const label = `${r.name ?? "Unfilled"}, ${s.part ?? s.role}, ${span(s.start, s.end)}${s.segments.length ? `: ${s.segments.map((g) => `${span(g.start, g.end)} ${g.label}`).join(", ")}` : ""}${s.absent ? ", absent" : ""}`;
                      return site.manage && s.editable
                        ? <SegmentsDialog key={s.id} activities={data.activities} shift={{ id: s.id, start: s.start, end: s.end, role: s.part ?? s.role, who: r.name, segments: s.segments, young: r.userId ? data.young[r.userId] ?? null : null }}
                            trigger={{ label: `Plan ${label}`, className: cn(cls, "flex items-stretch justify-start hover:border-[var(--pc-primary)]"), style: box(s.start, s.end), children: inner }} />
                        : <div key={s.id} aria-label={label} className={cn(cls, "flex items-stretch")} style={box(s.start, s.end)}>{inner}</div>;
                    })}
                    {r.teaching.map((t, i) => <TeachMark key={`t${i}`} t={t} style={box(t.start, t.end)} />)}
                  </Lane>
                ))}
              </Group>

              {teachingOnly.length || untaught.length ? (
                <Group title="Swim school" note="Instructors with classes and no duty this day. Classes and cover are set in the Swim school">
                  {[...teachingOnly.map((id) => ({ key: id, name: data.teachers[id] ?? "Instructor", list: data.classes.filter((c) => c.userId === id) })),
                    ...(untaught.length ? [{ key: "none", name: null, list: untaught }] : [])].map((t) => (
                    <Lane key={t.key} ticks={ticks} pos={pos} nowLine={nowLine} label={<><span className={cn("block truncate font-medium", !t.name && "text-[var(--pc-warning)]")}>{t.name ?? "No instructor"}</span><span className="block text-xs text-ui-muted-foreground">{t.list.length} {t.list.length === 1 ? "class" : "classes"}</span></>}>
                      {t.list.map((c, i) => (
                        <a key={i} href={c.href} style={box(c.startMinutes, c.endMinutes)} title={`${span(c.startMinutes, c.endMinutes)} ${c.label}`} aria-label={`${c.label}, ${span(c.startMinutes, c.endMinutes)}`}
                          className={cn("absolute inset-y-1.5 flex items-center overflow-hidden rounded-[var(--pc-radius-control)] border px-1 text-xs hover:border-[var(--pc-primary)]", t.name ? "border-transparent bg-[var(--pc-primary-soft)] text-[var(--pc-primary-ink)]" : "border-dashed border-[var(--pc-warning)] bg-[var(--pc-warning-soft)]")}>
                          <span className="truncate">{c.label}</span>
                        </a>
                      ))}
                    </Lane>
                  ))}
                </Group>
              ) : null}
            </div>
          </section>
          <Legend />
          <section className="module-panel max-w-2xl">
            {site.manage ? <DayNote siteId={site.id} date={day} text={data.note} label={formatDay(day)} />
              : <div className="space-y-1"><h2 className="text-sm font-semibold">Notes</h2><p className="text-sm whitespace-pre-line text-ui-muted-foreground">{data.note || "None."}</p></div>}
          </section>
        </>
      )}
    </div>
  );
}

function Group({ title, note, action, children }: { title: string; note?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-end justify-between gap-2 border-b border-ui-border px-3 pt-3 pb-1.5">
        <div>
          <h2 className="text-sm font-semibold text-[var(--pc-primary-ink)]">{title}</h2>
          {note ? <p className="text-xs text-ui-muted-foreground">{note}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Lane({ label, ticks, pos, nowLine, tall = false, height, children }: { label: ReactNode; ticks: number[]; pos: (m: number) => string; nowLine: string | null; tall?: boolean; height?: number; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[14rem_minmax(0,1fr)] border-b border-ui-border">
      <div className="min-w-0 px-3 py-1.5 text-sm">{label}</div>
      <div className={cn("relative", tall ? "min-h-12" : "min-h-10")} style={height ? { minHeight: height + 26 } : undefined}>
        {ticks.map((t) => <span key={t} aria-hidden="true" className="absolute inset-y-0 w-px bg-ui-border/60" style={{ left: pos(t) }} />)}
        {nowLine ? <span aria-hidden="true" className="absolute inset-y-0 z-[1] w-0.5 bg-[var(--pc-primary)]" style={{ left: nowLine }} /> : null}
        {children}
      </div>
    </div>
  );
}

/** Overlapping stretches on their own lines, so two people on poolside both show. */
function stack(spans: readonly { start: number; end: number }[]) {
  const ends: number[] = [];
  const of = spans.map((s) => {
    const free = ends.findIndex((e) => e <= s.start);
    const at = free >= 0 ? free : ends.length;
    ends[at] = s.end;
    return at;
  });
  return { of, count: ends.length };
}

/** One activity or break inside a shift's bar, placed by its share of the shift. */
function Piece({ g, shift, tone }: { g: Segment; shift: { start: number; end: number }; tone: string }) {
  const pct = (m: number) => `${(((m - shift.start) / (shift.end - shift.start)) * 100).toFixed(3)}%`;
  return <span className={cn("absolute inset-y-0 flex items-center truncate border-r border-ui-card px-1 text-xs font-medium", tone)} style={{ left: pct(g.start), width: `calc(${pct(g.end)} - ${pct(g.start)})` }} title={`${span(g.start, g.end)} ${g.label}`}>{g.label}</span>;
}

/** A swim class they teach, as a thin mark under their shift. */
function TeachMark({ t, style }: { t: Segment; style: CSSProperties }) {
  return (
    <a href={t.href} title={`Teaching ${span(t.start, t.end)} ${t.label}`} aria-label={`Teaching ${t.label}, ${span(t.start, t.end)}`}
      className="absolute bottom-0.5 flex h-2 items-center rounded-full bg-[var(--pc-primary)] hover:h-3" style={style}>
      <GraduationCap aria-hidden="true" className="sr-only" />
    </a>
  );
}

function PersonLabel({ row, edit, siteId, day, now, options }: {
  row: PersonRow; edit: ((id: string) => Parameters<typeof ShiftDialog>[0]["shift"]) | null; siteId: string; day: string; now: string;
  options: Parameters<typeof ShiftDialog>[0]["options"];
}) {
  const first = row.shifts[0];
  const warn = row.shifts.some((s) => s.warnings.length);
  const absent = row.shifts.some((s) => s.absent);
  return (
    <div className="flex items-start gap-1">
      <div className="min-w-0 flex-1">
        <span className={cn("flex items-center gap-1 truncate font-medium", !row.name && "text-[var(--pc-warning)]", absent && "text-ui-muted-foreground line-through")}>
          {absent ? <UserX aria-hidden="true" className="size-3.5 shrink-0 text-[var(--pc-danger)]" /> : warn ? <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0 text-[var(--pc-warning)]" /> : null}
          <span className="truncate">{row.name ?? "Unfilled"}</span>
        </span>
        <span className="block truncate text-xs text-ui-muted-foreground">{row.roles} · {hours(row.minutes)}h{row.breaks ? `, ${row.breaks}m unpaid break` : ""}</span>
      </div>
      {edit && first.editable ? (
        <ShiftDialog siteId={siteId} date={day} today={now} shift={edit(first.id)} options={options}
          trigger={{ label: `Change ${row.name ?? "the unfilled"} ${first.role} duty`, variant: "ghost", className: "size-8 min-h-8 p-0 pointer-coarse:size-11", children: <Pencil aria-hidden="true" className="size-3.5" /> }} />
      ) : null}
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ui-muted-foreground" aria-label="Key">
      <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-5 rounded-sm border border-ui-border bg-[var(--pc-surface-sunken)]" />Shift, nothing planned inside</li>
      <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-5 rounded-sm bg-[var(--pc-primary-soft)]" />Activity</li>
      <li className="flex items-center gap-1.5"><span aria-hidden="true" className="rota-break h-3 w-5 rounded-sm border border-ui-border" />Break</li>
      <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-1.5 w-5 rounded-full bg-[var(--pc-primary)]" />Teaching a swim class</li>
      <li className="flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-5 rounded-sm border border-[var(--pc-primary)]" />Place on a booking</li>
      <li className="flex items-center gap-1.5"><TriangleAlert aria-hidden="true" className="size-3.5 text-[var(--pc-danger)]" />Nobody on an activity</li>
    </ul>
  );
}
