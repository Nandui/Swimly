import "dotenv/config";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

/** Takes back a class cancellation made by mistake, so the session runs again.
 *
 *      npm run prod -- scripts/undo-class-cancellation.ts --date=2026-11-23 --time=15:10 --class=Starfish [--id=<cancellationId>] [--confirm]
 *
 *  The app has no undo for "Cancel session". A cancellation is one
 *  ClassCancellation row and its frozen roster (CancelledClassSwimmer); nothing
 *  else is written when a class is cancelled, so removing those two puts the
 *  session back on the duty view, the registers and the parents' lessons.
 *
 *  It refuses a cancellation billing has already acted on (notified, sent to
 *  Legend or restored): that one has left the building and needs a person.
 *
 *  Raw SQL on purpose: this checkout's generated client can be behind
 *  production's schema, and these columns have not changed since the table
 *  was made. Dry run by default. One audit row, in the same transaction. */

type Row = {
  id: string; courseId: string; clubId: string; clubName: string | null; date: Date; className: string;
  startMinutes: number; instructorName: string | null; reason: string; cancelledByName: string; cancelledAt: Date;
  attendanceRecorded: number; billingNotifiedAt: Date | null; legendProcessedAt: Date | null; restoredAt: Date | null;
  swimmers: number;
};

type Move = { oldId: string; newId: string; studentId: string; programmeId: string; swimmerName: string; movedBy: string;
  newClass: string | null; newDay: string; newStart: number; marks: number };

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

