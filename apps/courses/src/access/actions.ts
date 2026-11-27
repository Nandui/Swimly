"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/data/db";
import { log } from "@/data/log";
import { accountOf, PERSON, SESSION_COOKIE } from "./session";
import { afterFailure, cleanEmail, hashToken, newToken, SESSION_HOURS } from "./tokens";

export type SignInState = { error: string } | undefined;

/** One sentence for every reason, so the form cannot reveal who has an account. */
const REFUSED = "That email and password don't match. After several wrong tries, sign-in pauses for a few minutes.";

const Credentials = z.object({ email: z.string().min(3).max(200), password: z.string().min(1).max(200) });

/** Compared against when nobody matches, so a wrong email takes as long as a wrong password. */
let decoy: string | undefined;

/** Sign in with the person's Turnfin email and password. Courses reads the account and never
 *  writes it: its own count of wrong passwords is in `courses_sign_ins`. */
export async function signIn(_previous: SignInState, form: FormData): Promise<SignInState> {
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

  const token = newToken();
  const expiresAt = new Date(now.getTime() + SESSION_HOURS * 3_600_000);
  const success = { failedSignIns: 0, lockedUntil: null, lastSignInAt: now };
  await db.$transaction(async (tx) => {
    await tx.coursesSignIn.upsert({ where: { userId: account.id }, update: success, create: { userId: account.id, ...success } });
    await tx.coursesSession.create({ data: { userId: account.id, tokenHash: hashToken(token), expiresAt } });
    await log(tx, { orgId: account.orgId, account, action: "person.signed_in", record: "person", recordId: account.id });
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  redirect("/");
}

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
  redirect("/sign-in");
}
