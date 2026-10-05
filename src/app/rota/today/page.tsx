import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightLeft, ChevronRight, TriangleAlert, UserX } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { MarkTimepoint, ShiftDialog } from "@/components/rota/actions";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { TimelineGrid, type TimelineBlock, type TimelineLane } from "@/components/workspace/timeline-grid";
import { formatDate, formatTime, formatTimeRange, minutesNow, plural } from "@/lib/format";
import { ROTA_BLOCK_META, ROTA_CHANGE_REASON_META, ROTA_WARNING_META, clock, shiftBlockKind, type RotaBlockKind, type RotaChangeReason } from "@/lib/rota/constants";
import { rotaToday } from "@/lib/rota/data";
import { buildPlan } from "@/lib/rota/plan";
import { dayRange, teachingSpans } from "@/lib/rota/timeline";

const tagOf = (kind: RotaBlockKind) => ({ icon: ROTA_BLOCK_META[kind].icon, label: ROTA_BLOCK_META[kind].label });

export const metadata: Metadata = { title: "Today" };


/** Today's plan for duty managers: every department's duties on one
 *  timeline, what needs them now (cover for someone off, unfilled duties
 *  still to come) and today's changes with their reason and Timepoint state.
 *  The week has started, so every change here asks for its reason. */
