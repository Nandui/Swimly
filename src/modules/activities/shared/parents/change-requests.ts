import { createHash } from "node:crypto";
import { z } from "zod";
import type { ParentAccount, ParentChangeRequest, Prisma } from "@/generated/prisma/client";
import { parentAudit, withParent, type ParentIdentity } from "@/modules/activities/shared/parents/auth";
import { requireChild } from "@/modules/activities/shared/parents/children";
import { parseInput, readBody } from "@/modules/activities/shared/parents/http";
import { ParentApiError } from "@/modules/activities/shared/parents/errors";
import { rateLimit } from "@/modules/activities/shared/parents/security";
import { requestPage } from "@/modules/activities/shared/parents/access-requests";

/** Parents propose corrections to their own child's contact, emergency and
 *  medical details. Nothing on the swimmer changes until reception reviews and
 *  applies the request. Parents only ever see what they themselves proposed
 *  and the reply; the current staff record is never returned. */

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const text = (max: number) => z.string().trim().max(max);

/** The only fields a parent may propose. */
export const CHANGEABLE_FIELDS = ["contactName", "contactEmail", "contactPhone", "emergencyName", "emergencyPhone", "emergencyRelationship", "medicalNotes"] as const;
export type ChangeableField = (typeof CHANGEABLE_FIELDS)[number];
export const CHANGE_FIELD_LABELS: Record<ChangeableField, string> = {
  contactName: "Parent or guardian name", contactEmail: "Contact email", contactPhone: "Contact phone",
  emergencyName: "Emergency contact", emergencyPhone: "Emergency phone", emergencyRelationship: "Emergency contact relationship",
  medicalNotes: "Medical notes",
};

const changeRequestSchema = z.object({
  contactName: text(120).optional(),
  contactEmail: z.union([z.literal(""), z.string().trim().toLowerCase().pipe(z.email().max(200))]).optional(),
  contactPhone: text(40).optional(),
  emergencyName: text(120).optional(),
  emergencyPhone: text(40).optional(),
  emergencyRelationship: text(60).optional(),
  medicalNotes: text(2000).optional(),
  message: text(500).default(""),
}).strict().refine((value) => CHANGEABLE_FIELDS.some((field) => value[field] !== undefined), "Include at least one detail to change.");

function changeRequestDto(row: ParentChangeRequest) {
  const proposed = row.proposed as Partial<Record<ChangeableField, string>>;
  return {
    id: row.id, childId: row.studentId, status: row.status,
    proposed: Object.fromEntries(CHANGEABLE_FIELDS.filter((f) => proposed[f] !== undefined).map((f) => [f, proposed[f]])),
    message: row.message, reply: row.reply, createdAt: row.createdAt, reviewedAt: row.reviewedAt,
  };
}

export async function listChangeRequests(request: Request, tx: Prisma.TransactionClient, parent: ParentAccount, childId: string) {
  await requireChild(tx, parent, childId);
  const page = requestPage(request), where = { parentId: parent.id, studentId: childId };
  const rows = await tx.parentChangeRequest.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20 });
  return { items: rows.map(changeRequestDto), page, total: await tx.parentChangeRequest.count({ where }) };
}

export async function createChangeRequest(request: Request, identity: ParentIdentity, childId: string) {
  const key = parseInput(z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/), request.headers.get("idempotency-key"));
  const input = await readBody(request, changeRequestSchema);
  await rateLimit(`change-request:${identity.account.id}`, 20, 3600);
  return withParent(identity, async (tx, parent) => {
    await requireChild(tx, parent, childId);
    if (!parent.name) throw new ParentApiError(400, "PROFILE_REQUIRED", "Add your own name in Your account before sending a change.");
    const { message, ...fields } = input;
    const proposed = Object.fromEntries(CHANGEABLE_FIELDS.filter((f) => fields[f] !== undefined).map((f) => [f, fields[f] as string]));
    const requestHash = hash(JSON.stringify([childId, proposed, message]));
    const replay = await tx.parentChangeRequest.findUnique({ where: { parentId_key: { parentId: parent.id, key } } });
    if (replay) {
      if (replay.requestHash !== requestHash) throw new ParentApiError(409, "IDEMPOTENCY_CONFLICT", "This change was already sent with different details. Refresh to check its status.");
      return { request: changeRequestDto(replay), replayed: true };
    }
    if (await tx.parentChangeRequest.count({ where: { parentId: parent.id, studentId: childId, status: "PENDING" } }) >= 3) {
      throw new ParentApiError(409, "REQUEST_LIMIT", "You already have 3 changes waiting for review for this child. Reception will get back to you.");
    }
    const row = await tx.parentChangeRequest.create({ data: { parentId: parent.id, studentId: childId, key, requestHash, proposed, message } });
    // The audit row names which details were proposed, never their values.
    await parentAudit(tx, parent, "request-change", "ParentChangeRequest", row.id, `Proposed changes to ${Object.keys(proposed).map((f) => CHANGE_FIELD_LABELS[f as ChangeableField].toLowerCase()).join(", ")}`, { requestId: row.id, studentId: childId });
    return { request: changeRequestDto(row), replayed: false };
  });
}
