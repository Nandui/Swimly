import "server-only";
import { activePlacedStaff, areasAt, contractMinutesByIds, departmentIdsOf, departmentsForSite, sitesByIds, staffAgesByIds } from "@/lib/directory";
import { isDateOnly, parseDateOnly, toDateOnlyString as isoOf, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { qualificationsHeldBy } from "@/lib/qualifications";
import { activityTypesOf, subActivitiesFor } from "@/lib/setup/activity-types";
import { subTimes } from "@/lib/setup/meta";
import { commitmentsFor } from "@/modules/contributions";
import { changeBlocked } from "@/modules/rota/shared/access";
import { addDaysIso, mondayOf, youngBand } from "@/modules/rota/shared/constants";
import { pickSite } from "@/modules/rota/shared/data";
import { CLASSES } from "@/modules/rota/shared/writes";
import { buildDiary, type DiaryInput, type Span } from "@/modules/rota/features/diary/model";

/** Every department together, as `dept=all`. */
export const EVERY_DEPARTMENT = "all";

/** The day's diary for a department at a site, from the saved records (people on areas,
 *  activities, bookings and swim classes, planned shifts, breaks, absences), with the week's days
 *  around it and what the viewer may change. It opens on the viewer's own department and on today
 *  when it is in the week shown. */
export async function diaryWeek(input: { site?: string; dept?: string; day?: string }) {
  const { who, sites, site } = await pickSite(input.site);
  const now = today();
  const date = input.day && isDateOnly(input.day) ? input.day : now;
  const monday = mondayOf(date);
  if (!site) return { who, sites, site: null, date, now } as const;
  const orgId = who.orgId ?? null;
  const [departments, mine] = await Promise.all([departmentsForSite(orgId, site.id), departmentIdsOf(who.id).then((ids) => new Set(ids))]);
  const every = input.dept === EVERY_DEPARTMENT;
  const department = every ? null : departments.find((d) => d.id === input.dept) ?? departments.find((d) => mine.has(d.id)) ?? departments[0] ?? null;
  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i));
  const inputs = await diaryInputs(site.id, orgId, days, department?.id ?? null);
  const diaries = new Map(days.map((d) => [d, buildDiary(inputs.get(d)!)]));
  // Paid time this week at this site, every department's, for hours against contract.
  const weekPaid = new Map<string, number>();
  for (const d of days) for (const p of buildDiary({ ...inputs.get(d)!, departmentId: null }).people) weekPaid.set(p.userId, (weekPaid.get(p.userId) ?? 0) + p.paidMinutes);
  const diary = diaries.get(date)!;
  const dayInput = inputs.get(date)!;
  const contracts = await contractMinutesByIds(dayInput.staff.map((s) => s.userId));
  const hours = Object.fromEntries(dayInput.staff.map((s) => [s.userId, { week: weekPaid.get(s.userId) ?? 0, contract: contracts.get(s.userId) ?? null }]));
  const at = { plan: site.plan, run: site.run };
  // The department a change is made for: the one shown, or with every department, the viewer's own.
  const changeFor = department ?? departments.find((d) => mine.has(d.id) && !changeBlocked(at, date, now, d.id, mine)) ?? null;
  const blocked = changeFor ? changeBlocked(at, date, now, changeFor.id, mine) : "member";
  const share = department ? await prisma.rotaWeekShare.findUnique({
    where: { siteId_departmentId_monday: { siteId: site.id, departmentId: department.id, monday: parseDateOnly(monday) } }, select: { sharedByName: true },
  }) : null;
  const types = await activityTypesOf(orgId, false);
  return {
    who, sites, site, now, date, monday, departments, department, every, share,
    week: days.map((d) => ({ date: d, holes: diaries.get(d)!.holes.length, people: diaries.get(d)!.people.length })),
    diary, hours,
    /** For "Who could fill it": everyone at the site, what they hold and where else they are. */
    pool: { staff: dayInput.staff, held: dayInput.held, off: [...dayInput.off], elsewhere: Object.fromEntries(dayInput.elsewhere) },
    departmentFor: changeFor?.id ?? null,
    canChange: !blocked,
    blocked,
    canShare: !!department && (site.run || (site.plan && mine.has(department.id))),
    /** What can be added to the day: the department's activities (not swim classes, which come from the timetable). */
    types: types.filter((t) => !t.fromClasses && (!changeFor || t.departmentId === changeFor.id)).map((t) => ({ id: t.id, name: t.name })),
    areas: (await areasAt(site.id)).map((a) => ({ name: a.name, lanes: a.lanes, parentName: a.parentName })),
    /** Each activity's sub-activities, to choose from on someone's line. */
    subActivities: await subActivitiesFor(types.map((t) => t.id)),
  } as const;
}
export type DiaryWeek = Extract<Awaited<ReturnType<typeof diaryWeek>>, { diary: unknown }>;

