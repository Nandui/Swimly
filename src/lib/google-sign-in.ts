import { logAudit } from "@/lib/audit";
import { currentSharedDevice } from "@/lib/devices/shared-device";
import { mayWorkAnywhere, workDeviceRequired } from "@/lib/devices/work-device";
import { prisma } from "@/lib/prisma";

/** Sign in with Google: the way into Turnfin Work (owner decision, 23 October 2026).
 *
 *  Google proves who someone is. The first time a person from the work Google
 *  domain signs in, an account is made for them with no role: they are told it
 *  is ready and that a manager must give them one (Admin > Staff), and nothing
 *  else opens until then. Every sign-in refreshes their name and picture from
 *  Google. Role, sites and permissions are only ever set in Turnfin.
 *
 *  Switched on by the two Google settings; without them the provider is not
 *  registered and the sign-in page keeps the email and password form, so a
 *  deployment without a Google client (previews, local) works as before. */
export function googleSignInAvailable(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.AUTH_GOOGLE_ID?.trim() && env.AUTH_GOOGLE_SECRET?.trim());
}

/** The Google Workspace domains whose people get an account at their first
 *  sign-in. `AUTH_GOOGLE_DOMAINS` (comma separated) replaces the default. */
export function googleAccountDomains(env: Record<string, string | undefined> = process.env): string[] {
  const listed = (env.AUTH_GOOGLE_DOMAINS ?? "leisureworldcork.com").split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
  return [...new Set(listed)];
}

/** Why a Google sign-in was refused, as the `error` the sign-in page reads. */
export type GoogleRefusal = "google_no_account" | "google_waiting" | "google_password" | "work_device";

/** The sentence the sign-in page shows for each refusal. */
export const GOOGLE_REFUSAL_TEXT: Readonly<Record<GoogleRefusal, string>> = {
  google_no_account: "That Google account can't sign in to Turnfin. Use your work Google account, or ask a manager to check your account.",
  google_waiting: "Your Turnfin account is ready, but you don't have access yet. Ask your manager to give you a role, then sign in again.",
  google_password: "Google didn't ask for your password that time, so Turnfin can't be sure it's you. Try Sign in with Google again.",
  work_device: "This account can only sign in to Turnfin Work on a work computer. For your own records, use Turnfin Me on your phone.",
};

export function googleRefusalText(code: string | undefined | null): string | null {
  return code && Object.hasOwn(GOOGLE_REFUSAL_TEXT, code) ? GOOGLE_REFUSAL_TEXT[code as GoogleRefusal] : null;
}

type GoogleProfile = {
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  hd?: unknown;
  name?: unknown;
  given_name?: unknown;
  family_name?: unknown;
  picture?: unknown;
  auth_time?: unknown;
} | null | undefined;

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** The address Google vouches for, or null. An address Google has not
 *  verified proves nothing and is never matched. */
export function verifiedGoogleEmail(profile: GoogleProfile): string | null {
  if (!profile || profile.email_verified !== true) return null;
  return text(profile.email).toLowerCase() || null;
}

/** What Turnfin keeps from a Google profile: the person's own id at Google,
 *  their verified email, the Workspace domain it belongs to, their name and
 *  their picture. Null when Google has not verified the email. */
export function googleIdentity(profile: GoogleProfile) {
  const email = verifiedGoogleEmail(profile);
  const googleId = text(profile?.sub);
  if (!email || !googleId) return null;
  const name = (text(profile?.name) || [text(profile?.given_name), text(profile?.family_name)].filter(Boolean).join(" ")).slice(0, 120) || email.split("@")[0];
  const picture = text(profile?.picture);
  return {
    googleId,
    email,
    // `hd` is set only for a Workspace account, and only Google can set it.
    domain: text(profile?.hd).toLowerCase() || null,
    name,
    avatarUrl: picture.startsWith("https://") && picture.length <= 2048 ? picture : null,
  };
}

/** Google is asked to check the password at every sign-in (`max_age=0` in
 *  src/auth.ts), because desk and pool deck PCs are shared: a Google session
 *  someone left open in the browser must never let the next person in with
 *  one tap (owner question, 23 October 2026). Google then says when it last
 *  checked (`auth_time`, in seconds); a sign-in it didn't just check is refused.
 *  The allowance covers the redirect back and a little clock difference. */
export const GOOGLE_FRESH_SECONDS = 120;

export function freshGoogleSignIn(profile: GoogleProfile, now = Date.now()): boolean {
  const at = profile?.auth_time;
  if (typeof at !== "number" || !Number.isFinite(at)) return false;
  const age = now / 1000 - at;
  return age <= GOOGLE_FRESH_SECONDS && age >= -GOOGLE_FRESH_SECONDS;
}

export type GoogleIdentity = NonNullable<ReturnType<typeof googleIdentity>>;

/** Whether this identity may have an account made for it: a Workspace account
 *  of one of the work domains, with an address in that same domain. */
export function mayGetAccount(identity: GoogleIdentity, domains = googleAccountDomains()): boolean {
  return !!identity.domain && domains.includes(identity.domain) && identity.email.endsWith(`@${identity.domain}`);
}

const ACCOUNT = { id: true, name: true, email: true, isActive: true, staffRoleId: true, googleId: true, avatarUrl: true } as const;
type Found = { id: string; name: string; email: string; isActive: boolean; staffRoleId: string | null; googleId: string | null; avatarUrl: string | null };

/** The account a Google identity belongs to: the one already linked to this
 *  Google id, or else the one with this email. */
