import "server-only";
import { parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { addDaysIso, shiftWarnings } from "@/lib/rota/constants";

/** The signed-in person's own shifts, from today for `days` days, with any
 *  qualification warning so they can sort it before the shift. */
export async function myShifts(userId: string, days = 14) {
  const from = today();
  const shifts = await prisma.rotaShift.findMany({
    where: { userId, cancelledAt: null, date: { gte: parseDateOnly(from), lte: parseDateOnly(addDaysIso(from, days - 1)) } },
    orderBy: [{ date: "asc" }, { startMinutes: "asc" }],
    select: { id: true, userId: true, date: true, startMinutes: true, endMinutes: true, role: true, note: true, requiredTypeId: true,
      site: { select: { name: true } }, requiredType: { select: { name: true } } },
  });
  const held = await prisma.qualification.findMany({ where: { userId }, select: { typeId: true, issuedOn: true, expiresOn: true, revokedAt: true } });
  return shifts.map((s) => ({
    ...s,
    // Only the qualification warnings matter to the person; overlap is the planner's.
    warnings: shiftWarnings(s, held, []).filter((w) => w === "expired" || w === "missing"),
  }));
}
