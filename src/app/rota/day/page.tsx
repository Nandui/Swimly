import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pencil, UserPlus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { Tag } from "@/components/ui-kit/tag";
import { TimelineGrid, type TimelineBlock, type TimelineLane } from "@/components/workspace/timeline-grid";
import { CancelShift, CopyPlan, ShiftDialog } from "@/components/rota/actions";
import { DayNote } from "@/components/rota/day-note";
import { ShiftPlanSheet } from "@/components/rota/segments";
import { ActivityDialog, AssignDialog, RemoveActivity } from "@/components/rota/activities";
import { formatDay, formatTimeRange, minutesNow, plural, today } from "@/lib/format";
import { ROTA_BLOCK_META, ROTA_WARNING_META, addDaysIso, clock, shiftBlockKind, weekStarted, type RotaBlockKind } from "@/lib/rota/constants";
import { rotaDay } from "@/lib/rota/data";
import { hours } from "@/lib/rota/plan";
import { buildTimeline, dayRange, teachingSpans, type Candidate } from "@/lib/rota/timeline";

export const metadata: Metadata = { title: "Day plan" };

const span = (a: number, b: number) => `${clock(a)}–${clock(b)}`;
const tagOf = (kind: RotaBlockKind, label?: string) => ({ icon: ROTA_BLOCK_META[kind].icon, label: label ?? ROTA_BLOCK_META[kind].label });

/** Overlapping stretches on their own lines, so two people on poolside both show. */
function stack(spans: readonly { start: number; end: number }[]) {
  const ends: number[] = [];
  return spans.map((s) => {
    const free = ends.findIndex((e) => e <= s.start);
    const at = free >= 0 ? free : ends.length;
    ends[at] = s.end;
    return at;
  });
}

/** One day of a site's plan on the shared timeline: each activity's cover with
 *  its gaps; the day's bookings; everyone on their own lane with their shift,
 *  what they do inside it and their breaks; and the Swim school's teaching. A
 *  manager opens a shift to plan its activities, a gap to fill it, or a lane's
 *  pencil to change the duty. Below 1280px the same blocks are an agenda. */
