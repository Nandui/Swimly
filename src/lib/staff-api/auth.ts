import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { StaffApiError, confirmRequired, unauthenticated } from "@/lib/staff-api/errors";
import { sendStaffCode } from "@/lib/staff-api/email";
import { emailSchema, idSchema, readBody } from "@/lib/staff-api/http";
import { digest, opaqueToken, rateLimit, requestIp, sixDigitCode } from "@/lib/staff-api/security";

/** Turnfin Me sign-in: an email code every time, sent to the address on the
 *  person's Turnfin account; no password. A session lasts up to 12 hours (the
 *  app keeps it for the open tab only). HR records need a fresh code on top,
 *  valid for 15 minutes. Only active staff get codes; the response never says
 *  whether an address has an account. */

export const SESSION_MS = 12 * 60 * 60 * 1000;
export const CODE_MS = 10 * 60 * 1000;
export const CONFIRM_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export type StaffIdentity = { sessionId: string; confirmedAt: Date | null; user: { id: string; name: string; email: string; orgId: string } };

async function issueCode(userId: string, email: string, purpose: "sign-in" | "confirm", sessionId: string | null) {
  const id = randomUUID(), code = sixDigitCode();
  await prisma.staffSignInChallenge.create({ data: {
    id, userId, purpose, sessionId, codeHash: digest(`code:${id}:${code}`), expiresAt: new Date(Date.now() + CODE_MS),
  } });
  try {
    await sendStaffCode(email, code, purpose);
  } catch (error) {
    // A code that never arrived must never work.
    await prisma.staffSignInChallenge.update({ where: { id }, data: { usedAt: new Date() } });
    throw error;
  }
  return id;
}

/** Checks a code once. Wrong codes count; five end the challenge. */
async function redeemCode(challengeId: string, code: string, purpose: "sign-in" | "confirm", sessionId: string | null) {
  const challenge = await prisma.staffSignInChallenge.findUnique({ where: { id: challengeId } });
  if (!challenge || challenge.purpose !== purpose || challenge.sessionId !== sessionId || challenge.usedAt || challenge.expiresAt <= new Date() || challenge.attempts >= MAX_ATTEMPTS) return null;
  if (challenge.codeHash !== digest(`code:${challenge.id}:${code}`)) {
    await prisma.staffSignInChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
    return null;
  }
  const used = await prisma.staffSignInChallenge.updateMany({ where: { id: challenge.id, usedAt: null }, data: { usedAt: new Date() } });
  return used.count === 1 ? challenge : null;
}

const invalidCode = () => new StaffApiError(401, "INVALID_CODE", "That code is not right or has expired. Ask for a new one.");

export async function requestCode(request: Request) {
  const { email } = await readBody(request, z.object({ email: emailSchema }).strict());
  await rateLimit(`code-ip:${requestIp(request)}`, 30, 3600);
  await rateLimit(`request-email:${email}`, 5, 3600);
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, isActive: true, orgId: true } });
  // Same answer whether or not the address has an active account.
  const challengeId = user?.isActive && user.orgId ? await issueCode(user.id, user.email, "sign-in", null) : randomUUID();
  return { challengeId, expiresAt: new Date(Date.now() + CODE_MS).toISOString() };
}

export async function verifyCode(request: Request) {
  const input = await readBody(request, z.object({ challengeId: idSchema, code: z.string().regex(/^\d{6}$/, "Enter the six-digit code.") }).strict());
  await rateLimit(`verify-ip:${requestIp(request)}`, 60, 3600);
  const challenge = await redeemCode(input.challengeId, input.code, "sign-in", null);
  if (!challenge) throw invalidCode();
  const user = await prisma.user.findUnique({ where: { id: challenge.userId }, select: { id: true, name: true, email: true, isActive: true, orgId: true } });
  if (!user?.isActive || !user.orgId) throw invalidCode();
  const token = opaqueToken(), expiresAt = new Date(Date.now() + SESSION_MS);
  await prisma.staffSession.create({ data: { userId: user.id, tokenHash: digest(`session:${token}`), expiresAt } });
  return { accessToken: token, tokenType: "Bearer", expiresAt: expiresAt.toISOString(), me: { name: user.name } };
}

export async function authenticate(request: Request): Promise<StaffIdentity> {
  const match = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(request.headers.get("authorization") ?? "");
  if (!match) unauthenticated();
  const session = await prisma.staffSession.findUnique({ where: { tokenHash: digest(`session:${match[1]}`) } });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) unauthenticated();
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, name: true, email: true, isActive: true, orgId: true } });
  if (!user?.isActive || !user.orgId) {
    // Deactivated or removed from the organisation: every session ends now.
    await prisma.staffSession.updateMany({ where: { userId: session.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    unauthenticated();
  }
  await prisma.staffSession.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } });
  return { sessionId: session.id, confirmedAt: session.confirmedAt, user: { id: user.id, name: user.name, email: user.email, orgId: user.orgId } };
}

/** Sends a fresh code for this session, before opening HR records. */
export async function requestConfirm(request: Request, identity: StaffIdentity) {
  await rateLimit(`confirm:${identity.user.id}`, 10, 3600);
  const challengeId = await issueCode(identity.user.id, identity.user.email, "confirm", identity.sessionId);
  return { challengeId, expiresAt: new Date(Date.now() + CODE_MS).toISOString() };
}

export async function verifyConfirm(request: Request, identity: StaffIdentity) {
  const input = await readBody(request, z.object({ challengeId: idSchema, code: z.string().regex(/^\d{6}$/, "Enter the six-digit code.") }).strict());
  const challenge = await redeemCode(input.challengeId, input.code, "confirm", identity.sessionId);
  if (!challenge || challenge.userId !== identity.user.id) throw invalidCode();
  const confirmedAt = new Date();
  await prisma.staffSession.update({ where: { id: identity.sessionId }, data: { confirmedAt } });
  return { confirmedUntil: new Date(confirmedAt.getTime() + CONFIRM_MS).toISOString() };
}

export function requireConfirmed(identity: StaffIdentity, now = Date.now()) {
  if (!identity.confirmedAt || now - identity.confirmedAt.getTime() > CONFIRM_MS) confirmRequired();
}

export async function logout(identity: StaffIdentity) {
  await prisma.staffSession.update({ where: { id: identity.sessionId }, data: { revokedAt: new Date() } });
}
