import "dotenv/config";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

/** The Water Safety & Fun curriculum, as the club actually teaches it.
 *
 *  A bulk import rather than twenty passes through the dialog, and held to the
 *  app's rules rather than excused from them:
 *
 *  - **Idempotent** — matched on (level, name) and updated in place, so a
 *    second run re-orders rather than duplicates.
 *  - **Audited** — one row per level naming what was added, and no row at all
 *    when a run changes nothing.
 *  - **Archives, never deletes** — the two placeholder competencies on
 *    Starfish are retired, not removed, so anything ever assessed against them
 *    stays readable. Restore them from `/programmes` in one click.
 *
 *  Level goals are deliberately untouched: this imports competencies only. */

const PROGRAMME = "Water Safety & Fun";

const CURRICULUM: { level: string; competencies: string[] }[] = [
  {
    level: "Starfish",
    competencies: [
      "Put face in water & blow bubbles",
      "Return to standing position",
      "Float with face in the water (w/ woggle)",
      "Float with face in the water (w/ 2 donuts)",
      "Float with face in the water (on their own)",
      "Float on their back (w/ woggle)",
      "Float on their back (w/ 2 donuts)",
      "Float on their back (on their own)",
    ],
  },
  {
    level: "Penguins",
    competencies: [
      "Swim confidently in the learners pool",
      "Swim confidently in the main pool",
      "Kicking with face in the water while blowing bubbles (w/ board)",
      "Kicking with face in the water while blowing bubbles (no board)",
      "Kicking on their back (w/ board)",
      "Kicking on their back (no board)",
      "Pick up objects from the bottom of the pool in shallow end",
      "Going through a hoop in shallow end",
      "Pencil Float",
      "Mushroom float",
    ],
  },
];

/** Placeholders the real list replaces. Retired only if nothing was ever
 *  assessed against them — an assessment means somebody meant it. */
const RETIRE: { level: string; competencies: string[] }[] = [
  { level: "Starfish", competencies: ["Float", "Bubbles"] },
];

async function main() {
  const programme = await prisma.programme.findUnique({
    where: { name: PROGRAMME },
    select: { id: true, name: true },
  });
  if (!programme) throw new Error(`No programme called "${PROGRAMME}".`);

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!admin) throw new Error("No admin account to attribute the import to.");

  for (const entry of CURRICULUM) {
    const level = await prisma.level.findUnique({
      where: { programmeId_name: { programmeId: programme.id, name: entry.level } },
      select: { id: true, name: true },
    });
    if (!level) {
      console.log(`Skipped ${entry.level}: no such level in ${programme.name}.`);
      continue;
    }

    const before = await prisma.competency.findMany({
      where: { levelId: level.id },
      select: { name: true },
    });
    const known = new Set(before.map((row) => row.name));
    const added = entry.competencies.filter((name) => !known.has(name));

    for (const [index, name] of entry.competencies.entries()) {
      await prisma.competency.upsert({
        where: { levelId_name: { levelId: level.id, name } },
        update: { sortOrder: index, archivedAt: null },
        create: { levelId: level.id, name, sortOrder: index },
      });
    }

    // Retire the placeholders this list replaces, but never one that carries
    // an assessment.
    const retiring = RETIRE.find((row) => row.level === entry.level)?.competencies ?? [];
    const retired: string[] = [];
    for (const name of retiring) {
      const existing = await prisma.competency.findUnique({
        where: { levelId_name: { levelId: level.id, name } },
        select: { id: true, archivedAt: true, _count: { select: { results: true } } },
      });
      if (!existing || existing.archivedAt) continue;
      if (existing._count.results > 0) {
        console.log(`Kept "${name}": ${existing._count.results} assessment(s) recorded against it.`);
        continue;
      }
      await prisma.competency.update({
        where: { id: existing.id },
        data: { archivedAt: new Date() },
      });
      retired.push(name);
    }

    if (added.length === 0 && retired.length === 0) {
      console.log(`${level.name}: already up to date.`);
      continue;
    }

    await logAudit({
      actorId: admin.id,
      actorName: admin.name,
      action: "update",
      entity: "Level",
      entityId: level.id,
      programmeId: programme.id,
      summary:
        `Imported the ${level.name} competencies` +
        (added.length ? ` — added ${added.length} (${added.join("; ")})` : "") +
        (retired.length ? `; retired ${retired.join(", ")}` : ""),
    });

    console.log(
      `${level.name}: added ${added.length}, retired ${retired.length}, now ${entry.competencies.length} live.`
    );
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
