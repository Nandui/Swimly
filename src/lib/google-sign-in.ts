import { logAudit } from "@/lib/audit";
import { currentSharedDevice } from "@/lib/devices/shared-device";
import { mayWorkAnywhere, workDeviceRequired } from "@/lib/devices/work-device";
import { prisma } from "@/lib/prisma";

/** "Sign in with Google" for staff who already have an account.
 *
 *  Google only proves which email address someone owns. It never creates an
 *  account and never changes one: the address must already belong to an active
 *  staff account (Admin > Staff), exactly as for a password sign-in. Everything
 *  after that (role, sites, permissions) is read from the account as usual.
 *
 *  Switched on by the two Google settings; without them the provider is not
 *  registered and the button is not shown, so a deployment without a Google
 *  client (previews, local) looks exactly as before. */
export function googleSignInAvailable(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.AUTH_GOOGLE_ID?.trim() && env.AUTH_GOOGLE_SECRET?.trim());
}

/** Why a Google sign-in was refused, as the `error` the sign-in page reads. */
export type GoogleRefusal = "google_no_account" | "work_device";

/** The sentence the sign-in page shows for each refusal. One sentence for
 *  "no account" whatever the reason (unknown, deactivated, unverified), so the
 *  button cannot be used to find out who has an account. */
export const GOOGLE_REFUSAL_TEXT: Readonly<Record<GoogleRefusal, string>> = {
  google_no_account: "That Google account's email doesn't match an active Turnfin account. Sign in with your email and password, or ask a manager to check the email on your account.",
  work_device: "This account can only sign in to Turnfin Work on a work computer. For your own records, use Turnfin Me on your phone.",
};

export function googleRefusalText(code: string | undefined | null): string | null {
  return code && Object.hasOwn(GOOGLE_REFUSAL_TEXT, code) ? GOOGLE_REFUSAL_TEXT[code as GoogleRefusal] : null;
}

type GoogleProfile = { email?: unknown; email_verified?: unknown } | null | undefined;

/** The address Google vouches for, or null. An address Google has not
 *  verified proves nothing and is never matched. */
export function verifiedGoogleEmail(profile: GoogleProfile): string | null {
  if (!profile || profile.email_verified !== true || typeof profile.email !== "string") return null;
  const email = profile.email.trim().toLowerCase();
  return email || null;
}

/** The active staff account a Google profile signs in as, or why not. */
export async function googleStaffAccount(profile: GoogleProfile): Promise<{ user: { id: string; name: string; email: string } } | { refused: GoogleRefusal }> {
  const email = verifiedGoogleEmail(profile);
  if (!email) return { refused: "google_no_account" };
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, isActive: true } });
  if (!user?.isActive) return { refused: "google_no_account" };
  // The same work-PC rule as a password sign-in.
  if (workDeviceRequired() && !(await currentSharedDevice()) && !(await mayWorkAnywhere(user.id))) return { refused: "work_device" };
  return { user: { id: user.id, name: user.name, email: user.email } };
}

/** Written once the session is issued, so the account's history shows how
 *  they came in. */
export async function auditGoogleSignIn(user: { id: string; name: string }) {
  await logAudit({ actorId: user.id, actorName: user.name, action: "sign_in", entity: "User", entityId: user.id, summary: "Signed in with Google" });
}
