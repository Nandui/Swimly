import "server-only";
import { addDaysIso, today, toDateOnlyString } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  examDeadline, fitWarnings, isShortNoticeClash, semesterOf, shiftStart, swapAllowed, swapExpired, swapOverdue, type ExamOutcome, type SwapStatus,
} from "@/modules/staffing/shared/rules";
import { dateOf, pickSite, settingsFor, shiftsOf, strikeCounts, teachers } from "@/modules/staffing/shared/server";

/** Requests at a site: swaps (open, to approve, decided) and exam absences, with the exam seasons
 *  and their deadlines, and the published shifts ahead a request can be made for. */
export async function requestsPage(siteId: string | undefined) {
  const { who, sites, site } = await pickSite(siteId);
  if (!site) return null;
  const day = today();
  const now = new Date();
  const settings = await settingsFor(who.orgId);
  const [swaps, exams, seasons, ahead, people] = await Promise.all([
    prisma.staffingSwap.findMany({ where: { siteId: site.id, shift: { date: { gte: dateOf(addDaysIso(day, -30)) } } }, include: { shift: true }, orderBy: { requestedAt: "desc" } }),
    prisma.staffingExamAbsence.findMany({ where: { siteId: site.id, createdAt: { gte: dateOf(addDaysIso(day, -120)) } }, orderBy: { createdAt: "desc" } }),
    prisma.staffingExamSeason.findMany({ where: { orgId: who.orgId ?? undefined, endsOn: { gte: dateOf(addDaysIso(day, -30)) } }, orderBy: { startsOn: "asc" } }),
    prisma.staffingShift.findMany({
      where: { siteId: site.id, date: { gte: dateOf(day), lte: dateOf(addDaysIso(day, 56)) }, userId: { not: null }, status: "scheduled", block: { publishedAt: { not: null } } },
      orderBy: [{ date: "asc" }, { startMin: "asc" }],
    }),
    teachers(who.orgId),
  ]);
  const names = new Map(people.map((p) => [p.id, p.name]));
  const name = (id: string | null) => (id ? names.get(id) ?? "Someone" : null);
  const ids = people.map((p) => p.id);
  const [others, strikes] = await Promise.all([shiftsOf(ids, day, addDaysIso(day, 63)), strikeCounts(ids, day)]);
  const semester = semesterOf(day);
  const clashes = new Map<string, number>();
  const semesterExams = await prisma.staffingExamAbsence.findMany({ where: { orgId: who.orgId ?? undefined, createdAt: { gte: dateOf(semester.startsOn) } }, select: { userId: true, outcome: true } });
  for (const e of semesterExams) if (isShortNoticeClash(e.outcome)) clashes.set(e.userId, (clashes.get(e.userId) ?? 0) + 1);
  const open = new Set(swaps.filter((s) => s.status === "open" || s.status === "accepted").map((s) => s.shiftId));
  const givenInBlock = new Map<string, number>();
  for (const s of swaps) if (s.status !== "refused" && s.status !== "expired") givenInBlock.set(`${s.requesterId}:${s.shift.blockId}`, (givenInBlock.get(`${s.requesterId}:${s.shift.blockId}`) ?? 0) + 1);
  return {
    who, sites, site, today: day, settings,
    swaps: swaps.map((s) => {
      const start = shiftStart({ date: toDateOnlyString(s.shift.date), startMin: s.shift.startMin });
      const status: SwapStatus = swapExpired(s.status, start, now, settings) ? "expired" : (s.status as SwapStatus);
      return {
        id: s.id, status, requester: name(s.requesterId)!, requesterId: s.requesterId, takerId: s.takerId, taker: name(s.takerId), requestedAt: s.requestedAt,
        decidedByName: s.decidedByName, refusalReason: s.refusalReason, warnings: s.warnings, overdue: status === "accepted" && swapOverdue(s.acceptedAt, now, settings),
        takerWarnings: (() => {
          const taker = s.takerId ? people.find((p) => p.id === s.takerId) : null;
          if (!taker || (s.status !== "accepted" && s.status !== "open")) return [];
          return fitWarnings({ id: s.shiftId, date: toDateOnlyString(s.shift.date), startMin: s.shift.startMin, endMin: s.shift.endMin, role: s.shift.role },
            { ...taker, shifts: others.filter((o) => o.userId === taker.id) }, settings).map((w) => w.text);
        })(),
        overLimit: (givenInBlock.get(`${s.requesterId}:${s.shift.blockId}`) ?? 0) > settings.maxGiveaways,
        shift: { id: s.shift.id, date: toDateOnlyString(s.shift.date), startMin: s.shift.startMin, endMin: s.shift.endMin, role: s.shift.role, name: s.shift.name },
      };
    }),
    exams: exams.map((e) => ({
      id: e.id, person: name(e.userId)!, outcome: e.outcome as ExamOutcome, status: e.status, requestedAt: e.requestedAt, noticeSentOn: e.noticeSentOn ? toDateOnlyString(e.noticeSentOn) : null,
      decidedByName: e.decidedByName, note: e.note, flagged: (clashes.get(e.userId) ?? 0) >= settings.clashFlag,
    })),
    seasons: seasons.map((x) => ({ id: x.id, college: x.college, name: x.name, startsOn: toDateOnlyString(x.startsOn), endsOn: toDateOnlyString(x.endsOn), confirmed: x.confirmed, deadline: examDeadline(toDateOnlyString(x.startsOn), settings) })),
    ahead: ahead.map((s) => {
      const date = toDateOnlyString(s.date);
      return { id: s.id, date, startMin: s.startMin, endMin: s.endMin, role: s.role, name: s.name, userId: s.userId!, person: name(s.userId)!, swapOpen: open.has(s.id), swappable: swapAllowed(shiftStart({ date, startMin: s.startMin }), now, settings) };
    }),
    people: people.map((p) => ({ ...p, strikes: strikes.get(p.id) ?? 0 })),
    others,
    semester: semester.label,
  };
}
export type RequestsPage = NonNullable<Awaited<ReturnType<typeof requestsPage>>>;
