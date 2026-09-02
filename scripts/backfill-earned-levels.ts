import "dotenv/config";
import { logAudit } from "@/lib/audit";
import { parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { completionProgress } from "@/lib/progression/rules";

/** Credits every swimmer with the levels below the one they are placed at.
 *
 *      npx tsx scripts/backfill-earned-levels.ts [--confirm]
 *
 *  Dry run without `--confirm`.
 *
 *  A child in Dolphins has, by the club's own placement, passed Starfish,
 *  Penguins and Turtles. The app did not know that: every swimmer was imported
 *  at a level with nothing recorded beneath it, so 1,156 profiles read as if
 *  nobody had ever passed anything, and the move-up rule — which asks whether
 *  the previous level is complete — would have refused every one of them.
 *
 *  For each swimmer, every **live competency at every level below their
 *  placement** is marked ACHIEVED, and each of those levels gets a
 *  LevelCompletion with a full snapshot. "Below" means **within the programme
 *  they are placed in, and nowhere else.** A Sharks 2 child has earned
 *  Sharks 1. What they did in Water Safety & Fun, if anything, is not something
 *  their Sharks placement says — the club was explicit about this, after a
 *  first run that inferred a ladder from one programme into the next and
 *  credited every Sharks child with four Water Safety & Fun levels it had no
 *  business asserting. `undo-cross-programme-credit.ts` took that back.
 *  RLSS levels carry no competencies, so by the app's own rule (a level with
 *  nothing to pass is not completable) RLSS is untouched by construction.
 *
 *  Honesty about what these records are:
 *
 *  - Every row carries a note saying it was **inferred from placement, not
 *    individually assessed**, and names the level it was inferred from. A
 *    profile read in a year should not suggest an instructor watched this
 *    child float on a date they did not.
 *  - **Nothing already recorded is touched.** Results are inserted with
 *    skipDuplicates on (student, competency), so a real assessment — achieved
 *    or still working on — stands. Same for completions on (student, level).
 *    That is also what makes a second run a no-op.
 *  - The level a swimmer is **at** is left alone. That is where they are
 *    working; nothing there is earned yet.
 *  - Archived competencies are skipped. Only what the level currently requires
 *    is credited, which is also what the completion snapshot counts.
 *
 *  One audit row, not twenty thousand — the same granularity as the other
 *  bulk imports. */

const CHUNK = 1000;

async function main() {
  const confirm = process.argv.includes("--confirm");

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!admin) throw new Error("No admin account to attribute this to.");

  const programmes = await prisma.programme.findMany({
    where: { archivedAt: null },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      levels: {
        where: { archivedAt: null },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          competencies: { where: { archivedAt: null }, select: { id: true } },
        },
      },
    },
  });

  // Each level's position within its own programme. One ladder per programme;
  // nothing chains from one programme into another.
  type Rung = { id: string; name: string; programmeId: string; competencyIds: string[] };
  const ladders = new Map<string, Rung[]>(); // programme id -> rungs in order
  const rungOf = new Map<string, { ladder: string; index: number }>();

  const toRung = (p: (typeof programmes)[number], l: (typeof p.levels)[number]): Rung => ({
    id: l.id,
    name: l.name,
    programmeId: p.id,
    competencyIds: l.competencies.map((c) => c.id),
  });

  for (const p of programmes) {
    ladders.set(p.id, p.levels.map((l) => toRung(p, l)));
  }
  for (const [key, rungs] of ladders) {
    rungs.forEach((r, index) => rungOf.set(r.id, { ladder: key, index }));
  }

  const students = await prisma.student.findMany({
    where: { status: "ACTIVE", enrolments: { some: { status: "ACTIVE" } } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      enrolments: { where: { status: "ACTIVE" }, select: { levelId: true } },
    },
  });

  const assessedOn = parseDateOnly(today());
  const results: {
    studentId: string;
    competencyId: string;
    status: "ACHIEVED";
    assessedById: string;
    assessedByName: string;
    assessedOn: Date;
    note: string;
  }[] = [];
  const completions: {
    studentId: string;
    levelId: string;
    programmeId: string;
    completedOn: Date;
    competenciesAchieved: number;
    competencyCount: number;
    confirmedById: string;
    confirmedByName: string;
    note: string;
  }[] = [];
  const perLevel = new Map<string, number>();
  let swimmersCredited = 0;

  for (const student of students) {
    // The highest rung they are placed at on each ladder they are on.
    const highest = new Map<string, number>();
    for (const e of student.enrolments) {
      const rung = rungOf.get(e.levelId);
      if (!rung) continue;
      highest.set(rung.ladder, Math.max(highest.get(rung.ladder) ?? -1, rung.index));
    }

    let credited = false;
    for (const [ladder, top] of highest) {
      const rungs = ladders.get(ladder)!;
      for (const rung of rungs.slice(0, top)) {
        // The app's own rule: nothing to pass means nothing completed.
        const progress = completionProgress(rung.competencyIds, new Set(rung.competencyIds));
        if (!progress.eligible) continue;

        const note = `Inferred from placement at ${rungs[top].name} when the club's records were imported; not individually assessed.`;
        for (const competencyId of rung.competencyIds) {
          results.push({
            studentId: student.id,
            competencyId,
            status: "ACHIEVED",
            assessedById: admin.id,
            assessedByName: admin.name,
            assessedOn,
            note,
          });
        }
        completions.push({
          studentId: student.id,
          levelId: rung.id,
          programmeId: rung.programmeId,
          completedOn: assessedOn,
          competenciesAchieved: progress.achieved,
          competencyCount: progress.total,
          confirmedById: admin.id,
          confirmedByName: admin.name,
          note,
        });
        perLevel.set(rung.name, (perLevel.get(rung.name) ?? 0) + 1);
        credited = true;
      }
    }
    if (credited) swimmersCredited += 1;
  }

  console.log(`${students.length} active swimmers with a placement; ${swimmersCredited} sit above the base level.`);
  console.log(`\nWould credit, per level:`);
  for (const [name, n] of [...perLevel.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${name.padEnd(22)} ${String(n).padStart(4)} swimmers`);
  }
  console.log(`\n${completions.length} level completions and ${results.length} achieved competencies to write.`);
  console.log(`Anything already recorded is skipped, so these are upper bounds.`);

  if (!confirm) {
    console.log("\nDry run — nothing was written. Re-run with --confirm.");
    await prisma.$disconnect();
    return;
  }

  let wroteResults = 0;
  for (let i = 0; i < results.length; i += CHUNK) {
    const r = await prisma.competencyResult.createMany({
      data: results.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
    wroteResults += r.count;
    process.stdout.write(`\rresults ${Math.min(i + CHUNK, results.length)}/${results.length}`);
  }
  console.log("");

  let wroteCompletions = 0;
  for (let i = 0; i < completions.length; i += CHUNK) {
    const r = await prisma.levelCompletion.createMany({
      data: completions.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
    wroteCompletions += r.count;
  }

  if (wroteResults === 0 && wroteCompletions === 0) {
    console.log("\nNothing new to write — already done.");
    await prisma.$disconnect();
    return;
  }

  await logAudit({
    actorId: admin.id,
    actorName: admin.name,
    action: "update",
    entity: "Student",
    summary:
      `Credited ${swimmersCredited} swimmers with the levels below their placement, from the club's records — ` +
      `${wroteCompletions} level completions and ${wroteResults} competencies marked achieved, ` +
      `each noted as inferred from placement rather than individually assessed. ` +
      `Nothing already recorded was changed.`,
  });

  console.log(`\nDone. ${wroteCompletions} completions and ${wroteResults} achieved competencies written (${completions.length - wroteCompletions} completions and ${results.length - wroteResults} results already existed).`);
  await prisma.$disconnect();
}

void main();
