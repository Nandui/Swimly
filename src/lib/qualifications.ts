import type { Prisma } from "@/generated/prisma/client";
import type { SubjectFilter } from "@/lib/policy/types";

/** Core's qualifications, for modules. Qualification types (what a person can
 *  hold) and the qualifications people hold are Core records: Training and
 *  the Academy grant them, the rota and HR read them. Modules call these
 *  functions instead of querying the tables, and keep only the ids. Pass a
 *  transaction client to read or write inside one. Callers have already
 *  checked their permissions. */

type Db = Pick<Prisma.TransactionClient, "qualification" | "qualificationType" | "qualificationEvidence" | "user">;
async function client(db?: Db): Promise<Db> {
  return db ?? (await import("@/lib/prisma")).prisma;
}

export type QualificationTypeRef = { id: string; name: string; validityMonths: number | null; archivedAt: Date | null };
const typeSelect = { id: true, name: true, validityMonths: true, archivedAt: true } as const;

/** An organisation's live qualification types, by name. */
export async function qualificationTypesOf(orgId: string | null, db?: Db): Promise<QualificationTypeRef[]> {
  return (await client(db)).qualificationType.findMany({ where: { orgId: orgId ?? undefined, archivedAt: null }, orderBy: { name: "asc" }, select: typeSelect });
}

/** One qualification type in this organisation, archived or not; null when there is none. */
export async function qualificationTypeById(id: string, orgId?: string | null, db?: Db): Promise<QualificationTypeRef | null> {
  return (await client(db)).qualificationType.findFirst({ where: { id, ...(orgId ? { orgId } : {}) }, select: typeSelect });
}

/** One live qualification type in this organisation; null when there is none or it is archived. */
export async function liveQualificationTypeById(id: string, orgId: string, db?: Db): Promise<QualificationTypeRef | null> {
  return (await client(db)).qualificationType.findFirst({ where: { id, orgId, archivedAt: null }, select: typeSelect });
}

export async function qualificationTypesByIds(ids: readonly (string | null | undefined)[], db?: Db): Promise<Map<string, QualificationTypeRef>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (wanted.length === 0) return new Map();
  const rows = await (await client(db)).qualificationType.findMany({ where: { id: { in: wanted } }, select: typeSelect });
  return new Map(rows.map((row) => [row.id, row]));
}

/** Adds `as` to each row from the qualification type id in `key`; null when there is no id. */
export async function withQualificationTypes<K extends string, A extends string, T extends { [P in K]: string | null }>(
  rows: T[], key: K, as: A, db?: Db,
): Promise<Array<T & { [P in A]: QualificationTypeRef | null }>> {
  const types = await qualificationTypesByIds(rows.map((row) => row[key]), db);
  return rows.map((row) => ({ ...row, [as]: (row[key] && types.get(row[key] as string)) || null }) as T & { [P in A]: QualificationTypeRef | null });
}

/** What a recorded qualification says: when it was issued and expires, the
 *  certificate reference, a note on where it came from and who verified it. */
export type QualificationValues = {
  issuedOn: Date | null; expiresOn: Date | null; reference?: string; note?: string;
  verifiedById?: string | null; verifiedAt?: Date | null; revokedAt?: Date | null;
};

/** Records a qualification a person now holds. Returns its id. The caller writes the audit row. */
export async function recordQualification(tx: Db, holder: { orgId: string; userId: string; typeId: string }, values: QualificationValues): Promise<string> {
  return (await tx.qualification.create({ data: { ...holder, ...values }, select: { id: true } })).id;
}

/** Changes a recorded qualification (e.g. a new result for the same course). Returns its id. */
export async function updateQualification(tx: Db, id: string, values: QualificationValues): Promise<string> {
  return (await tx.qualification.update({ where: { id }, data: values, select: { id: true } })).id;
}

/** Withdraws a qualification: it stays on record, revoked from now. */
export async function revokeQualification(tx: Db, id: string): Promise<void> {
  await tx.qualification.update({ where: { id }, data: { revokedAt: new Date() } });
}

/* ---------- What people hold ---------- */

const userIn = (people: SubjectFilter): Prisma.StringFilter | undefined => (people.kind === "all" ? undefined : { in: [...people.userIds] });

/** Every qualification a person was given, revoked ones last, soonest expiry first. */
export async function qualificationsOf(userId: string, db?: Db) {
  return (await client(db)).qualification.findMany({
    where: { userId },
    orderBy: [{ revokedAt: { sort: "asc", nulls: "first" } }, { expiresOn: { sort: "asc", nulls: "last" } }],
    select: { id: true, issuedOn: true, expiresOn: true, revokedAt: true, reference: true, type: { select: { name: true } } },
  });
}

