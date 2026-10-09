"use server";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { isDateOnly, parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { currentActor, mayFor } from "@/lib/policy/session";
import { refresh } from "@/modules/rota/shared/writes";

/* ---------- The duty manager's day ---------- */

/** The change is in Timepoint too: closes its follow-up. */
export async function markTimepointUpdated(logId: string): Promise<ActionResult> {
  const entry = await prisma.rotaLog.findFirst({ where: { id: logId }, select: { siteId: true, timepointAt: true, summary: true, site: { select: { orgId: true } } } });
  if (!entry) return fail("That change is no longer in the log.");
  if (entry.timepointAt) return ok();
  if (!(await mayFor("rota.manage", { siteId: entry.siteId, orgId: entry.site.orgId ?? undefined }))) return fail("Only the duty manager updates Timepoint.");
  const actor = await currentActor();
  await prisma.$transaction(async (tx) => {
    await tx.rotaLog.update({ where: { id: logId }, data: { timepointAt: new Date(), timepointById: actor.id, timepointByName: actor.name } });
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "update", entity: "RotaLog", entityId: logId, clubId: entry.siteId, summary: `Recorded a rota change as updated in Timepoint: ${entry.summary}` }, tx);
  });
  refresh();
  return ok();
}

/** The day's note for every duty manager at the site. Empty text removes it. */
export async function saveDayNote(siteId: string, date: string, text: string): Promise<ActionResult> {
  if (!isDateOnly(date)) return fail("Choose a day.");
  const clean = text.trim();
  if (clean.length > 1000) return fail("Keep the note under 1,000 characters.");
  const site = await prisma.club.findFirst({ where: { id: siteId, archivedAt: null }, select: { id: true, name: true, orgId: true } });
  if (!site?.orgId) return fail("That site is not open.");
  if (!(await mayFor("rota.manage", { siteId, orgId: site.orgId }))) return fail("Only the duty manager keeps the day's note.");
  const actor = await currentActor();
  const day = parseDateOnly(date);
  await prisma.$transaction(async (tx) => {
    if (clean) await tx.rotaDayNote.upsert({ where: { siteId_date: { siteId, date: day } }, create: { orgId: site.orgId!, siteId, date: day, text: clean, byId: actor.id, byName: actor.name }, update: { text: clean, byId: actor.id, byName: actor.name } });
    else await tx.rotaDayNote.deleteMany({ where: { siteId, date: day } });
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "update", entity: "RotaDayNote", entityId: null, clubId: site.id, summary: `${clean ? "Wrote" : "Cleared"} the rota note for ${date} at ${site.name}` }, tx);
  });
  refresh();
  return ok();
}
