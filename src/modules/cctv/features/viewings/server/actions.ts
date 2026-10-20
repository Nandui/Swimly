"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { liveSiteById } from "@/lib/directory";
import { today } from "@/lib/format";
import { currentActor, mayFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { requireCctvActor } from "@/modules/cctv/shared/access";
import { noteSchema, parseIncidentNumber, reasonMeta, viewingNumber, viewingProblem, viewingSchema, type ViewingInput } from "@/modules/cctv/shared/rules";

/** The CCTV log's writes (docs/cctv.md): record a viewing at a site, and add a note to one. An
 *  entry is never changed or deleted once saved. Every write is audited; the activity log names
 *  the entry and why it was checked, never what was seen. */

/** Record a viewing at a site where the person holds Record. */
export async function recordViewing(input: ViewingInput): Promise<ActionResult & { id?: string }> {
  await requireCctvActor();
  const parsed = viewingSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const v = parsed.data;
  const problem = viewingProblem(v, today());
  if (problem) return fail(problem);
  const site = await liveSiteById(v.siteId);
  if (!site) return fail("That site is not open.");
  if (!(await mayFor("cctv.record", { siteId: site.id, orgId: site.orgId }))) return fail(`Recording a CCTV viewing at ${site.name} needs the CCTV log there.`);
  const actor = await currentActor();
  const { incident, ...fields } = v;
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.cctvViewing.create({ data: { ...fields, orgId: site.orgId, incidentNumber: parseIncidentNumber(incident) ?? null, recordedById: actor.id, recordedByName: actor.name } });
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "create", entity: "CctvViewing", entityId: row.id, clubId: site.id,
      summary: `Recorded CCTV viewing ${viewingNumber(row.number)} at ${site.name}: ${reasonMeta(row.reason).label.toLowerCase()}` }, tx);
    return row;
  });
  revalidatePath("/cctv");
  return { ok: true, id: created.id };
}

/** Add to a saved entry. The person who recorded it may, and so may Review at its site. */
export async function addViewingNote(id: string, text: string): Promise<ActionResult> {
  const who = await requireCctvActor();
  const parsed = noteSchema.safeParse(text);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const viewing = await prisma.cctvViewing.findFirst({ where: { id, orgId: who.orgId ?? undefined }, select: { id: true, number: true, siteId: true, orgId: true, recordedById: true } });
  if (!viewing) return fail("That entry no longer exists.");
  const mine = viewing.recordedById === who.id;
  if (!mine && !(await mayFor("cctv.review", { siteId: viewing.siteId, orgId: viewing.orgId }))) return fail("Only the person who recorded it, or someone who reviews the CCTV log at its site, can add to it.");
  await prisma.$transaction(async (tx) => {
    const note = await tx.cctvViewingNote.create({ data: { viewingId: id, text: parsed.data, byId: who.id, byName: who.name } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "create", entity: "CctvViewingNote", entityId: note.id, clubId: viewing.siteId,
      summary: `Added a note to CCTV viewing ${viewingNumber(viewing.number)}` }, tx);
  });
  revalidatePath(`/cctv/${id}`);
  revalidatePath("/cctv");
  return ok();
}
