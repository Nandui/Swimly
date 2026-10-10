import { cache } from "react";
import NextAuth, { type NextAuthConfig, type Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { CredentialsSignin } from "next-auth";
import bcrypt from "bcryptjs";
import { authCookies } from "@/lib/auth-cookies";
import { devSignInAllowed, getDevAdmin } from "@/lib/dev-sign-in";
import { prisma } from "@/lib/prisma";
import { mayPreview, previewedRole } from "@/lib/staff/preview";
import { ADMINISTRATOR_PERMISSIONS } from "@/lib/staff/permissions";
import { getCurrentClub } from "@/lib/clubs/current";
import { currentSharedDevice, SHARED_SESSION_MAX_MS } from "@/lib/devices/shared-device";
import { authorizePin } from "@/lib/devices/pin";
import { mayWorkAnywhere, workDeviceRequired } from "@/lib/devices/work-device";

/** A correct password on a device this account may not work from. Raised only
 *  after the password matched, so it reveals nothing about other accounts. */
class WorkDeviceRequired extends CredentialsSignin {
  code = "work_device";
}
import { ACCOUNT_SELECT, sessionUserFor, type Account } from "@/lib/staff/session-user";

/** Built as a function so the dev provider is **absent** from the array in
 *  production rather than present-and-refusing. There is then no endpoint to
 *  post to: `/api/auth/callback/dev-admin` simply does not exist. */
function providers(): NextAuthConfig["providers"] {
  const list: NextAuthConfig["providers"] = [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        // Deactivated accounts keep their history and lose their key. One
        // failure shape for every reason, so the form cannot be used to find
        // out which addresses have accounts.
        if (!user?.passwordHash || !user.isActive) return null;
        if (!(await bcrypt.compare(password, user.passwordHash))) return null;
        const device = await currentSharedDevice();
        // Work is done on registered work PCs unless the person may work anywhere.
        if (workDeviceRequired() && !device && !(await mayWorkAnywhere(user.id))) throw new WorkDeviceRequired();

        // A password sign-in is fresh for step-up, clears any PIN lock, and on
        // a shared device adds the person to its quick-switch list (if they
        // have a PIN).
        await prisma.user.update({ where: { id: user.id }, data: { passwordAt: new Date(), pinFailures: 0, pinLockedAt: null } });
        if (device && user.pinHash && user.orgId === device.orgId) {
          await prisma.sharedDeviceUser.upsert({
            where: { deviceId_userId: { deviceId: device.id, userId: user.id } },
            update: { lastUsedAt: new Date() }, create: { deviceId: device.id, userId: user.id },
          });
        }
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    // Quick switch on a registered shared device: the person taps their name
    // and enters their PIN. Only people who signed in there with their
    // password (and set a PIN) can; five wrong PINs lock it until they do so
    // again. A PIN session never counts as a fresh password for restricted data.
    Credentials({
      id: "pin",
      name: "PIN",
      credentials: { userId: {}, pin: {} },
      async authorize(credentials) {
        return authorizePin(await currentSharedDevice(), String(credentials?.userId ?? ""), String(credentials?.pin ?? ""));
      },
    }),
  ];

  if (devSignInAllowed()) {
    list.push(
      Credentials({
        id: "dev-admin",
        name: "Dev admin",
        credentials: {},
        async authorize() {
          // Asked again at call time, not just at boot: the array is built
          // once per process, and this is not a thing to be clever about.
          if (!devSignInAllowed()) return null;
          const admin = await getDevAdmin();
          if (!admin) return null;
          return { id: admin.id, email: admin.email, name: admin.name };
        },
      })
    );
  }

  return list;
}

/** Authentication for Swimly.
 *
 *  Credentials against the `User` table is the starting point, not a
 *  commitment: swapping in an email link or an SSO provider is an edit to the
 *  `providers` array and nothing else, because everything downstream asks
 *  `session.user.role` and never how the person signed in. */
const {
  handlers,
  auth: nextAuth,
} = NextAuth({
  session: { strategy: "jwt" },
  cookies: authCookies(),
  pages: { signIn: "/sign-in" },
  providers: providers(),
  callbacks: {
    // The token carries who, and how and when they proved it: never what they
    // may do. A PIN switch is marked, so restricted data asks for the password.
    async jwt({ token, user, account }) {
      if (user) {
        token.sub = user.id;
        token.authMethod = account?.provider === "pin" ? "pin" : account?.provider === "dev-admin" ? "dev" : "password";
        token.authAt = Date.now();
        token.sharedDevice = account?.provider === "pin" || !!(await currentSharedDevice());
      }
      return token;
    },
    // Placeholders only. The permission list is read from the database in
    // `auth()` below, which is the only thing the app ever calls — minting one
    // into the token here would keep granting access after it was taken away.
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.roleId = "";
      session.user.roleName = "";
      session.user.permissions = [];
      session.user.authMethod = token.authMethod ?? "password";
      session.user.authAt = token.authAt ?? null;
      session.user.sharedDevice = token.sharedDevice === true;
      return session;
    },
  },
});