export default async function DayPlanPage({ searchParams }: { searchParams: Promise<{ site?: string; date?: string }> }) {
  const input = await searchParams;
  const data = await rotaDay(input.site, input.date);
  const { site, day } = data;
  const now = today();
  const link = (date: string) => `/rota/day?${new URLSearchParams({ ...(site ? { site: site.id } : {}), date })}`;
  const { rows, cover } = buildTimeline(data.shifts, data.classes, data.planned);
  const { from, to } = dayRange([...data.shifts, ...data.bookings, ...data.classes, ...data.planned]);
  const clockNow = minutesNow();
  const kindAt = (start: number, end: number) => shiftBlockKind(day, now, clockNow, start, end);
  // Everyone on shift who could take on an activity: what they already do, and what they hold.
  const candidates: Candidate[] = rows.flatMap((r) => r.name ? r.shifts.filter((s) => s.editable).map((s) => ({
    shiftId: s.id, name: r.name!, start: s.start, end: s.end, absent: s.absent, types: r.userId ? data.held[r.userId] ?? [] : [],
    busy: [...s.segments.map((g) => ({ start: g.start, end: g.end, label: g.label })), ...r.teaching.map((t) => ({ start: t.start, end: t.end, label: "Teaching" })),
      // Their other shifts that day (a booking's place, say) keep them busy too.
      ...r.shifts.filter((o) => o.id !== s.id).map((o) => ({ start: o.start, end: o.end, label: o.part ?? o.role }))],
  })) : []);
  const options = { people: data.people, types: data.types, departments: data.departments, duties: data.duties };
  const byId = new Map(data.shifts.map((s) => [s.id, s]));
  const editShift = (id: string) => {
    const x = byId.get(id)!;
    return { id: x.id, date: x.date, startMinutes: x.startMinutes, endMinutes: x.endMinutes, role: x.role, note: x.note, userId: x.userId, requiredTypeId: x.requiredTypeId, departmentId: x.departmentId };
  };
  // Swim school instructors with no duty that day still show, so the pool's day is complete.
  const onPlan = new Set(rows.flatMap((r) => (r.userId ? [r.userId] : [])));
  const teachingOnly = [...new Set(data.classes.flatMap((c) => (c.userId && !onPlan.has(c.userId) ? [c.userId] : [])))];
  const untaught = data.classes.filter((c) => !c.userId);
  const open = rows.filter((r) => !r.name).length;
  const gaps = cover.reduce((n, c) => n + c.gaps.length, 0);
  const manage = !!site?.manage;

  // The day on the shared timeline: lanes, then their blocks.
  const lanes: TimelineLane[] = [];
  const blocks: TimelineBlock[] = [];
  if (site && cover.length) {
    lanes.push({ key: "h:activities", label: "Activities", caption: "What needs covering and who is on it", header: true });
    for (const c of cover) {
      const a = c.activity;
      const key = `act:${c.label.toLowerCase()}`;
      const who = { label: c.label, requiredTypeId: a?.requiredTypeId ?? null, requiredType: a?.requiredType ?? null };
      const caption = [a ? `${a.people} at a time` : "Only in shifts", a?.requiredType ? `needs ${a.requiredType}` : null, c.gaps.length ? plural(c.gaps.length, "gap to fill", "gaps to fill") : "Covered"].filter(Boolean).join(" · ");
      lanes.push({
        key, label: c.label, caption,
        action: manage && a ? <>
          <AssignDialog activity={who} span={{ start: a.start, end: a.end }} candidates={candidates}
            trigger={{ label: `Put someone on ${c.label}, ${span(a.start, a.end)}`, size: "icon", children: <UserPlus aria-hidden="true" /> }} />
          <ActivityDialog siteId={site.id} date={day} types={data.types} names={data.activities} activity={{ id: a.id, label: c.label, start: a.start, end: a.end, people: a.people, requiredTypeId: a.requiredTypeId, note: a.note }}
            trigger={{ label: `Change ${c.label}`, size: "icon", children: <Pencil aria-hidden="true" /> }} />
          <RemoveActivity id={a.id} label={c.label} />
        </> : undefined,
      });
      // People on it and its gaps share the lane's lines, so none overlap.
      const pieces = [...c.spans.map((x) => ({ ...x, gap: null })), ...c.gaps.map((g) => ({ start: g.start, end: g.end, who: "", gap: g }))].sort((x, y) => x.start - y.start);
      const lines = stack(pieces);
      pieces.forEach((x, i) => {
        if (!x.gap) {
          const kind = kindAt(x.start, x.end);
          blocks.push({ key: `${key}:s${i}`, lane: key, row: lines[i], start: x.start, end: x.end, state: ROTA_BLOCK_META[kind].state, title: x.who, hint: formatTimeRange(x.start, x.end), tag: tagOf(kind) });
          return;
        }
        const g = x.gap;
        const title = g.short > 1 || (a?.people ?? 1) > 1 ? `${g.short} short` : "Nobody";
        blocks.push({
          key: `${key}:g${i}`, lane: key, row: lines[i], start: g.start, end: g.end, state: "cover", title, hint: formatTimeRange(g.start, g.end), tag: tagOf("gap"),
          label: `${manage ? "Fill " : ""}${c.label}, ${formatTimeRange(g.start, g.end)}, ${title.toLowerCase()}`,
          render: manage ? (parts) => <AssignDialog activity={who} span={g} candidates={candidates} trigger={parts} /> : undefined,
        });
      });
    }
  }
  if (site && data.bookings.length) {
    lanes.push({ key: "h:bookings", label: "Bookings", header: true });
    for (const b of data.bookings) {
      const short = b.filled < b.places;
      const staffed = b.places ? `${b.filled} of ${b.places} staffed` : "No staff needed";
      lanes.push({ key: `b:${b.id}`, label: b.title, caption: staffed });
      blocks.push({
        key: `b:${b.id}`, lane: `b:${b.id}`, start: b.startMinutes, end: b.endMinutes, state: short ? "cover" : "assessment", title: b.title,
        hint: formatTimeRange(b.startMinutes, b.endMinutes), agendaHint: staffed, tag: tagOf(short ? "short" : "booking"), href: `/rota/bookings?site=${site.id}`,
      });
    }
  }
  if (site) {
    lanes.push({ key: "h:people", label: "People", caption: rows.length ? undefined : "Nobody is planned this day yet", header: true });
    for (const r of rows) {
      const first = r.shifts[0];
      const teaching = teachingSpans(r.teaching.map((t) => ({ userId: r.userId, startMinutes: t.start, endMinutes: t.end, href: t.href })));
      lanes.push({
        key: r.key, label: r.name ?? "Unfilled", caption: `${r.roles} · ${hours(r.minutes)}h${r.breaks ? `, ${r.breaks}m unpaid break` : ""}`,
        action: manage && first.editable ? (
          <ShiftDialog siteId={site.id} date={day} today={now} shift={editShift(first.id)} options={options}
            trigger={{ label: `Change ${r.name ?? "the unfilled"} ${first.role} shift`, variant: "ghost", size: "icon", children: <Pencil aria-hidden="true" /> }} />
        ) : undefined,
      });
      // A booking's place inside their own shift takes a second line rather than covering it.
      const lines = stack(r.shifts);
      for (const [i, s] of r.shifts.entries()) {
        const kind: RotaBlockKind = s.absent ? "absent" : !r.name ? "unfilled" : kindAt(s.start, s.end);
        const duty = s.part ?? s.role;
        const warning = s.warnings[0];
        const inside = teaching.filter((t) => t.start < s.end && s.start < t.end);
        const label = `${r.name ?? "Unfilled"}, ${duty}, ${formatTimeRange(s.start, s.end)}${s.segments.length ? `: ${s.segments.map((g) => `${span(g.start, g.end)} ${g.label}`).join(", ")}` : ""}${s.absent ? ", off" : ""}`;
        blocks.push({
          key: s.id, lane: r.key, row: lines[i], start: s.start, end: s.end, state: ROTA_BLOCK_META[kind].state, title: duty, hint: formatTimeRange(s.start, s.end), tag: tagOf(kind),
          extra: [...(warning ? [{ icon: ROTA_WARNING_META[warning].icon, label: ROTA_WARNING_META[warning].label }] : []),
            ...inside.map((t) => ({ icon: ROTA_BLOCK_META.teaching.icon, label: `Teaching ${formatTimeRange(t.start, t.end)}` }))],
          strip: s.segments.map((g) => ({ start: g.start, end: g.end, label: g.label, kind: g.kind === "break" ? "break" as const : "activity" as const })),
          agendaHint: r.name ?? "Unfilled",
          label: manage && s.editable ? `Plan ${label}` : label,
          render: manage && s.editable ? (parts) => (
            <ShiftPlanSheet activities={data.activities} trigger={parts} editable
              title={`${r.name ?? "Unfilled"} · ${formatDay(day)}`} description={`${duty} · ${formatTimeRange(s.start, s.end)}`}
              warnings={[...(s.absent ? ["absent" as const] : []), ...s.warnings]}
              shift={{ id: s.id, start: s.start, end: s.end, role: duty, who: r.name, segments: s.segments, young: r.userId ? data.young[r.userId] ?? null : null }}
              actions={<>
                <ShiftDialog siteId={site.id} date={day} today={now} shift={editShift(s.id)} options={options} label={s.absent ? "Give cover" : "Change shift"} suggested={s.absent ? "cover" : undefined} />
                <CancelShift id={s.id} label={`${duty} ${formatTimeRange(s.start, s.end)}`} live={weekStarted(day, now)} withText />
              </>} />
          ) : undefined,
        });
      }
    }
  }
  const swim = [...teachingOnly.map((id) => ({ key: id, name: data.teachers[id] ?? "Instructor", list: data.classes.filter((c) => c.userId === id) })),
    ...(untaught.length ? [{ key: "none", name: null, list: untaught }] : [])];
  if (site && swim.length) {
    lanes.push({ key: "h:swim", label: "Swim school", caption: "Classes and cover are set in the Swim school", header: true });
    for (const t of swim) {
      const key = `swim:${t.key}`;
      lanes.push({ key, label: t.name ?? "No instructor", caption: plural(t.list.length, "class", "classes") });
      teachingSpans(t.list).forEach((x, i) => {
        const kind: RotaBlockKind = t.name ? "teaching" : "gap";
        blocks.push({
          key: `${key}:${i}`, lane: key, start: x.start, end: x.end, state: t.name ? ROTA_BLOCK_META[kindAt(x.start, x.end)].state : "cover",
          title: t.name ?? "No instructor", hint: `${formatTimeRange(x.start, x.end)} · ${plural(x.count, "class", "classes")}`, tag: tagOf(kind), href: x.href,
          agendaHint: plural(x.count, "class", "classes"),
        });
      });
    }
  }
  const legend: RotaBlockKind[] = ["next", "gap", "booking", "unfilled", "absent", "teaching"];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={site ? `Day plan: ${site.name}` : "Day plan"}
        description={`${formatDay(day)} · ${rows.filter((r) => r.name).length} on the plan${open ? ` · ${open} unfilled` : ""}${gaps ? ` · ${plural(gaps, "gap")} in cover` : ""}`}
        actions={<>
          <nav aria-label="Days" className="flex items-center gap-2">
            <Button asChild variant="outline" size="icon" aria-label="Previous day"><Link href={link(addDaysIso(day, -1))}><ChevronLeft aria-hidden="true" /></Link></Button>
            <Button asChild variant="outline"><Link href={link(now)} aria-current={day === now ? "date" : undefined}>Today</Link></Button>
            <Button asChild variant="outline" size="icon" aria-label="Next day"><Link href={link(addDaysIso(day, 1))}><ChevronRight aria-hidden="true" /></Link></Button>
          </nav>
          {site?.manage && !weekStarted(day, now) ? <CopyPlan siteId={site.id} to={day} whole={false} /> : null}
          {site?.manage ? <ShiftDialog siteId={site.id} date={day} today={now} options={options} /> : null}
        </>} />
      {!site ? (
        <EmptyState as="h2" icon="calendarDays" title="No sites to show" hint="Your rota role does not cover a site yet." />
      ) : (
        <>
          <section aria-labelledby="day-timeline" className="pc-panel">
            <div className="pc-panel-head">
              <h2 id="day-timeline" className="text-lg font-semibold">The day</h2>
              {manage ? <ActivityDialog siteId={site.id} date={day} types={data.types} names={data.activities} /> : null}
            </div>
            {cover.length === 0 && manage ? <p className="text-sm text-ui-muted-foreground">No activities planned for this day. Add one, for example the 25m pool lifeguard from opening to close.</p> : null}
            <TimelineGrid from={from} to={to} now={day === now ? clockNow : null} lanes={lanes} blocks={blocks} laneHeading="Who" label={`Day plan, ${formatDay(day)}`} agenda={{ empty: "Nothing planned this day yet." }} />
            <ul className="flex flex-wrap gap-2" aria-label="Key">
              {legend.map((kind) => <li key={kind}><Tag meta={ROTA_BLOCK_META[kind]} /></li>)}
            </ul>
          </section>
          <section aria-labelledby="day-notes" className="pc-panel">
            <h2 id="day-notes">Notes</h2>
            {site.manage ? <DayNote siteId={site.id} date={day} text={data.note} labelledBy="day-notes" />
              : <p className="whitespace-pre-line text-ui-muted-foreground">{data.note || "None."}</p>}
          </section>
        </>
      )}
    </div>
  );
}

