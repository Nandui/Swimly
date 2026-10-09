"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { AuthorizationError, canSee, requirePermission } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/** The Legend steps of the billing follow-up (owner decisions, 9 October 2026; bulk-log.ts):
 *  marking an export processed or restored, and the price list the restore export reads. */

function refresh() {
  revalidatePath("/cancellations");
  revalidatePath("/cancellations/prices");
  revalidatePath("/duty");
}

const batchSchema = z.object({ ids: z.array(z.string().min(1)).min(1, "Nothing to mark.").max(500) });

/** After the Legend bulk update export: the classes in that file are processed (billing is
 *  notified) and wait in "To restore" for the direct debit run (owner decision, 9 October 2026). */
export async function markLegendProcessed(input: z.infer<typeof batchSchema>): Promise<ActionResult> {
  return markBatch(input, "processed");
}

/** After the restore export: the classes' members are back on their monthly price; done. */
export async function markRestored(input: z.infer<typeof batchSchema>): Promise<ActionResult> {
  return markBatch(input, "restored");
}

async function markBatch(input: z.infer<typeof batchSchema>, step: "processed" | "restored"): Promise<ActionResult> {
  const session = await requirePermission("billing.notify");
  if (!canSee(session, "cancellations")) throw new AuthorizationError("Cancelled classes access is required.");
  const parsed = batchSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const clubId = await currentClubId(), actorName = session.user.name ?? "Unknown", now = new Date();
  const where = step === "processed"
    ? { id: { in: parsed.data.ids }, clubId, billingNotifiedAt: null }
    : { id: { in: parsed.data.ids }, clubId, legendProcessedAt: { not: null }, restoredAt: null };
  const rows = await prisma.classCancellation.findMany({ where, select: { id: true, courseId: true, className: true, date: true } });
  if (!rows.length) return fail(step === "processed" ? "Those classes are no longer awaiting billing. Refresh the list." : "Those classes are no longer waiting to be restored. Refresh the list.");
  await prisma.$transaction(async (tx) => {
    await tx.classCancellation.updateMany({ where: { ...where, id: { in: rows.map((r) => r.id) } }, data: step === "processed"
      ? { legendProcessedAt: now, legendProcessedById: session.user.id, legendProcessedByName: actorName,
          billingNotifiedAt: now, billingNotifiedById: session.user.id, billingNotifiedByName: actorName, billingNote: "Processed in Legend from the bulk update export." }
      : { restoredAt: now, restoredById: session.user.id, restoredByName: actorName } });
    for (const row of rows) {
      await logAudit({ actorId: session.user.id, actorName, action: step === "processed" ? "billing-notified" : "billing-restored", entity: "Course", entityId: row.courseId, clubId,
        summary: step === "processed"
          ? `Processed ${row.className} on ${formatDate(row.date)} in Legend (bulk update export)`
          : `Put ${row.className} on ${formatDate(row.date)}'s members back on their monthly price in Legend`,
        details: { cancellationId: row.id, date: row.date.toISOString().slice(0, 10) } }, tx);
    }
  });
  refresh();
  return ok();
}

const priceSchema = z.object({ id: z.string().min(1), price: z.string().trim().max(12) });

/** The monthly price of one Legend agreement price, the NewCycleFee of the restore export. Empty
 *  clears it. Swim school Manage keeps the price list. */
export async function saveLegendPrice(input: z.infer<typeof priceSchema>): Promise<ActionResult> {
  const session = await requirePermission("curriculum.manage");
  const parsed = priceSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const clean = parsed.data.price.replace(/[€,\s]/g, "");
  if (clean && !/^\d{1,4}(\.\d{1,2})?$/.test(clean)) return fail("Give the monthly price like 45 or 45.50.");
  const monthlyCents = clean ? Math.round(Number(clean) * 100) : null;
  const row = await prisma.legendAgreementPrice.findUnique({ where: { id: parsed.data.id }, select: { name: true, monthlyCents: true } });
  if (!row) return fail("That agreement price no longer exists.");
  const actorName = session.user.name ?? "Unknown";
  await prisma.$transaction(async (tx) => {
    await tx.legendAgreementPrice.update({ where: { id: parsed.data.id }, data: { monthlyCents, updatedById: session.user.id, updatedByName: actorName } });
    await logAudit({ actorId: session.user.id, actorName, action: "update", entity: "LegendAgreementPrice", entityId: parsed.data.id, clubId: null,
      summary: `Set ${row.name}'s monthly price to ${monthlyCents === null ? "nothing" : `€${(monthlyCents / 100).toFixed(2)}`}${row.monthlyCents !== null ? ` (was €${(row.monthlyCents / 100).toFixed(2)})` : ""}` }, tx);
  });
  refresh();
  return ok();
}
