import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";

/** Purchasing end to end on an isolated database: suppliers and approved
 *  products, approval by role and amount, numbers per site in sequence, and
 *  nobody approving their own order. Invented people and suppliers. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let actions: typeof import("../features/orders/server/actions") & typeof import("../features/suppliers/server/actions");
let data: typeof import("../features/orders/server/data");
const ORG = "org_leisureworld";
type GrantRow = { roleName: string; permissions: string[]; screens: string[]; scopeKind: string; scopeId: string };
const state = { id: "mia", permissions: [] as string[], grants: [] as GrantRow[] };
/** Emails are never sent from tests: the transport is this double, which records them. */
const outbox: { to: string; subject: string; text: string; replyTo?: string; cc?: string }[] = [];
const mail = { down: false };
let bishopstown = "", churchfield = "";

function session() {
  return { user: { id: state.id, name: state.id, orgId: ORG, isSuperadmin: false, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions,
    screens: ["purchasing"], primaryScreens: ["purchasing"], grants: state.grants, authMethod: "password", authAt: Date.now() } };
}
class NotFound extends Error {}
const as = (id: string, permissions: string[], grants: GrantRow[] = []) => Object.assign(state, { id, permissions, grants });
const at = (siteId: string, permissions: string[]): GrantRow => ({ roleName: "Site", permissions, screens: ["purchasing"], scopeKind: "site", scopeId: siteId });

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  const clubs = await db.club.findMany({ where: { orgId: ORG }, orderBy: { name: "asc" } });
  bishopstown = clubs.find((c) => c.name.includes("Bishopstown"))!.id;
  churchfield = clubs.find((c) => c.name.includes("Churchfield"))!.id;
  // The migration gives Bishopstown BT and Churchfield CF; Churchfield's is cleared to show a site without one.
  assert.equal((await db.club.findUniqueOrThrow({ where: { id: bishopstown } })).code, "BT");
  await db.club.update({ where: { id: churchfield }, data: { code: null } });
  await db.staffRole.create({ data: { id: "r-duty", name: "Duty manager", permissions: [], screens: [] } });
  await db.staffRole.create({ data: { id: "r-gm", name: "General manager", permissions: [], screens: [] } });
  for (const [id, role] of [["mia", "r-duty"], ["dan", "r-duty"], ["gina", "r-gm"]]) await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: role, orgId: ORG } });
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
    "@/lib/email/sender": { emailSender: (name: string) => ({ clientId: "c", clientSecret: "s", refreshToken: "r", sender: "no-reply@example.invalid", fromHeader: name }) },
    "@/lib/email/google": { sendGoogleEmail: async (to: string, subject: string, content: { text: string; replyTo?: string; cc?: string }) => {
      if (mail.down) throw new Error("Email submission failed.");
      outbox.push({ to, subject, text: content.text, replyTo: content.replyTo, cc: content.cc });
    } },
    "next/navigation": { notFound: () => { throw new NotFound("not found"); } },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
  };
  actions = { ...serverModule<object>("src/modules/purchasing/features/suppliers/server/actions.ts", d), ...serverModule<object>("src/modules/purchasing/features/orders/server/actions.ts", d) } as typeof actions;
  data = serverModule("src/modules/purchasing/features/orders/server/data.ts", d);
});
after(async () => { await fixture?.close(); });

test("suppliers, products and approval rules need Manage", async () => {
  as("mia", ["purchasing.request"]);
  assert.equal((await actions.saveSupplier(null, { name: "Sample Chemicals" })).ok, false);
  as("gina", ["purchasing.manage"]);
  assert.equal((await actions.saveSupplier(null, { name: "Sample Chemicals", accountNumber: "LW-001" })).ok, true);
  assert.equal((await actions.saveSupplier(null, { name: "Sample Chemicals" })).ok, false, "one of each name");
  const supplier = await fixture.prisma.supplier.findFirstOrThrow({ where: { name: "Sample Chemicals" } });
  assert.equal((await actions.saveProduct(supplier.id, null, { name: "Chlorine tablets", unit: "25 kg drum", price: "12.5x" })).ok, false, "a price is an amount");
  assert.equal((await actions.saveProduct(supplier.id, null, { name: "Chlorine tablets", unit: "25 kg drum", price: "120" })).ok, true);
  assert.equal((await actions.saveProduct(supplier.id, null, { name: "pH minus", price: "45.50" })).ok, true);
  assert.equal((await actions.addApprovalRule({ supplierId: null, roleId: "r-duty", limit: "500" })).ok, true);
  assert.equal((await actions.addApprovalRule({ supplierId: null, roleId: "r-gm", limit: "" })).ok, true, "no limit");
  assert.equal((await actions.addApprovalRule({ supplierId: null, roleId: "r-gm", limit: "100" })).ok, false, "one rule per role and supplier");
});

