"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { can, requirePermission } from "@/lib/authz";
import { LIST_ORDER, LIVE } from "@/lib/curriculum/constants";
import { formatDate, parseDateOnly, today } from "@/lib/format";
import { completionProgress } from "@/lib/progression/rules";
import { fullName } from "@/lib/students/constants";
import { prisma } from "@/lib/prisma";

/** Assessment is the data — manage tier. Confirming a level *with gaps* is a
 *  different act, and admin tier, because it overrides the curriculum rather
 *  than recording what happened in the water. */

const NAME_CAP = 6;

function joinNames(names: string[]): string {
  if (names.length <= NAME_CAP) return names.join(", ");
  return `${names.slice(0, NAME_CAP).join(", ")} and ${names.length - NAME_CAP} others`;
}

const assessSchema = z.object({
  studentId: z.string().min(1),
  levelId: z.string().min(1),
  /** `null` is "not assessed" — the undo for a mis-tap, not a judgement. */
  results: z
    .array(
      z.object({
        competencyId: z.string().min(1),
        status: z.enum(["WORKING_ON", "ACHIEVED"]).nullable(),
      })
    )
    .max(100, "That is more competencies than a level can hold."),
});

export type AssessInput = z.infer<typeof assessSchema>;

/** One action for a whole checklist, for the same reason the register is one
 *  action: Server Actions dispatch one at a time per client. */
export async function saveAssessment(input: AssessInput): Promise<ActionResult> {
  const session = await requirePermission("progression.assess");

  const parsed = assessSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { studentId, levelId, results } = parsed.data;

  const [student, level] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.level.findUnique({
      where: { id: levelId },
      select: {
        id: true,
        name: true,
        programmeId: true,
        competencies: { where: LIVE, select: { id: true, name: true } },
      },
    }),
  ]);
  if (!student) return fail("That student no longer exists.");
  if (!level) return fail("That level no longer exists.");

  const nameById = new Map(level.competencies.map((row) => [row.id, row.name]));
  const stranger = results.find((row) => !nameById.has(row.competencyId));
  if (stranger) {
    return fail("Something on that checklist is not part of this level. Reload and try again.");
  }

  const existing = await prisma.competencyResult.findMany({
    where: { studentId, competencyId: { in: results.map((row) => row.competencyId) } },
    select: { competencyId: true, status: true },
  });
  const before = new Map(existing.map((row) => [row.competencyId, row.status]));

  const changed = results.filter((row) => (before.get(row.competencyId) ?? null) !== row.status);
  // Nothing moved, nothing written — including no audit row.
  if (changed.length === 0) return ok();

  const assessedOn = parseDateOnly(today());
  const assessedByName = session.user.name ?? "Unknown";

  // Typed as the base promise so the delete can join the same transaction —
  // an array inferred from the upserts alone will not take it.
  const writes: Prisma.PrismaPromise<unknown>[] = changed
    .filter((row) => row.status !== null)
    .map((row) =>
      prisma.competencyResult.upsert({
        where: { studentId_competencyId: { studentId, competencyId: row.competencyId } },
        create: {
          studentId,
          competencyId: row.competencyId,
          status: row.status!,
          assessedOn,
          assessedById: session.user.id,
          assessedByName,
        },
        update: {
          status: row.status!,
          assessedOn,
          assessedById: session.user.id,
          assessedByName,
        },
      })
    );

  const cleared = changed.filter((row) => row.status === null).map((row) => row.competencyId);
  if (cleared.length > 0) {
    writes.push(
      prisma.competencyResult.deleteMany({
        where: { studentId, competencyId: { in: cleared } },
      })
    );
  }

  await prisma.$transaction(writes);

  const nowAchieved = changed
    .filter((row) => row.status === "ACHIEVED")
    .map((row) => nameById.get(row.competencyId) ?? "a competency");
  const nowWorking = changed
    .filter((row) => row.status === "WORKING_ON")
    .map((row) => nameById.get(row.competencyId) ?? "a competency");
  const nowCleared = cleared.map((id) => nameById.get(id) ?? "a competency");

  const parts: string[] = [];
  if (nowAchieved.length) parts.push(`passed ${joinNames(nowAchieved)}`);
  if (nowWorking.length) parts.push(`working on ${joinNames(nowWorking)}`);
  if (nowCleared.length) parts.push(`unmarked ${joinNames(nowCleared)}`);

  await logAudit({
    actorId: session.user.id,
    actorName: assessedByName,
    action: "assess",
    entity: "Student",
    entityId: studentId,
    programmeId: level.programmeId,
    summary: `${fullName(student)} in ${level.name} — ${parts.join("; ")}`,
  });

  revalidatePath("/students/[id]", "page");
  revalidatePath("/courses/[id]/assess", "page");
  return ok();
}

