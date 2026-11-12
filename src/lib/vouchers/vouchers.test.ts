import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { today } from "@/lib/format";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";

/** Vouchers end to end on an isolated database: a batch with a code on every
 *  voucher, used once at a site that accepts it, put right, cancelled, and
 *  limited to the sites a role covers. Invented people and organisations. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let actions: typeof import("./actions");
let data: typeof import("./data");
const ORG = "org_leisureworld";
type GrantRow = { roleName: string; permissions: string[]; screens: string[]; scopeKind: string; scopeId: string };
const state = { id: "rita", permissions: [] as string[], grants: [] as GrantRow[] };
let bishopstown = "", churchfield = "";

function session() {
  return { user: { id: state.id, name: state.id, orgId: ORG, isSuperadmin: false, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions,
    screens: ["vouchers"], primaryScreens: ["vouchers"], grants: state.grants, authMethod: "password", authAt: Date.now() } };
}
class NotFound extends Error {}
const as = (id: string, permissions: string[], grants: GrantRow[] = []) => Object.assign(state, { id, permissions, grants });
const at = (siteId: string, permissions: string[]): GrantRow => ({ roleName: "Site", permissions, screens: ["vouchers"], scopeKind: "site", scopeId: siteId });
const day = (offset: number) => new Date(Date.parse(`${today()}T00:00:00.000Z`) + offset * 86_400_000).toISOString().slice(0, 10);
const batch = (over: Record<string, unknown> = {}) => ({
  occasion: "Christmas 2026", recipient: "Sample Community Centre", service: "Family swim", quantity: 3,
  validFrom: day(0), validUntil: day(30), siteIds: [bishopstown], ...over,
});

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  const clubs = await db.club.findMany({ where: { orgId: ORG }, orderBy: { name: "asc" } });
  bishopstown = clubs.find((c) => c.name.includes("Bishopstown"))!.id;
  churchfield = clubs.find((c) => c.name.includes("Churchfield"))!.id;
  await db.staffRole.create({ data: { id: "r-desk", name: "Receptionist", permissions: [], screens: [] } });
  for (const id of ["rita", "ronan", "maeve"]) await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: "r-desk", orgId: ORG } });
  const d = {
    "@/lib/prisma": { prisma: fixture.prisma },
    "@/lib/authz": {
      AuthorizationError: class AuthorizationError extends Error {},
      requireSession: async () => session(),
      can: (s: { user: { permissions: string[] } }, p: PermissionKey) => expandPermissions(s.user.permissions).has(p),
      canSee: () => true,
    },
    "@/lib/clubs/current": { currentClubId: async () => bishopstown, currentClubIdIfAny: async () => bishopstown },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { notFound: () => { throw new NotFound("not found"); } },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
  };
  actions = serverModule("src/lib/vouchers/actions.ts", d);
  data = serverModule("src/lib/vouchers/data.ts", d);
});
after(async () => { await fixture?.close(); });

test("making a batch needs Manage at every site it names, and gives every voucher its own code", async () => {
  as("rita", [], [at(bishopstown, ["vouchers.redeem"])]);
  assert.equal((await actions.saveBatch(null, batch())).ok, false, "the desk cannot give vouchers out");
  as("maeve", [], [at(bishopstown, ["vouchers.manage"])]);
  assert.equal((await actions.saveBatch(null, batch({ siteIds: [bishopstown, churchfield] }))).ok, false, "only her own sites");
  assert.equal((await actions.saveBatch(null, batch({ quantity: 0 }))).ok, false);
  assert.equal((await actions.saveBatch(null, batch({ quantity: 501 }))).ok, false);
  assert.equal((await actions.saveBatch(null, batch({ validUntil: day(-1) }))).ok, false, "the last day is not before the first");
  assert.equal((await actions.saveBatch(null, batch({ siteIds: [] }))).ok, false, "accepted somewhere");
  const made = await actions.saveBatch(null, batch());
  assert.ok(made.ok && made.id);
  const vouchers = await fixture.prisma.voucher.findMany({ where: { batchId: made.id! }, orderBy: { number: "asc" } });
  assert.deepEqual(vouchers.map((v) => v.number), [1, 2, 3]);
  assert.equal(new Set(vouchers.map((v) => v.code)).size, 3);
  assert.ok(vouchers.every((v) => /^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/.test(v.code)));
  const log = await fixture.prisma.auditLog.findFirstOrThrow({ where: { entity: "VoucherBatch", entityId: made.id!, action: "create" } });
  assert.equal(log.module, "Vouchers");
  assert.equal(log.clubId, bishopstown);
});

test("a voucher is used once, at a site that accepts it and that the role covers", async () => {
  const [first, second] = await fixture.prisma.voucher.findMany({ orderBy: { number: "asc" } });
  // Ronan works at Churchfield only: he can check the code, not use it there or at Bishopstown.
  as("ronan", [], [at(churchfield, ["vouchers.redeem"])]);
  const seen = await data.redeemPage(first.code.toLowerCase().replace("-", " "));
  assert.equal(seen.found?.state, "valid");
  assert.deepEqual(seen.found?.redeemAt, [], "not accepted at his site");
  assert.equal((await actions.redeemVoucher(first.code, churchfield)).ok, false, "the batch names Bishopstown only");
  assert.equal((await actions.redeemVoucher(first.code, bishopstown)).ok, false, "he does not cover Bishopstown");

  as("rita", [], [at(bishopstown, ["vouchers.redeem"])]);
  assert.equal((await actions.redeemVoucher("not a code", bishopstown)).ok, false);
  assert.equal((await actions.redeemVoucher("2222-2222", bishopstown)).ok, false, "no such voucher");
  assert.deepEqual((await data.redeemPage(first.code)).found?.redeemAt.map((s) => s.id), [bishopstown]);
  assert.equal((await actions.redeemVoucher(first.code, bishopstown)).ok, true);
  const again = await actions.redeemVoucher(first.code, bishopstown);
  assert.equal(again.ok, false, "once only");
  const used = await data.redeemPage(first.code);
  assert.equal(used.found?.state, "used");
  assert.equal(used.found?.justNow, true);
  assert.equal(used.found?.canUndo, false, "putting it right needs Manage");
  assert.deepEqual(used.latest.map((v) => v.code), [first.code]);
  const log = await fixture.prisma.auditLog.findFirstOrThrow({ where: { entity: "Voucher", entityId: first.id, action: "redeem" } });
  assert.equal(log.clubId, bishopstown);

  // A mistake is put right by whoever manages vouchers there; a lost voucher is cancelled.
  assert.equal((await actions.unredeemVoucher(first.id)).ok, false);
  as("maeve", [], [at(bishopstown, ["vouchers.manage"])]);
  assert.equal((await actions.unredeemVoucher(first.id)).ok, true);
  assert.equal((await data.redeemPage(first.code)).found?.state, "valid");
  assert.equal((await actions.voidVoucher(second.id)).ok, true);
  assert.equal((await actions.voidVoucher(second.id)).ok, false, "cancelled once");
  as("rita", [], [at(bishopstown, ["vouchers.redeem"])]);
  assert.equal((await actions.redeemVoucher(second.code, bishopstown)).ok, false, "a cancelled voucher cannot be used");
});

test("vouchers work only between the batch's days", async () => {
  as("maeve", [], [at(bishopstown, ["vouchers.manage"])]);
  const early = await actions.saveBatch(null, batch({ recipient: "Sample Scout Group", quantity: 1, validFrom: day(5), validUntil: day(20) }));
  const code = (await fixture.prisma.voucher.findFirstOrThrow({ where: { batchId: early.id! } })).code;
  assert.equal((await actions.redeemVoucher(code, bishopstown)).ok, false, "not valid yet");
  // Dates can be changed after printing; the codes and the number of vouchers stay.
  assert.equal((await actions.saveBatch(early.id!, batch({ recipient: "Sample Scout Group", quantity: 99, validFrom: day(-10), validUntil: day(-1) }))).ok, true);
  const changed = await fixture.prisma.voucherBatch.findUniqueOrThrow({ where: { id: early.id! }, include: { vouchers: true } });
  assert.equal(changed.quantity, 1);
  assert.equal(changed.vouchers[0].code, code);
  assert.equal((await actions.redeemVoucher(code, bishopstown)).ok, false, "expired");
  assert.equal((await data.redeemPage(code)).found?.state, "expired");
});

test("a cancelled batch stops its unused vouchers; batches show only to the sites they name", async () => {
  as("maeve", [], [at(bishopstown, ["vouchers.manage"])]);
  const page = await data.batchesPage();
  const christmas = page.occasions.find((o) => o.occasion === "Christmas 2026")!;
  assert.equal(christmas.batches.length, 2);
  const main = christmas.batches.find((b) => b.recipient === "Sample Community Centre")!;
  const one = (await data.batchPage(main.id));
  assert.deepEqual(one.counts, { used: 0, open: 2, expired: 0, void: 1 });
  assert.equal((await data.printPage(main.id)).vouchers.length, 2, "only vouchers still to hand out are printed");

  const open = one.batch.vouchers.filter((v) => v.state === "valid");
  as("rita", [], [at(bishopstown, ["vouchers.redeem"])]);
  assert.equal((await actions.redeemVoucher(open[0].code, bishopstown)).ok, true);
  await assert.rejects(data.batchesPage(), NotFound, "the desk has no Issued page");

  as("maeve", [], [at(churchfield, ["vouchers.manage"])]);
  assert.equal((await data.batchesPage()).occasions.length, 0, "nothing names Churchfield");
  await assert.rejects(data.batchPage(main.id), NotFound);
  assert.equal((await actions.voidBatch(main.id, "Made twice")).ok, false, "not her site");

  as("maeve", [], [at(bishopstown, ["vouchers.manage"])]);
  assert.equal((await actions.voidBatch(main.id, "")).ok, false, "a reason is needed");
  assert.equal((await actions.voidBatch(main.id, "Made twice by mistake")).ok, true);
  assert.equal((await actions.voidBatch(main.id, "Again")).ok, false);
  as("rita", [], [at(bishopstown, ["vouchers.redeem"])]);
  assert.equal((await actions.redeemVoucher(open[1].code, bishopstown)).ok, false, "cancelled with its batch");
  assert.equal((await data.redeemPage(open[0].code)).found?.state, "used", "the used one stays used");
  as("maeve", [], [at(bishopstown, ["vouchers.manage"])]);
  const after = (await data.batchesPage()).occasions.find((o) => o.occasion === "Christmas 2026")!;
  assert.equal(after.used, 1);
});
