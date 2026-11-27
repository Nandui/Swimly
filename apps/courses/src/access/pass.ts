import { createHmac, timingSafeEqual } from "node:crypto";

/** "Continue with Turnfin" (docs/courses.md, Sign-in and access): staff keep their Turnfin
 *  logins, so Courses asks Turnfin who is signed in rather than asking for a password again.
 *
 *    1. Courses makes a random **state**, keeps it in a cookie, and sends the browser to Turnfin.
 *    2. Turnfin signs the person in the way it always does, then sends the browser back with a
 *       **pass**: the person's id and that state, good for one minute, signed with a secret
 *       only the two share (Turnfin's side: ../../../../src/lib/courses-pass.ts).
 *    3. Courses checks the signature, the minute and that the state is this browser's, then
 *       opens its own session.
 *
 *  This file is pure. The format is `v1.<payload>.<signature>`; a test on each side holds the
 *  same example, so the two cannot drift apart unnoticed. */

const AUDIENCE = "turnfin-courses";

/** Where Turnfin is and the shared secret, or null when either is missing: sign-in then asks
 *  for the Turnfin email and password itself (local development without Turnfin running). */
export function turnfinConfig(env: Record<string, string | undefined> = process.env): { turnfinUrl: string; secret: string } | null {
  const secret = env.COURSES_PASS_SECRET ?? "";
  const raw = env.TURNFIN_URL ?? "";
  if (secret.length < 32 || !raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const local = url.hostname === "localhost" || url.hostname.endsWith(".localhost");
  if (url.protocol !== "https:" && !(local && url.protocol === "http:" && env.NODE_ENV !== "production")) return null;
  return { turnfinUrl: url.origin, secret };
}

/** The person a pass names, or null for anything not exactly right: a wrong signature, a pass
 *  past its minute, one made for something else, or one made for another browser's state. */
export function readPass(input: { pass: unknown; state: unknown; secret: string; now?: Date }): { userId: string } | null {
  if (typeof input.pass !== "string" || typeof input.state !== "string" || !input.state) return null;
  const parts = input.pass.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const [, payload, signature] = parts as [string, string, string];

  const expected = createHmac("sha256", input.secret).update(`v1.${payload}`).digest();
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!claims || typeof claims !== "object") return null;
  const { sub, state, exp, aud } = claims as Record<string, unknown>;
  if (aud !== AUDIENCE || typeof sub !== "string" || !sub || typeof exp !== "number") return null;
  if (exp * 1000 <= (input.now ?? new Date()).getTime()) return null;
  if (typeof state !== "string") return null;
  const mine = Buffer.from(input.state);
  const theirs = Buffer.from(state);
  if (mine.length !== theirs.length || !timingSafeEqual(mine, theirs)) return null;
  return { userId: sub };
}
