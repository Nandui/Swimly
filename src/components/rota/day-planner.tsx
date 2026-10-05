import { CalendarDays, CircleDashed, Coffee, Plus, School } from "lucide-react";
import { Tag } from "@/components/ui-kit/tag";
import { TimelineGrid, type TimelineBlock, type TimelineLane } from "@/components/workspace/timeline-grid";
import { CancelShift, ShiftDialog } from "@/components/rota/actions";
import { ActivityDialog, AssignDialog } from "@/components/rota/activities";
import { BookingDialog } from "@/components/rota/bookings";
import { AssignPlaceDialog, DragToPlan } from "@/components/rota/planner";
import { ShiftPlanSheet } from "@/components/rota/segments";
import { formatDay, formatTimeRange, minutesNow, plural, today } from "@/lib/format";
import { BOOKING_KIND_META, ROTA_BLOCK_META, ROTA_WARNING_META, clock, qualificationShort, shiftBlockKind, weekStarted, type BookingKind, type RotaBlockKind } from "@/lib/rota/constants";
import type { rotaDay } from "@/lib/rota/data";
import { hours } from "@/lib/rota/plan";
import { ROTA_NEED_META, dayNeedsFor, placeLabel, type RotaNeed } from "@/lib/rota/planner";
import { buildTimeline, dayRange, teachingSpans, type Candidate } from "@/lib/rota/timeline";

type DayData = Awaited<ReturnType<typeof rotaDay>>;
type Parts = Parameters<NonNullable<TimelineBlock["render"]>>[0];

const span = (a: number, b: number) => `${clock(a)}–${clock(b)}`;
const tagOf = (kind: RotaBlockKind) => ({ icon: ROTA_BLOCK_META[kind].icon, label: ROTA_BLOCK_META[kind].label });
const needTag = (kind: RotaNeed["kind"]) => ({ icon: ROTA_NEED_META[kind].icon, label: ROTA_NEED_META[kind].label });

/** Overlapping stretches on their own lines, so two people on the same cover both show. */
function stack(spans: readonly { start: number; end: number }[]) {
  const ends: number[] = [];
  return spans.map((s) => {
    const free = ends.findIndex((e) => e <= s.start);
    const at = free >= 0 ? free : ends.length;
    ends[at] = s.end;
    return at;
  });
}

/** One day of the plan (owner decisions, 5 October 2026), on one timeline that fits the width:
 *  hours on the time bar, the exact quarter hour read out under the pointer, and every block
 *  saying who and when in words. Three plainly named sections, each with one Add button:
 *  - Activities: what the department needs covered (a pool's lifeguard, the gym floor), who is
 *    on it, and amber gaps saying "No one" and when; a gap is pressed to fill it.
 *  - Bookings: each booking, who is on it and how many are still needed.
 *  - Staff: each person's shift as a dashed frame with what they do inside it; drag across free
 *    time to plan it. A shift with nobody on it is "Nobody yet".
 *  The summary in the panel head counts the day's gaps. The Week plan's day tabs (supervisors)
 *  and This week (duty managers) both draw the day with it; a department narrows it. */
