import { isStaging } from "./deployment";
import type { NextAuthConfig } from "next-auth";

/** Localhost apps share cookies across ports. Keep development sessions out of
 *  Auth.js's shared namespace without invalidating existing production sessions. */
export function authCookies(environment: string | undefined = process.env.NODE_ENV): NextAuthConfig["cookies"] {
  if (environment !== "development" && !isStaging()) return undefined;

  return {
    sessionToken: {
      name: isStaging() ? "__Secure-swimly.staging.session-token" : "swimly.dev.session-token",
      // Auth.js merges these with its HttpOnly, SameSite, path and protocol-
      // dependent Secure defaults. Only the name needs to change.
      options: {},
    },
  };
}
