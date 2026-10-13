import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { today } from "@/lib/format";

/** Stock end to end on an isolated database: the usual categories from the migration, the product
 *  list, a count at a site with counted none kept apart from not counted, one open count per site,
 *  submitting, comparing two counts, and the audit trail. Invented products only. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let products: typeof import("../features/products/server/actions");
let counts: typeof import("../features/counts/server/actions");
let compare: typeof import("../features/compare/server/data");
let sheet: typeof import("../features/counts/server/data");
const ORG = "org_leisureworld";
type GrantRow = { roleName: string; permissions: string[]; screens: string[]; scopeKind: string; scopeId: string };
const state = { id: "nora", permissions: [] as string[], grants: [] as GrantRow[] };
let bishopstown = "", churchfield = "";
class Denied extends Error {}
class NotFound extends Error {}

function session() {
  return { user: { id: state.id, name: state.id, orgId: ORG, isSuperadmin: false, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions,
    screens: ["stock"], primaryScreens: ["stock"], grants: state.grants, authMethod: "password", authAt: Date.now() } };
}
const as = (id: string, permissions: string[], grants: GrantRow[] = []) => Object.assign(state, { id, permissions, grants });
const at = (siteId: string, permissions: string[]): GrantRow => ({ roleName: "Site", permissions, screens: ["stock"], scopeKind: "site", scopeId: siteId });

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  const clubs = await db.club.findMany({ where: { orgId: ORG }, orderBy: { name: "asc" } });
  bishopstown = clubs.find((c) => c.name.includes("Bishopstown"))!.id;
  churchfield = clubs.find((c) => c.name.includes("Churchfield"))!.id;
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  for (const id of ["nora", "desk"]) await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: "r-staff", orgId: ORG, siteIds: [bishopstown] } });
  const d = {
    "@/lib/prisma": { prisma: db },
    "@/lib/authz": {
      AuthorizationError: class AuthorizationError extends Error {},
      requireSession: async () => session(),
      requirePermission: async (p: PermissionKey) => { if (!expandPermissions(state.permissions).has(p)) throw new Denied(p); return session(); },
      can: (s: { user: { permissions: string[] } }, p: PermissionKey) => expandPermissions(s.user.permissions).has(p),
      canSee: () => true,
    },
    "@/lib/clubs/current": { currentClubId: async () => bishopstown, currentClubIdIfAny: async () => bishopstown },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { notFound: () => { throw new NotFound("not found"); } },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
  };
  products = serverModule("src/modules/stock/features/products/server/actions.ts", d);
  counts = serverModule("src/modules/stock/features/counts/server/actions.ts", d);
  compare = serverModule("src/modules/stock/features/compare/server/data.ts", d);
  sheet = serverModule("src/modules/stock/features/counts/server/data.ts", d);
});
after(async () => { await fixture?.close(); });

const ids: Record<string, string> = {};

test("the migration gives the organisation the usual categories; only Manage keeps the product list", async () => {
  const cats = await fixture.prisma.stockCategory.findMany({ where: { orgId: ORG }, orderBy: { sortOrder: "asc" } });
  assert.deepEqual(cats.map((c) => c.name), ["Drink", "Snack", "Confectionery", "Retail", "Cleaning", "Equipment", "Other"]);
  const retail = cats.find((c) => c.name === "Retail")!.id;
  as("nora", ["stock.count"]);
  await assert.rejects(products.saveProduct(null, { name: "Synthetic goggles", categoryId: retail, unitLabel: "pair" }), Denied, "Count does not keep the list");
  as("nora", ["stock.manage"]);
  for (const name of ["Synthetic goggles", "Synthetic armbands", "Synthetic swim hat"]) assert.equal((await products.saveProduct(null, { name, categoryId: retail, unitLabel: "each" })).ok, true);
  assert.equal((await products.saveProduct(null, { name: "synthetic GOGGLES", categoryId: retail, unitLabel: "each" })).ok, false, "names are unique");
  for (const p of await fixture.prisma.stockProduct.findMany({ where: { orgId: ORG } })) ids[p.name] = p.id;
  assert.equal((await products.archiveCategory(retail, true)).ok, false, "a category in use can't be archived");
  assert.equal((await fixture.prisma.auditLog.findFirstOrThrow({ where: { entity: "StockProduct" } })).module, "Stock");
});

let first = "";

test("a count is started and counted at the person's own site only, one open count at a time", async () => {
  as("desk", [], [at(churchfield, ["stock.count"])]);
  assert.equal((await counts.startCount({ siteId: bishopstown, stockDate: today() })).ok, false, "not their site");
  as("desk", [], [at(bishopstown, ["stock.read"])]);
  assert.equal((await counts.startCount({ siteId: bishopstown, stockDate: today() })).ok, false, "View does not count");
  as("desk", [], [at(bishopstown, ["stock.count"])]);
  const started = await counts.startCount({ siteId: bishopstown, stockDate: "2026-09-30" });
  assert.equal(started.ok, true);
  first = started.id!;
  assert.equal((await counts.startCount({ siteId: bishopstown, stockDate: today() })).ok, false, "one open count per site");
  assert.equal((await counts.submitCount(first)).ok, false, "nothing counted yet");
  assert.equal((await counts.saveCountLine(first, ids["Synthetic goggles"], 12)).ok, true);
  assert.equal((await counts.saveCountLine(first, ids["Synthetic armbands"], 0)).ok, true, "counted none");
  assert.equal((await counts.saveCountLine(first, ids["Synthetic swim hat"], 5)).ok, true);
  assert.equal((await counts.saveCountLine(first, ids["Synthetic swim hat"], null)).ok, true, "back to not counted");
  assert.equal((await counts.saveCountLine(first, ids["Synthetic goggles"], -1)).ok, false);
  const lines = await fixture.prisma.stockTakeLine.findMany({ where: { stockTakeId: first } });
  assert.deepEqual(lines.map((l) => l.quantity).sort(), [0, 12], "none is a line, not counted is no line");
  const view = await sheet.stockTake(first);
  assert.equal(view.canCount, true);
  assert.equal(view.products.length, 3, "every live product is on the sheet");
  assert.equal((await counts.submitCount(first)).ok, true);
  assert.equal((await counts.saveCountLine(first, ids["Synthetic goggles"], 11)).ok, false, "a submitted count can't change");
});

test("two submitted counts compare: down is selling, up is flagged, not counted is kept out of the totals", async () => {
  as("desk", [], [at(bishopstown, ["stock.count"])]);
  const second = (await counts.startCount({ siteId: bishopstown, stockDate: "2026-10-31" })).id!;
  await counts.saveCountLine(second, ids["Synthetic goggles"], 7);
  await counts.saveCountLine(second, ids["Synthetic armbands"], 4);
  await counts.saveCountLine(second, ids["Synthetic swim hat"], 9);
  assert.equal((await counts.submitCount(second)).ok, true);
  const result = await compare.stockComparison({});
  assert.equal(result.from?.id, first, "the earlier count is on the left, whatever order they are chosen in");
  assert.deepEqual(result.rows.map((r) => [r.name, r.change, r.delta]), [
    ["Synthetic armbands", "up", 4], ["Synthetic goggles", "down", -5], ["Synthetic swim hat", "uncounted", 0],
  ]);
  assert.deepEqual(result.totals, { counted: 2, changed: 2, up: 1, uncounted: 1, out: 5 });
  as("desk", [], [at(churchfield, ["stock.read"])]);
  assert.equal((await compare.stockComparison({})).options.length, 0, "counts at other sites stay out of sight");
});

test("only Manage deletes a count; an empty open count can be discarded", async () => {
  as("desk", [], [at(bishopstown, ["stock.count"])]);
  assert.equal((await counts.deleteCount(first)).ok, false);
  const empty = (await counts.startCount({ siteId: bishopstown, stockDate: today() })).id!;
  assert.equal((await counts.discardCount(empty)).ok, true);
  as("nora", [], [at(bishopstown, ["stock.manage"])]);
  assert.equal((await counts.deleteCount(first)).ok, true);
  assert.equal(await fixture.prisma.stockTakeLine.count({ where: { stockTakeId: first } }), 0);
  assert.ok(await fixture.prisma.auditLog.findFirst({ where: { entity: "StockTake", action: "delete", entityId: first } }));
});

test("Manage adds the Bishopstown stock sheet's names once, under Other", async () => {
  as("desk", ["stock.count"]);
  await assert.rejects(products.addSheetProducts(), Denied);
  as("nora", ["stock.manage"]);
  assert.equal((await products.addSheetProducts()).ok, true);
  const other = await fixture.prisma.stockCategory.findFirstOrThrow({ where: { orgId: ORG, name: "Other" } });
  assert.equal(await fixture.prisma.stockProduct.count({ where: { orgId: ORG, categoryId: other.id } }), 74);
  assert.equal((await products.addSheetProducts()).ok, false, "nothing left to add");
});