async function findAccount(identity: GoogleIdentity): Promise<Found | null> {
  return (await prisma.user.findUnique({ where: { googleId: identity.googleId }, select: ACCOUNT }))
    ?? (await prisma.user.findUnique({ where: { email: identity.email }, select: ACCOUNT }));
}

/** The first organisation: Turnfin runs one operator's sites. New accounts join
 *  it, as a person added on the Staff page joins the adder's. */
async function homeOrganisation(): Promise<string | null> {
  return (await prisma.organisation.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } }))?.id ?? null;
}

/** Makes the account for a first Google sign-in: their name, email and picture,
 *  no role, so it opens nothing until a manager gives it one. */
async function makeAccount(identity: GoogleIdentity): Promise<Found | null> {
  try {
    const made = await prisma.user.create({
      data: { name: identity.name, email: identity.email, googleId: identity.googleId, avatarUrl: identity.avatarUrl, orgId: await homeOrganisation() },
      select: ACCOUNT,
    });
    await logAudit({ actorId: made.id, actorName: made.name, action: "create", entity: "User", entityId: made.id, summary: `Account made at ${made.name}'s first Sign in with Google (${made.email}), waiting for a role` });
    return made;
  } catch {
    // Two first sign-ins at once: the other one made it.
    return findAccount(identity);
  }
}

/** Keeps the account in step with Google: links the Google id, and takes the
 *  current name, picture and (when nobody else has it) a changed address. */
async function refreshAccount(account: Found, identity: GoogleIdentity): Promise<Found> {
  const changes: { name?: string; email?: string; googleId?: string; avatarUrl?: string | null } = {};
  if (account.googleId !== identity.googleId) changes.googleId = identity.googleId;
  if (account.name !== identity.name) changes.name = identity.name;
  if (account.avatarUrl !== identity.avatarUrl) changes.avatarUrl = identity.avatarUrl;
  if (account.email !== identity.email && !(await prisma.user.findUnique({ where: { email: identity.email }, select: { id: true } }))) changes.email = identity.email;
  if (Object.keys(changes).length === 0) return account;
  const updated = await prisma.user.update({ where: { id: account.id }, data: changes, select: ACCOUNT });
  const said = [
    changes.name ? `name from "${account.name}" to "${updated.name}"` : null,
    changes.email ? `email from ${account.email} to ${updated.email}` : null,
  ].filter(Boolean);
  if (said.length) await logAudit({ actorId: updated.id, actorName: updated.name, action: "update", entity: "User", entityId: updated.id, summary: `Google changed ${said.join(" and ")}` });
  return updated;
}

/** Signs a Google profile in: finds or makes the account, refreshes it from
 *  Google, then says whether it may come in. Called once per sign-in, before
 *  the session is issued. */
export async function googleSignIn(profile: GoogleProfile): Promise<{ user: { id: string; name: string; email: string } } | { refused: GoogleRefusal }> {
  const identity = googleIdentity(profile);
  if (!identity) return { refused: "google_no_account" };
  // Not enforced (23 October 2026): turning stale sign-ins away shut everyone
  // out on turnfin.app. Logged until we know what Google sends back.
  if (!freshGoogleSignIn(profile)) console.warn("google sign-in not fresh", { authTime: typeof profile?.auth_time === "number" ? Math.round(Date.now() / 1000 - profile.auth_time) + "s ago" : String(typeof profile?.auth_time) });
  let account = await findAccount(identity);
  if (!account) {
    if (!mayGetAccount(identity)) return { refused: "google_no_account" };
    account = await makeAccount(identity);
    if (!account) return { refused: "google_no_account" };
  }
  // A deactivated account keeps its history and stays shut: Google does not reopen it.
  if (!account.isActive) return { refused: "google_no_account" };
  account = await refreshAccount(account, identity);
  return admit(account);
}

/** The account a signed-in Google profile is, read only: the token's subject. */
export async function googleStaffAccount(profile: GoogleProfile): Promise<{ user: { id: string; name: string; email: string } } | { refused: GoogleRefusal }> {
  const identity = googleIdentity(profile);
  if (!identity) return { refused: "google_no_account" };
  const account = await findAccount(identity);
  if (!account?.isActive) return { refused: "google_no_account" };
  return admit(account);
}

async function admit(account: Found): Promise<{ user: { id: string; name: string; email: string } } | { refused: GoogleRefusal }> {
  // No role yet: the account exists, so a manager can find it on the Staff page.
  if (!account.staffRoleId) return { refused: "google_waiting" };
  // The same work-PC rule as a password sign-in.
  if (workDeviceRequired() && !(await currentSharedDevice()) && !(await mayWorkAnywhere(account.id))) return { refused: "work_device" };
  return { user: { id: account.id, name: account.name, email: account.email } };
}

/** Written once the session is issued, so the account's history shows how they
 *  came in. A full sign-in also clears a PIN lock, and on a work device adds a
 *  person with a PIN to its quick-switch list, as the password did. */
export async function recordGoogleSignIn(user: { id: string; name: string }) {
  const device = await currentSharedDevice();
  const account = await prisma.user.update({
    where: { id: user.id },
    data: { lastSignInAt: new Date(), pinFailures: 0, pinLockedAt: null },
    select: { pinHash: true, orgId: true },
  });
  if (device && account.pinHash && account.orgId === device.orgId) {
    await prisma.sharedDeviceUser.upsert({
      where: { deviceId_userId: { deviceId: device.id, userId: user.id } },
      update: { lastUsedAt: new Date() }, create: { deviceId: device.id, userId: user.id },
    });
  }
  await logAudit({ actorId: user.id, actorName: user.name, action: "sign_in", entity: "User", entityId: user.id, summary: "Signed in with Google" });
  return !!device;
}
