import { auth } from "@/auth";
import { coinageAccess } from "@/modules/finance-requests/shared/coinage/auth";
import { refundAccess } from "@/modules/finance-requests/shared/refunds/auth";
import type { CoinageActor } from "@/modules/finance-requests/shared/coinage/types";
import type { RefundActor } from "@/modules/finance-requests/shared/refunds/types";

/** Who may open Finance requests, and which kinds: a person can hold refunds or coinage without
 *  the other (an administrator's old role, or a role saved before the merge). Each kind's pages
 *  and actions still check its own permissions. */
export type FinanceActor = { id: string; name: string; refunds: RefundActor | null; coinage: CoinageActor | null };

export function financeAccess(user: { id: string; name?: string | null; permissions: readonly string[] }): FinanceActor | null {
  const refunds = refundAccess(user), coinage = coinageAccess(user);
  if (!refunds && !coinage) return null;
  return { id: user.id, name: user.name || "Staff member", refunds, coinage };
}

/** The signed-in person's Finance requests access, or null. */
export async function financeActor(): Promise<FinanceActor | null> {
  const session = await auth();
  return session?.user ? financeAccess(session.user) : null;
}
