import "server-only";
import type { Session } from "next-auth";
import { AuthorizationError, requireSession } from "@/lib/authz";
import { holdsAnywhere } from "@/lib/policy/engine";
import { actorForSession } from "@/lib/policy/session";

/** Who may open Vouchers (docs/vouchers.md). A voucher is used at a site and a
 *  batch names the sites that accept it, so pages and actions limit both to
 *  the sites the capability covers (`sitesFor`, `requireCapFor`); `manage`
 *  only decides which pages and buttons show. */
export type VouchersActor = { id: string; name: string; orgId: string | null; superadmin: boolean; manage: boolean };

export function vouchersAccess(session: Session): VouchersActor | null {
  const actor = actorForSession(session);
  if (!holdsAnywhere(actor, "vouchers.redeem")) return null;
  return { id: actor.id, name: actor.name, orgId: actor.orgId, superadmin: actor.superadmin, manage: holdsAnywhere(actor, "vouchers.manage") };
}

export async function requireVouchersActor() {
  const who = vouchersAccess(await requireSession());
  if (!who) throw new AuthorizationError("Vouchers access is required.");
  return who;
}
