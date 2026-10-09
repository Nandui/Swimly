import { auth } from "@/auth";
import { expandPermissions } from "@/lib/staff/permissions";
import { RefundError } from "@/modules/refunds/lib/rules";
import type { RefundActor } from "@/modules/refunds/lib/types";

export function refundAccess(user: { id: string; name?: string | null; permissions: readonly string[] }): RefundActor | null {
  const permissions = expandPermissions(user.permissions);
  if (!permissions.has("refunds.read")) return null;
  return { id: user.id, name: user.name || "Staff member", request: permissions.has("refunds.request"), review: permissions.has("refunds.review"), process: permissions.has("refunds.process") };
}
export async function requireRefundActor() {
  const session = await auth();
  const who = session?.user && refundAccess(session.user);
  if (!who) throw new RefundError("Refunds access is required. Sign in again or ask an administrator to check your access.");
  return who;
}
