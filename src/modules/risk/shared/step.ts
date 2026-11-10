import "server-only";
import { revalidatePath } from "next/cache";
import type { Prisma, RiskAssessment } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAt, requireRiskActor, type RiskActor } from "@/modules/risk/shared/access";
import { afterContentChange, RiskError } from "@/modules/risk/shared/rules";
import { alreadyDone, guardVersion, lockAssessment, recordStep } from "@/modules/risk/shared/service";
import type { RiskAction, RiskResult } from "@/modules/risk/shared/types";

type Change = {
  /** What to write on the assessment itself, if anything. */
  data?: Prisma.RiskAssessmentUncheckedUpdateInput;
  /** The history's note for this step. */
  note?: string;
};

/** One step on an assessment, the same way every time: authorize at its site, then under the
 *  assessment's lock check the replay and the version, write, and record the history and audit
 *  rows together. `content` marks a change to what was signed off: the assessment loses its
 *  sign-off and waits for it again (rules.ts, afterContentChange), recorded as its own step.
 *  A step that leaves the assessment as it was (a review request) passes no version and bumps none. */
export async function riskStep(
  input: { id: string; operationId: string; version?: number; action: RiskAction; needs: "risk.read" | "risk.write" | "risk.manage" | "risk.signoff"; content?: boolean },
  change: (row: RiskAssessment, who: RiskActor, tx: Prisma.TransactionClient) => Promise<Change>,
): Promise<RiskResult> {
  const who = await requireRiskActor();
  const { id, operationId, version, action } = input;
  try {
    const seen = await prisma.riskAssessment.findFirst({ where: { id, orgId: who.orgId ?? undefined }, select: { siteId: true, status: true } });
    await requireAt(who, seen, input.needs);
    await prisma.$transaction(async (tx) => {
      await lockAssessment(tx, id);
      if (await alreadyDone(tx, id, operationId, who, action)) return;
      const row = await tx.riskAssessment.findUniqueOrThrow({ where: { id } });
      if (version !== undefined) guardVersion(row, version);
      const reset = input.content ? afterContentChange(row) : null;
      const { data = {}, note = "" } = await change(row, who, tx);
      const saved = version === undefined && !Object.keys(data).length
        ? row
        : await tx.riskAssessment.update({ where: { id }, data: { ...reset?.data, ...data, version: { increment: 1 } } });
      await recordStep(tx, saved, who, action, operationId, note);
      if (reset?.cleared) await recordStep(tx, saved, who, "signoff_reset", `${operationId}:reset`, "The assessment was changed after it was signed off.");
    });
  } catch (error) {
    if (error instanceof RiskError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath("/risk-assessments", "layout");
  return { ok: true, id };
}
