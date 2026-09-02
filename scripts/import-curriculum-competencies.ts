import "dotenv/config";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

/** The rest of the swim-school curriculum, from "New Competencies Swim School"
 *  (the club's PDF, 2 Sep 2026). Starfish and Penguins went in earlier from a
 *  screenshot and match this document exactly; this adds the five levels that
 *  had nothing: Turtles, Dolphins, Sharks 1, Sharks 2, LeisureWorld Sharks.
 *
 *  Rookies Bronze, Silver and Gold are not in the document — RLSS is a
 *  different award scheme with its own syllabus — and are left alone.
 *
 *  Same rules as the first competency import: idempotent on (level, name),
 *  reorders rather than duplicates, never deletes, one audit row per level that
 *  actually changed and none for a level already up to date.
 *
 *  Two things the source does that are handled here rather than copied:
 *
 *  - **Sharks 1 lists "Pick up an object from the deep (about 2m deep" twice**,
 *    sixth and tenth, and never closes the bracket. Once, with the bracket
 *    closed. Nine competencies, not ten.
 *  - **LeisureWorld Sharks is tiered L1 / L2 / L3** in the source but is one
 *    level here, with 31 swimmers pinned to it. Splitting it would mean moving
 *    every one of those enrolments, which is a curriculum decision for the
 *    club, not a transcription. The tier survives as a prefix on each name —
 *    "L1 · Front Crawl (High Elbow)" — so the order still reads as a
 *    progression and the split stays possible later.
 *
 *  Level goals: the source has one per level, and five levels currently carry
 *  either nothing or the placeholder the timetable imports wrote ("No
 *  competencies recorded yet"), which this run makes untrue. The goal is
 *  written only into those. A description somebody typed by hand is never
 *  overwritten. Transcribed as written, including "1,5m". */

type LevelSpec = {
  level: string;
  goal: string;
  competencies: string[];
};

