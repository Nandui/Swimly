import "dotenv/config";
import type { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

/** Sharks is its own programme. Moves the levels **Sharks 1** and **Sharks 2**
 *  out of Water Safety & Fun into a new **Swimming Skills**, taking their
 *  classes and everybody in them.
 *
 *  The part that is easy to miss: **`Enrolment` pins `programmeId`.** That is
 *  deliberate — an enrolment records the level and programme a swimmer was
 *  placed at, so re-badging a course later cannot rewrite where somebody was
 *  last year. Which means moving a level does *not* move the enrolments on its
 *  own; their pinned programme has to be corrected too, or 139 children stay
 *  filed under Water Safety & Fun while their level sits elsewhere, and
 *  `/programmes` and the student profiles disagree about where they are.
 *
 *  Correcting them is right here and would not be in general. These swimmers
 *  were always in Sharks; only the level was filed under the wrong programme.
 *  Nothing derived is disturbed: the levels carry no competencies, no
 *  assessments, no level completions and no attendance. If any of those
 *  existed this script refuses, because then the pinned programme would be
 *  load-bearing history rather than a filing error.
 *
 *  The audit rows written by the imports are left pointing at Water Safety &
 *  Fun. They record what happened at the time, which is the point of them.
 *
 *  Dry run by default. Pass --confirm to write. */

const FROM = "Water Safety & Fun";
const TO = "Swimming Skills";
const MOVING = ["Sharks 1", "Sharks 2"];

function fail(message: string): never {
  console.error(`\nRefusing to run: ${message}`);
  console.error("Nothing was changed.");
  process.exit(1);
}

async function main() {
  const confirm = process.argv.includes("--confirm");

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!admin) fail("there is no active admin to attribute this to.");

  const from = await prisma.programme.findUnique({
    where: { name: FROM },
    select: { id: true, name: true, sortOrder: true },
  });
  if (!from) fail(`no programme called "${FROM}".`);

  const levels = await prisma.level.findMany({
    where: { programmeId: from.id, name: { in: MOVING } },
    select: {
      id: true,
      name: true,
      _count: { select: { competencies: true, courses: true, enrolments: true, completions: true } },
    },
  });

  const already = await prisma.programme.findUnique({
    where: { name: TO },
    select: { id: true, levels: { select: { name: true } } },
  });
  if (levels.length === 0 && already) {
    console.log(
      `Already done — ${TO} holds ${already.levels.map((l) => l.name).join(" and ")}. Nothing to do.`
    );
    await prisma.$disconnect();
    return;
  }
  if (levels.length !== MOVING.length) {
    fail(`expected ${MOVING.length} levels in ${FROM}, found ${levels.length}.`);
  }

  const levelIds = levels.map((l) => l.id);

  // If anything has been assessed or completed against these levels, the pinned
  // programme on an enrolment is history rather than a filing error, and
  // rewriting it would be the retroactive change the model exists to prevent.
  const [results, attendance] = await Promise.all([
    prisma.competencyResult.count({ where: { competency: { levelId: { in: levelIds } } } }),
    prisma.attendanceRecord.count({ where: { course: { levelId: { in: levelIds } } } }),
  ]);
  const completions = levels.reduce((n, l) => n + l._count.completions, 0);
  const competencies = levels.reduce((n, l) => n + l._count.competencies, 0);
  if (results || attendance || completions || competencies) {
    fail(
      `these levels already carry history — ${competencies} competencies, ${results} assessments, ` +
        `${completions} level completions, ${attendance} attendance rows. Moving them would rewrite it.`
    );
  }

  const enrolments = await prisma.enrolment.count({ where: { levelId: { in: levelIds } } });
  const courses = levels.reduce((n, l) => n + l._count.courses, 0);

  console.log(`\nMoving out of ${FROM} and into ${TO}:`);
  for (const l of levels) {
    console.log(`   ${l.name.padEnd(10)} ${l._count.courses} classes, ${l._count.enrolments} enrolments`);
  }
  console.log(`\n${enrolments} enrolments will have their pinned programme corrected.`);

  if (!confirm) {
    console.log("\nDry run — nothing was changed. Re-run with --confirm.");
    await prisma.$disconnect();
    return;
  }

  const remaining = await prisma.level.findMany({
    where: { programmeId: from.id, id: { notIn: levelIds } },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  const target = await prisma.programme.upsert({
    where: { name: TO },
    update: {},
    create: {
      name: TO,
      description:
        "Where a swimmer goes on to after Water Safety & Fun: stroke technique and endurance.",
      sortOrder: from.sortOrder + 1,
    },
    select: { id: true, name: true },
  });

  const writes: Prisma.PrismaPromise<unknown>[] = [
    // The levels themselves, renumbered from the top of their new programme
    // in the order MOVING lists them.
    ...levels.map((l) =>
      prisma.level.update({
        where: { id: l.id },
        data: { programmeId: target.id, sortOrder: MOVING.indexOf(l.name) },
      })
    ),
    // The pinned programme on every enrolment at those levels.
    prisma.enrolment.updateMany({
      where: { levelId: { in: levelIds } },
      data: { programmeId: target.id },
    }),
    // Close the gap the departing levels leave behind.
    ...remaining.map((l, i) => prisma.level.update({ where: { id: l.id }, data: { sortOrder: i } })),
  ];

  await prisma.$transaction(writes);

  await logAudit({
    actorId: admin.id,
    actorName: admin.name,
    action: "update",
    entity: "Programme",
    entityId: target.id,
    programmeId: target.id,
    summary:
      `Created ${TO} and moved ${MOVING.join(" and ")} into it from ${FROM} — ` +
      `${courses} classes and ${enrolments} enrolments, whose pinned programme was corrected with them. ` +
      `Nothing had been assessed or attended at those levels.`,
  });

  console.log(
    `\nDone. ${TO} now holds ${MOVING.join(" and ")}: ${courses} classes, ${enrolments} enrolments.`
  );
  console.log(`${FROM} keeps ${remaining.map((l) => l.name).join(", ")}.`);

  await prisma.$disconnect();
}

void main();
