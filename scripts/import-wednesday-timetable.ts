import "dotenv/config";
import { FOUNDING_CLUB_ID } from "@/lib/clubs/constants";
import { logAudit } from "@/lib/audit";
import { courseLabel, formatSlot } from "@/lib/courses/constants";
import { prisma } from "@/lib/prisma";

/** The Wednesday timetable, as it stands in the club's existing system.
 *
 *  Courses only — the rosters are imported separately, because the enrolment
 *  path has to go through the seat lock and the names need checking against
 *  something better than a screenshot.
 *
 *  Idempotent on (level, day, start, name): two classes really can share a
 *  level and a slot — Starfish (A) and Starfish (B) both run at 15:45 — so the
 *  name has to be part of the key or the second would overwrite the first.
 *
 *  Capacities are inferred from "enrolled + available" on each screen, and
 *  come out consistent per level: Starfish 8, Penguins 8, Turtles 10,
 *  Dolphins 12. A class showing "Only Waiting List" is full, which is what
 *  fixes the number for the levels where no spare places were shown. */

const PROGRAMME = "Water Safety & Fun";
const DAY = "WEDNESDAY" as const;
const DURATION = 30;

type CourseSeed = {
  name: string;
  level: string;
  /** Their reference, e.g. 00008170. Kept in `location` is wrong, so it goes
   *  nowhere for now — see the note in the summary about a code field. */
  code: string;
  start: string;
  capacity: number;
  location: string;
};

const TIMETABLE: CourseSeed[] = [
  // Starfish — capacity 8
  { name: "N - Starfish", code: "00006602", level: "Starfish", start: "15:10", capacity: 8, location: "Main Pool: Learners" },
  { name: "N - Starfish (B)", code: "00008171", level: "Starfish", start: "15:45", capacity: 8, location: "Main Pool: Learners" },
  { name: "N - Starfish", code: "00008077", level: "Starfish", start: "16:55", capacity: 8, location: "Main Pool: Learners" },

  // Penguins — capacity 8
  { name: "N - Penguins", code: "00008167", level: "Penguins", start: "15:10", capacity: 8, location: "Main Pool" },
  { name: "N - Penguins", code: "00008175", level: "Penguins", start: "16:20", capacity: 8, location: "Main Pool" },
  { name: "N - Penguins", code: "00008173", level: "Penguins", start: "16:55", capacity: 8, location: "Main Pool" },
  { name: "N - Penguins", code: "00008603", level: "Penguins", start: "17:30", capacity: 8, location: "Main Pool: Learners" },

  // Turtles — capacity 10
  { name: "N - Turtles", code: "00008168", level: "Turtles", start: "15:10", capacity: 10, location: "Main Pool" },
  { name: "N - Turtles", code: "00008172", level: "Turtles", start: "15:45", capacity: 10, location: "Main Pool" },
  { name: "N - Turtles", code: "00008176", level: "Turtles", start: "16:20", capacity: 10, location: "Main Pool" },

  // Dolphins — capacity 12
  { name: "N - Dolphins", code: "00008169", level: "Dolphins", start: "15:10", capacity: 12, location: "Main Pool" },
  { name: "N - Dolphins", code: "00008177", level: "Dolphins", start: "16:20", capacity: 12, location: "Main Pool" },
  { name: "N - Dolphins", code: "00008173", level: "Dolphins", start: "16:45", capacity: 12, location: "Main Pool" },
];

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

async function main() {
  const programme = await prisma.programme.findFirst({
    where: { name: PROGRAMME, clubId: FOUNDING_CLUB_ID },
    select: { id: true, name: true },
  });
  if (!programme) throw new Error(`No programme called "${PROGRAMME}".`);

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!admin) throw new Error("No admin account to attribute the import to.");

  // Both "Turtles" and "Dolphins" exist in Learn to Swim as well, so levels
  // are always resolved inside this programme.
  const levels = await prisma.level.findMany({
    where: { programmeId: programme.id },
    select: { id: true, name: true },
  });
  const levelByName = new Map(levels.map((l) => [l.name, l.id]));

  let created = 0;
  let existing = 0;

  for (const seed of TIMETABLE) {
    const levelId = levelByName.get(seed.level);
    if (!levelId) {
      console.log(`Skipped ${seed.name} ${seed.start}: no level "${seed.level}" in ${programme.name}.`);
      continue;
    }

    const startMinutes = toMinutes(seed.start);
    const already = await prisma.course.findFirst({
      where: { levelId, dayOfWeek: DAY, startMinutes, name: seed.name },
      select: { id: true },
    });
    if (already) {
      existing += 1;
      console.log(`Already there: ${seed.name} ${seed.start} (${seed.level}).`);
      continue;
    }

    const course = await prisma.course.create({
      data: { clubId: FOUNDING_CLUB_ID,
        levelId,
        name: seed.name,
        dayOfWeek: DAY,
        startMinutes,
        durationMinutes: DURATION,
        capacity: seed.capacity,
        location: seed.location,
        instructorId: admin.id,
      },
      select: {
        id: true,
        name: true,
        dayOfWeek: true,
        startMinutes: true,
        durationMinutes: true,
        level: { select: { name: true } },
      },
    });

    await logAudit({
      actorId: admin.id,
      actorName: admin.name,
      action: "create",
      entity: "Course",
      entityId: course.id,
      programmeId: programme.id,
      summary: `Imported course ${courseLabel(course)} teaching ${course.level.name}, ${formatSlot(course)}, ${seed.capacity} places (ref ${seed.code})`,
    });

    created += 1;
    console.log(`Created ${seed.name} ${seed.start} — ${seed.level}, ${seed.capacity} places.`);
  }

  console.log(`\nDone. ${created} created, ${existing} already present.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
