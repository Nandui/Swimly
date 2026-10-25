"use server";

import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { formatDate, isDateOnly, parseDateOnly, plural } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { atSite, refresh } from "@/modules/stock/shared/server";

/** Count writes, each checked against the count's site: Count starts, counts,
 *  submits and discards an empty count; Manage also deletes one. Every write is audited. */

const day = (d: Date) => formatDate(d);

async function takeFor(id: string, cap: "stock.count" | "stock.manage") {
  const take = await prisma.stockTake.findFirst({ where: { id }, select: { id: true, siteId: true, stockDate: true, submittedAt: true, startedByName: true, _count: { select: { lines: true } } } });
  if (!take) return { ok: false as const, error: "That count no longer exists." };
  const at = await atSite(take.siteId, cap);
  if (!at.ok) return at;
  return { ...at, take };
}

const startSchema = z.object({
  siteId: z.string().min(1, "Choose the site."),
  stockDate: z.string().refine(isDateOnly, "Choose the day this count is for."),
  notes: z.string().trim().max(500).default(""),
});
export type StartInput = z.input<typeof startSchema>;

/** Start a count at a site for a stock day; the dialog then opens its sheet. One open count per site. */
export async function startCount(input: StartInput): Promise<ActionResult & { id?: string }> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  const at = await atSite(d.siteId, "stock.count");
  if (!at.ok) return fail(at.error);
  const result = await prisma.$transaction(async (tx) => {
    if (await tx.stockTake.findFirst({ where: { siteId: d.siteId, submittedAt: null }, select: { id: true } })) {
      return fail(`${at.site.name} already has a count open. Carry on with that one.`);
    }
    const take = await tx.stockTake.create({ data: { orgId: at.site.orgId, siteId: d.siteId, stockDate: parseDateOnly(d.stockDate), notes: d.notes, startedById: at.actor.id, startedByName: at.actor.name } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "create", entity: "StockTake", entityId: take.id, clubId: d.siteId,
      summary: `Started a stock count at ${at.site.name} for ${day(take.stockDate)}` }, tx);
    return { ok: true as const, id: take.id };
  });
  if (!result.ok) return result;
  refresh();
  return { ok: true, id: result.id };
}

/** Count one product: a whole number, 0 for none, or null to take it back to uncounted. The sheet
 *  saves as the person types, so this refreshes nothing. */
export async function saveCountLine(takeId: string, productId: string, quantity: number | null): Promise<ActionResult> {
  if (quantity !== null && (!Number.isInteger(quantity) || quantity < 0 || quantity > 999_999)) return fail("Enter a whole number, or clear the box to leave it uncounted.");
  const t = await takeFor(takeId, "stock.count");
  if (!t.ok) return fail(t.error);
  if (t.take.submittedAt) return fail("This count has been submitted, so it can't be changed.");
  const product = await prisma.stockProduct.findFirst({ where: { id: productId, orgId: t.site.orgId }, select: { id: true, name: true, archivedAt: true } });
  if (!product) return fail("That product no longer exists.");
  return prisma.$transaction(async (tx) => {
    const line = await tx.stockTakeLine.findUnique({ where: { stockTakeId_productId: { stockTakeId: takeId, productId } }, select: { id: true, quantity: true } });
    if (quantity === null) {
      if (!line) return ok();
      await tx.stockTakeLine.delete({ where: { id: line.id } });
      await logAudit({ actorId: t.actor.id, actorName: t.actor.name, action: "update", entity: "StockTakeLine", entityId: line.id, clubId: t.site.id,
        summary: `Cleared the count for ${product.name} at ${t.site.name}, back to uncounted` }, tx);
      return ok();
    }
    if (product.archivedAt && !line) return fail(`${product.name} is archived, so it can't be counted on a new line.`);
    if (line?.quantity === quantity) return ok();
    const saved = line
      ? await tx.stockTakeLine.update({ where: { id: line.id }, data: { quantity, countedAt: new Date(), countedById: t.actor.id, countedByName: t.actor.name } })
      : await tx.stockTakeLine.create({ data: { stockTakeId: takeId, productId, quantity, countedById: t.actor.id, countedByName: t.actor.name } });
    await logAudit({ actorId: t.actor.id, actorName: t.actor.name, action: line ? "update" : "create", entity: "StockTakeLine", entityId: saved.id, clubId: t.site.id,
      summary: `Counted ${product.name} at ${t.site.name}: ${quantity === 0 ? "none" : quantity}${line ? ` (was ${line.quantity})` : ""}` }, tx);
    return ok();
  });
}

/** Submit a count. Uncounted products stay uncounted; after this it can't be changed. */
export async function submitCount(takeId: string): Promise<ActionResult> {
  const t = await takeFor(takeId, "stock.count");
  if (!t.ok) return fail(t.error);
  if (t.take.submittedAt) return fail("This count has already been submitted.");
  if (t.take._count.lines === 0) return fail("Nothing has been counted yet. Count something, or discard the count.");
  await prisma.$transaction(async (tx) => {
    await tx.stockTake.update({ where: { id: takeId }, data: { submittedAt: new Date(), submittedById: t.actor.id, submittedByName: t.actor.name } });
    await logAudit({ actorId: t.actor.id, actorName: t.actor.name, action: "submit", entity: "StockTake", entityId: takeId, clubId: t.site.id,
      summary: `Submitted the ${day(t.take.stockDate)} stock count at ${t.site.name}: ${plural(t.take._count.lines, "product")} counted` }, tx);
  });
  refresh(takeId);
  return ok();
}

/** Throw away an open count nobody has counted on yet. */
export async function discardCount(takeId: string): Promise<ActionResult> {
  const t = await takeFor(takeId, "stock.count");
  if (!t.ok) return fail(t.error);
  if (t.take.submittedAt) return fail("A submitted count can't be discarded.");
  if (t.take._count.lines > 0) return fail("Something has been counted on it, so it can't be discarded. Submit it instead.");
  await prisma.$transaction(async (tx) => {
    await tx.stockTake.delete({ where: { id: takeId } });
    await logAudit({ actorId: t.actor.id, actorName: t.actor.name, action: "delete", entity: "StockTake", entityId: takeId, clubId: t.site.id,
      summary: `Discarded the empty ${day(t.take.stockDate)} stock count at ${t.site.name}` }, tx);
  });
  refresh();
  return ok();
}

/** Manage only: remove a count, open or submitted, with its lines. The removal stays in the activity log. */
export async function deleteCount(takeId: string): Promise<ActionResult> {
  const t = await takeFor(takeId, "stock.manage");
  if (!t.ok) return fail(t.error);
  await prisma.$transaction(async (tx) => {
    await tx.stockTake.delete({ where: { id: takeId } });
    await logAudit({ actorId: t.actor.id, actorName: t.actor.name, action: "delete", entity: "StockTake", entityId: takeId, clubId: t.site.id,
      summary: `Deleted the ${day(t.take.stockDate)} stock count at ${t.site.name} (started by ${t.take.startedByName}, ${t.take.submittedAt ? "submitted" : "still open"}, ${plural(t.take._count.lines, "line")})` }, tx);
  });
  refresh();
  return ok();
}
