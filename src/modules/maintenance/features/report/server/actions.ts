"use server";

import { revalidatePath } from "next/cache";
import { areaNamesAt, liveSiteById } from "@/lib/directory";
import { mayFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { requireMaintenanceActor } from "@/modules/maintenance/shared/access";
import { cleanFields, MaintenanceError, problemOf, reportSchema, statusFor, type ReportInput } from "@/modules/maintenance/shared/rules";
import { alreadyDone, lockRequest, recordStep } from "@/modules/maintenance/shared/service";
import type { MaintenanceResult } from "@/modules/maintenance/shared/types";

/** Report a problem at a site: needs `maintenance.report` there. It starts In Trackplan when the
 *  reporter says it is already there, else Reported, waiting for a manager. Sending the same form
 *  twice saves once (the form's id and operation id). Audited with its history row. */
export async function reportProblem(input: ReportInput): Promise<MaintenanceResult> {
  const who = await requireMaintenanceActor();
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: problemOf(parsed.error) };
  const { id, operationId, siteId, ...rest } = parsed.data;
  if (!(await mayFor("maintenance.report", { siteId, orgId: who.orgId }))) return { ok: false, error: "Your role cannot report maintenance problems at that site." };
  const site = await liveSiteById(siteId);
  if (!site || (who.orgId && site.orgId !== who.orgId)) return { ok: false, error: "Choose one of your sites." };
  const fields = cleanFields(rest);
  if (fields.area && !(await areaNamesAt(siteId)).some((a) => a.toLowerCase() === fields.area.toLowerCase())) return { ok: false, error: "Choose an area from the list, or leave it empty and say where." };
  try {
    await prisma.$transaction(async (tx) => {
      await lockRequest(tx, id);
      if (await tx.maintenanceRequest.findUnique({ where: { id }, select: { id: true } })) {
        if (await alreadyDone(tx, id, operationId, who, "report")) return;
        throw new MaintenanceError("This report was already sent. Refresh the page.");
      }
      const row = await tx.maintenanceRequest.create({
        data: { id, orgId: site.orgId ?? who.orgId ?? "", siteId, ...fields, status: statusFor("reported", fields.trackplan), reportedById: who.id, reportedByName: who.name },
      });
      await recordStep(tx, row, who, "report", operationId, "", site.name);
    });
  } catch (error) {
    if (error instanceof MaintenanceError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath("/maintenance", "layout");
  return { ok: true, id };
}
