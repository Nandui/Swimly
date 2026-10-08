import "server-only";
import { formatDate, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { registerPersonFileSection, type PersonFileEntry } from "@/modules/contributions";

/** Training's part of a person's file: what they have to do, and how much they have done. */
export async function trainingFile(userId: string): Promise<{ summary: string; entries: PersonFileEntry[] }> {
  const [open, done] = await Promise.all([
    prisma.trainingAssignment.findMany({
      where: { userId, status: { in: ["ASSIGNED", "SUBMITTED"] } }, orderBy: [{ dueOn: { sort: "asc", nulls: "last" } }],
      select: { id: true, status: true, dueOn: true, assignedAt: true, course: { select: { title: true } } },
    }),
    prisma.trainingAssignment.count({ where: { userId, status: "COMPLETED" } }),
  ]);
  const now = parseDateOnly(today());
  const overdue = open.filter((a) => a.dueOn && a.dueOn < now).length;
  return {
    summary: `${[open.length ? `${open.length} to do` : "Nothing to do", overdue ? `${overdue} overdue` : null, `${done} completed`].filter(Boolean).join(" · ")}.`,
    entries: open.map((a): PersonFileEntry => ({
      id: a.id,
      title: a.course.title,
      detail: [a.status === "SUBMITTED" ? "Waiting for sign-off" : null, a.dueOn ? `${a.dueOn < now ? "Was due" : "Due"} ${formatDate(a.dueOn)}` : "No deadline"].filter(Boolean).join(" · "),
      on: (a.dueOn ?? a.assignedAt).toISOString().slice(0, 10),
    })),
  };
}

registerPersonFileSection({ id: "training.open", heading: "Training", load: trainingFile });
