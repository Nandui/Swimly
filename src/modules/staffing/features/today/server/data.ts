import "server-only";
import { addDaysIso, isDateOnly, today, toDateOnlyString } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { isAway, semesterOf, STRIKE_OWNER, type AttendanceKind, type StrikeStage } from "@/modules/staffing/shared/rules";
import { dateOf, pickSite, settingsFor, shiftsOf, strikeCounts, teachers } from "@/modules/staffing/shared/server";

/** Today for the duty manager (spec section 9): the day's shifts at a site, what was logged, the
 *  places that need cover with who could take them, and the strike conversations due. */
export async function todayPage(siteId: string | undefined, dayParam: string | undefined) {
  const { who, sites, site } = await pickSite(siteId);
  const day = dayParam && isDateOnly(dayParam) ? dayParam : today();
  if (!site) return null;
  const settings = await settingsFor(who.orgId);
  const [rows, people] = await Promise.all([
    prisma.staffingShift.findMany({ where: { siteId: site.id, date: dateOf(day), block: { publishedAt: { not: null } } }, orderBy: [{ startMin: "asc" }, { name: "asc" }, { createdAt: "asc" }] }),
    teachers(who.orgId),
  ]);
  const logs = await prisma.staffingAttendance.findMany({ where: { shiftId: { in: rows.map((r) => r.id) } }, orderBy: { createdAt: "asc" } });
  const names = new Map(people.map((p) => [p.id, p.name]));
  const shifts = rows.map((s) => ({
    id: s.id, coversId: s.coversId, name: s.name, role: s.role, startMin: s.startMin, endMin: s.endMin, status: s.status, userId: s.userId,
    person: s.userId ? names.get(s.userId) ?? "Someone" : null,
    logs: logs.filter((l) => l.shiftId === s.id).map((l) => ({ id: l.id, kind: l.kind as AttendanceKind, onTime: l.onTime, minutesLate: l.minutesLate, loggedBy: l.loggedBy, at: l.createdAt })),
  }));
  // A place needs cover when nobody is on it, or its person is away and nobody covers them.
  const needCover = rows.filter((s) => !s.userId || (isAway(s.status) && !rows.some((o) => o.coversId === s.id && !isAway(o.status)))).map((s) => s.id);
  const ids = people.map((p) => p.id);
  const [others, strikes] = await Promise.all([shiftsOf(ids, addDaysIso(day, -1), addDaysIso(day, 7)), strikeCounts(ids, day)]);
  const due = await prisma.staffingStrike.findMany({
    where: { siteId: site.id, handledAt: null, withdrawnAt: null, stage: { in: ["informal_1"] }, dueOn: { lte: dateOf(addDaysIso(day, 1)) } }, orderBy: { dueOn: "asc" },
  });
  return {
    who, sites, site, day, today: today(), settings,
    shifts, needCover,
    people: people.map((p) => ({ ...p, strikes: strikes.get(p.id) ?? 0 })),
    others,
    chats: due.map((s) => ({ id: s.id, userId: s.userId, name: names.get(s.userId) ?? "Someone", stage: s.stage as StrikeStage, cause: s.cause, dueOn: toDateOnlyString(s.dueOn), owner: STRIKE_OWNER[s.stage as StrikeStage] })),
    semester: semesterOf(day).label,
  };
}
export type TodayPage = NonNullable<Awaited<ReturnType<typeof todayPage>>>;
