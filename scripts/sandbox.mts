/** A complete local Turnfin on throwaway in-memory databases.
 *
 *    npm run sandbox          # then open http://localhost:3100
 *
 *  Starts PGlite Postgres servers for the main database and each separate
 *  module database (Docs, HR), applies every committed migration, seeds a
 *  fictional LeisureWorld, and runs `next dev` pointed only at them. It never
 *  reads .env database settings and never connects to a real database; stop it
 *  and everything is gone.
 *
 *  Every sandbox account signs in with the password SANDBOX_PASSWORD below.
 *  These people are invented; do not add real staff or swimmers here. */
import { spawn } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { roleColumns } from "../src/lib/staff/levels";

export const SANDBOX_PASSWORD = "sandbox-turnfin-2026";
const PORTS = { main: 54391, docs: 54392, hr: 54393, app: Number(process.env.SANDBOX_PORT ?? 3100) };

async function serve(name: string, port: number, migrate: (db: PGlite) => Promise<void>) {
  const db = new PGlite();
  await migrate(db);
  const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 20 });
  await server.start();
  console.log(`[sandbox] ${name} database on 127.0.0.1:${port}`);
  return `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable`;
}

const mainUrl = await serve("main", PORTS.main, async (db) => {
  for (const folder of readdirSync("prisma/migrations").filter((name) => /^\d/.test(name)).sort()) {
    await db.exec(readFileSync(`prisma/migrations/${folder}/migration.sql`, "utf8"));
  }
});
const docsUrl = await serve("docs", PORTS.docs, async (db) => {
  for (const file of readdirSync("docs-database/migrations").sort()) await db.exec(readFileSync(`docs-database/migrations/${file}`, "utf8"));
});
const hrUrl = existsSync("hr-database/migrations")
  ? await serve("hr", PORTS.hr, async (db) => {
      for (const file of readdirSync("hr-database/migrations").sort()) await db.exec(readFileSync(`hr-database/migrations/${file}`, "utf8"));
    })
  : null;

// ---------------------------------------------------------------------------
// A fictional LeisureWorld
// ---------------------------------------------------------------------------
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: mainUrl }) });
const ORG = "org_leisureworld";
const hash = await bcrypt.hash(SANDBOX_PASSWORD, 10);
/** Every sandbox account also has this quick-switch PIN for shared devices. */
export const SANDBOX_PIN = "2580";
const pinHash = await bcrypt.hash(SANDBOX_PIN, 10);
const roles: Record<string, string> = {};
// The roles from "How Turnfin works" (docs/how-turnfin-works.md), as levels.
const levelRoles: { name: string; homeName: string; levels: Record<string, string>; extras?: string[]; system?: boolean }[] = [
  { name: "Admin", homeName: "Management", levels: { admin: "manage" }, system: true },
  { name: "Instructor", homeName: "Pool deck", levels: { "pool-deck": "teach" }, system: true },
  { name: "Receptionist", homeName: "Front of House", levels: { "swim-school": "desk", refunds: "use", docs: "read", rota: "view" } },
  { name: "Lifeguard", homeName: "Poolside", levels: { docs: "read", rota: "view" } },
  { name: "Duty manager", homeName: "Duty desk", levels: { "swim-school": "desk", refunds: "manage", docs: "read", training: "trainer", rota: "manage" }, extras: ["swim-school.cancel-classes"] },
  { name: "Swim school manager", homeName: "Swim school office", levels: { "swim-school": "manage", "pool-deck": "lead", docs: "manage", training: "manage", rota: "manage", hr: "team" }, extras: ["swim-school.cancel-classes", "docs.approve"] },
];
for (const [i, role] of levelRoles.entries()) {
  const data = { homeName: role.homeName, ...roleColumns({ levels: role.levels, extras: role.extras ?? [] }) };
  roles[role.name] = role.system
    ? (await prisma.staffRole.update({ where: { name: role.name }, data: { ...data, isSystem: true } })).id
    : (await prisma.staffRole.create({ data: { name: role.name, ...data, sortOrder: 10 + i } })).id;
}

await prisma.department.createMany({ data: [
  { id: "dept_aquatics", orgId: ORG, name: "Aquatics", clubId: "club_churchfield", sortOrder: 0 },
  { id: "dept_reception", orgId: ORG, name: "Reception", sortOrder: 1 },
  { id: "dept_gym", orgId: ORG, name: "Gym", clubId: "club_bishopstown", sortOrder: 2 },
] });

