import type { Account } from "@/access/session";
import { may, siteFilter } from "@/access/grants";
import { db } from "@/data/db";
import { clock, dayIn } from "@/data/dates";

/** One class on today's timetable: only what the list shows. */
export type TodayClass = { id: string; time: string; name: string; site: string; where: string; instructor: string };

/** Today's swim classes for this account: every class at its sites for the desk and managers,
 *  their own classes for someone who only teaches. Null when the account has neither. */
export async function todaysClasses(account: Account, now: Date = new Date()): Promise<TodayClass[] | null> {
  const everyClass = may(account.access, "desk") || may(account.access, "lead");
  const ownOnly = !everyClass && may(account.access, "teach");
  if (!everyClass && !ownOnly) return null;
  // Someone who teaches but is not linked to a person record has no classes to their name.
  if (ownOnly && !account.personId) return [];

  const classes = await db.course.findMany({
    where: {
      dayOfWeek: dayIn(now),
      archivedAt: null,
      clubId: siteFilter(account.access),
      club: { orgId: account.orgId },
      ...(ownOnly ? { instructorId: account.personId } : {}),
    },
    orderBy: [{ startMinutes: "asc" }, { club: { sortOrder: "asc" } }],
    select: {
      id: true, name: true, startMinutes: true, durationMinutes: true, location: true,
      level: { select: { name: true } },
      club: { select: { name: true } },
      instructor: { select: { name: true } },
    },
  });
  return classes.map((c) => ({
    id: c.id,
    time: `${clock(c.startMinutes)} to ${clock(c.startMinutes + c.durationMinutes)}`,
    name: c.name ?? c.level.name,
    site: c.club.name,
    where: c.location ?? "",
    instructor: c.instructor?.name ?? "Nobody yet",
  }));
}
