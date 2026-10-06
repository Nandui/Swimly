import "server-only";
import { parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { subjectsFor } from "@/lib/policy/session";
import { requireRotaActor } from "@/lib/rota/access";
import { AuthorizationError } from "@/lib/authz";
import { addDaysIso, returnStage, type AbsenceReason, type AbsenceUpdateKind, type ReturnFit } from "@/lib/rota/constants";
import { commitmentsFor } from "@/modules/server";

/** Absences and returns to work (owner decision, 6 October 2026: the records live in the main
 *  database so the rota always has them, and show on the person's HR file through the
 *  personal-file seam). Run (`rota.manage`) records them for the people it covers. An absence
 *  turns the person's activities into gaps on the rota; it never removes them. */

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Whose absences this person may see and record, as ids (null: everyone in the organisation). */
async function reach() {
  const r = await subjectsFor("rota.manage");
  return r.kind === "all" ? null : [...r.userIds];
}

/** The days a person works from `from` on: rota activities and swim classes they teach. */
async function workDays(userIds: string[], from: string, to: string) {
  if (!userIds.length) return new Map<string, string[]>();
  const [assignments, classes] = await Promise.all([
    prisma.rotaAssignment.findMany({ where: { userId: { in: userIds }, need: { date: { gte: parseDateOnly(from), lte: parseDateOnly(to) } } }, select: { userId: true, need: { select: { date: true } } } }),
    commitmentsFor({ userIds, from, to }).then((all) => all.filter((c) => c.source === "activities.classes")),
  ]);
  const out = new Map<string, string[]>();
  for (const a of assignments) out.set(a.userId, [...(out.get(a.userId) ?? []), iso(a.need.date)!]);
  for (const c of classes) if (c.userId) out.set(c.userId, [...(out.get(c.userId) ?? []), c.date]);
  for (const [k, v] of out) out.set(k, [...new Set(v)].sort());
  return out;
}

/** The Absences page: who is off now or soon, whose return to work is still to record, and who
 *  came back in the last 30 days. Each current absence counts the days of work it leaves to cover. */
export async function rotaAbsences() {
  const who = await requireRotaActor();
  if (!who.run) throw new AuthorizationError("Running the rota is required.");
  const orgId = who.orgId ?? undefined;
  const from = today(), since = addDaysIso(from, -30);
  const users = await reach();
  const rows = await prisma.rotaAbsence.findMany({
    where: { orgId, withdrawnAt: null, userId: users ? { in: users } : { not: null }, OR: [{ lastDay: null }, { lastDay: { gte: parseDateOnly(since) } }, { returnMetOn: null }] },
    orderBy: [{ firstDay: "asc" }],
    select: { id: true, userId: true, reason: true, firstDay: true, lastDay: true, note: true, reportedByName: true, createdAt: true,
      returnMetOn: true, returnFit: true, returnAdjustments: true, returnFitNote: true, returnNote: true, returnByName: true,
      user: { select: { name: true } }, continues: { select: { firstDay: true, lastDay: true, reason: true } },
      updates: { orderBy: { createdAt: "asc" }, select: { id: true, kind: true, lastDay: true, note: true, byName: true, createdAt: true } } },
  });
  const named = rows.map(({ user, updates, returnFit, reason, ...a }) => ({
    ...a, reason: reason as AbsenceReason, returnFit: returnFit as ReturnFit | null, user: { name: user?.name ?? "Someone" },
    updates: updates.map((u) => ({ ...u, kind: u.kind as AbsenceUpdateKind })), extensions: updates.filter((u) => u.kind === "extended").length,
  }));
  const open = named.filter((a) => !a.lastDay || iso(a.lastDay)! >= from);
  const ahead = await workDays(open.flatMap((a) => (a.userId ? [a.userId] : [])), from, addDaysIso(from, 27));
  const current = open.map((a) => ({ ...a, shiftsToCover: (ahead.get(a.userId ?? "") ?? []).filter((d) => !a.lastDay || d <= iso(a.lastDay)!).length }));
  const ended = named.filter((a) => !open.includes(a)).reverse();
  const firstBack = await firstDaysBack(ended.filter((a) => !a.returnMetOn));
  const staged = ended.map((a) => {
    const firstShift = firstBack.get(a.id) ?? null;
    return { ...a, firstShift, stage: returnStage({ lastDay: iso(a.lastDay)!, returnMetOn: iso(a.returnMetOn) }, firstShift, from) };
  });
  const people = await prisma.user.findMany({ where: { orgId, isActive: true, ...(users ? { id: { in: users } } : {}) }, orderBy: { name: "asc" }, select: { id: true, name: true, jobTitle: true } });
  const recentOf = (userId: string) => named.filter((a) => a.userId === userId).map((a) => ({ id: a.id, reason: a.reason, firstDay: iso(a.firstDay)!, lastDay: iso(a.lastDay) }));
  return {
    who, today: from, current, returning: staged.filter((a) => a.stage !== "recorded"), returned: staged.filter((a) => a.stage === "recorded"),
    people: people.map((p) => ({ id: p.id, name: p.name, jobTitle: p.jobTitle, absences: recentOf(p.id) })),
  };
}
export type RotaAbsenceRow = Awaited<ReturnType<typeof rotaAbsences>>["current"][number];
export type RotaReturnRow = Awaited<ReturnType<typeof rotaAbsences>>["returning"][number];

/** For the home page and overview: returns to work due now among the people this person covers. */
export async function returnsToWorkDue() {
  const who = await requireRotaActor();
  if (!who.run) return 0;
  const from = today();
  const users = await reach();
  const ended = await prisma.rotaAbsence.findMany({
    where: { orgId: who.orgId ?? undefined, withdrawnAt: null, returnMetOn: null, lastDay: { lt: parseDateOnly(from) }, userId: users ? { in: users } : { not: null } },
    select: { id: true, userId: true, lastDay: true },
  });
  const firstBack = await firstDaysBack(ended);
  return ended.filter((a) => returnStage({ lastDay: iso(a.lastDay)!, returnMetOn: null }, firstBack.get(a.id) ?? null, from) === "due").length;
}

/** Each ended absence's first day of work after it, within four weeks. */
async function firstDaysBack(absences: { id: string; userId: string | null; lastDay: Date | null }[]) {
  const out = new Map<string, string>();
  const ended = absences.filter((a) => a.lastDay && a.userId);
  if (!ended.length) return out;
  const earliest = ended.map((a) => iso(a.lastDay)!).sort()[0];
  const days = await workDays([...new Set(ended.map((a) => a.userId!))], addDaysIso(earliest, 1), addDaysIso(today(), 28));
  for (const a of ended) {
    const first = (days.get(a.userId!) ?? []).find((d) => d > iso(a.lastDay)!);
    if (first) out.set(a.id, first);
  }
  return out;
}
