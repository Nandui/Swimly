import type { Prisma } from "@/generated/prisma/client";
import type { SharedCurriculum } from "@/modules/activities/shared/curriculum/data/shared";

/** The programmes a swimmer is in now: their active class places. A waiting
 *  list place is not a place yet, so it does not count. */
export async function currentProgrammeIds(tx: Prisma.TransactionClient, studentId: string): Promise<string[]> {
  const rows = await tx.enrolment.findMany({ where: { studentId, status: "ACTIVE" }, select: { programmeId: true } });
  return rows.map((row) => row.programmeId);
}

/** Why a swimmer cannot be assessed for this programme, or null when they can.
 *  Programmes run in the order set on the Programmes page. A swimmer already in
 *  a class is assessed for their own programme or a later one, never an earlier
 *  one; with places in two programmes, the later one counts. Age is checked
 *  separately, by the session's age range (`ageRangeError`). */
export function programmeRuleError(
  curriculum: SharedCurriculum,
  enrolledProgrammeIds: string[],
  sessionProgrammeId: string,
  name: string
): string | null {
  const position = (id: string) => curriculum.programmes.findIndex((p) => p.id === curriculum.programmeIds.resolve(id));
  const target = position(sessionProgrammeId);
  if (target < 0) return null;
  const current = Math.max(-1, ...enrolledProgrammeIds.map(position));
  if (current <= target) return null;
  const now = curriculum.programmes[current];
  const allowed = curriculum.programmes.slice(current).filter((p) => !p.archivedAt).map((p) => p.name);
  const choices = allowed.length > 1 ? `${allowed.slice(0, -1).join(", ")} or ${allowed.at(-1)}` : allowed[0] ?? now.name;
  return `${name} is already in ${now.name}, so they can only book an assessment for ${choices}.`;
}