export function DayPlanner({ data, dept }: { data: DayData; dept: { id: string; name: string } | null }) {
  const { site, day } = data;
  if (!site) return null;
  const now = today();
  const clockNow = minutesNow();
  const manage = site.manage;
  const live = weekStarted(day, now);
  const kindAt = (start: number, end: number) => shiftBlockKind(day, now, clockNow, start, end);
  const byId = new Map(data.shifts.map((s) => [s.id, s]));
  const isPlace = (id: string) => !!byId.get(id)?.bookingId;
  // Cover the whole site shares (no department) shows in every department's plan.
  const planned = dept ? data.planned.filter((a) => !a.departmentId || a.departmentId === dept.id) : data.planned;
  const bookings = dept ? data.bookings.filter((b) => b.departmentId === dept.id) : data.bookings;
  const inDept = new Set(data.shifts.filter((s) => dept && s.departmentId === dept.id).map((s) => s.id));
  const timeline = buildTimeline(data.shifts, dept ? [] : data.classes, planned);
  const cover = dept ? timeline.cover.filter((c) => c.activity) : timeline.cover;
  const rows = timeline.rows.filter((r) => r.name !== null).filter((r) => !dept || r.shifts.some((s) => inDept.has(s.id)));
  const toFill = data.shifts.filter((s) => s.kind === "shift" && !s.bookingId && !s.userId && !s.rotaPersonId && (!dept || s.departmentId === dept.id))
    .sort((x, y) => x.startMinutes - y.startMinutes || x.role.localeCompare(y.role));
  const { needs } = dayNeedsFor(data.shifts, data.planned, dept?.id ?? null);
  // The day from an hour before the first thing planned to an hour after the last, so it fits.
  const range = dayRange([...data.shifts, ...bookings, ...(dept ? [] : data.classes), ...planned]);
  const { from, to } = range;
  const options = { people: data.people, types: data.types, departments: data.departments, duties: data.duties };
  const editShift = (id: string) => {
    const x = byId.get(id)!;
    return { id: x.id, date: x.date, startMinutes: x.startMinutes, endMinutes: x.endMinutes, role: x.role, note: x.note, userId: x.userId, requiredTypeId: x.requiredTypeId, departmentId: x.departmentId };
  };
  // Everyone on shift who could take something on: their own shift, what keeps them busy in it
  // (activities, breaks, booking places, teaching), and what they hold.
  const candidates: Candidate[] = timeline.rows.flatMap((r) => r.name && r.userId ? r.shifts.filter((s) => s.editable && !isPlace(s.id)).map((s) => ({
    shiftId: s.id, userId: r.userId, name: r.name!, start: s.start, end: s.end, absent: s.absent, types: data.held[r.userId!] ?? [],
    busy: [...s.segments.map((g) => ({ start: g.start, end: g.end, label: g.label })), ...r.teaching.map((t) => ({ start: t.start, end: t.end, label: "Teaching" })),
      ...r.shifts.filter((o) => o.id !== s.id).map((o) => ({ start: o.start, end: o.end, label: o.part ?? o.role }))],
  })) : []);
  const people = data.people.map((p) => ({ id: p.id, name: p.name }));
  const placeOf = (id: string) => {
    const s = byId.get(id)!;
    return { id: s.id, date: day, startMinutes: s.startMinutes, endMinutes: s.endMinutes, role: s.role, what: placeLabel(s), note: s.note,
      userId: s.userId, who: s.user?.name ?? s.rotaPerson?.name ?? null, requiredTypeId: s.requiredTypeId, requiredType: s.requiredType?.name ?? null, departmentId: s.departmentId };
  };

  const lanes: TimelineLane[] = [];
  const blocks: TimelineBlock[] = [];

  // Activities: what the department needs covered, who is on it and when, and the gaps.
  lanes.push({
    key: "h:activities", label: "Activities", header: true, caption: cover.length ? undefined : "No activities planned this day",
    action: manage ? <ActivityDialog siteId={site.id} date={day} types={data.types} names={data.activities} departments={data.departments} department={dept ?? undefined}
      trigger={{ label: "Add activity", children: <><Plus aria-hidden="true" />Add activity</> }} /> : undefined,
  });
  for (const c of cover) {
    const a = c.activity;
    const key = `act:${c.label.toLowerCase()}`;
    const who = { label: c.label, requiredTypeId: a?.requiredTypeId ?? null, requiredType: a?.requiredType ?? null };
    lanes.push({
      key, label: c.label,
      caption: a ? [`${a.people} at a time`, a.requiredType ? qualificationShort(a.requiredType) : null].filter(Boolean).join(" · ") : "Only inside shifts",
      edit: manage && a ? <ActivityDialog siteId={site.id} date={day} types={data.types} names={data.activities} departments={data.departments}
        activity={{ id: a.id, label: c.label, start: a.start, end: a.end, people: a.people, requiredTypeId: a.requiredTypeId, departmentId: data.planned.find((p) => p.id === a.id)?.departmentId ?? null, note: a.note }}
        trigger={{ label: `Change ${c.label}`, className: "pc-timeline-lane-link", variant: "link", children: c.label }} /> : undefined,
    });
    const pieces = [...c.spans.map((x) => ({ ...x, gap: null })), ...c.gaps.map((g) => ({ start: g.start, end: g.end, who: "", gap: g }))].sort((x, y) => x.start - y.start);
    const lines = stack(pieces);
    pieces.forEach((x, i) => {
      if (!x.gap) {
        const kind = kindAt(x.start, x.end);
        blocks.push({ key: `${key}:s${i}`, lane: key, row: lines[i], start: x.start, end: x.end, state: ROTA_BLOCK_META[kind].state, title: x.who, hint: span(x.start, x.end), tag: tagOf(kind) });
        return;
      }
      const g = x.gap;
      const title = g.short > 1 ? `${g.short} short` : "No one";
      blocks.push({
        key: `${key}:g${i}`, lane: key, row: lines[i], start: g.start, end: g.end, state: "cover", title, hint: span(g.start, g.end), tag: needTag("unfilled"),
        label: `${manage ? "Fill " : ""}${c.label}, ${formatTimeRange(g.start, g.end)}, ${title.toLowerCase()}`,
        render: manage ? (parts) => <AssignDialog activity={who} span={g} candidates={candidates} trigger={parts} /> : undefined,
      });
    });
  }

  // Bookings: one block per booking, who is on it and how many are still needed.
  lanes.push({
    key: "h:bookings", label: "Bookings", header: true, caption: bookings.length ? undefined : "No bookings this day",
    action: manage ? <BookingDialog siteId={site.id} today={now} departments={data.departments} types={data.types} department={dept?.id}
      preset={day >= now ? { date: day, start: "09:30", end: "11:30" } : undefined} outline /> : undefined,
  });
  for (const b of bookings) {
    const places = data.shifts.filter((s) => s.bookingId === b.id);
    if (!places.length) continue;
    const lane = `b:${b.id}`;
    const meta = BOOKING_KIND_META[b.kind as BookingKind];
    const roles = [...Map.groupBy(places, (s) => s.bookingNeed?.role ?? s.role).entries()].map(([role, list]) => `${list.length} ${role.toLowerCase()}${list.length > 1 ? "s" : ""}`).join(", ");
    lanes.push({ key: lane, label: b.title, icon: meta?.icon, caption: [roles, b.place].filter(Boolean).join(" · ") });
    const names = places.flatMap((s) => (s.user?.name ?? s.rotaPerson?.name) ? [s.user?.name ?? s.rotaPerson!.name] : []);
    const missing = places.filter((s) => !s.userId && !s.rotaPersonId);
    const problem = places.find((s) => needs.some((n) => n.shiftId === s.id && n.kind !== "unfilled" && n.kind !== "double"));
    const start = Math.min(...places.map((s) => s.startMinutes)), end = Math.max(...places.map((s) => s.endMinutes));
    // The place a press opens: the first with nobody, else one with a problem, else the first.
    const target = missing[0] ?? problem ?? places[0];
    // First names, so a short booking still shows who: "Ava, Alex".
    const title = names.length ? names.map((n) => n.split(" ")[0]).join(", ") : "Nobody yet";
    const hint = `${span(start, end)}${missing.length ? ` · ${missing.length} needed` : ""}`;
    blocks.push({
      key: lane, lane, start, end, state: problem ? "absent" : missing.length ? "cover" : "assessment", title, hint,
      tag: problem ? needTag("off") : missing.length ? needTag("unfilled") : tagOf("booking"), agendaHint: b.title,
      label: `${b.title}, ${formatTimeRange(start, end)}: ${names.length ? names.join(", ") : "nobody yet"}${missing.length ? `, ${missing.length} still needed` : ""}`,
      render: manage && !target.importId ? (parts: Parts) => (
        <AssignPlaceDialog place={placeOf(target.id)} siteId={site.id} live={live} candidates={candidates} people={people} trigger={parts} suggested={problem ? "cover" : undefined} />
      ) : undefined,
    });
  }

  // Staff: each person's shift as a frame with what they do inside it.
  lanes.push({
    key: "h:staff", label: "Staff", header: true, caption: rows.length || toFill.length ? undefined : "Nobody on shift this day",
    action: manage ? <ShiftDialog siteId={site.id} date={day} today={now} options={options} department={dept?.id}
      trigger={{ label: "Add a shift", variant: "outline", children: <><Plus aria-hidden="true" />Add a shift</> }} /> : undefined,
  });
  const staffBlocks: TimelineBlock[] = [];
  const bookingTitle = new Map(data.bookings.map((b) => [b.id, b.title]));
  const planCovers = data.planned.map((p) => ({ label: p.label, start: p.startMinutes, end: p.endMinutes, requiredTypeId: p.requiredTypeId, requiredType: p.requiredType?.name ?? null }));
  const planPlaces = data.shifts.filter((s) => s.bookingId).map((s) => ({ ...placeOf(s.id), booking: bookingTitle.get(s.bookingId!) ?? "" }));
  for (const r of rows) {
    const own = r.shifts.filter((s) => !isPlace(s.id));
    const places = r.shifts.filter((s) => isPlace(s.id));
    const teaching = teachingSpans(r.teaching.map((t) => ({ userId: r.userId, startMinutes: t.start, endMinutes: t.end, href: t.href })));
    const first = own[0];
    const warning = own.flatMap((s) => s.warnings).find((w) => w !== "overlap");
    lanes.push({
      key: r.key, label: r.name!,
      caption: [own.length ? `Shift ${own.map((s) => span(s.start, s.end)).join(", ")}` : "No shift, bookings only", `${hours(r.minutes)}h`, warning ? ROTA_WARNING_META[warning].label : null].filter(Boolean).join(" · "),
      edit: manage && first?.editable ? <ShiftDialog siteId={site.id} date={day} today={now} shift={editShift(first.id)} options={options}
        trigger={{ label: `Change ${r.name}'s shift`, variant: "ghost", className: "pc-timeline-lane-link", children: r.name! }} /> : undefined,
    });
    for (const s of own) {
      const sheet = (parts: Parts) => (
        <ShiftPlanSheet activities={data.activities} trigger={parts} editable
          title={`${r.name} · ${formatDay(day)}`} description={`${s.role} · ${formatTimeRange(s.start, s.end)}`}
          warnings={[...(s.absent ? ["absent" as const] : []), ...s.warnings]}
          shift={{ id: s.id, start: s.start, end: s.end, role: s.role, who: r.name, segments: s.segments, young: r.userId ? data.young[r.userId] ?? null : null }}
          actions={<>
            <ShiftDialog siteId={site.id} date={day} today={now} shift={editShift(s.id)} options={options} label={s.absent ? "Give cover" : "Change shift"} suggested={s.absent ? "cover" : undefined} />
            <CancelShift id={s.id} label={`${s.role} ${formatTimeRange(s.start, s.end)}`} live={live} withText />
          </>} />
      );
      if (s.absent) {
        staffBlocks.push({ key: `${s.id}:shift`, lane: r.key, start: s.start, end: s.end, state: "absent", title: "Off", hint: `${s.role} · needs cover`, tag: tagOf("absent"),
          label: `${r.name} is off, ${s.role}, ${formatTimeRange(s.start, s.end)}`, render: manage && s.editable ? sheet : undefined });
        continue;
      }
      const busy = [...s.segments, ...places.map((p) => ({ start: p.start, end: p.end })), ...teaching.map((t) => ({ start: t.start, end: t.end }))]
        .filter((b) => b.start < s.end && s.start < b.end).map((b) => ({ start: b.start, end: b.end }));
      const free = `${r.name}'s shift, ${formatTimeRange(s.start, s.end)}: drag across free time, or press, to plan what they do`;
      staffBlocks.push({
        key: `${s.id}:shift`, lane: r.key, start: s.start, end: s.end, state: "shift", title: "On shift", hint: span(s.start, s.end), tag: tagOf("next"),
        agendaHint: `${r.name} · on shift`, label: manage && s.editable ? free : `${r.name}, on shift ${formatTimeRange(s.start, s.end)}`,
        render: manage && s.editable ? (parts) => (
          <DragToPlan shift={{ id: s.id, start: s.start, end: s.end, who: r.name!, userId: r.userId, types: r.userId ? data.held[r.userId] ?? [] : [], date: day, busy }}
            siteId={site.id} live={live} covers={planCovers} places={planPlaces} activities={data.activities} label={free} style={parts.style}>
            <span className="sr-only">{free}</span>
          </DragToPlan>
        ) : undefined,
      });
      for (const x of s.segments) {
        const isBreak = x.kind === "break";
        staffBlocks.push({
          key: `${s.id}:${x.start}:${x.label}`, lane: r.key, start: x.start, end: x.end,
          state: isBreak ? "open" : ROTA_BLOCK_META[kindAt(x.start, x.end)].state,
          title: isBreak ? "Break" : x.label, hint: span(x.start, x.end),
          tag: isBreak ? { icon: Coffee, label: x.label } : tagOf(kindAt(x.start, x.end)), agendaHint: r.name!,
          label: `${r.name}: ${x.label}, ${formatTimeRange(x.start, x.end)}`, render: manage && s.editable ? sheet : undefined,
        });
      }
    }
    for (const p of places) {
      const booking = bookingTitle.get(byId.get(p.id)!.bookingId!) ?? p.part ?? p.role;
      staffBlocks.push({
        key: p.id, lane: r.key, start: p.start, end: p.end, state: p.absent ? "absent" : "assessment", title: booking, hint: span(p.start, p.end),
        tag: tagOf("booking"), agendaHint: r.name!, label: `${r.name}: ${placeLabel(byId.get(p.id)!)}, ${formatTimeRange(p.start, p.end)}`,
        render: manage && p.editable ? (parts) => <AssignPlaceDialog place={placeOf(p.id)} siteId={site.id} live={live} candidates={candidates} people={people} trigger={parts} /> : undefined,
      });
    }
    teaching.forEach((t, i) => staffBlocks.push({
      key: `${r.key}:teach:${i}`, lane: r.key, start: t.start, end: t.end, state: ROTA_BLOCK_META[kindAt(t.start, t.end)].state, title: "Teaching",
      hint: `${span(t.start, t.end)} · ${plural(t.count, "class", "classes")}`, tag: tagOf("teaching"), href: t.href, agendaHint: r.name!,
      label: `${r.name}: teaching ${plural(t.count, "class", "classes")}, ${formatTimeRange(t.start, t.end)}`,
    }));
  }
  // Two things at once (a booking during a duty, say) take a line each, so neither hides the other.
  for (const lane of new Set(staffBlocks.map((b) => b.lane))) {
    const inner = staffBlocks.filter((b) => b.lane === lane && !b.key.endsWith(":shift")).sort((x, y) => x.start - y.start);
    stack(inner).forEach((row, i) => { inner[i].row = row; });
  }
  blocks.push(...staffBlocks);
  // A shift with nobody on it: "Nobody yet", pressed to give it to someone.
  for (const s of toFill) {
    const lane = `fill:${s.id}`;
    lanes.push({ key: lane, label: "Nobody yet", caption: `${s.role} · ${span(s.startMinutes, s.endMinutes)}`, icon: CircleDashed });
    blocks.push({
      key: s.id, lane, start: s.startMinutes, end: s.endMinutes, state: "cover", title: s.role, hint: span(s.startMinutes, s.endMinutes),
      tag: needTag("unfilled"), agendaHint: "Nobody yet", label: `${manage && !s.importId ? "Fill " : ""}${s.role}, ${formatTimeRange(s.startMinutes, s.endMinutes)}, nobody yet`,
      render: manage && !s.importId ? (parts) => <ShiftDialog siteId={site.id} date={day} today={now} shift={editShift(s.id)} options={options} trigger={parts} /> : undefined,
    });
  }
  // Swim school instructors teaching outside any shift still show, so the pool's day is complete.
  const inShift = (c: (typeof data.classes)[number]) => rows.some((r) => r.userId === c.userId && r.shifts.some((s) => s.start < c.endMinutes && c.startMinutes < s.end));
  const outside = dept ? [] : data.classes.filter((c) => c.userId && !inShift(c));
  for (const id of new Set(outside.map((c) => c.userId!))) {
    const key = `swim:${id}`;
    const list = outside.filter((c) => c.userId === id);
    lanes.push({ key, label: data.teachers[id] ?? "Instructor", caption: "Teaching only, set in the Swim school" });
    teachingSpans(list).forEach((x, i) => blocks.push({
      key: `${key}:${i}`, lane: key, start: x.start, end: x.end, state: ROTA_BLOCK_META[kindAt(x.start, x.end)].state, title: "Teaching",
      hint: `${span(x.start, x.end)} · ${plural(x.count, "class", "classes")}`, tag: tagOf("teaching"), href: x.href,
      label: `${data.teachers[id] ?? "Instructor"}: teaching ${plural(x.count, "class", "classes")}, ${formatTimeRange(x.start, x.end)}`,
    }));
  }

  const gaps = needs.length;
  return (
    <section aria-labelledby="planner-day" className="pc-panel">
      <div className="pc-panel-head">
        <h2 id="planner-day">{formatDay(day)}{dept ? ` · ${dept.name}` : ""}</h2>
        {gaps ? <span className="rota-summary" data-tone="gap">{plural(gaps, "gap", "gaps")} to fill</span> : <span className="rota-summary">Everything is covered</span>}
      </div>
      <TimelineGrid readout from={from} to={to} now={day === now ? clockNow : null} lanes={lanes} blocks={blocks} laneHeading="Time"
        label={`The plan for ${formatDay(day)}`} agenda={{ show: (b) => !b.key.endsWith(":shift") || b.state === "absent", empty: "Nothing planned this day yet." }} />
      <ul className="flex flex-wrap gap-2" aria-label="Key">
        <li><Tag meta={{ label: "Someone on it", color: "blue", icon: CalendarDays }} /></li>
        <li><Tag meta={{ label: "Nobody yet", color: "orange", icon: CircleDashed }} /></li>
        <li><Tag meta={{ label: "Booking", color: "purple", icon: School }} /></li>
        <li><Tag meta={{ label: "Off, or not qualified", color: "red", icon: ROTA_NEED_META.off.icon }} /></li>
        <li className="rota-key-shift">Dashed box: their shift</li>
      </ul>
    </section>
  );
}