/** Which active staff a list covers: at a site (or every site), in a position. */
export type StaffFilters = { site?: string; position?: string };
const filteredStaff = (f: StaffFilters): Prisma.UserWhereInput => ({
  isActive: true,
  ...(f.site ? { OR: [{ siteIds: { has: f.site } }, { siteIds: { isEmpty: true } }] } : {}),
  ...(f.position ? { positionId: f.position } : {}),
});

/** Live qualifications that expire by `horizon` (expired ones included) for these people,
 *  soonest first, unless a newer one of the same type already replaces them. */
export async function qualificationsExpiringBy(orgId: string | null, people: SubjectFilter, horizon: Date, filters: StaffFilters = {}, db?: Db) {
  const c = await client(db);
  const rows = await c.qualification.findMany({
    where: { orgId: orgId ?? undefined, userId: userIn(people), revokedAt: null, expiresOn: { lte: horizon }, user: filteredStaff(filters) },
    orderBy: { expiresOn: "asc" },
    select: { id: true, userId: true, typeId: true, expiresOn: true, revokedAt: true, type: { select: { name: true } }, user: { select: { name: true, jobTitle: true } } },
  });
  if (rows.length === 0) return [];
  const newer = await c.qualification.findMany({
    where: { userId: { in: [...new Set(rows.map((r) => r.userId))] }, typeId: { in: [...new Set(rows.map((r) => r.typeId))] }, revokedAt: null, OR: [{ expiresOn: null }, { expiresOn: { gt: horizon } }] },
    select: { userId: true, typeId: true },
  });
  const renewed = new Set(newer.map((q) => `${q.userId}:${q.typeId}`));
  return rows.filter((r) => !renewed.has(`${r.userId}:${r.typeId}`));
}

/** These people whose position needs qualifications, by name: what it needs and what they hold. */
export async function positionRequirements(orgId: string | null, people: SubjectFilter, filters: StaffFilters = {}, db?: Db) {
  return (await client(db)).user.findMany({
    where: { orgId: orgId ?? undefined, id: userIn(people), ...filteredStaff(filters), position: { requires: { some: {} } } },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, position: { select: { name: true, requires: { select: { type: { select: { id: true, name: true } } } } } },
      qualifications: { select: { typeId: true, issuedOn: true, expiresOn: true, revokedAt: true } },
    },
  });
}

/* ---------- Certificates people upload (Turnfin Me) ---------- */

/** An uploaded certificate's owner and state, to check access before reviewing it. */
export async function certificateUpload(id: string, db?: Db) {
  return (await client(db)).qualificationEvidence.findUnique({ where: { id }, select: { userId: true, orgId: true, status: true } });
}

/** An uploaded certificate's file and owner. The caller checks access before serving it. */
export async function certificateFile(id: string, db?: Db) {
  return (await client(db)).qualificationEvidence.findUnique({ where: { id }, select: { userId: true, orgId: true, fileName: true, mime: true, bytes: true } });
}

/** Uploaded certificates for these people, never the reader's own: waiting ones oldest
 *  first, or the 50 most recently decided. */
export async function certificateUploads(orgId: string | null, people: SubjectFilter, readerId: string, view: "PENDING" | "DONE", db?: Db) {
  return (await client(db)).qualificationEvidence.findMany({
    where: {
      orgId: orgId ?? undefined,
      userId: { ...userIn(people), not: readerId },
      ...(view === "PENDING" ? { status: "PENDING" } : { status: { in: ["VERIFIED", "DECLINED"] } }),
    },
    orderBy: view === "PENDING" ? { createdAt: "asc" } : { reviewedAt: "desc" },
    take: 50,
    select: { id: true, userId: true, typeId: true, typeName: true, issuedOn: true, expiresOn: true, reference: true, fileName: true, mime: true, size: true, status: true, reviewNote: true, reviewedByName: true, reviewedAt: true, createdAt: true },
  });
}

type Reviewer = { id: string; name: string };

/** Marks a waiting upload verified, as the qualification recorded from it. False when it was already decided. */
export async function markCertificateVerified(tx: Db, id: string, recorded: { typeId: string; qualificationId: string }, by: Reviewer): Promise<boolean> {
  const moved = await tx.qualificationEvidence.updateMany({ where: { id, status: "PENDING" }, data: {
    status: "VERIFIED", typeId: recorded.typeId, qualificationId: recorded.qualificationId, reviewedById: by.id, reviewedByName: by.name, reviewedAt: new Date(),
  } });
  return moved.count === 1;
}

/** Declines a waiting upload with the reason the person sees. False when it was already decided. */
export async function markCertificateDeclined(tx: Db, id: string, reason: string, by: Reviewer): Promise<boolean> {
  const moved = await tx.qualificationEvidence.updateMany({ where: { id, status: "PENDING" }, data: { status: "DECLINED", reviewNote: reason, reviewedById: by.id, reviewedByName: by.name, reviewedAt: new Date() } });
  return moved.count === 1;
}