type Seed = { id: string; name: string; role: string; title: string; site: string; departments: string[]; manager?: string; superadmin?: boolean; sites?: string[] };
const people: Seed[] = [
  { id: "sbx_alex", name: "Alex Example", role: "Admin", title: "General manager", site: "club_bishopstown", departments: [], superadmin: true },
  { id: "sbx_maya", name: "Maya Example", role: "Duty manager", title: "Duty manager, Churchfield", site: "club_churchfield", departments: [], manager: "sbx_alex", sites: ["club_churchfield"] },
  { id: "sbx_liam", name: "Liam Example", role: "Swim school manager", title: "Aquatics lead", site: "club_churchfield", departments: ["dept_aquatics"], manager: "sbx_maya" },
  { id: "sbx_ava", name: "Ava Example", role: "Instructor", title: "Swim teacher", site: "club_churchfield", departments: ["dept_aquatics"], manager: "sbx_liam" },
  { id: "sbx_noah", name: "Noah Example", role: "Receptionist", title: "Receptionist", site: "club_bishopstown", departments: ["dept_reception"], manager: "sbx_alex" },
  { id: "sbx_riley", name: "Riley Example", role: "Lifeguard", title: "Lifeguard", site: "club_bishopstown", departments: ["dept_aquatics"], manager: "sbx_liam" },
];
for (const p of people) {
  await prisma.user.create({ data: {
    id: p.id, name: p.name, email: `${p.id.slice(4)}@sandbox.invalid`, passwordHash: hash, passwordAt: new Date(), pinHash,
    staffRoleId: roles[p.role], orgId: ORG, jobTitle: p.title, primaryClubId: p.site, siteIds: p.sites ?? [], isSuperadmin: !!p.superadmin,
    startedOn: new Date("2023-04-03T00:00:00Z"),
  } });
}
for (const p of people) {
  if (p.manager) await prisma.user.update({ where: { id: p.id }, data: { managerId: p.manager } });
  for (const [i, departmentId] of p.departments.entries()) await prisma.userDepartment.create({ data: { userId: p.id, departmentId, isPrimary: i === 0 } });
}
// One role each (docs/how-turnfin-works.md): no extra roles.
const soon = new Date(); soon.setUTCDate(soon.getUTCDate() + 30);
const past = new Date(); past.setUTCDate(past.getUTCDate() - 10);
await prisma.qualification.createMany({ data: [
  { orgId: ORG, userId: "sbx_ava", typeId: "qt_nplq", issuedOn: new Date("2025-02-01T00:00:00Z"), expiresOn: new Date("2027-02-01T00:00:00Z"), reference: "NPLQ-EXAMPLE-1", verifiedById: "sbx_liam", verifiedAt: new Date() },
  { orgId: ORG, userId: "sbx_ava", typeId: "qt_first_aid", issuedOn: new Date("2023-11-01T00:00:00Z"), expiresOn: soon, verifiedById: "sbx_liam", verifiedAt: new Date() },
  { orgId: ORG, userId: "sbx_riley", typeId: "qt_nplq", issuedOn: new Date("2024-01-10T00:00:00Z"), expiresOn: past, verifiedById: "sbx_liam", verifiedAt: new Date() },
] });

const seedModule = "./sandbox-seed.ts";
if (existsSync(new URL(seedModule, import.meta.url))) {
  const extra = await import(seedModule) as { seed: (ctx: { prisma: PrismaClient; docsUrl: string; hrUrl: string | null; roles: Record<string, string> }) => Promise<void> };
  await extra.seed({ prisma, docsUrl, hrUrl, roles });
}
await prisma.$disconnect();

console.log(`[sandbox] Seeded a fictional LeisureWorld. Sign in as alex@sandbox.invalid (superadmin), maya@, liam@, ava@, noah@ or riley@sandbox.invalid with the sandbox password in scripts/sandbox.mts.`);
const env = {
  ...process.env,
  DATABASE_URL: mainUrl, DIRECT_URL: mainUrl, DOCS_DATABASE_URL: docsUrl, DOCS_DIRECT_URL: docsUrl,
  ...(hrUrl ? { HR_DATABASE_URL: hrUrl, HR_DIRECT_URL: hrUrl } : {}),
  AUTH_SECRET: "sandbox-only-secret-not-for-deployment-0000", AUTH_TRUST_HOST: "true",
  DEV_AUTH_BYPASS: "", NEXT_TELEMETRY_DISABLED: "1",
  // Turnfin Me (apps/me, port 3101) against this sandbox. Codes print here.
  STAFF_API_ENABLED: "true", STAFF_AUTH_SECRET: "sandbox-only-staff-secret-not-for-deployment",
  STAFF_API_ALLOWED_ORIGINS: "http://localhost:3101", STAFF_ME_URL: "http://localhost:3101", STAFF_EMAIL_DEV_LOG: "true",
};
const app = spawn("npx", ["next", "dev", "-p", String(PORTS.app)], { stdio: "inherit", env, shell: true });
app.on("exit", (code) => process.exit(code ?? 0));
