import "dotenv/config";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

/** Takes back the credit the backfill gave across programmes.
 *
 *      npx tsx scripts/undo-cross-programme-credit.ts [--confirm]
 *
 *  `backfill-earned-levels.ts` credited each swimmer with the levels below
 *  their placement, and followed a ladder I inferred — Water Safety & Fun
 *  running into Swimming Skills — so every Sharks child was also credited with
 *  Starfish, Penguins, Turtles and Dolphins. The club's rule is narrower:
 *  **credit is given within the programme the swimmer is on, and nowhere
 *  else.** A Sharks 2 child has earned Sharks 1. What they did in Water Safety
 *  & Fun, if anything, is not something their Sharks placement says.
 *
 *  Only rows the backfill wrote are touched, recognised by the note it left on
 *  every one ("Inferred from placement at …; not individually assessed.").
 *  Anything an instructor recorded stands. And only rows in a programme the
 *  swimmer holds **no** active place in are removed — a child placed in both
 *  programmes keeps the credit in both, because in both it is within-programme.
 *
 *  Dry run by default. One audit row. */

const BACKFILL_NOTE = "not individually assessed.";
const CHUNK = 1000;

async function main() {
  const confirm = process.argv.includes("--confirm");

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!admin) throw new Error("No admin account to attribute this to.");

  const placements = await prisma.enrolment.findMany({
    where: { status: "ACTIVE" },
    select: { studentId: true, programmeId: true },
  });
  const programmesOf = new Map<string, Set<string>>();
  for (const p of placements) {
    programmesOf.set(p.studentId, (programmesOf.get(p.studentId) ?? new Set()).add(p.programmeId));
  }
  const onProgramme = (studentId: string, programmeId: string) =>
    programmesOf.get(studentId)?.has(programmeId) ?? false;

  const [completions, results] = await Promise.all([
    prisma.levelCompletion.findMany({
      where: { note: { endsWith: BACKFILL_NOTE } },
      select: { id: true, studentId: true, programmeId: true, level: { select: { name: true } } },
    }),
    prisma.competencyResult.findMany({
      where: { note: { endsWith: BACKFILL_NOTE } },
      select: {
        id: true,
        studentId: true,
        competency: { select: { level: { select: { name: true, programmeId: true } } } },
      },
    }),
  ]);

  const badCompletions = completions.filter((c) => !onProgramme(c.studentId, c.programmeId));
  const badResults = results.filter(
    (r) => !onProgramme(r.studentId, r.competency.level.programmeId)
  );

  const perLevel = new Map<string, number>();
  for (const c of badCompletions) perLevel.set(c.level.name, (perLevel.get(c.level.name) ?? 0) + 1);
  const swimmers = new Set(badCompletions.map((c) => c.studentId)).size;

  console.log(`${completions.length} backfilled completions and ${results.length} backfilled results on record.`);
  console.log(`\nCross-programme, to remove: ${badCompletions.length} completions and ${badResults.length} results, across ${swimmers} swimmers.`);
  for (const [name, n] of [...perLevel.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${name.padEnd(22)} ${String(n).padStart(4)} swimmers`);
  }

  if (!confirm) {
    console.log("\nDry run — nothing was removed. Re-run with --confirm.");
    await prisma.$disconnect();
    return;
  }
  if (badCompletions.length === 0 && badResults.length === 0) {
    console.log("\nNothing to remove.");
    await prisma.$disconnect();
    return;
  }

  const ids = (rows: { id: string }[]) => rows.map((r) => r.id);
  let removedResults = 0;
  for (let i = 0; i < badResults.length; i += CHUNK) {
    const r = await prisma.competencyResult.deleteMany({
      where: { id: { in: ids(badResults.slice(i, i + CHUNK)) } },
    });
    removedResults += r.count;
  }
  let removedCompletions = 0;
  for (let i = 0; i < badCompletions.length; i += CHUNK) {
    const r = await prisma.levelCompletion.deleteMany({
      where: { id: { in: ids(badCompletions.slice(i, i + CHUNK)) } },
    });
    removedCompletions += r.count;
  }

  await logAudit({
    actorId: admin.id,
    actorName: admin.name,
    action: "revoke-level",
    entity: "Student",
    summary:
      `Took back the credit given across programmes to ${swimmers} swimmers — ` +
      `${removedCompletions} level completions and ${removedResults} competencies that had been inferred from a ` +
      `placement in a different programme. Credit for the levels below a placement is given within that programme only.`,
  });

  console.log(`\nDone. Removed ${removedCompletions} completions and ${removedResults} results.`);
  await prisma.$disconnect();
}

void main();

