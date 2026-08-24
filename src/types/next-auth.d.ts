import type { DefaultSession } from "next-auth";
import type { Role } from "@/generated/prisma/client";

/** The session carries the role, because every permission question in the app
 *  is asked against it. Without this augmentation `session.user.role` is
 *  `any` and `authz.ts` silently stops checking anything. */
declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role } & DefaultSession["user"];
  }

  interface User {
    role: Role;
  }
}

/** The JWT interface is declared in `@auth/core/jwt`; `next-auth/jwt` only
 *  re-exports it, so augmenting that path would declare a second, unrelated
 *  module and leave `token.role` as `unknown`. */
declare module "@auth/core/jwt" {
  interface JWT {
    role: Role;
  }
}
