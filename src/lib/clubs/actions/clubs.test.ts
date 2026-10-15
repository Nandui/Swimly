import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { liveSitesOf } from "@/lib/directory";

/** A site added in Admin joins the administrator's organisation, so every
 *  module's site list (incidents, rota, tasks...) shows it, and saving a site
 *  that was added without one repairs it. Invented names only. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let clubs: typeof import("./clubs");
const ORG = "org_leisureworld";

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  await db.staffRole.create({ data: { id: "r-admin", name: "Example site keeper", permissions: ["clubs.manage"], screens: [] } });
  await db.user.create({ data: { id: "ada", name: "Ada Example", email: "ada@example.invalid", staffRoleId: "r-admin", orgId: ORG } });
  const session = { user: { id: "ada", name: "Ada Example", orgId: ORG, permissions: ["clubs.manage"] } };
  clubs = serverModule("src/lib/clubs/actions/clubs.ts", {
    "@/lib/prisma": { prisma: db },
    "@/lib/authz": { requirePermission: async () => session, requireSession: async () => session },
    "@/lib/clubs/current": { currentClubId: async () => null, currentClubIdIfAny: async () => null },
    "next/cache": { revalidatePath() {} },
    "next/headers": { cookies: async () => ({ set() {} }) },
    "next/navigation": { redirect() {} },
  });
});
after(async () => { await fixture?.close(); });

test("a new site is listed by the modules", async () => {
  assert.deepEqual(await clubs.createClub({ name: "Example Riverside", code: "ER" }), { ok: true });
  const listed = await liveSitesOf(ORG, fixture.prisma);
  assert.ok(listed.some((s) => s.name === "Example Riverside"));
});

test("saving a site added without an organisation adds it, with an audit row", async () => {
  const db = fixture.prisma;
  const orphan = await db.club.create({ data: { name: "Example Lakeside", sortOrder: 50 } });
  assert.ok(!(await liveSitesOf(ORG, db)).some((s) => s.id === orphan.id));
  assert.deepEqual(await clubs.updateClub(orphan.id, { name: "Example Lakeside", code: "" }), { ok: true });
  assert.ok((await liveSitesOf(ORG, db)).some((s) => s.id === orphan.id));
  const audit = await db.auditLog.findFirst({ where: { entity: "Club", entityId: orphan.id } });
  assert.equal(audit?.summary, "Added Example Lakeside to the organisation");
});