const CURRICULUM: LevelSpec[] = [
  {
    level: "Starfish",
    goal: "Being safe in the water, being able to stand up when falling, being able to retrieve a sinker from the bottom of the pool. Ideal time 12–18 weeks. Age 5–7.",
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
    goal: "Being able to roam in the water with their face in comfortably, being able to use their kick to swim. Age 5–9.",
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
  {
    level: "Turtles",
    goal: "Swimming in the main pool confidently, being safe in the deep end, knowing how to reach the poolside for safety; using arms and legs to swim. Age 6–10.",
    competencies: [
      "Tread water confidently (for about 20 seconds)",
      "Deep end confidence (swimming safely without reaching for the wall)",
      "Go back safely from the middle of the pool to the poolside",
      "Front Crawl arm action & leg action together",
      "Back crawl arm action & leg action together",
      "Introduction to Breaststroke arms",
      "Sitting Dive (in the deep end)",
      "Jumping safely in the deep end",
    ],
  },
  {
    level: "Dolphins",
    goal: "Swimming confidently in the deep end, jumping safely, staying in the water without aid confidently, move through water without stopping to take a breath. Age 7–12.",
    competencies: [
      "Pick up an object from the deep (about 1,5m deep)",
      "Rotary breathing - show head turning to the side to breathe",
      "Front Crawl confidently",
      "Back crawl confidently",
      "Intro to Breaststroke legs",
      "Treading water for 30 seconds",
      "Kneeling Dive",
    ],
  },
  {
    level: "Sharks 1",
    goal: "Diving safely, reaching the bottom of the pool safely, swim until the other side of the pool without stopping, being able to play in the deep end with no hesitation. Age 8–12.",
    competencies: [
      "Forward flip from a standing position",
      "Standing Dive",
      "Front Crawl with high elbow",
      "Back Crawl keeping head still",
      "Breaststroke with small circles (arms) and good kick",
      // Listed twice in the source, bracket never closed. Once, closed.
      "Pick up an object from the deep (about 2m deep)",
      "Treading Water with head out of the water",
      "Sculling head first",
      "Introduction to Butterfly body undulation",
    ],
  },
  {
    level: "Sharks 2",
    goal: "Diving safely, continuous swimming with a turn, being able to play in the deep end with no hesitation, show good swimming technique. Age 8–15.",
    competencies: [
      "Front Crawl with good breathing and rhythm",
      "Back crawl with controlled body and extended arms",
      "Breaststroke with correct timing and good kick",
      "Introduction to Butterfly arms",
      "Sculling head first",
      "Flip and turn for continuous swimming",
    ],
  },
  {
    level: "LeisureWorld Sharks",
    goal: "Finesse the swimming skills and develop endurance. Ideal time indefinite. Age 13–17.",
    competencies: [
      "L1 · Front Crawl (High Elbow)",
      "L1 · Front Crawl (Bilateral Breathing)",
      "L1 · Back Crawl (Streamlined Body)",
      "L1 · Breaststroke (Arms with small circles and hand pointed down)",
      "L1 · Sculling Head First",
      "L2 · Front Crawl (S shape arm action)",
      "L2 · Back Crawl (Extended arms)",
      "L2 · Breaststroke (Powerful Kick)",
      "L2 · Butterfly (Body Undulation)",
      "L2 · Tumble Turning",
      "L2 · Sculling Feet First",
      "L3 · Front Crawl (Arm action every 6 kicks)",
      "L3 · Back Crawl (S shape arm action)",
      "L3 · Breaststroke (Correct timing)",
      "L3 · Butterfly arms",
      "L3 · Butterfly breathing (every two strokes)",
      "L3 · Standing Dive",
    ],
  },
];

/** A description this app wrote itself, which a real goal may replace. Anything
 *  else in the field was typed by a person and stays. */
function isPlaceholder(description: string | null): boolean {
  if (!description || !description.trim()) return true;
  return /^Imported from the club's .*timetable\. No competencies recorded yet\.$/.test(
    description.trim()
  );
}

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!admin) throw new Error("No admin account to attribute the import to.");

  for (const entry of CURRICULUM) {
    // By name across every programme: Sharks moved out of Water Safety & Fun
    // after the first competency import, and a script that assumes a
    // programme would miss it.
    const matches = await prisma.level.findMany({
      where: { name: entry.level },
      select: { id: true, name: true, description: true, programmeId: true },
    });
    if (matches.length !== 1) {
      console.log(
        `Skipped ${entry.level}: ${matches.length === 0 ? "no such level" : `${matches.length} levels carry that name`}.`
      );
      continue;
    }
    const level = matches[0];

    const before = await prisma.competency.findMany({
      where: { levelId: level.id },
      select: { name: true, sortOrder: true, archivedAt: true },
    });
    const known = new Map(before.map((row) => [row.name, row]));
    const added = entry.competencies.filter((name) => !known.has(name));
    const reordered = entry.competencies.filter((name, index) => {
      const row = known.get(name);
      return row && (row.sortOrder !== index || row.archivedAt !== null);
    });

    for (const [index, name] of entry.competencies.entries()) {
      await prisma.competency.upsert({
        where: { levelId_name: { levelId: level.id, name } },
        update: { sortOrder: index, archivedAt: null },
        create: { levelId: level.id, name, sortOrder: index },
      });
    }

    const setGoal = isPlaceholder(level.description) && level.description?.trim() !== entry.goal;
    if (setGoal) {
      await prisma.level.update({ where: { id: level.id }, data: { description: entry.goal } });
    }

    if (added.length === 0 && reordered.length === 0 && !setGoal) {
      console.log(`${level.name}: already up to date.`);
      continue;
    }

    await logAudit({
      actorId: admin.id,
      actorName: admin.name,
      action: "update",
      entity: "Level",
      entityId: level.id,
      programmeId: level.programmeId,
      summary:
        `Imported the ${level.name} competencies from the club's curriculum` +
        (added.length ? ` — added ${added.length} (${added.join("; ")})` : "") +
        (reordered.length ? `; reordered ${reordered.length}` : "") +
        (setGoal ? `; set the level's goal` : ""),
    });

    console.log(
      `${level.name}: added ${added.length}, reordered ${reordered.length}${setGoal ? ", goal set" : ""}, now ${entry.competencies.length} live.`
    );
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
