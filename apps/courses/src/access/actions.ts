"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/data/db";
import { log } from "@/data/log";
import { cookieBase, openSession, STATE_COOKIE, STATE_SECONDS } from "./open-session";
import { turnfinConfig } from "./pass";
import { accountOf, PERSON, SESSION_COOKIE } from "./session";
import { afterFailure, cleanEmail, hashToken, newToken } from "./tokens";

export type SignInState = { error: string } | undefined;

/** One sentence for every reason, so the form cannot reveal who has an account. */
const REFUSED = "That email and password don't match. After several wrong tries, sign-in pauses for a few minutes.";

const Credentials = z.object({ email: z.string().min(3).max(200), password: z.string().min(1).max(200) });

/** Compared against when nobody matches, so a wrong email takes as long as a wrong password. */
let decoy: string | undefined;

/** "Continue with Turnfin": off to Turnfin, which knows who is signed in, and back with a pass
 *  (./pass.ts). The state ties the pass that returns to this browser. */
export async function continueWithTurnfin(): Promise<void> {
  const turnfin = turnfinConfig();
  if (!turnfin) redirect("/sign-in");
  const state = newToken();
  (await cookies()).set(STATE_COOKIE, state, { ...cookieBase, maxAge: STATE_SECONDS });
  redirect(`${turnfin.turnfinUrl}/api/courses/pass?state=${state}`);
}

/** Sign in with the person's Turnfin email and password, where Continue with Turnfin is not
 *  set up (local development without Turnfin running). Where it is, there is one way in, so
 *  Turnfin's own sign-in rules (Google, work devices) always apply. Courses reads the account
 *  and never writes it: its own count of wrong passwords is in `courses_sign_ins`. */
export async function signIn(_previous: SignInState, form: FormData): Promise<SignInState> {
  if (turnfinConfig()) return { error: "Use Continue with Turnfin to sign in." };
  const parsed = Credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Enter your email and password." };
  const now = new Date();

  const person = await db.user.findUnique({
    where: { email: cleanEmail(parsed.data.email) },
    select: { ...PERSON, passwordHash: true },
  });
  const matches = await bcrypt.compare(parsed.data.password, person?.passwordHash ?? (decoy ??= await bcrypt.hash(newToken(), 10)));
  const account = person?.passwordHash ? accountOf(person) : null;
  if (!account) return { error: REFUSED };

  const guard = await db.coursesSignIn.findUnique({ where: { userId: account.id }, select: { failedSignIns: true, lockedUntil: true } });
  if (guard?.lockedUntil && guard.lockedUntil > now) return { error: REFUSED };

  if (!matches) {
    // A pause that has run out starts the count again.
    const failure = afterFailure(guard?.lockedUntil ? 0 : (guard?.failedSignIns ?? 0), now);
    await db.$transaction(async (tx) => {
      await tx.coursesSignIn.upsert({ where: { userId: account.id }, update: failure, create: { userId: account.id, ...failure } });
      if (failure.lockedUntil) {
        await log(tx, { orgId: account.orgId, account, action: "person.sign_in_paused", record: "person", recordId: account.id });
      }
    });
    return { error: REFUSED };
  }

  await openSession(account, "password");
  redirect("/");
}

/** Ends the Courses session on this browser. Turnfin's own sign-in is Turnfin's to end. */
export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const session = await db.coursesSession.findUnique({ where: { tokenHash: hashToken(token) }, select: { id: true, userId: true } });
    if (session) {
      const person = await db.user.findUnique({ where: { id: session.userId }, select: { id: true, name: true, orgId: true } });
      await db.$transaction(async (tx) => {
        await tx.coursesSession.delete({ where: { id: session.id } });
        if (person?.orgId) {
          await log(tx, { orgId: person.orgId, account: person, action: "person.signed_out", record: "person", recordId: person.id });
        }
      });
    }
    jar.delete(SESSION_COOKIE);
  }
  redirect("/sign-in?out=1");
}
