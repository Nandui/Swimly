import NextAuth, { type NextAuthConfig, type Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { devSignInAllowed, getDevAdmin } from "@/lib/dev-sign-in";
import { prisma } from "@/lib/prisma";

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

        return { id: user.id, email: user.email, name: user.name };
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
  signIn,
  signOut,
  auth: nextAuth,
} = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  providers: providers(),
  callbacks: {
    jwt({ token, user }) {
      if (user) token.sub = user.id;
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
      return session;
    },
  },
});

export { handlers, signIn, signOut };

const ACCOUNT_SELECT = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  staffRole: { select: { id: true, name: true, permissions: true } },
} as const;

type Account = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  staffRole: { id: string; name: string; permissions: string[] } | null;
};

/** An account with no role has no permissions and no way to be given any
 *  without an admin, so it reads as signed out rather than as a person who can
 *  see the shell and do nothing in it. The column is nullable only because it
 *  had to be added to a table that already had rows. */
function sessionUserFor(account: Account) {
  if (!account.staffRole) return null;
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    roleId: account.staffRole.id,
    roleName: account.staffRole.name,
    permissions: account.staffRole.permissions,
  };
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
 *  a deployment cannot disable authentication. */
export async function auth(): Promise<Session | null> {
  const session = await nextAuth();

  if (session?.user?.id) {
    const current = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: ACCOUNT_SELECT,
    });
    // Deleted or deactivated reads as signed out. The cookie survives; the
    // access does not.
    if (!current?.isActive) return null;

    const user = sessionUserFor(current);
    if (!user) return null;

    return { ...session, user: { ...session.user, ...user } };
  }

  if (process.env.NODE_ENV === "production" || process.env.DEV_AUTH_BYPASS !== "1") {
    return null;
  }

  const admin = await prisma.user.findFirst({
    where: { isActive: true, staffRole: { permissions: { has: "staff.manage" } } },
    orderBy: { createdAt: "asc" },
    select: ACCOUNT_SELECT,
  });
  if (!admin) return null;

  const user = sessionUserFor(admin);
  if (!user) return null;

  return { user, expires: new Date(Date.now() + 60 * 60 * 1000).toISOString() };
}
