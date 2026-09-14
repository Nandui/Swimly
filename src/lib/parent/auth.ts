import { randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { ParentAccount, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { digest, lockParent, opaqueToken, rateLimit, requestIp } from "@/lib/parent/security";
import { ParentApiError, unavailable } from "@/lib/parent/errors";
import { emailSchema, readBody } from "@/lib/parent/http";
import { parentEmailConfig, sendParentSignInCode } from "@/lib/parent/email";

export type ParentIdentity = { account: ParentAccount; sessionId: string };
const unauthenticated = () => new ParentApiError(401, "UNAUTHENTICATED", "Please sign in again.");

export async function parentAudit(tx: Prisma.TransactionClient, parent: Pick<ParentAccount, "id" | "name">, action: string, entity: string, entityId: string, summary: string, extra: Prisma.InputJsonObject = {}, clubId: string | null = null) {
  await logAudit({ actorId: null, actorName: parent.name ?? "Verified parent", action, entity, entityId, summary, clubId,
    details: { ...extra, actorType: "parent", parentId: parent.id } }, tx);
}

export async function requestCode(request: Request) {
  const { email } = await readBody(request, z.object({ email: emailSchema }).strict());
  const emailConfig = parentEmailConfig();
  await rateLimit(`code-ip:${requestIp(request)}`, 30, 3600);
  await rateLimit(`code-email:${email}`, 5, 3600);
  const id = opaqueToken(), code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + 10 * 60_000);
  await prisma.$transaction(async tx => {
    await tx.parentSignInChallenge.create({ data: { id, email, codeHash: digest(`code:${id}:${code}`), expiresAt } });
    await logAudit({ actorName: "Parent sign-in", action: "request-code", entity: "ParentSignInChallenge", entityId: id,
      summary: "Requested an email verification code", clubId: null }, tx);
  });
  try { await sendParentSignInCode(email, code, emailConfig); }
  catch {
    await prisma.$transaction(async tx => {
      await tx.parentSignInChallenge.update({ where: { id }, data: { usedAt: new Date() } });
      await logAudit({ actorName: "Parent sign-in", action: "delivery-failed", entity: "ParentSignInChallenge", entityId: id,
        summary: "Invalidated a verification code after email delivery failed", clubId: null }, tx);
    });
    unavailable();
  }
  return { challengeId: id, expiresAt: expiresAt.toISOString() };
}

export async function verifyCode(request: Request) {
  const { challengeId, code } = await readBody(request, z.object({ challengeId: z.string().regex(/^[A-Za-z0-9_-]{43}$/), code: z.string().regex(/^\d{6}$/) }).strict());
  await rateLimit(`verify-ip:${requestIp(request)}`, 60, 3600);
  const candidate = await prisma.parentSignInChallenge.findUnique({ where: { id: challengeId }, select: { email: true } });
  const token = opaqueToken(), now = new Date(), expiresAt = new Date(now.getTime() + 7 * 86400_000);
  // Return failed attempts from the transaction, then throw: counters must commit.
  const account = candidate && await prisma.$transaction(async tx => {
    await lockParent(tx, candidate.email);
    await tx.$queryRaw`SELECT id FROM "ParentSignInChallenge" WHERE id=${challengeId} FOR UPDATE`;
    const challenge = await tx.parentSignInChallenge.findUnique({ where: { id: challengeId } });
    if (!challenge || challenge.usedAt || challenge.expiresAt <= new Date() || challenge.attempts >= 5) return null;
    const expected = Buffer.from(challenge.codeHash, "hex"), supplied = Buffer.from(digest(`code:${challengeId}:${code}`), "hex");
    const matches = expected.length === supplied.length && timingSafeEqual(expected, supplied);
    await tx.parentSignInChallenge.update({ where: { id: challengeId }, data: { attempts: { increment: 1 }, ...(matches ? { usedAt: new Date() } : {}) } });
    await logAudit({ actorName: "Parent sign-in", action: matches ? "verify-code" : "invalid-code", entity: "ParentSignInChallenge", entityId: challengeId,
      summary: matches ? "Verified an email sign-in code" : "Rejected an incorrect verification code", clubId: null }, tx);
    if (!matches) return null;
    let parent = await tx.parentAccount.findUnique({ where: { email: challenge.email } });
    if (parent && !parent.isActive) return null;
    if (!parent) {
      parent = await tx.parentAccount.create({ data: { email: challenge.email } });
      await parentAudit(tx, parent, "create", "ParentAccount", parent.id, "Created a verified parent account");
    }
    const session = await tx.parentSession.create({ data: { parentId: parent.id, tokenHash: digest(`session:${token}`), expiresAt } });
    await parentAudit(tx, parent, "sign-in", "ParentSession", session.id, "Signed in to the parent API");
    return parent;
  });
  if (!account) throw new ParentApiError(401, "INVALID_CODE", "That code is incorrect or has expired. Request a new code if needed.");
  return { accessToken: token, tokenType: "Bearer", expiresAt: expiresAt.toISOString(), parent: parentProfile(account) };
}

export function parentProfile(account: ParentAccount) {
  return { id: account.id, email: account.email, name: account.name, phone: account.phone };
}

export async function authenticateParent(request: Request): Promise<ParentIdentity> {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(request.headers.get("authorization") ?? "");
  if (!match) throw unauthenticated();
  const session = await prisma.parentSession.findUnique({ where: { tokenHash: digest(`session:${match[1]}`) }, include: { parent: true } });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.parent.isActive) throw unauthenticated();
  await rateLimit(`parent:${session.parentId}`, 120, 60);
  return { account: session.parent, sessionId: session.id };
}

/** Recheck access under the same lock staff take for grants, revocations and
 * account suspension. No cached identity authorizes a child read or write. */
export async function withParent<T>(identity: ParentIdentity, run: (tx: Prisma.TransactionClient, account: ParentAccount) => Promise<T>) {
  return prisma.$transaction(async tx => {
    await lockParent(tx, identity.account.email);
    const session = await tx.parentSession.findUnique({ where: { id: identity.sessionId }, include: { parent: true } });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.parent.isActive) throw unauthenticated();
    return run(tx, session.parent);
  }, { timeout: 15_000 });
}

export async function updateProfile(request: Request, identity: ParentIdentity) {
  const data = await readBody(request, z.object({ name: z.string().trim().min(2).max(100), phone: z.string().trim().max(40).nullable().optional() }).strict());
  return withParent(identity, async (tx, parent) => {
    const updated = await tx.parentAccount.update({ where: { id: parent.id }, data });
    await parentAudit(tx, parent, "update", "ParentAccount", parent.id, "Updated parent contact details");
    return parentProfile(updated);
  });
}

export async function logout(identity: ParentIdentity) {
  return withParent(identity, async (tx, parent) => {
    await tx.parentSession.update({ where: { id: identity.sessionId }, data: { revokedAt: new Date() } });
    await parentAudit(tx, parent, "sign-out", "ParentSession", identity.sessionId, "Signed out of the parent API");
  });
}
