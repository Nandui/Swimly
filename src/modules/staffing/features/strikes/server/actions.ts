"use server";

import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { formatShortDay } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { PermissionKey } from "@/lib/staff/permissions";
import { STRIKE_STAGE_META, type StrikeStage } from "@/modules/staffing/shared/rules";
import { atSite, refresh, teachers } from "@/modules/staffing/shared/server";

/** Strike conversations and referrals (BR-8.3): each stage is recorded by its owner. A return-to-
 *  work chat needs Run, the second informal Supervise with a note signed by both, and a referral
 *  Manage. A strike logged in error is withdrawn by Manage, with a reason; never deleted. */

const OWNER_CAP: Record<StrikeStage, PermissionKey> = {
  not_counted: "staffing.run",
  informal_1: "staffing.run",
  informal_2: "staffing.supervise",
  formal_referral: "staffing.manage",
  serious_misconduct_referral: "staffing.manage",
};

const handleSchema = z.object({ note: z.string().trim().min(3, "Say what was discussed or referred.").max(2000), signedByBoth: z.boolean().default(false) });

export async function handleStrike(id: string, input: z.input<typeof handleSchema>): Promise<ActionResult> {
  const parsed = handleSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const strike = await prisma.staffingStrike.findUnique({ where: { id } });
  if (!strike) return fail("That strike no longer exists.");
  const stage = strike.stage as StrikeStage;
  const where = await atSite(strike.siteId, OWNER_CAP[stage]);
  if (!where.ok) return fail(where.error);
  if (strike.handledAt || strike.withdrawnAt) return fail("This has already been recorded.");
  if (stage === "informal_2" && !parsed.data.signedByBoth) return fail("The second informal conversation ends with a written note signed by both. Tick it once it is signed.");
  const person = (await teachers(where.actor.orgId)).find((p) => p.id === strike.userId)?.name ?? "someone";
  await prisma.$transaction(async (tx) => {
    await tx.staffingStrike.update({ where: { id }, data: { handledAt: new Date(), handledById: where.actor.id, handledByName: where.actor.name, note: parsed.data.note, signedByBoth: parsed.data.signedByBoth } });
    await logAudit({ actorId: where.actor.id, actorName: where.actor.name, action: "complete", entity: "StaffingStrike", entityId: id, clubId: strike.siteId,
      summary: `${STRIKE_STAGE_META[stage].label} recorded for ${person} (strike from ${formatShortDay(strike.occurredOn)})` }, tx);
  });
  refresh();
  return ok();
}

export async function withdrawStrike(id: string, reason: string): Promise<ActionResult> {
  const text = reason.trim();
  if (text.length < 3) return fail("Say why the strike is withdrawn.");
  const strike = await prisma.staffingStrike.findUnique({ where: { id } });
  if (!strike) return fail("That strike no longer exists.");
  const where = await atSite(strike.siteId, "staffing.manage");
  if (!where.ok) return fail(where.error);
  if (strike.withdrawnAt) return fail("This strike is already withdrawn.");
  const person = (await teachers(where.actor.orgId)).find((p) => p.id === strike.userId)?.name ?? "someone";
  await prisma.$transaction(async (tx) => {
    await tx.staffingStrike.update({ where: { id }, data: { withdrawnAt: new Date(), note: [strike.note, `Withdrawn: ${text}`].filter(Boolean).join("\n") } });
    await logAudit({ actorId: where.actor.id, actorName: where.actor.name, action: "cancel", entity: "StaffingStrike", entityId: id, clubId: strike.siteId,
      summary: `Withdrew ${person}'s strike from ${formatShortDay(strike.occurredOn)}: ${text}` }, tx);
  });
  refresh();
  return ok();
}