export { handlers };

/** The signed-in person's own sites, read from the sign-in cookie alone: the full session
 *  (`auth`) needs the working site first, so the working site cannot ask it. `sites` empty
 *  means every site. Null when nobody is signed in (or outside a request). */
export const signedInSites = cache(async (): Promise<{ primary: string | null; sites: string[] } | null> => {
  const id = (await nextAuth())?.user?.id;
  if (!id) return null;
  const user = await prisma.user.findUnique({ where: { id }, select: { primaryClubId: true, siteIds: true } });
  return user ? { primary: user.primaryClubId, sites: user.siteIds } : null;
});

async function currentSiteForSession(): Promise<string | null> {
  try { return (await getCurrentClub()).club.id; } catch { return null; }
}

/** The session, or null.
 *
 *  The role and its permissions are re-read from the database rather than
 *  trusted from the token. A JWT carries what it was minted with, so without
 *  this a deactivated instructor keeps working access until the token expires,
 *  a demotion only bites at the next sign-in, and — now that roles are
 *  editable — un-ticking a permission would not take effect until everyone
 *  holding it happened to sign out. One indexed lookup per session read buys
 *  all three taking effect immediately, which is the whole point.
 *
 *  In development this falls back to a **real** admin out of the database, so
 *  audit rows point at someone who exists and every permission check behaves
 *  exactly as it will once you are signed in. It is gated on
 *  `NODE_ENV !== "production"` as well as on the flag, so setting the flag on
 *  a deployment cannot disable authentication.
 *
 *  **Memoised per request**, which is the difference between "one indexed
 *  lookup per session read" and one per *caller*. The layout asks, the page
 *  guard asks, and then every data module asks again through `requireSession`
 *  — `/courses` alone came to six identical queries, and at 32ms to a managed
 *  Postgres in another country that is a fifth of a second spent asking who is
 *  signed in six times. `cache` is per-render and never crosses a request, so
 *  a deactivation still bites on the very next page. */
export const auth = cache(async function auth(): Promise<Session | null> {
  const session = await nextAuth();

  if (session?.user?.id) {
    const current = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: ACCOUNT_SELECT,
    });
    // Deleted or deactivated reads as signed out. The cookie survives; the
    // access does not.
    if (!current?.isActive) return null;
    // A shared-device session ends after its maximum age whatever the idle
    // timer did (a tablet left on the deck overnight).
    if (session.user.sharedDevice && (!session.user.authAt || Date.now() - session.user.authAt > SHARED_SESSION_MAX_MS)) return null;

    const siteId = await currentSiteForSession();
    const user = sessionUserFor(current, siteId);
    if (!user) return null;

    return { ...session, user: { ...session.user, ...(await wearPreview(user, current, siteId)) } };
  }

  if (process.env.NODE_ENV === "production" || process.env.DEV_AUTH_BYPASS !== "1") {
    return null;
  }

  const admin = await prisma.user.findFirst({
    where: { isActive: true, staffRole: { permissions: { hasEvery: [...ADMINISTRATOR_PERMISSIONS] } } },
    orderBy: { createdAt: "asc" },
    select: ACCOUNT_SELECT,
  });
  if (!admin) return null;

  const siteId = await currentSiteForSession();
  const user = sessionUserFor(admin, siteId);
  if (!user) return null;

  return {
    user: await wearPreview(user, admin, siteId),
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
});

type SessionUser = Omit<Session["user"], "image">;

/** On a dev build, an account that may manage roles can ask to see the app
 *  as another role. The person stays the same — id, name, email, sites — and
 *  the session is rebuilt by `sessionUserFor` as if they held that role, so
 *  its levels apply in every module exactly as for a real holder.
 *  `previewedRole` returns null everywhere the gate is shut, so this is a
 *  no-op on production whatever cookie arrives. */
async function wearPreview(user: SessionUser, account: Account, siteId: string | null): Promise<SessionUser> {
  if (!mayPreview(user.permissions, user.isSuperadmin)) return user;
  const role = await previewedRole();
  if (!role) return user;
  // The superadmin flag is dropped: a preview shows only what the role gives.
  const worn = sessionUserFor({ ...account, isSuperadmin: false, staffRole: role }, siteId);
  if (!worn) return user;
  return {
    ...user,
    ...worn,
    preview: {
      roleId: role.id,
      roleName: role.name,
      actualRoleName: user.roleName,
      actualPermissions: user.permissions,
      actualIsSuperadmin: user.isSuperadmin === true,
    },
  };
}
