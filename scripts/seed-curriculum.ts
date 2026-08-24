import "dotenv/config";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

/** A curriculum to start from, so the app has something to show before anyone
 *  has typed a level in by hand.
 *
 *  Held to the app's own rules rather than excused from them, because a script
 *  doing the mutating does not make the mutating unaudited:
 *
 *  - **Self-disabling** — declines once any programme exists, so leaving it in
 *    a pipeline costs one query.
 *  - **Idempotent** — everything is matched on its natural key and updated in
 *    place, so a second run is a no-op rather than a duplicate.
 *  - **Audited** — one row per programme, naming what appeared.
 *
 *  It is a starting point, not a recommendation. Rename everything to whatever
 *  your club actually teaches. */

type LevelSeed = { name: string; description: string; competencies: string[] };
type ProgrammeSeed = { name: string; description: string; levels: LevelSeed[] };

const CURRICULUM: ProgrammeSeed[] = [
  {
    name: "Learn to Swim",
    description: "The main ladder, from first time in the water to all four strokes.",
    levels: [
      {
        name: "Turtles",
        description: "Getting comfortable in the water.",
        competencies: [
          "Enter and leave the water safely with help",
          "Put their face in the water and blow bubbles",
          "Walk across the pool holding the wall",
          "Float on their front for 3 seconds with support",
          "Follow an instruction from the poolside",
        ],
      },
      {
        name: "Otters",
        description: "Floating, gliding and moving without help.",
        competencies: [
          "Enter and leave the water unaided",
          "Float on their back for 5 seconds",
          "Push and glide on their front for 2 metres",
          "Submerge fully and recover to standing",
          "Move 5 metres using any leg action",
        ],
      },
      {
        name: "Seals",
        description: "The first recognisable strokes.",
        competencies: [
          "Swim 10 metres on their front",
          "Swim 10 metres on their back",
          "Rotate from front to back and back again",
          "Tread water for 10 seconds",
          "Retrieve an object from chest-deep water",
        ],
      },
      {
        name: "Dolphins",
        description: "Front crawl and back crawl over a distance.",
        competencies: [
          "Swim 25 metres front crawl with breathing to the side",
          "Swim 25 metres back crawl",
          "Perform a push-and-glide with a streamlined body position",
          "Tread water for 30 seconds",
          "Enter the water with a sitting dive",
        ],
      },
      {
        name: "Sharks",
        description: "All four strokes, and the confidence to use them.",
        competencies: [
          "Swim 25 metres breaststroke with a legal kick",
          "Swim 15 metres butterfly",
          "Swim 50 metres front crawl without stopping",
          "Perform a standing dive from the poolside",
          "Swim 25 metres wearing clothing",
        ],
      },
      {
        name: "Sea Lions",
        description: "Distance, water safety and the way out of the programme.",
        competencies: [
          "Swim 200 metres continuously, changing stroke at least once",
          "Tread water for 2 minutes",
          "Perform a surface dive and retrieve an object from deep water",
          "Demonstrate a reach rescue with a floating aid",
          "Explain three pool and open-water safety rules",
        ],
      },
    ],
  },
  {
    name: "Adult Lessons",
    description: "For adults who never learned, or who want their stroke fixed.",
    levels: [
      {
        name: "Beginner",
        description: "Water confidence for an adult starting from nothing.",
        competencies: [
          "Enter and leave the water unaided",
          "Submerge and breathe out under water",
          "Float on their back unaided",
          "Move 10 metres in any way they choose",
        ],
      },
      {
        name: "Improver",
        description: "Two strokes, over a length.",
        competencies: [
          "Swim 25 metres front crawl with side breathing",
          "Swim 25 metres backstroke",
          "Tread water for 1 minute",
          "Swim 100 metres continuously",
        ],
      },
      {
        name: "Open Water Ready",
        description: "Stamina and safety for swimming outside a pool.",
        competencies: [
          "Swim 400 metres continuously",
          "Sight forward every six strokes over 50 metres",
          "Tread water for 3 minutes",
          "Explain cold-water entry and exit safety",
        ],
      },
    ],
  },
];

async function main() {
  const existing = await prisma.programme.findFirst({ select: { id: true, name: true } });
  if (existing) {
    console.log(`Skipped: a curriculum already exists (${existing.name}).`);
    return;
  }

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!admin) {
    throw new Error("No admin account yet. Run `npm run db:seed` first, then this.");
  }

  for (const [programmeIndex, seed] of CURRICULUM.entries()) {
    const programme = await prisma.programme.upsert({
      where: { name: seed.name },
      update: { description: seed.description, sortOrder: programmeIndex },
      create: { name: seed.name, description: seed.description, sortOrder: programmeIndex },
      select: { id: true, name: true },
    });

    let competencyCount = 0;

    for (const [levelIndex, levelSeed] of seed.levels.entries()) {
      const level = await prisma.level.upsert({
        where: { programmeId_name: { programmeId: programme.id, name: levelSeed.name } },
        update: { description: levelSeed.description, sortOrder: levelIndex },
        create: {
          programmeId: programme.id,
          name: levelSeed.name,
          description: levelSeed.description,
          sortOrder: levelIndex,
        },
        select: { id: true },
      });

      for (const [competencyIndex, name] of levelSeed.competencies.entries()) {
        await prisma.competency.upsert({
          where: { levelId_name: { levelId: level.id, name } },
          update: { sortOrder: competencyIndex },
          create: { levelId: level.id, name, sortOrder: competencyIndex },
        });
        competencyCount += 1;
      }
    }

    await logAudit({
      actorId: admin.id,
      actorName: admin.name,
      action: "create",
      entity: "Programme",
      entityId: programme.id,
      programmeId: programme.id,
      summary: `Seeded programme ${programme.name} with ${seed.levels.length} levels and ${competencyCount} competencies`,
    });

    console.log(
      `Seeded ${programme.name}: ${seed.levels.length} levels, ${competencyCount} competencies.`
    );
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
