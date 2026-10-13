import "dotenv/config";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

/** Moves one swim school class to another site, for a class registered at the
 *  wrong one. The app has no site picker on a class: a class is created at the
 *  working site and keeps it.
 *
 *  Levels and programmes are shared across sites, so the class keeps its level
 *  and every enrolment, register, note, cover and result stays attached to it.
 *  Cancellations from today on move with it (they feed the site's billing
 *  queue); earlier ones stay where they were recorded.
 *
 *  Dry run by default: it prints what is attached and any clash at the new
 *  site. Pass --confirm to write.
 *    npm run prod -- scripts/move-course-site.ts --course <id> --to Churchfield
 *    npm run prod -- scripts/move-course-site.ts --course <id> --to Churchfield --confirm */
function arg(name: string) {
  const index = process.argv.indexOf(name);
  return index > 0 ? process.argv[index + 1]?.trim() ?? "" : "";
}

const time = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

async function main() {
  const courseId = arg("--course");
  const to = arg("--to");
  if (!courseId || !to) throw new Error("Pass --course <class id> and --to <site name or code>.");
  const confirm = process.argv.includes("--confirm");

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true, name: true, clubId: true, dayOfWeek: true, startMinutes: true, durationMinutes: true,
      location: true, archivedAt: true, instructorId: true,
      level: { select: { name: true } },
      instructor: { select: { name: true, siteIds: true, isActive: true } },
      _count: { select: { attendance: true, notes: true, covers: true, assessedResults: true, cancellations: true, plannedTeachers: true } },
    },
  });
  if (!course) throw new Error(`No class with id ${courseId}.`);
  const clubs = await prisma.club.findMany({ select: { id: true, name: true, code: true, archivedAt: true } });
  const from = clubs.find((c) => c.id === course.clubId)!;
  const target = clubs.find((c) => c.name.toLowerCase() === to.toLowerCase() || c.code?.toLowerCase() === to.toLowerCase());
  if (!target || target.archivedAt) throw new Error(`No active site called ${to}. Sites: ${clubs.map((c) => c.name).join(", ")}.`);
  if (target.id === course.clubId) throw new Error(`${course.name ?? course.level.name} is already at ${target.name}.`);

  const label = `${course.name ?? course.level.name} (${course.level.name}), ${course.dayOfWeek.toLowerCase()} ${time(course.startMinutes)}`;
  const today = new Date(new Date().toISOString().slice(0, 10));
  const [enrolments, futureCancellations, planned, sameSlot] = await Promise.all([
    prisma.enrolment.groupBy({ by: ["status"], where: { courseId }, _count: true }),
    prisma.classCancellation.count({ where: { courseId, date: { gte: today } } }),
    prisma.classPlannedTeacher.findMany({ where: { courseId, date: { gte: today }, teacherId: { not: null } }, distinct: ["teacherId"], select: { teacherName: true, teacher: { select: { siteIds: true } } } }),
    prisma.course.findMany({
      where: { clubId: target.id, archivedAt: null, dayOfWeek: course.dayOfWeek, startMinutes: { lt: course.startMinutes + course.durationMinutes } },
      select: { id: true, name: true, startMinutes: true, durationMinutes: true, location: true, level: { select: { name: true } } },
    }),
  ]);
  const clashes = sameSlot.filter((c) => c.startMinutes + c.durationMinutes > course.startMinutes);
  const worksAt = (siteIds: string[]) => siteIds.length === 0 || siteIds.includes(target.id);

  console.log(`Class: ${label}${course.archivedAt ? " [archived]" : ""}`);
  console.log(`Site: ${from.name} -> ${target.name}`);
  console.log(`Location field: ${course.location ?? "(blank)"}`);
  console.log(`Enrolments: ${enrolments.map((e) => `${e._count} ${e.status.toLowerCase()}`).join(", ") || "none"} (stay in the class)`);
  console.log(`History kept on the class: ${course._count.attendance} register marks, ${course._count.notes} notes, ${course._count.covers} covers, ${course._count.assessedResults} results`);
  console.log(`Cancellations: ${course._count.cancellations} in all, ${futureCancellations} from today on (these move to ${target.name})`);
  if (course.instructor) {
    console.log(`Instructor: ${course.instructor.name}${course.instructor.isActive ? "" : " [inactive]"}${worksAt(course.instructor.siteIds) ? "" : ` [NOT set to work at ${target.name}]`}`);
  } else console.log("Instructor: none");
  for (const p of planned) if (p.teacher && !worksAt(p.teacher.siteIds)) console.log(`Planned teacher ${p.teacherName} is NOT set to work at ${target.name}`);
  console.log(clashes.length
    ? `Same time at ${target.name}: ${clashes.map((c) => `${c.name ?? c.level.name} ${time(c.startMinutes)}${c.location ? ` (${c.location})` : ""}`).join("; ")}`
    : `No other ${target.name} class at that time.`);

  if (!confirm) return console.log("Dry run. Pass --confirm to write.");
  await prisma.$transaction(async (tx) => {
    await tx.course.update({ where: { id: courseId }, data: { clubId: target.id } });
    await tx.classCancellation.updateMany({ where: { courseId, date: { gte: today } }, data: { clubId: target.id } });
    for (const clubId of [from.id, target.id]) {
      await logAudit({ actorId: null, actorName: "Operator script", action: "update", entity: "Course", entityId: courseId, clubId,
        summary: `Moved class ${label} from ${from.name} to ${target.name}` }, tx);
    }
  });
  console.log(`Moved to ${target.name}.`);
}

main().then(() => prisma.$disconnect(), async (error) => { console.error(error.message); await prisma.$disconnect(); process.exit(1); });
