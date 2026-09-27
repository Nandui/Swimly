import "server-only";
import { prisma } from "@/lib/prisma";
import { qualificationState } from "@/lib/people/data";

/** The signed-in person's own qualifications, soonest to expire first. Read by
 *  the staff API (Turnfin Me) only; Work has no personal pages. */
export async function myQualifications(userId: string) {
  const rows = await prisma.qualification.findMany({
    where: { userId, revokedAt: null },
    orderBy: [{ expiresOn: { sort: "asc", nulls: "last" } }],
    select: { id: true, issuedOn: true, expiresOn: true, revokedAt: true, reference: true, type: { select: { id: true, name: true } } },
  });
  return rows.map((q) => ({ ...q, state: qualificationState(q) }));
}
