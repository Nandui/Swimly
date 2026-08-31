import "dotenv/config";
import type { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

/** Moves whole levels from one programme to another, taking their classes and
 *  everybody in them.
 *
 *      npx tsx scripts/move-levels.ts \
 *        --to "RLSS Lifesaving" \
 *        --levels "Rookies Bronze 1 - 3|Rookies Silver 1 - 3" \
 *        --description "Lifesaving awards, taught in the main pool." \
 *        --confirm
 *
 *  Dry run without `--confirm`. The target programme is created if it does not
 *  exist.
 *
 *  **The part that is easy to miss: `Enrolment` pins `programmeId`.** That is
 *  deliberate — an enrolment records the level *and programme a swimmer was
 *  placed at*, so re-badging a course later cannot rewrite where somebody was
 *  last year. Which means moving a level does **not** move the enrolments on
 *  its own; their pinned programme has to be corrected too, or the swimmers
 *  stay filed under the old programme while their level sits elsewhere, and
 *  `/programmes` and the student profiles disagree without erroring.
 *
 *  Correcting them is right for a **mis-filing** and wrong for anything else,
 *  so this refuses to run if the levels carry competencies, assessments, level
 *  completions or attendance. Once any of those exist the pinned programme is
 *  load-bearing history rather than a filing error, and the honest move is a
 *  transfer per enrolment, not an update.
 *
 *  Audit rows already written keep pointing at the old programme. They record
 *  what happened at the time, which is the point of them. One new row records
 *  the move. */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function fail(message: string): never {
  console.error(`\nRefusing to run: ${message}`);
  console.error("Nothing was changed.");
  process.exit(1);
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  const to = arg("to");
  const description = arg("description");
  const names = (arg("levels") ?? "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!to || names.length === 0) {
    fail('usage: --to "Programme" --levels "Level A|Level B" [--description "..."] [--confirm]');
  }

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!admin) fail("there is no active admin to attribute this to.");

  const levels = await prisma.level.findMany({
    where: { name: { in: names } },
    select: {
      id: true,
      name: true,
      programme: { select: { id: true, name: true, sortOrder: true } },
      _count: { select: { competencies: true, courses: true, enrolments: true, completions: true } },
    },
  });

  if (levels.length !== names.length) {
    fail(
      `expected ${names.length} levels, found ${levels.length}: ${levels.map((l) => l.name).join(", ") || "none"}`
    );
  }

  const done = levels.filter((l) => l.programme.name === to);
  if (done.length === levels.length) {
    console.log(`Already done — all ${levels.length} levels are in ${to}. Nothing to do.`);
    await prisma.$disconnect();
    return;
  }
  if (done.length > 0) {
    fail(`${done.map((l) => l.name).join(" and ")} already sit in ${to} but the others do not.`);
  }

  const sources = new Set(levels.map((l) => l.programme.id));
  if (sources.size !== 1) {
    fail(`those levels are spread across ${sources.size} programmes; move them one programme at a time.`);
  }
  const from = levels[0].programme;
  const levelIds = levels.map((l) => l.id);

  // If anything has been assessed, completed or attended at these levels, the
  // pinned programme on an enrolment is history rather than a filing error, and
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

  console.log(`\nMoving out of ${from.name} and into ${to}:`);
  for (const l of levels) {
    console.log(
      `   ${l.name.padEnd(22)} ${l._count.courses} classes, ${l._count.enrolments} enrolments`
    );
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

  const lastProgramme = await prisma.programme.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const target = await prisma.programme.upsert({
    where: { name: to },
    update: {},
    create: {
      name: to,
      description: description ?? null,
      sortOrder: (lastProgramme?.sortOrder ?? -1) + 1,
    },
    select: { id: true, name: true, levels: { select: { id: true } } },
  });

  // Appended after whatever the target already holds, in the order given.
  const base = target.levels.length;

  const writes: Prisma.PrismaPromise<unknown>[] = [
    ...levels.map((l) =>
      prisma.level.update({
        where: { id: l.id },
        data: { programmeId: target.id, sortOrder: base + names.indexOf(l.name) },
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
      `Moved ${names.join(" and ")} into ${to} from ${from.name} — ` +
      `${courses} ${courses === 1 ? "class" : "classes"} and ${enrolments} enrolments, whose pinned ` +
      `programme was corrected with them. Nothing had been assessed or attended at those levels.`,
  });

  console.log(`\nDone. ${to} holds ${names.join(" and ")}: ${courses} classes, ${enrolments} enrolments.`);
  console.log(
    remaining.length
      ? `${from.name} keeps ${remaining.map((l) => l.name).join(", ")}.`
      : `${from.name} is left with no levels.`
  );

  await prisma.$disconnect();
}

void main();