async function main() {
  const confirm = process.argv.includes("--confirm");
  const date = arg("date"), time = arg("time"), name = arg("class") ?? "", id = arg("id");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Give --date=YYYY-MM-DD.");
  if (!time || !/^\d{2}:\d{2}$/.test(time)) throw new Error("Give --time=HH:MM.");
  const minutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

  const all = await prisma.$queryRaw<Row[]>`
    SELECT k.id, k."courseId", k."clubId", c.name AS "clubName", k.date, k."className", k."startMinutes",
           k."instructorName", k.reason, k."cancelledByName", k."cancelledAt", k."attendanceRecorded",
           k."billingNotifiedAt", k."legendProcessedAt", k."restoredAt",
           (SELECT COUNT(*)::int FROM "CancelledClassSwimmer" s WHERE s."cancellationId" = k.id) AS swimmers
    FROM "ClassCancellation" k LEFT JOIN "Club" c ON c.id = k."clubId"
    WHERE k.date = ${date}::date
    ORDER BY k."startMinutes", k."className"`;

  console.log(`Cancellations on ${date}: ${all.length}`);
  for (const r of all) {
    console.log(`   ${clock(r.startMinutes)}  ${r.className.padEnd(28)} ${(r.clubName ?? r.clubId).padEnd(16)} ${r.swimmers} swimmers  by ${r.cancelledByName}  "${r.reason}"  [${r.id}]`);
  }

  const matches = all.filter((r) => r.startMinutes === minutes && r.className.toLowerCase().includes(name.toLowerCase()) && (!id || r.id === id));
  if (matches.length !== 1) {
    console.log(`\n${matches.length} cancellations match ${time} "${name}"${id ? ` id ${id}` : ""}. Need exactly one; narrow with --class or --id.`);
    return;
  }
  const row = matches[0];
  console.log(`\nTo undo: ${row.className} at ${clock(row.startMinutes)}, ${row.clubName ?? row.clubId}`);
  console.log(`   teacher ${row.instructorName ?? "none"}, cancelled ${row.cancelledAt.toISOString()} by ${row.cancelledByName}`);
  console.log(`   reason "${row.reason}", ${row.swimmers} swimmers on the frozen roster, ${row.attendanceRecorded} attendance marks at the time`);
  console.log(`   billing notified: ${row.billingNotifiedAt?.toISOString() ?? "no"}, Legend: ${row.legendProcessedAt?.toISOString() ?? "no"}, restored: ${row.restoredAt?.toISOString() ?? "no"}`);

  if (row.billingNotifiedAt || row.legendProcessedAt || row.restoredAt) {
    console.log("\nBilling has already acted on this cancellation. Not undoing it from a script.");
    return;
  }
  // Swimmers moved out of the class after it was cancelled (--move-back): the place they
  // left that day, paired with the place the move made, through the move's own audit row.
  const moves = !process.argv.includes("--move-back") ? [] : await prisma.$queryRaw<Move[]>`
    SELECT o.id AS "oldId", n.id AS "newId", o."studentId", o."programmeId", s."swimmerName", a."actorName" AS "movedBy",
           c.name AS "newClass", c."dayOfWeek"::text AS "newDay", c."startMinutes" AS "newStart",
           (SELECT COUNT(*)::int FROM "AttendanceRecord" r WHERE r."studentId" = n."studentId" AND r."courseId" = n."courseId" AND r.date >= n."startedOn") AS marks
    FROM "Enrolment" o
    JOIN "CancelledClassSwimmer" s ON s."cancellationId" = ${row.id} AND s."studentId" = o."studentId"
    JOIN "Enrolment" n ON n."studentId" = o."studentId" AND n.id <> o.id AND n.status = 'ACTIVE'
      AND n."createdAt" >= ${row.cancelledAt} AND n."startedOn" = o."endedOn"
    JOIN "AuditLog" a ON a.entity = 'Enrolment' AND a.action = 'transfer' AND a."entityId" = n.id
    JOIN "Course" c ON c.id = n."courseId"
    WHERE o."courseId" = ${row.courseId} AND o.status = 'TRANSFERRED' AND o."endedOn" = ${date}::date AND o."updatedAt" >= ${row.cancelledAt}
    ORDER BY o."updatedAt"`;
  const initials = (n: string) => n.split(" ").map((p) => p[0]).join("");
  if (moves.length) {
    const [seat] = await prisma.$queryRaw<{ capacity: number | null; taken: number }[]>`
      SELECT c.capacity, (SELECT COUNT(*)::int FROM "Enrolment" e WHERE e."courseId" = c.id AND e.status = 'ACTIVE') AS taken
      FROM "Course" c WHERE c.id = ${row.courseId}`;
    console.log(`\nTo move back (${moves.length}); the class has ${seat.taken} of ${seat.capacity ?? "no limit"} places taken:`);
    for (const m of moves) console.log(`   ${initials(m.swimmerName)}: from ${m.newClass ?? "class"} ${m.newDay} ${clock(m.newStart)} (moved by ${m.movedBy}, ${m.marks} attendance marks there) back to ${row.className}`);
    if (new Set(moves.map((m) => m.studentId)).size !== moves.length) { console.log("A swimmer matches more than one move. Stopping."); return; }
    if (moves.some((m) => m.marks > 0)) { console.log("A moved swimmer already has attendance in the new class. Stopping."); return; }
    if (seat.capacity !== null && seat.taken + moves.length > seat.capacity) { console.log("The class has no room for them. Stopping."); return; }
  }

  if (!confirm) {
    console.log("\nDry run: nothing was changed. Re-run with --confirm.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    const swimmers = await tx.$executeRaw`DELETE FROM "CancelledClassSwimmer" WHERE "cancellationId" = ${row.id}`;
    const gone = await tx.$executeRaw`
      DELETE FROM "ClassCancellation"
      WHERE id = ${row.id} AND "billingNotifiedAt" IS NULL AND "legendProcessedAt" IS NULL AND "restoredAt" IS NULL`;
    if (gone !== 1) throw new Error("The cancellation changed while this ran. Nothing was removed.");
    const details = JSON.stringify({ cancellationId: row.id, date, reason: row.reason, cancelledByName: row.cancelledByName,
      cancelledAt: row.cancelledAt.toISOString(), affectedSwimmers: swimmers });
    await tx.$executeRaw`
      INSERT INTO "AuditLog" (id, "actorName", action, entity, "entityId", "clubId", module, summary, details)
      VALUES (${randomUUID()}, 'Operator script', 'undo-cancel-session', 'Course', ${row.courseId}, ${row.clubId}, 'Swim school',
        ${`Undid the cancellation of ${row.className} on ${date} (cancelled by ${row.cancelledByName}: ${row.reason}). The session runs; ${swimmers} swimmers no longer await billing follow-up.`},
        ${details}::jsonb)`;
    for (const m of moves) {
      const removed = await tx.$executeRaw`DELETE FROM "Enrolment" WHERE id = ${m.newId} AND status = 'ACTIVE'`;
      const back = await tx.$executeRaw`
        UPDATE "Enrolment" SET status = 'ACTIVE', "endedOn" = NULL, "updatedAt" = NOW()
        WHERE id = ${m.oldId} AND status = 'TRANSFERRED'`;
      if (removed !== 1 || back !== 1) throw new Error("A moved place changed while this ran. Nothing was changed.");
      await tx.$executeRaw`
        INSERT INTO "AuditLog" (id, "actorName", action, entity, "entityId", "programmeId", "clubId", module, summary, details)
        VALUES (${randomUUID()}, 'Operator script', 'undo-transfer', 'Enrolment', ${m.oldId}, ${m.programmeId}, ${row.clubId}, 'Swim school',
          ${`Put ${m.swimmerName} back in ${row.className} · ${clock(row.startMinutes)}: the move to ${m.newClass ?? "another class"} · ${m.newDay} ${clock(m.newStart)} by ${m.movedBy} followed a cancellation made by mistake. The new place was removed.`},
          ${JSON.stringify({ cancellationId: row.id, removedEnrolmentId: m.newId, restoredEnrolmentId: m.oldId })}::jsonb)`;
    }
    if (moves.length) console.log(`\nMoved ${moves.length} swimmers back.`);
    console.log(`\nRemoved the cancellation and its ${swimmers} roster rows. Audit row written.`);
  });

  const left = await prisma.$queryRaw<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM "ClassCancellation" WHERE id = ${row.id}`;
  console.log(`Check: ${left[0].n} rows left for that cancellation.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
