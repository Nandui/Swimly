"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requirePermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { withCourseSeat } from "@/modules/activities/shared/enrolment/seat";
import { coursesOf, MoveRefused, runMove, type StepCheck } from "@/modules/activities/features/together/server/move";

const stepsSchema = z.array(z.object({
  studentId: z.string().min(1),
  toCourseId: z.string().min(1),
  fromEnrolmentId: z.string().min(1).nullable(),
  reason: z.string().trim().max(300, "Keep each reason under 300 characters.").optional(),
  legendAgreement: z.enum(["PENDING", "DONE"]).optional(),
})).min(1, "Nobody to move.").max(8).refine((steps) => new Set(steps.map((s) => s.studentId)).size === steps.length, "Each child once.");

/** What "Move them here" would do, read under the same locks, without changing anything. */
export async function checkMove(input: unknown): Promise<{ ok: true; checks: StepCheck[] } | { ok: false; error: string }> {
  await requirePermission("enrolment.manage");
  const parsed = stepsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const steps = parsed.data;
  const checks = await withCourseSeat(await coursesOf(prisma, steps), (tx) => runMove(tx, steps));
  return { ok: true, checks };
}

/** Makes every move in one transaction: all of them, or none. */
export async function makeMove(input: unknown): Promise<ActionResult> {
  const session = await requirePermission("enrolment.manage");
  const parsed = stepsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const steps = parsed.data;
  try {
    await withCourseSeat(await coursesOf(prisma, steps), (tx) => runMove(tx, steps, session));
  } catch (error) {
    if (error instanceof MoveRefused) return fail(error.message, error.fieldErrors);
    throw error;
  }
  for (const path of ["/together", "/courses", "/schedule", "/instructor", "/legend-agreements", "/awaiting-enrolment"]) revalidatePath(path);
  revalidatePath("/courses/[id]", "page");
  revalidatePath("/students/[id]", "page");
  return ok();
}