export default async function TodayPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const data = await rotaToday((await searchParams).site);
  const { site, today: now } = data;
  const plan = buildPlan([{ iso: now, shifts: data.shifts, classes: data.classes }]);
  const options = { people: data.people, types: data.types, departments: data.departments, duties: data.duties };
  // The timeline runs from an hour before the earliest start to an hour after the latest end, whole hours.
  const { from, to } = dayRange([...data.shifts, ...data.bookings, ...data.classes]);
  const shiftOf = (id: string) => data.shifts.find((s) => s.id === id)!;
  const editable = (id: string) => {
    const s = shiftOf(id);
    return { id: s.id, date: s.date, startMinutes: s.startMinutes, endMinutes: s.endMinutes, role: s.role, note: s.note, userId: s.userId, requiredTypeId: s.requiredTypeId, departmentId: s.departmentId };
  };
  const pending = data.changes.filter((c) => !c.timepointAt).length;
  // The Swim school's classes today, one lane per instructor (no instructor last), back-to-back classes as one block.
  const teachers = [...Map.groupBy(data.classes, (c) => c.userId ?? "").entries()]
    .map(([userId, list]) => ({ key: userId || "none", userId: userId || null, name: userId ? data.teachers[userId] ?? "Instructor" : "No instructor", classes: [...list].sort((x, y) => x.startMinutes - y.startMinutes) }))
    .sort((x, y) => Number(!x.userId) - Number(!y.userId) || x.classes[0].startMinutes - y.classes[0].startMinutes);
  const kindAt = (start: number, end: number) => shiftBlockKind(now, now, data.minutesNow, start, end);

  // Today's duties on the shared timeline: bookings, the Swim school, then each department and
  // duty with everyone on it. The Day plan for today shows the same day with its activities.
  const lanes: TimelineLane[] = [];
  const blocks: TimelineBlock[] = [];
  if (site && data.bookings.length) {
    lanes.push({ key: "h:bookings", label: "Bookings", caption: plural(data.bookings.length, "booking"), header: true });
    for (const b of data.bookings) {
      const short = b.filled < b.places;
      const staffed = b.places ? `${b.filled} of ${b.places} staffed` : "No staff needed";
      lanes.push({ key: `b:${b.id}`, label: b.title, caption: staffed });
      blocks.push({ key: `b:${b.id}`, lane: `b:${b.id}`, start: b.startMinutes, end: b.endMinutes, state: short ? "cover" : "assessment", title: b.title,
        hint: formatTimeRange(b.startMinutes, b.endMinutes), agendaHint: staffed, tag: tagOf(short ? "short" : "booking"), href: `/rota/bookings?site=${site.id}` });
    }
  }
  if (site && teachers.length) {
    lanes.push({ key: "h:swim", label: "Swim school", caption: "From the Swim school timetable; instructors and cover are set there", header: true });
    for (const t of teachers) {
      const key = `swim:${t.key}`;
      lanes.push({ key, label: t.name, caption: plural(t.classes.length, "class", "classes") });
      teachingSpans(t.classes).forEach((x, i) => blocks.push({
        key: `${key}:${i}`, lane: key, start: x.start, end: x.end, state: t.userId ? ROTA_BLOCK_META[kindAt(x.start, x.end)].state : "cover",
        title: t.name, hint: `${formatTimeRange(x.start, x.end)} · ${plural(x.count, "class", "classes")}`, agendaHint: plural(x.count, "class", "classes"),
        tag: tagOf(t.userId ? "teaching" : "gap"), href: x.href,
      }));
    }
  }
  if (site) for (const g of plan.groups.filter((group) => group.key !== "g:swim")) {
    lanes.push({ key: `h:${g.key}`, label: g.label, header: true });
    for (const r of g.rows) {
      if (r.days[0].some((e) => e.href)) continue; // The Swim school's classes have their own lanes above.
      const entries = [...r.days[0]].sort((x, y) => shiftOf(x.id).startMinutes - shiftOf(y.id).startMinutes);
      lanes.push({ key: `d:${r.key}`, label: r.duty, caption: [r.needs, plural(entries.length, "person", "people")].filter(Boolean).join(" · "), header: true });
      for (const e of entries) {
        const s = shiftOf(e.id);
        const kind: RotaBlockKind = e.absent ? "absent" : !e.who ? "unfilled" : kindAt(s.startMinutes, s.endMinutes);
        const warning = e.warnings[0];
        const label = [r.duty, e.part, formatTimeRange(s.startMinutes, s.endMinutes), e.who ?? "unfilled", e.absent ? "off, needs cover" : null].filter(Boolean).join(", ");
        lanes.push({ key: e.id, label: e.who ?? "Unfilled", caption: e.part ?? r.duty });
        blocks.push({
          key: e.id, lane: e.id, start: s.startMinutes, end: s.endMinutes, state: ROTA_BLOCK_META[kind].state, title: e.part ?? r.duty,
          hint: formatTimeRange(s.startMinutes, s.endMinutes), agendaHint: e.who ?? "Unfilled", tag: tagOf(kind),
          extra: warning ? [{ icon: ROTA_WARNING_META[warning].icon, label: ROTA_WARNING_META[warning].label }] : undefined,
          label: site.manage && e.editable ? `Change ${label}` : label,
          render: site.manage && e.editable ? (parts) => (
            <ShiftDialog siteId={site.id} date={now} today={now} shift={editable(e.id)} options={options} suggested={e.absent ? "cover" : undefined} trigger={parts} />
          ) : undefined,
        });
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={site ? `Today: ${site.name}` : "Today"}
        description={`${formatDate(new Date(`${now}T00:00:00Z`))} · ${clock(data.minutesNow)} · the day is under way, so each change asks for its reason`}
        actions={site?.manage ? <>
          <Button asChild variant="outline"><Link href="/rota/absences?report=1"><UserX aria-hidden="true" />Report an absence</Link></Button>
          <ShiftDialog siteId={site.id} date={now} today={now} options={options} />
        </> : undefined} />
      {!site ? (
        <EmptyState as="h2" icon="calendarDays" title="No sites to show" hint="Your rota role does not cover a site yet." />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="pc-grid">
            <section aria-labelledby="today-needs" className="pc-panel">
              <div className="pc-panel-head"><h2 id="today-needs">Needs you{data.needs.length ? ` · ${data.needs.length}` : ""}</h2></div>
              {data.needs.length === 0 ? <EmptyState compact icon="calendarCheck" title="Every shift still to come has someone on it" /> : (
                <ul className="pc-rows">
                  {data.needs.map(({ shift: s, absent, cover }) => (
                    <li key={s.id} className="pc-row">
                      {absent ? null : <span className="pc-tile-icon" aria-hidden="true"><TriangleAlert /></span>}
                      <span className="pc-row-body">
                        <span className="pc-row-title">{s.role} {formatTimeRange(s.startMinutes, s.endMinutes)}</span>
                        <span className="pc-row-hint">{absent ? `${s.user?.name ?? s.rotaPerson?.name ?? "Someone"} is off` : "Unfilled"}{cover.length ? ". Free and qualified:" : site.manage ? " · nobody free and qualified" : ""}</span>
                      </span>
                      {site.manage && !s.importId && cover.length ? (
                        <span className="flex basis-full flex-wrap gap-2">
                          {cover.map((p) => (
                            <ShiftDialog key={p.id} siteId={site.id} date={now} today={now} shift={editable(s.id)} options={options} person={p.id} suggested={absent ? "cover" : "extra"}
                              trigger={{ label: `Give cover to ${p.name}, ${s.role} ${formatTimeRange(s.startMinutes, s.endMinutes)}`, children: `Give cover to ${p.name}` }} />
                          ))}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section aria-labelledby="today-changes" className="pc-panel">
              <div className="pc-panel-head"><h2 id="today-changes">Changes today{pending ? ` · ${pending} not in Timepoint yet` : ""}</h2></div>
              {data.changes.length === 0 ? <EmptyState compact icon="calendarDays" title="No changes to today's shifts" /> : (
                <ul className="pc-rows">
                  {data.changes.map((c) => {
                    const reason = ROTA_CHANGE_REASON_META[c.reason as RotaChangeReason];
                    return (
                      <li key={c.id} className="pc-row">
                        <span className="pc-tile-icon" aria-hidden="true">{reason ? <reason.icon /> : <ArrowRightLeft />}</span>
                        <span className="pc-row-body">
                          <span className="pc-row-title">{c.kind === "cancelled" ? `Cancelled: ${c.before}` : c.kind === "added" ? `Added: ${c.after}` : `${c.before} → ${c.after.split(", ").at(-1)}`}</span>
                          <span className="pc-row-hint">
                            {formatTime(minutesNow(c.createdAt))} · by {c.byName}{c.note ? ` · ${c.note}` : ""} · {c.timepointAt ? `Updated in Timepoint${c.timepointByName ? ` by ${c.timepointByName}` : ""}` : "Timepoint not updated yet"}
                          </span>
                        </span>
                        <span className="pc-row-trail">
                          {reason ? <Tag meta={reason} /> : null}
                          {!c.timepointAt && site.manage ? <MarkTimepoint id={c.id} what={c.after || c.before} /> : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
          <section aria-labelledby="today-shifts" className="pc-panel">
            <div className="pc-panel-head">
              <h2 id="today-shifts">Shifts today</h2>
              <Button asChild variant="ghost"><Link href={`/rota/day?${new URLSearchParams({ site: site.id, date: now })}`}>Open day plan<ChevronRight aria-hidden="true" /></Link></Button>
            </div>
            {plan.groups.length === 0 && teachers.length === 0 && data.bookings.length === 0 ? (
              <EmptyState icon="calendarDays" title="No shifts planned today" action={<Button asChild variant="outline"><Link href={`/rota?site=${site.id}`}>Open the week plan</Link></Button>} />
            ) : (
              <TimelineGrid from={from} to={to} now={data.minutesNow} lanes={lanes} blocks={blocks} laneHeading="Shift" label="Shifts today" />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
