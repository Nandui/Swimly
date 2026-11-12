import type { Prisma } from "@/generated/prisma/client";
import { withSites, withStaff } from "@/lib/directory";

/** Adds each class's `club` ({ id, name }) and `instructor` ({ id, name } or
 *  null) from Core's directory, so Activities queries never join Core tables. */
export async function withClassRefs<T extends { clubId: string; instructorId: string | null }>(
  rows: T[], db?: Pick<Prisma.TransactionClient, "user" | "club">,
) {
  return withStaff(await withSites(rows, "clubId", "club", db), "instructorId", "instructor", db);
}
