import { auth } from "@/auth";
import { expandPermissions } from "@/lib/staff/permissions";
import { visibleScreens } from "@/lib/staff/screens";
import { RefundError } from "@/lib/refunds/rules";
import type { RefundActor } from "@/lib/refunds/types";

export function refundAccess(user: { id: string; name?: string | null; permissions: readonly string[]; screens: readonly string[] }): RefundActor | null {
  const permissions = expandPermissions(user.permissions);
  if (!visibleScreens(user.screens, permissions).has("refunds") || !permissions.has("refunds.read")) return null;
  return { id: user.id, name: user.name || "Staff member", request: permissions.has("refunds.request"), review: permissions.has("refunds.review"), process: permissions.has("refunds.process") };
}
export async function requireRefundActor() {
  const session = await auth();
  const who = session?.user && refundAccess(session.user);
  if (!who) throw new RefundError("Refunds access is required. Sign in again or ask an administrator to check your access.");
  return who;
}
