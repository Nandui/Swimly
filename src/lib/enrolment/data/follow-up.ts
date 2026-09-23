import type { Prisma, StudentFollowUp } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { canSee, requireSession, AuthorizationError } from "@/lib/authz";
import { toDateOnlyString } from "@/lib/format";
import type { FollowUpEntry, FollowUpHistory, FollowUpSummary } from "@/lib/enrolment/follow-up";

export const FOLLOW_UP_SELECT = { enrolmentFollowUps: { orderBy: { sequence: "desc" }, take: 1 }, _count: { select: { enrolmentFollowUps: true } } } as const satisfies Prisma.StudentSelect;
export function followUpEntry(row: StudentFollowUp): FollowUpEntry {
  return { id: row.id, sequence: row.sequence, actorName: row.actorName, clubName: row.clubName,
    channel: row.channel as FollowUpEntry["channel"], outcome: row.outcome as FollowUpEntry["outcome"], note: row.note,
    occurredOn: toDateOnlyString(row.occurredOn), nextContactOn: row.nextContactOn ? toDateOnlyString(row.nextContactOn) : null, createdAt: row.createdAt.toISOString() };
}
export function followUpSummary(row: { enrolmentFollowUps: StudentFollowUp[]; _count: { enrolmentFollowUps: number } }): FollowUpSummary {
  return { count: row._count.enrolmentFollowUps, latest: row.enrolmentFollowUps[0] ? followUpEntry(row.enrolmentFollowUps[0]) : null };
}
export async function requireFollowUpAccess() {
  const actor = await requireSession();
  if (!canSee(actor, "awaiting-enrolment") && !canSee(actor, "students")) throw new AuthorizationError("You do not have access to swimmer follow-up history.");
  return actor;
}
export async function readFollowUpHistory(studentId: string, before?: number): Promise<FollowUpHistory> {
  await requireFollowUpAccess();
  if (typeof studentId !== "string" || !studentId || studentId.length > 100 || (before !== undefined && (!Number.isSafeInteger(before) || before < 1))) throw new Error("Choose a swimmer and reload their history.");
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: FOLLOW_UP_SELECT });
  if (!student) throw new Error("That swimmer is no longer available.");
  const rows = await prisma.studentFollowUp.findMany({ where: { studentId, ...(before ? { sequence: { lt: before } } : {}) }, orderBy: { sequence: "desc" }, take: 21 });
  const entries = rows.slice(0, 20).map(followUpEntry);
  return { entries, nextBefore: rows.length > 20 ? entries[entries.length - 1].sequence : null, summary: followUpSummary(student) };
}
