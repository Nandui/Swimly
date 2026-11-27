import { createHmac } from "node:crypto";

/** "Continue with Turnfin" for Turnfin Courses (docs/courses.md, Sign-in and access).
 *
 *  Courses is a separate site (courses.turnfin.app) where staff keep their Turnfin logins.
 *  Rather than ask for the password again, Courses sends the browser here; Turnfin, which
 *  already knows who is signed in (by password, Google or a PIN switch), hands back a **pass**:
 *  who it is, good for one minute, signed with a secret only the two share. Courses checks the
 *  signature and opens its own session. Nothing about the person but their id is in it.
 *
 *  This file is pure: the route (src/app/api/courses/pass) asks who is signed in. Courses
 *  verifies with its own copy of the format (apps/courses/src/access/pass.ts); a test on each
 *  side holds the same example, so the two cannot drift apart unnoticed. */

/** How long a pass is good for. It is used at once, by a redirect. */
export const PASS_SECONDS = 60;
const AUDIENCE = "turnfin-courses";

/** The random value Courses made for this browser and expects back inside the pass, so a pass
 *  made for one browser is no use in another. */
const STATE = /^[A-Za-z0-9_-]{20,128}$/;
export const isPassState = (value: unknown): value is string => typeof value === "string" && STATE.test(value);

/** Where Courses is and the shared secret, or null when either is missing: the route then
 *  does not exist. `COURSES_URL` is an exact origin; the pass is never sent anywhere else. */
export function coursesPassConfig(env: Record<string, string | undefined> = process.env): { coursesUrl: string; secret: string } | null {
  const secret = env.COURSES_PASS_SECRET ?? "";
  const raw = env.COURSES_URL ?? "";
  if (secret.length < 32 || !raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const local = url.hostname === "localhost" || url.hostname.endsWith(".localhost");
  if (url.protocol !== "https:" && !(local && url.protocol === "http:" && env.NODE_ENV !== "production")) return null;
  return { coursesUrl: url.origin, secret };
}

const encode = (value: string | Buffer) => Buffer.from(value).toString("base64url");

/** A pass for this person, bound to the state Courses sent. `v1.<payload>.<signature>`. */
export function signPass(input: { userId: string; state: string; secret: string; now?: Date }): string {
  const exp = Math.floor((input.now ?? new Date()).getTime() / 1000) + PASS_SECONDS;
  const payload = encode(JSON.stringify({ sub: input.userId, state: input.state, exp, aud: AUDIENCE }));
  const signature = encode(createHmac("sha256", input.secret).update(`v1.${payload}`).digest());
  return `v1.${payload}.${signature}`;
}
