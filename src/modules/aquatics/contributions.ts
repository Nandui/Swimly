import "server-only";
import { prisma } from "@/lib/prisma";
import { registerSiteSummary, registerStaffColumn } from "@/modules/contributions";

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-IE")} ${n === 1 ? one : many}`;

/** Classes each person is the scheduled instructor for, archived ones included,
 *  as the Staff page has always counted them. */
registerStaffColumn({
  id: "aquatics.classes",
  header: "Classes",
  async values(userIds) {
    if (userIds.length === 0) return new Map();
    const rows = await prisma.course.groupBy({ by: ["instructorId"], where: { instructorId: { in: userIds } }, _count: { _all: true } });
    return new Map(rows.filter((row) => row.instructorId).map((row) => [row.instructorId!, String(row._count._all)]));
  },
});

/** What each site runs in Aquatics: live programmes, active swimmers and live classes. */
registerSiteSummary({
  id: "aquatics.site",
  async lines(clubIds) {
    if (clubIds.length === 0) return new Map();
    const [programmes, students, courses] = await Promise.all([
      prisma.programme.groupBy({ by: ["clubId"], where: { clubId: { in: clubIds }, archivedAt: null }, _count: { _all: true } }),
      prisma.student.groupBy({ by: ["clubId"], where: { clubId: { in: clubIds }, status: "ACTIVE" }, _count: { _all: true } }),
      prisma.course.groupBy({ by: ["clubId"], where: { clubId: { in: clubIds }, archivedAt: null }, _count: { _all: true } }),
    ]);
    const count = (rows: { clubId: string; _count: { _all: number } }[], id: string) => rows.find((row) => row.clubId === id)?._count._all ?? 0;
    return new Map(clubIds.map((id) => [id, [
      plural(count(programmes, id), "programme", "programmes"),
      plural(count(students, id), "active swimmer", "active swimmers"),
      plural(count(courses, id), "class", "classes"),
    ].join(" · ")]));
  },
});
