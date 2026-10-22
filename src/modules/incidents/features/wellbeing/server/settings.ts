import "server-only";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { IncidentError } from "@/modules/incidents/shared/rules";
import type { IncidentsActor } from "@/modules/incidents/shared/types";
import { recipientList, recipientsProblem } from "@/modules/incidents/features/wellbeing/rules";

/** Who gets wellbeing check requests (owner request, 22 October 2026: "let me
 *  define who is to receive these emails"): a list of addresses, not a role, set
 *  in Incidents > Settings by someone with Manage. Empty until then. */

/** Who is copied (CC) on each request to HR (owner request, 22 October 2026: "always cc me"). */
export async function wellbeingCopies(orgId: string | null): Promise<string[]> {
  if (!orgId) return [];
  return recipientList((await prisma.incidentsSettings.findUnique({ where: { orgId }, select: { wellbeingCc: true } }))?.wellbeingCc ?? "");
}

export async function wellbeingRecipients(orgId: string | null): Promise<string[]> {
  if (!orgId) return [];
  return recipientList((await prisma.incidentsSettings.findUnique({ where: { orgId }, select: { wellbeingTo: true } }))?.wellbeingTo ?? "");
}

/** The setting as the Settings page shows it, with who last changed it. */
export async function wellbeingSetting(orgId: string | null) {
  const row = orgId ? await prisma.incidentsSettings.findUnique({ where: { orgId } }) : null;
  return { to: recipientList(row?.wellbeingTo ?? ""), cc: recipientList(row?.wellbeingCc ?? ""), changedByName: row?.changedByName ?? null, changedAt: row?.updatedAt ?? null };
}

export async function saveWellbeingRecipients(who: IncidentsActor, typed: string, typedCc: string) {
  if (!who.signoff || !who.orgId) throw new IncidentError("Changing who gets wellbeing checks needs Incidents: Manage.");
  const list = recipientList(typed), copies = recipientList(typedCc);
  const problem = recipientsProblem(list) ?? recipientsProblem(copies);
  if (problem) throw new IncidentError(problem);
  const wellbeingTo = list.join(", "), wellbeingCc = copies.join(", ");
  await prisma.$transaction(async (tx) => {
    await tx.incidentsSettings.upsert({
      where: { orgId: who.orgId! },
      create: { orgId: who.orgId!, wellbeingTo, wellbeingCc, changedById: who.id, changedByName: who.name },
      update: { wellbeingTo, wellbeingCc, changedById: who.id, changedByName: who.name },
    });
    await logAudit({
      actorId: who.id, actorName: who.name, action: "update", entity: "IncidentsSettings", entityId: who.orgId!,
      summary: `${wellbeingTo ? `Wellbeing check requests now go to ${wellbeingTo}` : "Wellbeing check requests now go to nobody"}${wellbeingCc ? `, copied to ${wellbeingCc}` : ", copied to nobody"}`,
    }, tx);
  });
}
