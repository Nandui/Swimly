import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CheckCircle2, Clock3, TriangleAlert, UserX } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { MarkTimepoint, ShiftDialog } from "@/components/rota/actions";
import { Tag } from "@/components/ui-kit/tag";
import { formatDate } from "@/lib/format";
import { ROTA_CHANGE_REASON_META, clock, type RotaChangeReason } from "@/lib/rota/constants";
import { rotaToday } from "@/lib/rota/data";
import { buildPlan } from "@/lib/rota/plan";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: { absolute: "Today · Turnfin Rota" } };

const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Dublin" });
const span = (s: { startMinutes: number; endMinutes: number }) => `${clock(s.startMinutes)}–${clock(s.endMinutes)}`;

/** Today's plan for duty managers: every department's duties on one
 *  timeline, what needs them now (cover for someone off, unfilled duties
 *  still to come) and today's changes with their reason and Timepoint state.
 *  The week has started, so every change here asks for its reason. */
export default async function TodayPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const data = await rotaToday((await searchParams).site);
  const { site, today: now } = data;
  const plan = buildPlan([{ iso: now, shifts: data.shifts, classes: data.classes }]);
  const options = { people: data.people, types: data.types, departments: data.departments, duties: data.duties };
  // The timeline runs from the earliest start to the latest end, whole hours, at least 06:00 to 22:00.
  const from = Math.min(360, ...data.shifts.map((s) => Math.floor(s.startMinutes / 60) * 60));
  const to = Math.max(1320, ...data.shifts.map((s) => Math.ceil(s.endMinutes / 60) * 60));
  const pos = (m: number) => `${(((m - from) / (to - from)) * 100).toFixed(2)}%`;
  const hours = Array.from({ length: (to - from) / 120 + 1 }, (_, i) => from + i * 120);
  const nowAt = data.minutesNow >= from && data.minutesNow <= to ? pos(data.minutesNow) : null;
  const shiftOf = (id: string) => data.shifts.find((s) => s.id === id)!;
  const editable = (id: string) => {
    const s = shiftOf(id);
    return { id: s.id, date: s.date, startMinutes: s.startMinutes, endMinutes: s.endMinutes, role: s.role, note: s.note, userId: s.userId, requiredTypeId: s.requiredTypeId, departmentId: s.departmentId };
  };
  const pending = data.changes.filter((c) => !c.timepointAt).length;

  return (
    <div className="space-y-4">
      <div className="module-heading">
        <div className="space-y-1">
          <h1>Today{site ? <span className="font-normal text-ui-muted-foreground">: {site.name}</span> : null}</h1>
          <p className="text-sm">{formatDate(new Date(`${now}T00:00:00Z`))} · {clock(data.minutesNow)} · the day is under way, so each change asks for its reason</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.sites.length > 1 && site ? (
            <form method="get" className="flex items-center gap-2" aria-label="Choose a site">
              <div className="w-full sm:w-56"><NativeSelect name="site" defaultValue={site.id} aria-label="Site">
                {data.sites.map((s) => <NativeSelectOption key={s.id} value={s.id}>{s.name}</NativeSelectOption>)}
              </NativeSelect></div>
              <Button type="submit" variant="outline">Show</Button>
            </form>
          ) : null}
          {site?.manage ? <Button asChild variant="outline" className="min-h-11"><Link href="/rota/absences"><UserX aria-hidden="true" />Report absence</Link></Button> : null}
          {site?.manage ? <ShiftDialog siteId={site.id} date={now} today={now} options={options} /> : null}
        </div>
      </div>
      {!site ? (
        <div className="module-empty"><CalendarDays aria-hidden="true" /><h2 className="font-semibold">No sites to show</h2><p className="mt-2 text-sm text-ui-muted-foreground">Your rota role does not cover a site yet.</p></div>
      ) : (
        <div className="flex flex-col gap-4">
          <aside className="grid items-start gap-4 lg:grid-cols-2">
            <section aria-labelledby="today-needs" className="module-panel space-y-3">
              <h2 id="today-needs">Needs you{data.needs.length ? ` · ${data.needs.length}` : ""}</h2>
              {data.needs.length === 0 ? <p className="text-sm text-ui-muted-foreground">Every duty still to come has someone on it.</p> : (
                <ul className="divide-y divide-ui-border">
                  {data.needs.map(({ shift: s, absent, cover }) => (
                    <li key={s.id} className="space-y-2 py-3 first:pt-0">
                      <p className="font-semibold">{s.role} {span(s)}</p>
                      <p className="text-sm text-ui-muted-foreground">{absent ? `${s.user?.name ?? s.rotaPerson?.name ?? "Someone"} is off.` : "Unfilled."} {cover.length ? "Free and qualified:" : site.manage ? "Nobody free and qualified on the plan." : ""}</p>
                      {site.manage && !s.importId ? cover.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate font-medium">{p.name}</span>
                          <ShiftDialog siteId={site.id} date={now} today={now} shift={editable(s.id)} options={options} person={p.id} suggested={absent ? "cover" : "extra"}
                            trigger={{ label: `Give cover: ${p.name}, ${s.role}`, className: "min-h-11", children: "Give cover" }} />
                        </div>
                      )) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section aria-labelledby="today-changes" className="module-panel space-y-3">
              <h2 id="today-changes">Changes today{pending ? ` · ${pending} not in Timepoint yet` : ""}</h2>
              {data.changes.length === 0 ? <p className="text-sm text-ui-muted-foreground">No changes to today&apos;s duties.</p> : (
                <ul className="divide-y divide-ui-border">
                  {data.changes.map((c) => (
                    <li key={c.id} className="space-y-1.5 py-3 text-sm first:pt-0">
                      <p className="font-semibold">{c.kind === "cancelled" ? `Cancelled: ${c.before}` : c.kind === "added" ? `Added: ${c.after}` : `${c.before} → ${c.after.split(", ").at(-1)}`}</p>
                      <p className="flex flex-wrap items-center gap-2 text-ui-muted-foreground">
                        <Tag color={ROTA_CHANGE_REASON_META[c.reason as RotaChangeReason].color}>{ROTA_CHANGE_REASON_META[c.reason as RotaChangeReason].label}</Tag>
                        {TIME.format(c.createdAt)} · by {c.byName}{c.note ? ` · ${c.note}` : ""}
                      </p>
                      {c.timepointAt ? (
                        <p className="flex items-center gap-1.5 font-medium text-[var(--pc-success)]"><CheckCircle2 aria-hidden="true" className="size-4" />Updated in Timepoint{c.timepointByName ? ` by ${c.timepointByName}` : ""}</p>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 font-medium text-[var(--pc-warning)]"><Clock3 aria-hidden="true" className="size-4" />Timepoint not updated yet</span>
                          {site.manage ? <MarkTimepoint id={c.id} what={c.after || c.before} /> : null}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
          <section aria-labelledby="today-duties" className="min-w-0 overflow-hidden rounded-[var(--pc-radius-panel)] border border-ui-border bg-ui-card">
            <h2 id="today-duties" className="sr-only">Duties today</h2>
            {plan.groups.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-ui-muted-foreground">No duties planned today. <Link href={`/rota?site=${site.id}`} className="underline underline-offset-2">Open the week plan</Link>.</p>
            ) : (
              <>
                {/* Wide screens: a timeline. */}
                <div className="hidden md:block">
                  <div className="grid grid-cols-[11rem_minmax(0,1fr)] border-b border-ui-border bg-[var(--pc-surface-sunken)] text-xs font-semibold text-ui-muted-foreground">
                    <div className="px-3 py-2">Duty</div>
                    <div className="relative h-8" aria-hidden="true">
                      {hours.map((h) => <span key={h} className="absolute top-2 -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: pos(h) }}>{clock(h)}</span>)}
                    </div>
                  </div>
                  {plan.groups.map((g) => (
                    <div key={g.key}>
                      <div className="border-b border-ui-border px-3 py-1.5 text-sm font-semibold text-[var(--pc-primary-ink)]">{g.label}</div>
                      {g.rows.map((r) => (
                        <div key={r.key} className="grid grid-cols-[11rem_minmax(0,1fr)] border-b border-ui-border">
                          <div className="px-3 py-2 text-sm font-medium">{r.duty}{r.needs ? <span className="block text-xs font-normal text-ui-muted-foreground">{r.needs}</span> : null}</div>
                          <div className="relative min-h-14">
                            {nowAt ? <span aria-hidden="true" className="absolute inset-y-0 w-0.5 bg-[var(--pc-primary)]" style={{ left: nowAt }} /> : null}
                            {r.days[0].map((e) => {
                              if (e.href) {
                                const [a, z] = e.text.split("–").map((t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)));
                                return <a key={e.id} href={e.href} className="absolute inset-y-2 flex items-center gap-1.5 truncate rounded-[var(--pc-radius-inner)] bg-[var(--pc-primary-soft)] px-2 text-xs text-[var(--pc-primary-ink)] hover:underline" style={{ left: pos(a), width: `calc(${pos(z)} - ${pos(a)})` }}><span className="font-semibold">{e.who}</span>{e.part ? <span>· {e.part}</span> : null}</a>;
                              }
                              const s = shiftOf(e.id);
                              const tone = e.absent ? "border-[var(--pc-danger)] bg-[var(--pc-danger-soft)]" : !e.who ? "border-dashed border-ui-muted-foreground bg-ui-card" : "border-ui-border bg-[var(--pc-surface-sunken)]";
                              const body = (
                                <span className="flex min-w-0 items-center gap-1.5 truncate">
                                  {e.absent ? <UserX aria-hidden="true" className="size-3.5 shrink-0 text-[var(--pc-danger)]" /> : !e.absent && e.warnings.length ? <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0 text-[var(--pc-warning)]" /> : null}
                                  <span className={cn("font-semibold", e.absent && "line-through decoration-[var(--pc-danger)]")}>{e.who ?? "Unfilled"}</span>
                                  {e.part ? <span className="text-ui-muted-foreground">{e.part}</span> : null}
                                  <span className="text-ui-muted-foreground tabular-nums">{e.text}</span>
                                </span>
                              );
                              const style = { left: pos(s.startMinutes), width: `calc(${pos(s.endMinutes)} - ${pos(s.startMinutes)})` };
                              const label = [r.duty, e.part, e.text, e.who ?? "unfilled", e.absent ? "absent, needs cover" : null].filter(Boolean).join(", ");
                              const cls = cn("absolute inset-y-2 flex items-center rounded-[var(--pc-radius-inner)] border px-2 text-left text-xs", tone);
                              return site.manage && e.editable
                                ? <ShiftDialog key={e.id} siteId={site.id} date={now} today={now} shift={editable(e.id)} options={options} suggested={e.absent ? "cover" : undefined}
                                    trigger={{ label: `Change ${label}`, variant: "ghost", className: cn(cls, "h-auto justify-start font-normal hover:border-[var(--pc-primary)] focus-visible:outline-2 focus-visible:outline-[var(--pc-focus)]"), style, children: body }} />
                                : <div key={e.id} aria-label={label} className={cls} style={style}>{body}</div>;
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                {/* Phones: the day as a list, in time order. */}
                <ul className="divide-y divide-ui-border md:hidden">
                  {[...data.shifts].sort((a, b) => a.startMinutes - b.startMinutes).map((s) => {
                    const who = s.user?.name ?? s.rotaPerson?.name ?? null;
                    const absent = s.warnings.includes("absent");
                    return (
                      <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{span(s)} · {s.role}</span>
                          <span className="flex items-center gap-1.5 text-sm text-ui-muted-foreground">{absent ? <UserX aria-hidden="true" className="size-3.5 text-[var(--pc-danger)]" /> : null}{who ? `${who}${absent ? ", absent" : ""}` : "Unfilled"}{s.department ? ` · ${s.department.name}` : ""}</span>
                        </span>
                        {site.manage && !s.importId ? <ShiftDialog siteId={site.id} date={now} today={now} shift={editable(s.id)} options={options} suggested={absent ? "cover" : undefined} /> : null}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
