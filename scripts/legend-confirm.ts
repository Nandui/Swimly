import "dotenv/config";
import { readFileSync } from "node:fs";
import readXlsxFile from "read-excel-file/universal";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { parseLegendList, planLegendMatch, type Place } from "@/modules/activities/lib/enrolment/legend-list";

/** Confirms Legend agreements from a list exported from Legend, for every
 *  site at once: the operator's version of "Match a Legend list" on the
 *  Legend agreements page (docs/legend-agreements.md), for when nobody can
 *  sign in to do it there. Same rules: only active places still to check,
 *  whose member is on the list with a live agreement that fits the place's
 *  programme. Each confirmation is recorded under the named staff account.
 *
 *  Dry run by default; prints counts, never names.
 *    npm run prod -- scripts/legend-confirm.ts "C:\path\List.xlsx"
 *    npm run prod -- scripts/legend-confirm.ts "C:\path\List.xlsx" --confirm --as manager@example.com */
async function main() {
  let path = "", email = "", confirm = false;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--confirm") confirm = true;
    else if (args[i] === "--as") email = (args[++i] ?? "").trim().toLowerCase();
    else if (!args[i].startsWith("--") && !path) path = args[i];
  }
  if (!path) throw new Error("Pass the Legend list (.xlsx).");

  const bytes = readFileSync(path);
  const sheets = await readXlsxFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const sheet = sheets.find((s) => s.sheet.toLowerCase() === "data") ?? sheets[0];
  const members = parseLegendList(sheet.data as unknown[][], new Date().toISOString().slice(0, 10));
  const numbers = members.map((m) => m.memberNumber);

  const [rows, known, programmes, clubs] = await Promise.all([
    prisma.enrolment.findMany({
      where: { status: "ACTIVE", legendAgreementStatus: { in: ["NEEDS_CHECK", "PENDING"] }, student: { memberNumber: { in: numbers } } },
      select: { id: true, programmeId: true, student: { select: { firstName: true, lastName: true, memberNumber: true } },
        course: { select: { clubId: true, level: { select: { name: true } } } } },
    }),
    prisma.student.findMany({ where: { memberNumber: { in: numbers }, enrolments: { some: { status: "ACTIVE" } } }, select: { memberNumber: true } }),
    prisma.programme.findMany({ select: { id: true, name: true } }),
    prisma.club.findMany({ select: { id: true, name: true } }),
  ]);
  const places: (Place & { programmeId: string; swimmer: string })[] = rows.map((r) => ({
    id: r.id, memberNumber: r.student.memberNumber, siteId: r.course.clubId, programmeId: r.programmeId,
    programmeName: programmes.find((p) => p.id === r.programmeId)?.name ?? "", levelName: r.course.level.name,
    swimmer: `${r.student.firstName} ${r.student.lastName}`,
  }));
  const knownSet = new Set(known.flatMap((k) => (k.memberNumber ? [k.memberNumber.toUpperCase()] : [])));

  console.log(`Legend list: ${members.length} members (${members.filter((m) => m.terminated).length} with a terminated agreement).`);
  const toConfirm: typeof places = [];
  for (const club of clubs) {
    const plan = planLegendMatch(members, places, club.id, knownSet);
    if (!plan.confirm.length && !plan.mismatch.length && !plan.terminated.length) continue;
    console.log(`${club.name}: ${plan.confirm.length} to confirm, ${plan.mismatch.length} where Legend names another programme, ${plan.terminated.length} with the agreement ended.`);
    toConfirm.push(...places.filter((p) => plan.confirm.some((c) => c.id === p.id)));
  }
  const overall = planLegendMatch(members, places, "", knownSet);
  console.log(`Already confirmed: ${overall.alreadyConfirmed}. No swim place: ${overall.notFound.length}.`);

  if (!confirm) return console.log(`Dry run: ${toConfirm.length} places would be confirmed. Pass --confirm --as <staff email> to write.`);
  if (!email) throw new Error("Pass --as <email> of the staff member these confirmations are recorded under.");
  const actor = await prisma.user.findFirst({ where: { email, isActive: true }, select: { id: true, name: true } });
  if (!actor) throw new Error(`No active account for ${email}.`);
  const done = await prisma.$transaction(async (tx) => {
    const still = await tx.enrolment.findMany({ where: { id: { in: toConfirm.map((p) => p.id) }, status: "ACTIVE", legendAgreementStatus: { in: ["NEEDS_CHECK", "PENDING"] } }, select: { id: true } });
    await tx.enrolment.updateMany({ where: { id: { in: still.map((s) => s.id) } }, data: {
      legendAgreementStatus: "DONE", legendAgreementUpdatedAt: new Date(), legendAgreementUpdatedById: actor.id, legendAgreementUpdatedByName: actor.name,
    } });
    for (const { id } of still) {
      const p = toConfirm.find((x) => x.id === id)!;
      await logAudit({ actorId: actor.id, actorName: actor.name, action: "legend-agreement", entity: "Enrolment", entityId: id, programmeId: p.programmeId, clubId: p.siteId,
        summary: `Confirmed the Legend billing agreement is updated for ${p.swimmer}, from the Legend list (operator script)` }, tx);
    }
    return still.length;
  }, { timeout: 300_000 });
  console.log(`Confirmed ${done} places, recorded under ${actor.name}.`);
}

main().then(() => prisma.$disconnect(), async (error) => { console.error(error.message); await prisma.$disconnect(); process.exit(1); });
