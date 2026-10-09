import "server-only";
import { activeStaffIds } from "@/lib/directory";
import { addDaysIso, formatDate, parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/** Training for Turnfin Me's daily digest: assignments due within 3 days of
 *  `on`, or overdue, for active people. `ref` keeps each one sent once. */
export async function trainingReminderItems(on: string) {
  const soon = parseDateOnly(addDaysIso(on, 3));
  const rows = await prisma.trainingAssignment.findMany({
    where: { status: "ASSIGNED", dueOn: { not: null, lte: soon } },
    select: { id: true, userId: true, dueOn: true, course: { select: { title: true } } },
  });
  const active = await activeStaffIds(rows.map((r) => r.userId));
  return rows.filter((r) => active.has(r.userId)).map((r) => {
    const overdue = r.dueOn!.toISOString().slice(0, 10) < on;
    return { userId: r.userId, kind: overdue ? "training-overdue" : "training-due", ref: r.id,
      line: overdue ? `${r.course.title} is overdue (it was due ${formatDate(r.dueOn!)}).` : `${r.course.title} is due ${formatDate(r.dueOn!)}.` };
  });
}
