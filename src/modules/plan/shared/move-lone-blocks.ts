import { logAudit } from "@/lib/audit";
import { sitesByIds } from "@/lib/directory";
import { today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { planLoneBlocks, type LoneBlock, type Move } from "@/modules/plan/shared/lone-blocks";
import { clock } from "@/modules/plan/shared/rules";
import type { SessionDef } from "@/modules/plan/shared/model";

/** Moves blocks that are on a kind of work by itself onto activities (D33), for
 *  `scripts/plan-move-lone-blocks.ts`. Only blocks from `from` on (today unless told): days gone
 *  by stay as they were. Reads and reports always; writes only with `confirm`, each move in one
 *  transaction with its audit row. Run twice it finds nothing the second time, because a moved
 *  block is on an activity. Not a server action: nobody is signed in, an operator runs it. */

const ACTOR = { actorId: null, actorName: "Operator script" };
const WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type MoveReport = { site: string; what: string; people: number; days: number; move: Move };

export async function moveLoneBlocks(options: { confirm: boolean; from?: string }): Promise<{ from: string; moves: MoveReport[]; written: boolean }> {
  const from = options.from ?? today();
  const rows = await prisma.planBlock.findMany({
    where: { sessionId: null, duty: { isBreak: false }, shift: { date: { gte: from } } },
    include: { shift: { select: { orgId: true, siteId: true, date: true } }, duty: { select: { name: true } } },
    orderBy: [{ shift: { date: "asc" } }, { startMinutes: "asc" }],
  });
  if (rows.length === 0) return { from, moves: [], written: false };
  const blocks: LoneBlock[] = rows.map((b) => ({ id: b.id, siteId: b.shift.siteId, date: b.shift.date, dutyId: b.dutyId, start: b.startMinutes, end: b.endMinutes }));
  const siteIds = [...new Set(blocks.map((b) => b.siteId))];
  const last = blocks.reduce((max, b) => (b.date > max ? b.date : max), from);
  const sessionRows = await prisma.planSession.findMany({
    where: { siteId: { in: siteIds }, cancelledAt: null, firstDay: { lte: last }, lastDay: { gte: from } },
    include: { needs: true, days: { where: { date: { gte: from, lte: last } } } },
  });
  const sessions: (SessionDef & { siteId: string })[] = sessionRows.map((s) => ({
    id: s.id, siteId: s.siteId, title: s.title, areaId: s.siteAreaId, lanes: s.lanes, start: s.startMinutes, end: s.endMinutes, weekdays: s.weekdays,
    firstDay: s.firstDay, lastDay: s.lastDay, skipDays: s.skipDays, needs: s.needs.map((n) => ({ dutyId: n.dutyId, count: n.count })),
    days: s.days.map((d) => ({ date: d.date, cancelled: d.cancelled, start: d.startMinutes, end: d.endMinutes })),
  }));
  const moves = planLoneBlocks(blocks, sessions);
  const sites = await sitesByIds(siteIds);
  const dutyName = new Map(rows.map((b) => [b.dutyId, b.duty.name]));
  const orgOf = new Map(rows.map((b) => [b.shift.siteId, b.shift.orgId]));

  const report = moves.map((move): MoveReport => {
    const name = dutyName.get(move.dutyId) ?? "Work";
    const what = move.kind === "join"
      ? `${name} joins the activity "${move.title}"`
      : `${name} becomes a new activity "${name}", ${clock(move.start)} to ${clock(move.end)}, ${move.weekdays.map((d) => WEEKDAY[d]).join(" ")}, ${move.firstDay} to ${move.lastDay}`
        + `, needs ${move.count}${move.skipDays.length ? `, not on ${move.skipDays.length} of those days` : ""}`;
    return { site: sites.get(move.siteId)?.name ?? move.siteId, what, people: move.blockIds.length, days: move.dates.length, move };
  });
  if (!options.confirm) return { from, moves: report, written: false };

  for (const { move, what } of report) {
    await prisma.$transaction(async (tx) => {
      let sessionId: string;
      if (move.kind === "join") sessionId = move.sessionId;
      else {
        const made = await tx.planSession.create({ data: {
          orgId: orgOf.get(move.siteId) ?? "", siteId: move.siteId, title: dutyName.get(move.dutyId) ?? "Work", startMinutes: move.start, endMinutes: move.end,
          weekdays: move.weekdays, firstDay: move.firstDay, lastDay: move.lastDay, skipDays: move.skipDays,
          note: "Made from work that was planned by itself (D33).", createdById: "script", createdByName: ACTOR.actorName,
          needs: { create: { dutyId: move.dutyId, count: move.count } },
        } });
        sessionId = made.id;
      }
      // Only blocks still by themselves: someone may have moved one since the plan was read.
      const moved = await tx.planBlock.updateMany({ where: { id: { in: move.blockIds }, sessionId: null }, data: { sessionId } });
      await logAudit({ ...ACTOR, action: move.kind === "join" ? "update" : "create", entity: "PlanSession", entityId: sessionId, clubId: move.siteId,
        summary: `${what}: ${moved.count} block${moved.count === 1 ? "" : "s"} moved onto it` }, tx);
    });
  }
  return { from, moves: report, written: true };
}
