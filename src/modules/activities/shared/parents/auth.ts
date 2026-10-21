import { randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { ParentAccount, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { digest, lockParent, opaqueToken, rateLimit, requestIp } from "@/modules/activities/shared/parents/security";
import { ParentApiError, unavailable } from "@/modules/activities/shared/parents/errors";
import { emailSchema, readBody } from "@/modules/activities/shared/parents/http";
import { parentEmailConfig, sendParentSignInCode } from "@/modules/activities/shared/parents/email";
import { bearerToken } from "@/lib/public-api/http";

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

/** A family account (a parent with children in lessons) or an adult one (books swimming courses
 *  for themselves). One email is one kind: separate accounts (owner decision, 21 October 2026). */
export const ACCOUNT_KINDS = ["family", "adult"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];
const kindOf = (account: Pick<ParentAccount, "kind">): AccountKind => (account.kind === "adult" ? "adult" : "family");

export async function verifyCode(request: Request) {
  const { challengeId, code, kind } = await readBody(request, z.object({ challengeId: z.string().regex(/^[A-Za-z0-9_-]{43}$/), code: z.string().regex(/^\d{6}$/),
    kind: z.enum(ACCOUNT_KINDS).default("family") }).strict());
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
    // The code is used either way; the other kind of account is told to use another email.
    if (parent && kindOf(parent) !== kind) return { wrongKind: kindOf(parent) } as const;
    if (!parent) {
      parent = await tx.parentAccount.create({ data: { email: challenge.email, kind } });
      await parentAudit(tx, parent, "create", "ParentAccount", parent.id, kind === "adult" ? "Created a verified adult account for swimming courses" : "Created a verified parent account");
    }
    const session = await tx.parentSession.create({ data: { parentId: parent.id, tokenHash: digest(`session:${token}`), expiresAt } });
    await parentAudit(tx, parent, "sign-in", "ParentSession", session.id, "Signed in to the parent API");
    return parent;
  });
  if (!account) throw new ParentApiError(401, "INVALID_CODE", "That code is incorrect or has expired. Request a new code if needed.");
  if ("wrongKind" in account) {
    throw new ParentApiError(409, "ACCOUNT_KIND", account.wrongKind === "adult"
      ? "This email is already used for adult swimming courses. Use a different email for your family account."
      : "This email is already used for a family account. Use a different email to book adult swimming courses.");
  }
  return { accessToken: token, tokenType: "Bearer", expiresAt: expiresAt.toISOString(), parent: parentProfile(account) };
}

export function parentProfile(account: ParentAccount) {
  return { id: account.id, email: account.email, name: account.name, phone: account.phone, kind: kindOf(account) };
}

/** Children, link requests, assessments and corrections belong to family accounts. */
export function requireFamily(account: Pick<ParentAccount, "kind">) {
  if (kindOf(account) !== "family") throw new ParentApiError(403, "FAMILY_ACCOUNT_ONLY", "This is an adult courses account. Children's lessons need a family account with a different email.");
}

export function isAdult(account: Pick<ParentAccount, "kind">) {
  return kindOf(account) === "adult";
}

export async function authenticateParent(request: Request): Promise<ParentIdentity> {
  const token = bearerToken(request, /^[A-Za-z0-9_-]{43}$/);
  if (!token) throw unauthenticated();
  const session = await prisma.parentSession.findUnique({ where: { tokenHash: digest(`session:${token}`) }, include: { parent: true } });
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

/** A phone number the desk can ring: digits with optional +, spaces, dashes,
 * dots and brackets, and at least seven digits. */
export const phoneSchema = z.string().trim().max(40)
  .regex(/^\+?[0-9 ().-]+$/, "Enter a phone number using digits, spaces and an optional +.")
  .refine(value => value.replace(/\D/g, "").length >= 7, "Enter a phone number with at least 7 digits.");

/** Name and phone are both required before a parent books, links or proposes
 * changes. Older accounts without a phone are asked for it, not locked out. */
export function profileMissing(parent: Pick<ParentAccount, "name" | "phone">) {
  return !parent.name || !parent.phone?.trim();
}

export async function updateProfile(request: Request, identity: ParentIdentity) {
  const data = await readBody(request, z.object({ name: z.string().trim().min(2).max(100), phone: phoneSchema }).strict());
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
