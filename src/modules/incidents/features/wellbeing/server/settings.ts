import "server-only";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { IncidentError } from "@/modules/incidents/shared/rules";
import type { IncidentsActor } from "@/modules/incidents/shared/types";
import { recipientList, recipientsProblem } from "@/modules/incidents/features/wellbeing/rules";

/** Who gets wellbeing check requests (owner request, 22 October 2026: "let me
 *  define who is to receive these emails"): a list of addresses, not a role, set
 *  in Incidents > Settings by someone with Manage. Empty until then. */

export async function wellbeingRecipients(orgId: string | null): Promise<string[]> {
  if (!orgId) return [];
  return recipientList((await prisma.incidentsSettings.findUnique({ where: { orgId }, select: { wellbeingTo: true } }))?.wellbeingTo ?? "");
}

/** The setting as the Settings page shows it, with who last changed it. */
export async function wellbeingSetting(orgId: string | null) {
  const row = orgId ? await prisma.incidentsSettings.findUnique({ where: { orgId } }) : null;
  return { to: recipientList(row?.wellbeingTo ?? ""), changedByName: row?.changedByName ?? null, changedAt: row?.updatedAt ?? null };
}

export async function saveWellbeingRecipients(who: IncidentsActor, typed: string) {
  if (!who.signoff || !who.orgId) throw new IncidentError("Changing who gets wellbeing checks needs Incidents: Manage.");
  const list = recipientList(typed);
  const problem = recipientsProblem(list);
  if (problem) throw new IncidentError(problem);
  const wellbeingTo = list.join(", ");
  await prisma.$transaction(async (tx) => {
    await tx.incidentsSettings.upsert({
      where: { orgId: who.orgId! },
      create: { orgId: who.orgId!, wellbeingTo, changedById: who.id, changedByName: who.name },
      update: { wellbeingTo, changedById: who.id, changedByName: who.name },
    });
    await logAudit({
      actorId: who.id, actorName: who.name, action: "update", entity: "IncidentsSettings", entityId: who.orgId!,
      summary: wellbeingTo ? `Wellbeing check requests now go to ${wellbeingTo}` : "Wellbeing check requests now go to nobody",
    }, tx);
  });
}