/** The model's input for each day, read in one go for the days asked. */
export async function diaryInputs(siteId: string, orgId: string | null, days: readonly string[], departmentId: string | null) {
  const from = days[0], to = days[days.length - 1];
  const range = { gte: parseDateOnly(from), lte: parseDateOnly(to) };
  const [types, areas, needs, onAreas, shifts, breaks, commitments, placed] = await Promise.all([
    activityTypesOf(orgId, true),
    areasAt(siteId),
    prisma.rotaNeed.findMany({ where: { siteId, date: range }, select: { id: true, date: true, typeId: true, place: true, startMinutes: true, endMinutes: true, places: true, note: true,
      repeat: { select: { title: true } }, assignments: { select: { id: true, needId: true, place: true, userId: true, startMinutes: true, endMinutes: true,
        subs: { orderBy: { sortOrder: "asc" }, select: { name: true, when: true, atMinutes: true, times: true } } } } } }),
    prisma.rotaAreaAssignment.findMany({ where: { siteId, date: range }, select: { id: true, date: true, areaId: true, qualificationTypeId: true, place: true, userId: true, startMinutes: true, endMinutes: true } }),
    prisma.rotaPlanShift.findMany({ where: { siteId, date: range }, select: { id: true, date: true, userId: true, departmentId: true, startMinutes: true, endMinutes: true } }),
    prisma.rotaBreak.findMany({ where: { siteId, date: range }, select: { date: true, userId: true, startMinutes: true, minutes: true, paid: true } }),
    commitmentsFor({ siteIds: [siteId], from, to }),
    activePlacedStaff(orgId),
  ]);
  const classes = commitments.filter((c) => c.source === CLASSES && c.ref);
  const atSite = placed.filter((p) => !p.siteIds.length || p.siteIds.includes(siteId));
  const onDay = [...needs.flatMap((n) => n.assignments.map((a) => a.userId)), ...onAreas.map((a) => a.userId), ...shifts.map((s) => s.userId), ...classes.flatMap((c) => (c.userId ? [c.userId] : []))];
  const ids = [...new Set([...atSite.map((p) => p.id), ...onDay])];
  const [ages, held, absences, awayNeeds, awayAreas, awayClasses] = await Promise.all([
    staffAgesByIds(ids),
    qualificationsHeldBy(ids),
    prisma.rotaAbsence.findMany({ where: { userId: { in: ids }, withdrawnAt: null, firstDay: { lte: parseDateOnly(to) }, OR: [{ lastDay: null }, { lastDay: { gte: parseDateOnly(from) } }] },
      select: { userId: true, firstDay: true, lastDay: true } }),
    prisma.rotaAssignment.findMany({ where: { userId: { in: ids }, need: { siteId: { not: siteId }, date: range } }, select: { userId: true, startMinutes: true, endMinutes: true, need: { select: { date: true, siteId: true } } } }),
    prisma.rotaAreaAssignment.findMany({ where: { userId: { in: ids }, siteId: { not: siteId }, date: range }, select: { userId: true, date: true, siteId: true, startMinutes: true, endMinutes: true } }),
    commitmentsFor({ userIds: ids, from, to }).then((all) => all.filter((c) => c.siteId !== siteId)),
  ]);
  const siteNames = await sitesByIds([...awayNeeds.map((a) => a.need.siteId), ...awayAreas.map((a) => a.siteId)]);
  const departmentsOf = new Map(placed.map((p) => [p.id, p.departmentIds]));
  const dob = new Map(ages.map((a) => [a.id, a.dateOfBirth ? isoOf(a.dateOfBirth) : null]));
  const names = new Map(ages.map((a) => [a.id, a.name]));
  const areaIds = new Map(areas.map((a) => [a.id, a]));
  const out = new Map<string, DiaryInput>();
  for (const date of days) {
    const on = (d: Date) => isoOf(d) === date;
    const elsewhere = new Map<string, (Span & { label: string })[]>();
    const away = (userId: string, s: Span & { label: string }) => elsewhere.set(userId, [...(elsewhere.get(userId) ?? []), s]);
    for (const a of awayNeeds) if (on(a.need.date)) away(a.userId, { start: a.startMinutes, end: a.endMinutes, label: `At ${siteNames.get(a.need.siteId)?.name ?? "another site"}` });
    for (const a of awayAreas) if (on(a.date)) away(a.userId, { start: a.startMinutes, end: a.endMinutes, label: `At ${siteNames.get(a.siteId)?.name ?? "another site"}` });
    for (const c of awayClasses) if (c.date === date && c.userId) away(c.userId, { start: c.startMinutes, end: c.endMinutes, label: c.label });
    const dayNeeds = needs.filter((n) => on(n.date));
    out.set(date, {
      date, departmentId, areas, held: held.map((q) => ({ userId: q.userId, typeId: q.typeId, issuedOn: q.issuedOn ? isoOf(q.issuedOn) : null, expiresOn: q.expiresOn ? isoOf(q.expiresOn) : null, revoked: !!q.revokedAt })),
      types: types.map((t) => ({ id: t.id, name: t.name, departmentId: t.departmentId, requiredTypeId: t.requiredTypeId, requiredName: t.requiredType?.name ?? null, fromClasses: t.fromClasses })),
      needs: dayNeeds.map((n) => ({ id: n.id, typeId: n.typeId, place: n.place, start: n.startMinutes, end: n.endMinutes, places: n.places, note: n.note, bookingTitle: n.repeat?.title ?? null })),
      assignments: dayNeeds.flatMap((n) => n.assignments.map((a) => ({ id: a.id, needId: a.needId, place: a.place, userId: a.userId, start: a.startMinutes, end: a.endMinutes,
        subs: a.subs.map((x) => ({ name: x.name, when: x.when, at: x.atMinutes, times: x.when === "at" ? subTimes(x) : [] })) }))),
      // An area's need is `area:<area>:<qualification>:<date>` (areaNeedsOn); kept only while the area is.
      areaAssignments: onAreas.filter((a) => on(a.date) && areaIds.has(a.areaId)).map((a) => ({ id: a.id, needId: `area:${a.areaId}:${a.qualificationTypeId ?? "*"}:${date}`, place: a.place, userId: a.userId, start: a.startMinutes, end: a.endMinutes })),
      classes: classes.filter((c) => c.date === date).map((c) => ({ ref: c.ref!, title: c.title ?? c.label, place: c.place ?? "", start: c.startMinutes, end: c.endMinutes, userId: c.userId })),
      shifts: shifts.filter((s) => on(s.date)).map((s) => ({ id: s.id, userId: s.userId, departmentId: s.departmentId, start: s.startMinutes, end: s.endMinutes })),
      breaks: breaks.filter((b) => on(b.date)).map((b) => ({ userId: b.userId, start: b.startMinutes, minutes: b.minutes, paid: b.paid })),
      staff: ids.map((id) => ({ userId: id, name: names.get(id) ?? "Former staff", departmentIds: departmentsOf.get(id) ?? [], young: youngBand(dob.get(id) ?? null, date) })),
      off: new Set(absences.filter((a) => a.userId && isoOf(a.firstDay) <= date && (!a.lastDay || isoOf(a.lastDay) >= date)).map((a) => a.userId!)),
      elsewhere,
    });
  }
  return out;
}

