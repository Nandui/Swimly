import "server-only";
import { prisma } from "@/lib/prisma";
import { qualificationState } from "@/lib/people/data";
import { ANY_WEEK, usualWeekOf } from "@/lib/people/usual-week";

/** The signed-in person's own qualifications, soonest to expire first: the
 *  newest certificate of each type only, so a renewed one no longer warns.
 *  Read by the staff API (Turnfin Me) only; Work has no personal pages. */
export async function myQualifications(userId: string) {
  const rows = await prisma.qualification.findMany({
    where: { userId, revokedAt: null },
    orderBy: [{ expiresOn: { sort: "asc", nulls: "last" } }],
    select: { id: true, issuedOn: true, expiresOn: true, revokedAt: true, reference: true, type: { select: { id: true, name: true } } },
  });
  const newest = new Map<string, (typeof rows)[number]>();
  for (const q of rows) {
    const held = newest.get(q.type.id);
    const rank = (x: typeof q) => `${x.expiresOn?.toISOString() ?? "9999"}|${x.issuedOn?.toISOString() ?? ""}`;
    if (!held || rank(q) > rank(held)) newest.set(q.type.id, q);
  }
  return rows.filter((q) => newest.get(q.type.id) === q).map((q) => ({ ...q, state: qualificationState(q) }));
}

/** The signed-in person's own usual week (D34, D35), for Turnfin Me through the staff API only:
 *  the times they said they can work each weekday, Monday first. Until they say, every day reads
 *  as any time and `said` is false. Never another person's. */
export async function myUsualWeek(userId: string) {
  const row = await prisma.staffUsualWeek.findUnique({ where: { userId }, select: { modes: true, starts: true, ends: true, updatedAt: true } });
  return row ? { said: true, days: usualWeekOf(row), updatedAt: row.updatedAt } : { said: false, days: [...ANY_WEEK], updatedAt: null };
}
