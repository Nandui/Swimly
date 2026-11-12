import "dotenv/config";
import { Client, types } from "pg";
import { prisma } from "@/lib/prisma";
import { planImport, type ImportLookup, type OldRiskData } from "@/modules/risk/features/import/rules";
import { writeImport } from "@/modules/risk/features/import/server/write";

/** Brings the risk assessments over from the standalone Risk Management app
 *  (github.com/Nandui/project-risk) into Turnfin's Risk assessments (D29).
 *
 *  It only ever READS the old database, named by RISK_SOURCE_DATABASE_URL, and writes to Turnfin's
 *  (DATABASE_URL). Each assessment comes with its hazards, reviews, review requests and history,
 *  keeping its reference and ids, so running it again adds only what is not here yet. Old centres
 *  are matched to Turnfin sites by their two-letter code, then by name; people by email;
 *  departments by name. An assessment whose centre has no site here is skipped and named. A person
 *  with no account here keeps their name as text. The old app's incidents are not brought over:
 *  Turnfin's Incidents is the record for those.
 *
 *  Dry run by default: it prints what would happen and writes nothing. Pass --confirm to write.
 *    RISK_SOURCE_DATABASE_URL=... npx tsx scripts/import-risk-assessments.ts --as owner@example.com
 *    RISK_SOURCE_DATABASE_URL=... npm run prod -- scripts/import-risk-assessments.ts --as owner@example.com --confirm */

// The old app keeps its times as UTC without a zone; read them as UTC, whatever this machine's zone.
types.setTypeParser(1114, (value) => new Date(`${value.replace(" ", "T")}Z`));

const same = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

async function readOld(url: string): Promise<OldRiskData> {
  const old = new Client({ connectionString: url });
  await old.connect();
  try {
    await old.query("SET default_transaction_read_only = on");
    const rows = async <T>(sql: string) => (await old.query(sql)).rows as T[];
    // The first standalone app called its history "AuditLog"; Centrely renamed it.
    const audit = (await rows<{ name: string | null }>(`SELECT to_regclass('"RisklyAuditLog"')::text AS name`))[0]?.name ? `"RisklyAuditLog"` : `"AuditLog"`;
    const hasTarget = (await rows(`SELECT 1 FROM information_schema.columns WHERE table_name = 'RiskAssessment' AND column_name = 'targetScore'`)).length > 0;
    return {
      centers: await rows(`SELECT id, name, "siteCode" FROM "Center"`),
      users: await rows(`SELECT id, name, email FROM "User"`),
      areas: await rows(`SELECT id, name FROM "Area"`),
      roles: await rows(`SELECT id, name FROM "Role"`),
      activities: await rows(`SELECT id, name FROM "Activity"`),
      departments: await rows(`SELECT id, name FROM "Department"`),
      assessments: await rows(`SELECT *${hasTarget ? "" : `, NULL::int AS "targetScore"`} FROM "RiskAssessment"`),
      hazards: await rows(`SELECT * FROM "Hazard"`),
      reviewLogs: await rows(`SELECT * FROM "ReviewLog"`),
      reviewRequests: await rows(`SELECT * FROM "ReviewRequest"`),
      auditLogs: await rows(`SELECT id, "assessmentId", "userId", "userName", action, detail, "createdAt" FROM ${audit} WHERE "assessmentId" IS NOT NULL`),
    };
  } finally {
    await old.end();
  }
}

async function main() {
  const source = process.env.RISK_SOURCE_DATABASE_URL;
  if (!source) throw new Error("Set RISK_SOURCE_DATABASE_URL to the old Risk Management database (read only).");
  if (source === process.env.DATABASE_URL || source === process.env.DIRECT_URL) throw new Error("RISK_SOURCE_DATABASE_URL is Turnfin's own database. Point it at the old Risk Management database.");
  const index = process.argv.indexOf("--as");
  const email = index > 0 ? process.argv[index + 1]?.trim().toLowerCase() : "";
  if (!email) throw new Error("Pass --as <email> of your own active Turnfin account: the import is recorded in your name.");
  const confirm = process.argv.includes("--confirm");

  const operator = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, isActive: true, orgId: true } });
  if (!operator?.isActive || !operator.orgId) throw new Error(`No active Turnfin account with an organisation for ${email}.`);
  const orgId = operator.orgId;

  const old = await readOld(source);
  const [sites, people, departments] = await Promise.all([
    prisma.club.findMany({ where: { orgId, archivedAt: null }, select: { id: true, name: true, code: true } }),
    prisma.user.findMany({ where: { orgId }, select: { id: true, name: true, email: true } }),
    prisma.department.findMany({ where: { orgId, archivedAt: null }, select: { id: true, name: true } }),
  ]);
  const lookup: ImportLookup = {
    sites: new Map(old.centers.flatMap((c) => {
      const site = sites.find((s) => same(s.code, c.siteCode)) ?? sites.find((s) => same(s.name, c.name)) ?? sites.find((s) => s.name.toLowerCase().includes(c.name.trim().toLowerCase()) || c.name.toLowerCase().includes(s.name.trim().toLowerCase()));
      return site ? [[c.id, { id: site.id, orgId, name: site.name }] as const] : [];
    })),
    users: new Map(old.users.flatMap((u) => {
      const person = people.find((p) => same(p.email, u.email));
      return person ? [[u.id, { id: person.id, name: person.name }] as const] : [];
    })),
    departments: new Map(old.departments.flatMap((d) => {
      const department = departments.find((x) => same(x.name, d.name));
      return department ? [[d.id, department.id] as const] : [];
    })),
  };

  console.log(`Old app: ${old.assessments.length} assessments, ${old.hazards.length} hazards, ${old.reviewLogs.length} reviews, ${old.reviewRequests.length} review requests.`);
  for (const c of old.centers) console.log(`  ${c.name} (${c.siteCode ?? "no code"}) -> ${lookup.sites.get(c.id)?.name ?? "NO SITE IN TURNFIN"}`);

  const plan = planImport(old, lookup, { id: operator.id, name: operator.name });
  const lines = await writeImport(prisma, plan, { id: operator.id, name: operator.name }, { confirm });
  for (const line of lines) console.log(`  ${line.outcome.padEnd(12)} ${line.reference}${line.subject ? `  ${line.subject}, ${line.site}, ${line.hazards} hazards` : ""}${line.reason ? `  (${line.reason})` : ""}`);
  for (const note of plan.notes) console.log(`\nNote: ${note}`);
  const count = (outcome: string) => lines.filter((l) => l.outcome === outcome).length;
  console.log(`\n${confirm ? `${count("imported")} imported` : `${count("would import")} would be imported`}, ${count("already here")} already here, ${count("skipped")} skipped.`);
  if (!confirm) console.log("Dry run. Nothing was written. Pass --confirm to write.");
}

main().then(() => prisma.$disconnect(), async (error) => { console.error(error.message); await prisma.$disconnect(); process.exit(1); });
