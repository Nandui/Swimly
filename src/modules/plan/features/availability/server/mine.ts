import "server-only";
import { prisma } from "@/lib/prisma";
import { usualWeekOf } from "@/modules/plan/shared/data";
import { ANY_WEEK } from "@/modules/plan/shared/rules";

/** The signed-in person's own usual week (D34), for Turnfin Me through the staff API only: the
 *  times they said they can work each weekday, Monday first. Until they say, every day reads as
 *  any time and `said` is false. Never another person's. */
export async function myUsualWeek(userId: string) {
  const row = await prisma.planAvailability.findUnique({ where: { userId }, select: { modes: true, starts: true, ends: true, updatedAt: true } });
  return row ? { said: true, days: usualWeekOf(row), updatedAt: row.updatedAt } : { said: false, days: [...ANY_WEEK], updatedAt: null };
}
