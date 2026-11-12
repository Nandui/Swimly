import "server-only";
import { notFound } from "next/navigation";
import { addDaysIso, today, toDateOnlyString } from "@/lib/format";
import { mayFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import {
  ackState, blockEnd, blockState, hoursAgainstContract, nextBlockStart, publishDeadline, semesterOf,
} from "@/modules/staffing/shared/rules";
import { pickSite, settingsFor, shiftsOf, staffingSites, strikeCounts, poolStaff } from "@/modules/staffing/shared/server";

/** The Blocks page: one site's blocks, newest first, with where each stands. */
export async function blocksPage(siteId: string | undefined) {
  const { who, sites, site } = await pickSite(siteId);
  if (!site) return null;
  const now = new Date();
  const [settings, rows] = await Promise.all([
    settingsFor(who.orgId),
    prisma.staffingBlock.findMany({
      where: { siteId: site.id }, orderBy: { startsOn: "desc" }, take: 12,
      include: { shifts: { select: { userId: true } }, acks: { select: { acknowledgedAt: true } } },
    }),
  ]);
  const blocks = rows.map((b) => {
    const startsOn = toDateOnlyString(b.startsOn);
    const deadline = publishDeadline(startsOn, settings);
    return {
      id: b.id, startsOn, endsOn: blockEnd(startsOn), deadline, state: blockState(b.publishedAt, deadline, now), publishedAt: b.publishedAt,
      places: b.shifts.length, filled: b.shifts.filter((s) => s.userId).length,
      acks: b.acks.length, acknowledged: b.acks.filter((a) => a.acknowledgedAt).length,
    };
  });
  const latest = rows[0] ? toDateOnlyString(rows[0].startsOn) : null;
  const next = nextBlockStart(latest, today(), settings, now);
  const upcoming = blocks.filter((b) => b.state !== "published").sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0] ?? null;
  const nextDeadline = publishDeadline(next, settings);
  return { who, sites, site, blocks, next: { startsOn: next, deadline: nextDeadline, state: blockState(null, nextDeadline, now) }, upcoming, settings };
}

/** One block: its days and places, the staff and their other shifts (for the warnings, worked
 *  out in the browser from the same rules), hours against contract and acknowledgements. */
export async function blockPage(id: string) {
  const block = await prisma.staffingBlock.findUnique({
    where: { id },
    include: { shifts: { orderBy: [{ date: "asc" }, { startMin: "asc" }, { name: "asc" }, { createdAt: "asc" }] }, acks: true },
  });
  if (!block) notFound();
  const { who, sites } = await staffingSites();
  const site = sites.find((s) => s.id === block.siteId);
  if (!site || !(await mayFor("staffing.read", { siteId: block.siteId, orgId: block.orgId }))) notFound();
  const now = new Date();
  const startsOn = toDateOnlyString(block.startsOn);
  const endsOn = blockEnd(startsOn);
  const settings = await settingsFor(block.orgId);
  const people = await poolStaff(block.orgId);
  const ids = people.map((p) => p.id);
  const [others, strikes, swaps] = await Promise.all([
    shiftsOf(ids, addDaysIso(startsOn, -7), addDaysIso(endsOn, 7)),
    strikeCounts(ids, startsOn),
    prisma.staffingSwap.findMany({ where: { shift: { blockId: block.id } }, select: { requesterId: true, status: true } }),
  ]);
  const names = new Map(people.map((p) => [p.id, p.name]));
  const shifts = block.shifts.map((s) => ({
    id: s.id, slotId: s.slotId, date: toDateOnlyString(s.date), startMin: s.startMin, endMin: s.endMin, role: s.role, name: s.name,
    userId: s.userId, person: s.userId ? names.get(s.userId) ?? "Someone no longer on the rota" : null, status: s.status,
  }));
  const contracts = new Map(people.filter((p) => p.contractMinutes !== null).map((p) => [p.id, p.contractMinutes!]));
  const hours = hoursAgainstContract(startsOn, shifts, contracts)
    .map((h) => ({ ...h, name: names.get(h.userId) ?? "Someone" }))
    .sort((a, b) => b.short - a.short || a.name.localeCompare(b.name));
  const given = new Map<string, number>();
  for (const s of swaps) if (s.status === "approved" || s.status === "accepted" || s.status === "open") given.set(s.requesterId, (given.get(s.requesterId) ?? 0) + 1);
  const deadline = publishDeadline(startsOn, settings);
  return {
    who, site,
    block: { id: block.id, startsOn, endsOn, deadline, state: blockState(block.publishedAt, deadline, now), publishedAt: block.publishedAt, publishedByName: block.publishedByName, shortAccepted: block.shortAccepted },
    shifts,
    people: people.map((p) => ({ ...p, strikes: strikes.get(p.id) ?? 0, givenAway: given.get(p.id) ?? 0 })),
    others: others.filter((o) => !block.shifts.some((s) => s.id === o.id)),
    hours,
    acks: block.acks.map((a) => ({
      userId: a.userId, name: names.get(a.userId) ?? "Someone", acknowledgedAt: a.acknowledgedAt, phonedAt: a.phonedAt, phonedByName: a.phonedByName,
      state: ackState(block.publishedAt ?? now, a.acknowledgedAt, now, settings),
    })).sort((a, b) => a.name.localeCompare(b.name)),
    settings,
    semester: semesterOf(startsOn).label,
    today: today(),
  };
}
export type BlockPage = Awaited<ReturnType<typeof blockPage>>;
