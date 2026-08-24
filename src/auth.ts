import NextAuth, { type Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

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
  providers: [
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

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.role = token.role;
      return session;
    },
  },
});

export { handlers, signIn, signOut };

/** The session, or null.
 *
 *  The role is re-read from the database rather than trusted from the token.
 *  A JWT carries the role it was minted with, so without this a deactivated
 *  instructor keeps working access until the token expires, and a demotion
 *  only bites the next time they sign in. One indexed lookup per session read
 *  buys both taking effect immediately, which is the whole point of having
 *  tiers.
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
      select: { name: true, email: true, role: true, isActive: true },
    });
    // Deleted or deactivated reads as signed out. The cookie survives; the
    // access does not.
    if (!current?.isActive) return null;

    return {
      ...session,
      user: {
        ...session.user,
        name: current.name,
        email: current.email,
        role: current.role,
      },
    };
  }

  if (process.env.NODE_ENV === "production" || process.env.DEV_AUTH_BYPASS !== "1") {
    return null;
  }

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) return null;

  return {
    user: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}
