import "dotenv/config";
import { prisma } from "@/lib/prisma";

/** Read-only: what happened to a cancelled class's swimmers since it was cancelled.
 *      npm run prod -- scripts/inspect-cancellation-moves.ts --id=<cancellationId> */
const id = process.argv.find((a) => a.startsWith("--id="))?.slice(5);

async function main() {
  if (!id) throw new Error("Give --id=<cancellationId>.");
  const [k] = await prisma.$queryRaw<{ courseId: string; cancelledAt: Date; date: Date }[]>`
    SELECT "courseId", "cancelledAt", date FROM "ClassCancellation" WHERE id = ${id}`;
  if (!k) throw new Error("No such cancellation.");
  const swimmers = await prisma.$queryRaw<{ studentId: string; swimmerName: string }[]>`
    SELECT "studentId", "swimmerName" FROM "CancelledClassSwimmer" WHERE "cancellationId" = ${id}`;
  const ids = swimmers.map((s) => s.studentId);
  const label = new Map(swimmers.map((s, i) => [s.studentId, `S${i + 1} (${s.swimmerName.split(" ").map((p) => p[0]).join("")})`]));

  const cols = await prisma.$queryRaw<{ table_name: string; column_name: string }[]>`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'studentId' ORDER BY table_name`;
  console.log("Tables with studentId:", cols.map((c) => c.table_name).join(", "));

  const enrolCols = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Enrolment' ORDER BY ordinal_position`;
  console.log("Enrolment columns:", enrolCols.map((c) => c.column_name).join(", "));

  const enrolments = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT e.id, e."studentId", e."courseId", e.status, e."startedOn", e."endedOn", e."scheduledEndOn", e."createdAt", e."updatedAt",
           c.name AS course, c."dayOfWeek", c."startMinutes"
    FROM "Enrolment" e JOIN "Course" c ON c.id = e."courseId"
    WHERE e."studentId" = ANY(${ids}) AND (e.status = 'ACTIVE' OR e."updatedAt" >= ${k.cancelledAt} OR e."createdAt" >= ${k.cancelledAt})
    ORDER BY e."studentId", e."createdAt"`;
  console.log(`\nEnrolments (active, or touched since ${k.cancelledAt.toISOString()}):`);
  for (const e of enrolments) {
    const d = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 16) : String(v));
    console.log(`   ${label.get(e.studentId as string)}  ${e.status}  ${e.course ?? ""} dow${e.dayOfWeek} ${e.startMinutes}  started ${d(e.startedOn).slice(0, 10)} ended ${d(e.endedOn).slice(0, 10)} schedEnd ${d(e.scheduledEndOn).slice(0, 10)}  created ${d(e.createdAt)} updated ${d(e.updatedAt)}  ${e.courseId === k.courseId ? "<- cancelled class" : ""} [${e.id}]`);
  }

  const audit = await prisma.$queryRaw<{ createdAt: Date; actorName: string; action: string; entity: string; entityId: string | null; summary: string; details: unknown }[]>`
    SELECT "createdAt", "actorName", action, entity, "entityId", summary, details FROM "AuditLog"
    WHERE "createdAt" >= ${k.cancelledAt}
      AND ("entityId" = ANY(${ids}) OR "entityId" = ${k.courseId} OR details::text LIKE ANY(${ids.map((s) => `%${s}%`)})
           OR "entityId" IN (SELECT id FROM "Enrolment" WHERE "studentId" = ANY(${ids})))
    ORDER BY "createdAt"`;
  console.log(`\nAudit rows since the cancellation touching these swimmers or the class: ${audit.length}`);
  for (const a of audit) {
    let text = `${a.summary}  ${JSON.stringify(a.details)}`;
    for (const s of swimmers) { text = text.split(s.swimmerName).join(label.get(s.studentId)!).split(s.studentId).join(label.get(s.studentId)!); }
    console.log(`   ${a.createdAt.toISOString().slice(11, 16)}  ${a.actorName}  ${a.action} ${a.entity}  ${text.slice(0, 420)}`);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
