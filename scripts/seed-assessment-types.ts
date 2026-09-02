import "dotenv/config";
import { FOUNDING_CLUB_ID } from "@/lib/clubs/constants";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

/** The two kinds of assessment the club named when asking for this, for
 *  Water Safety & Fun. Idempotent on (programme, name); a re-run changes
 *  nothing. Other programmes get theirs from the programme page. */
const TYPES = [
  { programme: "Water Safety & Fun", name: "New swimmers", description: "Totally new to the water — never had a lesson." },
  { programme: "Water Safety & Fun", name: "Mixed abilities", description: "Some experience, level not yet known." },
];

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } });
  if (!admin) throw new Error("No admin account to attribute this to.");
  for (const [index, t] of TYPES.entries()) {
    const programme = await prisma.programme.findFirst({ where: { name: t.programme, clubId: FOUNDING_CLUB_ID }, select: { id: true, name: true } });
    if (!programme) { console.log(`no programme ${t.programme}`); continue; }
    const existing = await prisma.assessmentType.findUnique({ where: { programmeId_name: { programmeId: programme.id, name: t.name } }, select: { id: true } });
    if (existing) { console.log(`${t.programme} / ${t.name}: already there`); continue; }
    const created = await prisma.assessmentType.create({ data: { programmeId: programme.id, name: t.name, description: t.description, sortOrder: index }, select: { id: true } });
    await logAudit({ actorId: admin.id, actorName: admin.name, action: "create", entity: "AssessmentType", entityId: created.id, programmeId: programme.id, summary: `Added assessment type ${t.name} to ${programme.name}` });
    console.log(`${t.programme} / ${t.name}: added`);
  }
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
