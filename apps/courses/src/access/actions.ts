"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/data/db";
import { log } from "@/data/log";
import { SESSION_COOKIE } from "./session";
import { afterFailure, cleanEmail, hashToken, newToken, SESSION_HOURS } from "./tokens";

export type SignInState = { error: string } | undefined;

/** One sentence for every reason, so the form cannot reveal who has an account. */
const REFUSED = "That email and password don't match. After several wrong tries, sign-in pauses for a few minutes.";

const Credentials = z.object({ email: z.string().min(3).max(200), password: z.string().min(1).max(200) });

/** Compared against when no account matches, so a wrong email takes as long as a wrong password. */
let decoy: string | undefined;

export async function signIn(_previous: SignInState, form: FormData): Promise<SignInState> {
  const parsed = Credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Enter your email and password." };
  const email = cleanEmail(parsed.data.email);
  const now = new Date();

  const account = await db.coursesAccount.findUnique({
    where: { email },
    select: { id: true, orgId: true, name: true, passwordHash: true, isActive: true, failedSignIns: true, lockedUntil: true },
  });
  const matches = await bcrypt.compare(parsed.data.password, account?.passwordHash ?? (decoy ??= await bcrypt.hash(newToken(), 10)));
  if (!account || !account.isActive) return { error: REFUSED };
  if (account.lockedUntil && account.lockedUntil > now) return { error: REFUSED };

  if (!matches) {
    // A lock that has run out starts the count again.
    const failure = afterFailure(account.lockedUntil ? 0 : account.failedSignIns, now);
    await db.$transaction(async (tx) => {
      await tx.coursesAccount.update({ where: { id: account.id }, data: failure });
      if (failure.lockedUntil) {
        await log(tx, { orgId: account.orgId, account, action: "account.sign_in_paused", record: "account", recordId: account.id });
      }
    });
    return { error: REFUSED };
  }

  const token = newToken();
  const expiresAt = new Date(now.getTime() + SESSION_HOURS * 3_600_000);
  await db.$transaction(async (tx) => {
    await tx.coursesAccount.update({ where: { id: account.id }, data: { failedSignIns: 0, lockedUntil: null, lastSignInAt: now } });
    await tx.coursesSession.create({ data: { accountId: account.id, tokenHash: hashToken(token), expiresAt } });
    await log(tx, { orgId: account.orgId, account, action: "account.signed_in", record: "account", recordId: account.id });
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
    await db.$transaction(async (tx) => {
      const session = await tx.coursesSession.findUnique({
        where: { tokenHash: hashToken(token) },
        select: { id: true, account: { select: { id: true, orgId: true, name: true } } },
      });
      if (!session) return;
      await tx.coursesSession.delete({ where: { id: session.id } });
      await log(tx, { orgId: session.account.orgId, account: session.account, action: "account.signed_out", record: "account", recordId: session.account.id });
    });
    jar.delete(SESSION_COOKIE);
  }
  redirect("/sign-in");
}
