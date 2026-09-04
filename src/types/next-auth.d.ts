import type { DefaultSession } from "next-auth";

/** The session carries the **permissions**, not the role, because every
 *  authorization question in the app is "may they do this?" and never "what
 *  are they called?". The role's id and name ride along only so screens can
 *  say who someone is; nothing branches on them.
 *
 *  Without this augmentation `session.user.permissions` is `any` and
 *  `authz.ts` silently stops checking anything.
 *
 *  These are filled in by `auth()` in `src/auth.ts`, which re-reads the role
 *  from the database on every request. The `session` callback cannot do it —
 *  it only sees the token — so it sets empty placeholders that `auth()` then
 *  replaces. Nothing outside `src/auth.ts` calls the raw NextAuth session. */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roleId: string;
      roleName: string;
      permissions: string[];
      /** A `ROLE_HOMES` key: where this person's day starts. */
      home: string;
    } & DefaultSession["user"];
  }

  interface User {
    roleId?: string | null;
  }
}

/** The JWT interface is declared in `@auth/core/jwt`; `next-auth/jwt` only
 *  re-exports it, so augmenting that path would declare a second, unrelated
 *  module and leave the claim as `unknown`.
 *
 *  The token deliberately carries nothing but the subject. A permission list
 *  minted into a JWT is a permission list that keeps working after it has been
 *  taken away — the whole point of re-reading is that a change to a role bites
 *  on the next request rather than at token expiry. */
declare module "@auth/core/jwt" {
  interface JWT {
    sub?: string;
  }
}
