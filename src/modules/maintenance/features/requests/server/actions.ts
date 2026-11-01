"use server";

import { revalidatePath } from "next/cache";
import { areaNamesAt, siteName } from "@/lib/directory";
import { mayFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { requireMaintenanceActor, type MaintenanceActor } from "@/modules/maintenance/shared/access";
import { cleanFields, correctSchema, isOpen, MaintenanceError, moveChange, moveSchema, problemOf, statusFor, type CorrectInput, type MoveInput } from "@/modules/maintenance/shared/rules";
import { alreadyDone, guardVersion, lockRequest, recordStep } from "@/modules/maintenance/shared/service";
import type { MaintenanceRequest, Prisma } from "@/generated/prisma/client";
import type { MaintenanceAction, MaintenanceResult, MaintenanceStatus, Move, TrackplanAnswer } from "@/modules/maintenance/shared/types";

/** Manage's writes on one request, at its site: authorize, validate, then under the request's lock
 *  check the version and replay, write, and record the history and audit rows together. */
async function asManager(who: MaintenanceActor, id: string) {
  const row = await prisma.maintenanceRequest.findFirst({ where: { id, orgId: who.orgId ?? undefined }, select: { siteId: true } });
  if (!row || !(await mayFor("maintenance.report", { siteId: row.siteId, orgId: who.orgId }))) throw new MaintenanceError("This request is not available.");
  if (!(await mayFor("maintenance.manage", { siteId: row.siteId, orgId: who.orgId }))) throw new MaintenanceError("Changing requests needs Maintenance: Manage at this site.");
  return row.siteId;
}

async function step(id: string, operationId: string, version: number, action: MaintenanceAction, change: (row: MaintenanceRequest, who: MaintenanceActor, tx: Prisma.TransactionClient) => Promise<{ data: Record<string, unknown>; note: string }>): Promise<MaintenanceResult> {
  const who = await requireMaintenanceActor();
  try {
    const site = await siteName(await asManager(who, id));
    await prisma.$transaction(async (tx) => {
      await lockRequest(tx, id);
      if (await alreadyDone(tx, id, operationId, who, action)) return;
      const row = await tx.maintenanceRequest.findUniqueOrThrow({ where: { id } });
      guardVersion(row, version);
      const { data, note } = await change(row, who, tx);
      const saved = await tx.maintenanceRequest.update({ where: { id }, data: { ...data, version: { increment: 1 } } });
      await recordStep(tx, saved, who, action, operationId, note, site);
    });
  } catch (error) {
    if (error instanceof MaintenanceError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath("/maintenance", "layout");
  return { ok: true, id };
}

/** Put it in Trackplan, mark it fixed, close it not fixed (with a reason, or as a duplicate of
 *  another request at the site), or open it again. */
export async function moveRequest(input: MoveInput): Promise<MaintenanceResult> {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: problemOf(parsed.error) };
  const { id, operationId, version, move, ...rest } = parsed.data;
  return step(id, operationId, version, move satisfies Move, async (row, who, tx) => {
    const duplicate = move === "close" && rest.duplicateOfId
      ? await tx.maintenanceRequest.findFirst({ where: { id: rest.duplicateOfId, orgId: row.orgId, siteId: row.siteId, status: { not: "closed" } }, select: { id: true } })
      : null;
    const data = moveChange({ id: row.id, status: row.status as MaintenanceStatus, trackplan: row.trackplan as TrackplanAnswer, trackplanRef: row.trackplanRef }, move, rest, who, new Date(), duplicate);
    return { data, note: move === "trackplan" && rest.trackplanRef ? [rest.note, `Reference ${rest.trackplanRef}`].filter(Boolean).join(". ") : rest.note || ("outcome" in data && typeof data.outcome === "string" ? data.outcome : "") };
  });
}

/** Correct what was reported: where, what, urgency, risk and the Trackplan answer. An open request
 *  follows the answer (Yes is In Trackplan); a closed one keeps its status. */
export async function correctRequest(input: CorrectInput): Promise<MaintenanceResult> {
  const parsed = correctSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: problemOf(parsed.error) };
  const { id, operationId, version, ...rest } = parsed.data;
  return step(id, operationId, version, "correct", async (row, _who, tx) => {
    const fields = cleanFields(rest);
    if (fields.area && fields.area.toLowerCase() !== row.area.toLowerCase() && !(await areaNamesAt(row.siteId, tx)).some((a) => a.toLowerCase() === fields.area.toLowerCase()))
      throw new MaintenanceError("Choose an area from the list, or leave it empty and say where.");
    const changed = (Object.keys(fields) as (keyof typeof fields)[]).filter((k) => fields[k] !== row[k]);
    if (!changed.length) throw new MaintenanceError("Nothing has changed.");
    const status = isOpen(row.status) ? statusFor(row.status as MaintenanceStatus, fields.trackplan) : row.status;
    return { data: { ...fields, status }, note: `Changed: ${changed.map((k) => LABELS[k]).join(", ")}` };
  });
}

const LABELS = { area: "area", place: "where exactly", title: "what is broken", details: "details", urgency: "urgency", risk: "risk", trackplan: "Trackplan answer", trackplanRef: "Trackplan reference" } as const;
