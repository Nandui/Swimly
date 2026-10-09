import { revalidatePath } from "next/cache";
import { AuthorizationError } from "@/lib/authz";
import { type HrSql } from "@/modules/hr/shared/database";
import { prisma } from "@/lib/prisma";
import { requireCapFor } from "@/lib/policy/session";
import type { PermissionKey } from "@/lib/staff/permissions";
import type { Actor } from "@/lib/policy/types";

/** HR writes. Each needs the restricted capability for that person (which also
 *  needs a recent password), and nobody writes their own record. Every change
 *  writes an HR audit event in the same transaction. The person's own
 *  acknowledgement is not here: Work has no personal actions (see self.ts,
 *  used by the staff API for Turnfin Me). */

export type Allowed = { ok: true; actor: Actor } | { ok: false; error: string };
export async function allowedFor(cap: PermissionKey, subjectUserId: string): Promise<Allowed> {
  const subject = await prisma.user.findUnique({ where: { id: subjectUserId }, select: { orgId: true } });
  if (!subject) return { ok: false, error: "That person no longer exists." };
  try {
    // The subject's organisation, so an everywhere grant never reaches another org.
    const actor = await requireCapFor(cap, { subjectUserId, orgId: subject.orgId });
    if (actor.id === subjectUserId) return { ok: false, error: "Nobody writes their own HR record." };
    return { ok: true, actor };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function audit(tx: HrSql, actor: Pick<Actor, "id" | "name" | "orgId">, action: string, entity: string, entityId: string, subjectUserId: string, summary: string) {
  await tx.query(`INSERT INTO audit_events (org_id, actor_id, actor_name, action, entity, entity_id, subject_user_id, summary) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [actor.orgId ?? "", actor.id, actor.name, action, entity, entityId, subjectUserId, summary]);
}
export const refresh = (subjectUserId: string, reviewId?: string) => {
  revalidatePath(`/hr/people/${subjectUserId}`);
  if (reviewId) revalidatePath(`/hr/reviews/${reviewId}`);
};
