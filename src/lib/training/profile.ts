import "server-only";
import { formatDate, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { registerProfileSummary } from "@/modules/contributions";

/** Training on someone's Staff page: what they have to do, and how much they have done. */
registerProfileSummary({
  id: "training.summary",
  heading: "Training",
  async load(userId) {
    const [open, done] = await Promise.all([
      prisma.trainingAssignment.findMany({
        where: { userId, status: { in: ["ASSIGNED", "SUBMITTED"] } }, orderBy: [{ dueOn: { sort: "asc", nulls: "last" } }], take: 6,
        select: { status: true, dueOn: true, course: { select: { title: true } } },
      }),
      prisma.trainingAssignment.count({ where: { userId, status: "COMPLETED" } }),
    ]);
    const now = parseDateOnly(today());
    const overdue = open.filter((a) => a.dueOn && a.dueOn < now).length;
    return {
      summary: [open.length ? `${open.length} to do` : "Nothing to do", overdue ? `${overdue} overdue` : null, `${done} completed`].filter(Boolean).join(" · "),
      lines: open.map((a) => ({ label: a.course.title, hint: [a.status === "SUBMITTED" ? "Waiting for sign-off" : null, a.dueOn ? `${a.dueOn < now ? "Was due" : "Due"} ${formatDate(a.dueOn)}` : "No deadline"].filter(Boolean).join(" · ") })),
      href: `/training/people/${userId}`,
    };
  },
});
