import type { Prisma } from "@/generated/prisma/client";
import { readSharedCurriculum } from "@/lib/curriculum/data/shared";

/** All catalogue creates/renames take this lock before checking the shared
 * name space, including definitions whose original parent is a site copy. */
export async function sharedNameTaken(tx: Prisma.TransactionClient, kind: "programme" | "level" | "competency" | "type", name: string, parentId?: string, exceptId?: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(73916420)`;
  const c = await readSharedCurriculum(tx);
  const rows = kind === "programme" ? c.programmes
    : kind === "level" ? c.levels.filter(l => l.programmeId === c.programmeIds.resolve(parentId!))
    : kind === "competency" ? c.competencies.filter(item => item.levelId === c.levelIds.resolve(parentId!))
    : c.types.filter(t => t.programmeId === c.programmeIds.resolve(parentId!));
  return rows.some(row => row.id !== exceptId && row.name.trim().toLocaleLowerCase("en-IE") === name.trim().toLocaleLowerCase("en-IE"));
}