test("an order: drafted, sent, approved by someone else within their limit, numbered per site", async () => {
  const supplier = await fixture.prisma.supplier.findFirstOrThrow({ where: { name: "Sample Chemicals" }, include: { products: true } });
  const tablets = supplier.products.find((p) => p.name === "Chlorine tablets")!;
  as("mia", [], [at(bishopstown, ["purchasing.request"])]);
  const order = (qty: number, siteId = bishopstown) => ({ siteId, supplierId: supplier.id, neededBy: "", note: "", lines: [{ productId: tablets.id, quantity: qty }] });
  assert.equal((await actions.saveOrder(null, order(1, churchfield), true)).ok, false, "only their sites");
  const small = await actions.saveOrder(null, order(2), false);
  assert.ok(small.ok && small.id);
  assert.equal((await fixture.prisma.purchaseOrder.findUniqueOrThrow({ where: { id: small.id! } })).totalCents, 24000, "2 × €120");
  assert.equal((await actions.saveOrder(small.id!, order(3), true)).ok, true, "changed and sent");

  // Mia may not approve her own; Dan (same role, €500 limit) may.
  assert.equal((await actions.decideOrder(small.id!, "approve", "")).ok, false, "not your own");
  as("dan", [], [at(bishopstown, ["purchasing.read"])]);
  const home = await data.purchasingHome();
  assert.deepEqual(home.waiting.map((o) => o.id), [small.id]);
  assert.equal((await actions.decideOrder(small.id!, "approve", "")).ok, true);
  assert.equal((await fixture.prisma.purchaseOrder.findUniqueOrThrow({ where: { id: small.id! } })).number, "PO-BT-00001");

  // Over Dan's limit: only the general manager.
  as("mia", [], [at(bishopstown, ["purchasing.request"])]);
  const big = await actions.saveOrder(null, order(10), true);
  as("dan", [], [at(bishopstown, ["purchasing.read"])]);
  assert.equal((await data.purchasingHome()).waiting.length, 0, "€1,200 is over €500");
  assert.equal((await actions.decideOrder(big.id!, "approve", "")).ok, false);
  as("gina", ["purchasing.read"]);
  assert.equal((await actions.decideOrder(big.id!, "reject", "")).ok, false, "a rejection needs its reason");
  assert.equal((await actions.decideOrder(big.id!, "approve", "")).ok, true);
  assert.equal((await fixture.prisma.purchaseOrder.findUniqueOrThrow({ where: { id: big.id! } })).number, "PO-BT-00002", "the next number");
  assert.equal((await actions.decideOrder(big.id!, "approve", "")).ok, false, "decided once");

  // Rejected goes back to its requester to change; a site without a code cannot be numbered.
  as("mia", [], [at(bishopstown, ["purchasing.request"]), at(churchfield, ["purchasing.request"])]);
  const cf = await actions.saveOrder(null, order(1, churchfield), true);
  as("gina", ["purchasing.read"]);
  assert.equal((await actions.decideOrder(cf.id!, "approve", "")).ok, false, "Churchfield has no short code yet");
  assert.equal((await actions.decideOrder(cf.id!, "reject", "Order from the cheaper supplier")).ok, true);
  as("mia", [], [at(churchfield, ["purchasing.request"])]);
  const detail = await data.purchaseOrder(cf.id!);
  assert.equal(detail.canEdit, true);
  assert.equal(detail.order.decisionNote, "Order from the cheaper supplier");
  assert.equal((await actions.cancelOrder(cf.id!)).ok, true);
  assert.equal((await actions.cancelOrder(small.id!)).ok, false, "an approved order stays");

  const log = await fixture.prisma.auditLog.findMany({ where: { entity: "PurchaseOrder", action: "approve" } });
  assert.equal(log.length, 2);
  assert.ok(log.every((l) => l.module === "Purchasing" && l.clubId === bishopstown));
});

test("a supplier's own approvers replace the general ones; nobody approving means it cannot be sent", async () => {
  as("gina", ["purchasing.manage"]);
  await actions.saveSupplier(null, { name: "Sample Office Supplies" });
  const office = await fixture.prisma.supplier.findFirstOrThrow({ where: { name: "Sample Office Supplies" } });
  await actions.saveProduct(office.id, null, { name: "Paper", price: "5" });
  assert.equal((await actions.addApprovalRule({ supplierId: office.id, roleId: "r-duty", limit: "20" })).ok, true);
  const paper = await fixture.prisma.purchaseProduct.findFirstOrThrow({ where: { supplierId: office.id } });
  as("mia", [], [at(bishopstown, ["purchasing.request"])]);
  const tooMuch = await actions.saveOrder(null, { siteId: bishopstown, supplierId: office.id, neededBy: "", note: "", lines: [{ productId: paper.id, quantity: 10 }] }, true);
  assert.equal(tooMuch.ok, false, "€50 is over the only approver's €20, and the general manager's rule does not apply here");
  as("dan", ["purchasing.read"]);
  await assert.rejects(data.purchaseOrder("nope"), NotFound);
});

