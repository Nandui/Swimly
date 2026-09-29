import "dotenv/config";
import { readFileSync } from "node:fs";
import readXlsxFile from "read-excel-file/universal";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { parseLegendList, placesToConfirm } from "@/modules/activities/lib/enrolment/legend-list";

/** Confirms Legend agreements from a list exported from Legend, at every
 *  site: the operator's version of "Upload Legend list" on the Legend
 *  agreements page (docs/legend-agreements.md), for when nobody can sign in
 *  to do it there. Every place still to check whose member number is on the
 *  list is confirmed, recorded under the named staff account.
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
  const numbers = parseLegendList(sheet.data as unknown[][]);

  const [rows, clubs] = await Promise.all([
    prisma.enrolment.findMany({
      where: { status: "ACTIVE", legendAgreementStatus: { in: ["NEEDS_CHECK", "PENDING"] }, student: { memberNumber: { in: numbers } } },
      select: { id: true, programmeId: true, studentId: true, student: { select: { firstName: true, lastName: true, memberNumber: true } }, course: { select: { clubId: true } } },
    }),
    prisma.club.findMany({ select: { id: true, name: true } }),
  ]);
  const places = placesToConfirm(numbers, rows.map((r) => ({ ...r, memberNumber: r.student.memberNumber, siteId: r.course.clubId })), "all");
  console.log(`Legend list: ${numbers.length} member numbers. ${places.length} places to confirm (${new Set(places.map((p) => p.studentId)).size} swimmers).`);
  for (const club of clubs) {
    const here = places.filter((p) => p.siteId === club.id).length;
    if (here) console.log(`  ${club.name}: ${here}`);
  }
  if (!confirm) return console.log("Dry run. Pass --confirm --as <staff email> to write.");
  if (!email) throw new Error("Pass --as <email> of the staff member these confirmations are recorded under.");
  const actor = await prisma.user.findFirst({ where: { email, isActive: true }, select: { id: true, name: true } });
  if (!actor) throw new Error(`No active account for ${email}.`);
  const done = await prisma.$transaction(async (tx) => {
    const still = await tx.enrolment.findMany({ where: { id: { in: places.map((p) => p.id) }, status: "ACTIVE", legendAgreementStatus: { in: ["NEEDS_CHECK", "PENDING"] } }, select: { id: true } });
    await tx.enrolment.updateMany({ where: { id: { in: still.map((s) => s.id) } }, data: {
      legendAgreementStatus: "DONE", legendAgreementUpdatedAt: new Date(), legendAgreementUpdatedById: actor.id, legendAgreementUpdatedByName: actor.name,
    } });
    for (const { id } of still) {
      const p = places.find((x) => x.id === id)!;
      await logAudit({ actorId: actor.id, actorName: actor.name, action: "legend-agreement", entity: "Enrolment", entityId: id, programmeId: p.programmeId, clubId: p.siteId,
        summary: `Confirmed the Legend billing agreement is updated for ${p.student.firstName} ${p.student.lastName}, from the Legend list (operator script)` }, tx);
    }
    return still.length;
  }, { timeout: 300_000 });
  console.log(`Confirmed ${done} places, recorded under ${actor.name}.`);
}

main().then(() => prisma.$disconnect(), async (error) => { console.error(error.message); await prisma.$disconnect(); process.exit(1); });
