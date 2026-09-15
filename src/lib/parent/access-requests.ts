import { createHash } from "node:crypto";
import { z } from "zod";
import type { ParentAccessRequest, ParentAccount, Prisma } from "@/generated/prisma/client";
import { parentAudit, withParent, type ParentIdentity } from "@/lib/parent/auth";
import { dateSchema, parseInput, readBody } from "@/lib/parent/http";
import { ParentApiError } from "@/lib/parent/errors";
import { rateLimit } from "@/lib/parent/security";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const accessRequestSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  dateOfBirth: dateSchema.refine(value => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= "1900-01-01" && date <= new Date();
  }, "Enter a valid date of birth that is not in the future."),
  context: z.string().trim().max(500).default(""),
}).strict();

// Only submitted details and the explicit parent-facing reply leave the staff API.
export function accessRequestDto(row: ParentAccessRequest) {
  return { id: row.id, firstName: row.firstName, lastName: row.lastName,
    dateOfBirth: row.dateOfBirth.toISOString().slice(0, 10), context: row.context,
    status: row.status, reply: row.reply, createdAt: row.createdAt, reviewedAt: row.reviewedAt };
}
export function requestPage(request: Request) {
  return parseInput(z.coerce.number().int().min(1).max(100000), new URL(request.url).searchParams.get("page") ?? 1);
}
export async function listAccessRequests(request: Request, tx: Prisma.TransactionClient, parent: ParentAccount) {
  const page = requestPage(request), where = { parentId: parent.id };
  const rows = await tx.parentAccessRequest.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20 });
  return { items: rows.map(accessRequestDto), page, total: await tx.parentAccessRequest.count({ where }) };
}
export async function createAccessRequest(request: Request, identity: ParentIdentity) {
  const key = parseInput(z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/), request.headers.get("idempotency-key"));
  const input = await readBody(request, accessRequestSchema);
  await rateLimit(`access-request:${identity.account.id}`, 30, 3600);
  return withParent(identity, async (tx, parent) => {
    if (!parent.name) throw new ParentApiError(400, "PROFILE_REQUIRED", "Add your own name in Your account before sending a request.");
    const requestHash = hash(JSON.stringify(input));
    const replay = await tx.parentAccessRequest.findUnique({ where: { parentId_key: { parentId: parent.id, key } } });
    if (replay) {
      if (replay.requestHash !== requestHash) throw new ParentApiError(409, "IDEMPOTENCY_CONFLICT", "This request was already sent with different details. Refresh to check its status.");
      return { request: accessRequestDto(replay), replayed: true };
    }
    const childFingerprint = hash(JSON.stringify([input.firstName.toLowerCase().replace(/\s+/g, " "), input.lastName.toLowerCase().replace(/\s+/g, " "), input.dateOfBirth]));
    const pending = await tx.parentAccessRequest.findFirst({ where: { parentId: parent.id, childFingerprint, status: "PENDING" } });
    if (pending) return { request: accessRequestDto(pending), replayed: true };
    if (await tx.parentAccessRequest.count({ where: { parentId: parent.id, status: "PENDING" } }) >= 10) {
      throw new ParentApiError(409, "REQUEST_LIMIT", "You already have 10 requests waiting for review. Please check their status before sending more.");
    }
    const row = await tx.parentAccessRequest.create({ data: { ...input, dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00Z`), parentId: parent.id, key, requestHash, childFingerprint } });
    await parentAudit(tx, parent, "request", "ParentAccessRequest", row.id, "Requested access to an existing swimmer", { requestId: row.id });
    return { request: accessRequestDto(row), replayed: false };
  });
}
