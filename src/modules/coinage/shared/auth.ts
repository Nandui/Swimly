import { auth } from "@/auth";
import { expandPermissions } from "@/lib/staff/permissions";
import { CoinageError } from "@/modules/coinage/shared/rules";
import type { CoinageActor } from "@/modules/coinage/shared/types";

export function coinageAccess(user: { id: string; name?: string | null; permissions: readonly string[] }): CoinageActor | null {
  const permissions = expandPermissions(user.permissions);
  if (!permissions.has("coinage.read")) return null;
  return { id: user.id, name: user.name || "Staff member", request: permissions.has("coinage.request"), review: permissions.has("coinage.review"), process: permissions.has("coinage.process") };
}
export async function requireCoinageActor() {
  const session = await auth();
  const who = session?.user && coinageAccess(session.user);
  if (!who) throw new CoinageError("Coinage access is required. Sign in again or ask an administrator to check your access.");
  return who;
}
