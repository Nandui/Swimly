import type { Prisma } from "@/generated/prisma/client";

/** Core's qualifications, for modules. Qualification types (what a person can
 *  hold) and the qualifications people hold are Core records: Training and
 *  the Academy grant them, the rota and HR read them. Modules call these
 *  functions instead of querying the tables, and keep only the ids. Pass a
 *  transaction client to read or write inside one. Callers have already
 *  checked their permissions. */

type Db = Pick<Prisma.TransactionClient, "qualification" | "qualificationType">;
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