const confirmSchema = z.object({
  studentId: z.string().min(1),
  levelId: z.string().min(1),
  note: z.string().trim().max(300),
  /** Non-empty means "confirmed with gaps", which is admin tier. */
  overrideReason: z.string().trim().max(300),
});

export async function confirmLevelCompletion(
  input: z.infer<typeof confirmSchema>
): Promise<ActionResult> {
  const session = await requirePermission("progression.assess");

  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { studentId, levelId, note, overrideReason } = parsed.data;

  const [student, level] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.level.findUnique({
      where: { id: levelId },
      select: {
        id: true,
        name: true,
        programmeId: true,
        competencies: { where: LIVE, orderBy: [...LIST_ORDER], select: { id: true } },
      },
    }),
  ]);
  if (!student) return fail("That student no longer exists.");
  if (!level) return fail("That level no longer exists.");

  const already = await prisma.levelCompletion.findUnique({
    where: { studentId_levelId: { studentId, levelId } },
    select: { id: true },
  });
  if (already) return fail(`${fullName(student)} has already completed ${level.name}.`);

  const achievedRows = await prisma.competencyResult.findMany({
    where: {
      studentId,
      status: "ACHIEVED",
      competencyId: { in: level.competencies.map((row) => row.id) },
    },
    select: { competencyId: true },
  });

  const progress = completionProgress(
    level.competencies.map((row) => row.id),
    new Set(achievedRows.map((row) => row.competencyId))
  );

  if (level.competencies.length === 0) {
    return fail(`${level.name} has no competencies yet, so there is nothing to have passed.`);
  }

  if (!progress.eligible) {
    // Overriding the curriculum is a different decision from recording what
    // happened, so it needs the tier that owns the curriculum — and a reason.
    if (!can(session, "progression.override")) {
      return fail(
        `${fullName(student)} has ${progress.achieved} of ${progress.total}. Only someone allowed to complete a level with gaps can do that.`
      );
    }
    if (!overrideReason) {
      return fail(
        `${fullName(student)} has ${progress.achieved} of ${progress.total}. Say why the level is being completed anyway.`
      );
    }
  }

  const completedOn = parseDateOnly(today());
  const confirmedByName = session.user.name ?? "Unknown";

  await prisma.levelCompletion.create({
    data: {
      studentId,
      levelId,
      programmeId: level.programmeId,
      completedOn,
      // Frozen here. Without the snapshot, one curriculum edit later nobody
      // can tell whether this was earned or waved through.
      competenciesAchieved: progress.achieved,
      competencyCount: progress.total,
      overrideReason: progress.eligible ? null : overrideReason,
      confirmedById: session.user.id,
      confirmedByName,
      note: note || null,
    },
  });

  await logAudit({
    actorId: session.user.id,
    actorName: confirmedByName,
    action: "complete-level",
    entity: "Student",
    entityId: studentId,
    programmeId: level.programmeId,
    summary:
      `${fullName(student)} completed ${level.name} on ${formatDate(completedOn)} (${progress.achieved} of ${progress.total})` +
      (progress.eligible ? "" : ` — confirmed with gaps: ${overrideReason}`),
  });

  revalidatePath("/students/[id]", "page");
  revalidatePath("/courses/[id]/assess", "page");
  return ok();
}

const revokeSchema = z.object({
  reason: z.string().trim().min(1, "Say why the completion is being taken back."),
});

/** Confirmations get made by mistake. A silent delete is worse than an audited
 *  one, so this exists and it demands a reason. */
export async function revokeLevelCompletion(
  id: string,
  input: z.infer<typeof revokeSchema>
): Promise<ActionResult> {
  const session = await requirePermission("progression.override");

  const parsed = revokeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const completion = await prisma.levelCompletion.findUnique({
    where: { id },
    select: {
      id: true,
      programmeId: true,
      completedOn: true,
      level: { select: { name: true } },
      student: { select: { firstName: true, lastName: true } },
    },
  });
  if (!completion) return fail("That completion no longer exists.");

  await prisma.levelCompletion.delete({ where: { id } });

  await logAudit({
    actorId: session.user.id,
    actorName: session.user.name ?? "Unknown",
    action: "revoke-level",
    entity: "Student",
    entityId: id,
    programmeId: completion.programmeId,
    summary: `Took back ${fullName(completion.student)}'s completion of ${completion.level.name} from ${formatDate(completion.completedOn)} — ${parsed.data.reason}`,
  });

  revalidatePath("/students/[id]", "page");
  return ok();
}