test("an approved order is emailed: tests to yourself first, the supplier only once it is turned on", async () => {
  const db = fixture.prisma;
  const first = await db.purchaseOrder.findFirstOrThrow({ where: { number: "PO-BT-00001" } });
  const supplier = await db.supplier.findUniqueOrThrow({ where: { id: first.supplierId } });
  outbox.length = 0;

  // Off by default: only a test to yourself.
  as("mia", [], [at(bishopstown, ["purchasing.request"])]);
  assert.equal((await data.purchaseOrder(first.id)).canEmail, true, "whoever raised it");
  assert.equal((await actions.emailOrder(first.id, "supplier")).ok, false, "emails to suppliers start off");
  as("gina", ["purchasing.manage"]);
  assert.equal((await actions.setSupplierEmails(true)).ok, false, "not before a test");
  as("mia", [], [at(bishopstown, ["purchasing.request"])]);
  assert.equal((await actions.emailOrder(first.id, "test")).ok, true);
  assert.deepEqual(outbox.map((m) => m.to), ["mia@example.invalid"], "the test reaches only the sender");
  assert.match(outbox[0].subject, /^Test: Purchase order PO-BT-00001/);
  assert.match(outbox[0].text, /Chlorine tablets/);
  assert.equal(outbox[0].replyTo, "mia@example.invalid");

  // Someone who only sees the site cannot send it; an order not yet approved cannot be sent.
  as("dan", [], [at(bishopstown, ["purchasing.read"])]);
  assert.equal((await data.purchaseOrder(first.id)).canEmail, false);
  assert.equal((await actions.emailOrder(first.id, "test")).ok, false);
  const pending = await db.purchaseOrder.findFirstOrThrow({ where: { status: { not: "approved" } } });
  as("mia", [], [at(bishopstown, ["purchasing.request"]), at(churchfield, ["purchasing.request"])]);
  assert.equal((await actions.emailOrder(pending.id, "test")).ok, false);

  // Turned on by Manage after the test; the supplier needs an address.
  as("gina", ["purchasing.manage"]);
  assert.equal((await actions.setSupplierEmails(true)).ok, true);
  assert.equal((await actions.setSupplierEmailCopy("not an address")).ok, false);
  assert.equal((await actions.setSupplierEmailCopy("gina@example.invalid")).ok, true);
  as("mia", [], [at(bishopstown, ["purchasing.request"])]);
  assert.equal((await actions.setSupplierEmailCopy("")).ok, false, "only Manage");
  assert.equal((await actions.emailOrder(first.id, "supplier")).ok, false, "no address yet");
  await db.supplier.update({ where: { id: supplier.id }, data: { email: "orders@example.invalid", contactName: "Sam" } });
  assert.equal((await actions.emailOrder(first.id, "supplier")).ok, true);
  assert.equal(outbox.at(-1)!.to, "orders@example.invalid");
  assert.equal(outbox.at(-1)!.cc, "gina@example.invalid", "copied on every email to a supplier");
  assert.equal(outbox[0].cc, undefined, "tests are not copied");
  assert.match(outbox.at(-1)!.subject, /^Purchase order PO-BT-00001/);
  assert.match(outbox.at(-1)!.text, /^Hello Sam,/);

  // A failure is kept, and nothing pretends it went.
  mail.down = true;
  assert.equal((await actions.emailOrder(first.id, "supplier")).ok, false);
  mail.down = false;
  const kept = await db.purchaseOrderEmail.findMany({ where: { orderId: first.id }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(kept.map((e) => [e.kind, e.status, e.ccAddress]), [["test", "sent", ""], ["supplier", "sent", "gina@example.invalid"], ["supplier", "failed", "gina@example.invalid"]]);
  assert.equal((await db.auditLog.count({ where: { entity: "PurchaseOrder", entityId: first.id, action: "email" } })), 3);

  // Off again: nothing more goes to the supplier.
  as("gina", ["purchasing.manage"]);
  assert.equal((await actions.setSupplierEmails(false)).ok, true);
  as("mia", [], [at(bishopstown, ["purchasing.request"])]);
  assert.equal((await actions.emailOrder(first.id, "supplier")).ok, false);
  as("mia", ["purchasing.request"]);
  assert.equal((await actions.setSupplierEmails(true)).ok, false, "only Manage turns it on");
});
