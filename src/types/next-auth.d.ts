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
      /** What they may do at the site they are working in: the one access
       *  language. Pages, menus and actions ask for a permission. */
      permissions: string[];
      /** The operator this person works for (the organisation boundary). */
      orgId?: string | null;
      /** Sees everything in the organisation, restricted (HR) data included. */
      isSuperadmin?: boolean;
      /** Parts of their role that apply only at their other sites or over
       *  their team, for the policy engine. */
      grants?: { roleName: string; permissions: string[]; scopeKind: string; scopeId: string }[];
      /** What their role gives everywhere. */
      primaryPermissions?: string[];
      /** How this session proved who it is: a password sign-in, a PIN quick
       *  switch on a shared device, or the development bypass; and when. */
      authMethod?: "password" | "pin" | "dev";
      authAt?: number | null;
      /** Set on a shared device's quick-switch sessions. */
      sharedDevice?: boolean;
      /** Set on a dev build while seeing the app as another role: the role
       *  being worn, and what the real account actually holds. */
      preview?: {
        roleId: string;
        roleName: string;
        actualRoleName: string;
        actualPermissions: string[];
      } | null;
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
    /** How the person proved who they are, and when (never what they may do). */
    authMethod?: "password" | "pin" | "dev";
    authAt?: number;
    sharedDevice?: boolean;
  }
}
