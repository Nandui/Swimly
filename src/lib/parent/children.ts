import type { ParentAccount, Prisma } from "@/generated/prisma/client";
import { notFound } from "@/lib/parent/errors";

export const CHILD_SELECT = { id: true, firstName: true, lastName: true, dateOfBirth: true, status: true } as const satisfies Prisma.StudentSelect;
type Child = Prisma.StudentGetPayload<{ select: typeof CHILD_SELECT }>;

export function childDto(child: Child) {
  return { id: child.id, firstName: child.firstName, lastName: child.lastName, dateOfBirth: child.dateOfBirth?.toISOString().slice(0, 10) ?? null, status: child.status };
}

export function childScope(parent: Pick<ParentAccount, "email">): Prisma.StudentWhereInput {
  return { parentAccess: { some: { parentEmail: parent.email, revokedAt: null } } };
}

export async function requireChild(tx: Prisma.TransactionClient, parent: Pick<ParentAccount, "email">, childId: string) {
  const child = await tx.student.findFirst({ where: { id: childId, ...childScope(parent) }, select: CHILD_SELECT });
  if (!child) notFound();
  return child;
}

export async function listChildren(tx: Prisma.TransactionClient, parent: ParentAccount) {
  const children = await tx.student.findMany({ where: childScope(parent), select: CHILD_SELECT, orderBy: [{ firstName: "asc" }, { id: "asc" }] });
  return { items: children.map(childDto) };
}
