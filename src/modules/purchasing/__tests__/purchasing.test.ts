import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { poNumber } from "@/modules/purchasing/shared/rules";

/** The first order approved today: Bishopstown, this month, running number 1. */
const firstNumber = () => poNumber("BT", new Date(), 1);

/** Purchasing end to end on an isolated database: suppliers and approved
 *  products, approval by role and amount, numbers in sequence, and
 *  nobody approving their own order. Invented people and suppliers. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let actions: typeof import("../features/orders/server/actions") & typeof import("../features/suppliers/server/actions");
let data: typeof import("../features/orders/server/data");
let homeItems: typeof import("../features/orders/server/home");
const ORG = "org_leisureworld";
type GrantRow = { roleName: string; permissions: string[]; screens: string[]; scopeKind: string; scopeId: string };
const state = { id: "mia", permissions: [] as string[], grants: [] as GrantRow[] };
/** Emails are never sent from tests: the transport is this double, which records them. */
const outbox: { to: string; subject: string; text: string; replyTo?: string; cc?: string[]; logo?: string }[] = [];
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
    "@/lib/email/google": { sendGoogleEmail: async (to: string, subject: string, content: { text: string; html?: string; replyTo?: string; cc?: string[]; inlineImages?: { cid: string; content: Buffer }[] }) => {
      if (mail.down) throw new Error("Email submission failed.");
      const logo = content.inlineImages?.[0];
      outbox.push({ to, subject, text: content.text, replyTo: content.replyTo, cc: content.cc, logo: logo && logo.content.length > 0 && content.html?.includes(`cid:${logo.cid}`) ? logo.cid : undefined });
    } },
    "next/navigation": { notFound: () => { throw new NotFound("not found"); } },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
  };
  actions = { ...serverModule<object>("src/modules/purchasing/features/suppliers/server/actions.ts", d), ...serverModule<object>("src/modules/purchasing/features/orders/server/actions.ts", d) } as typeof actions;
  data = serverModule("src/modules/purchasing/features/orders/server/data.ts", d);
  homeItems = serverModule("src/modules/purchasing/features/orders/server/home.ts", d);
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
  assert.equal((await fixture.prisma.purchaseOrder.findUniqueOrThrow({ where: { id: small.id! } })).number, firstNumber());

  // Over Dan's limit: only the general manager.
  as("mia", [], [at(bishopstown, ["purchasing.request"])]);
  const big = await actions.saveOrder(null, order(10), true);
  as("dan", [], [at(bishopstown, ["purchasing.read"])]);
  assert.equal((await data.purchasingHome()).waiting.length, 0, "€1,200 is over €500");
  assert.equal((await actions.decideOrder(big.id!, "approve", "")).ok, false);
  as("gina", ["purchasing.read"]);
  assert.equal((await actions.decideOrder(big.id!, "reject", "")).ok, false, "a rejection needs its reason");
  assert.equal((await actions.decideOrder(big.id!, "approve", "")).ok, true);
  assert.equal((await fixture.prisma.purchaseOrder.findUniqueOrThrow({ where: { id: big.id! } })).number, poNumber("BT", new Date(), 2), "the next running number");
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
  const first = await db.purchaseOrder.findFirstOrThrow({ where: { number: firstNumber() } });
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
  assert.match(outbox[0].subject, new RegExp(`^Test: Purchase order ${firstNumber()}`));
  assert.match(outbox[0].text, /Chlorine tablets/);
  assert.equal(outbox[0].replyTo, "mia@example.invalid");
  assert.equal(outbox[0].logo, "leisureworld-logo@turnfin", "the logo travels inside the email");

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
  assert.equal((await actions.setSupplierEmailCopy("gina@example.invalid, not an address")).ok, false);
  assert.equal((await actions.setSupplierEmailCopy("a@example.invalid, b@example.invalid, c@example.invalid, d@example.invalid, e@example.invalid, f@example.invalid")).ok, false, "a few, not a mailing list");
  assert.equal((await actions.setSupplierEmailCopy(" gina@example.invalid; accounts@example.invalid,GINA@example.invalid ")).ok, true);
  assert.equal((await db.purchasingSettings.findFirstOrThrow()).copyTo, "gina@example.invalid, accounts@example.invalid", "tidied, each once");
  as("mia", [], [at(bishopstown, ["purchasing.request"])]);
  assert.equal((await actions.setSupplierEmailCopy("")).ok, false, "only Manage");
  assert.equal((await actions.emailOrder(first.id, "supplier")).ok, false, "no address yet");
  await db.supplier.update({ where: { id: supplier.id }, data: { email: "orders@example.invalid", contactName: "Sam" } });
  assert.equal((await actions.emailOrder(first.id, "supplier")).ok, true);
  assert.equal(outbox.at(-1)!.to, "orders@example.invalid");
  assert.deepEqual(outbox.at(-1)!.cc, ["mia@example.invalid", "gina@example.invalid", "accounts@example.invalid"], "whoever raised it and everyone listed are copied on every email to a supplier");
  assert.equal(outbox.at(-1)!.replyTo, "mia@example.invalid");
  assert.equal(outbox[0].cc, undefined, "tests are not copied");
  assert.match(outbox.at(-1)!.subject, new RegExp(`^Purchase order ${firstNumber()}`));
  assert.match(outbox.at(-1)!.text, /^Hello Sam,/);

  // A failure is kept, and nothing pretends it went.
  mail.down = true;
  assert.equal((await actions.emailOrder(first.id, "supplier")).ok, false);
  mail.down = false;
  const kept = await db.purchaseOrderEmail.findMany({ where: { orderId: first.id }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(kept.map((e) => [e.kind, e.status, e.ccAddress]), [["test", "sent", ""], ["supplier", "sent", "mia@example.invalid, gina@example.invalid, accounts@example.invalid"], ["supplier", "failed", "mia@example.invalid, gina@example.invalid, accounts@example.invalid"]]);
  assert.equal((await db.auditLog.count({ where: { entity: "PurchaseOrder", entityId: first.id, action: "email" } })), 3);

  // Sent by someone else, the supplier's replies still go to whoever raised the order.
  as("gina", ["purchasing.manage"]);
  assert.equal((await actions.emailOrder(first.id, "supplier")).ok, true);
  assert.equal(outbox.at(-1)!.replyTo, "mia@example.invalid", "replies go to whoever raised it");
  assert.match(outbox.at(-1)!.text, /it goes to mia\./);
  assert.deepEqual(outbox.at(-1)!.cc, ["mia@example.invalid", "gina@example.invalid", "accounts@example.invalid"], "and they are copied");

  // Off again: nothing more goes to the supplier.
  as("gina", ["purchasing.manage"]);
  assert.equal((await actions.setSupplierEmails(false)).ok, true);
  as("mia", [], [at(bishopstown, ["purchasing.request"])]);
  assert.equal((await actions.emailOrder(first.id, "supplier")).ok, false);
  as("mia", ["purchasing.request"]);
  assert.equal((await actions.setSupplierEmails(true)).ok, false, "only Manage turns it on");
});

test("an administrator may approve their own order; nobody else may", async () => {
  const supplier = await fixture.prisma.supplier.findFirstOrThrow({ where: { name: "Sample Chemicals" }, include: { products: true } });
  const order = { siteId: bishopstown, supplierId: supplier.id, neededBy: "", note: "", lines: [{ productId: supplier.products[0].id, quantity: 1 }] };
  as("mia", [], [at(bishopstown, ["purchasing.request"])]);
  const own = await actions.saveOrder(null, order, true);
  assert.equal((await actions.decideOrder(own.id!, "approve", "")).ok, false, "not an administrator");
  as("mia", ["staff.manage", "roles.manage", "purchasing.read", "purchasing.request"]);
  assert.equal((await data.purchaseOrder(own.id!)).canApprove, true);
  assert.equal((await actions.decideOrder(own.id!, "approve", "")).ok, true, "an administrator, within their role's limit");
  const log = await fixture.prisma.auditLog.findFirstOrThrow({ where: { entity: "PurchaseOrder", entityId: own.id!, action: "approve" } });
  assert.match(log.summary, /their own order/);
});

test("Home shows each person the orders waiting for their approval, their own rejected ones and raising one", async () => {
  const viewer = (anywhere: string[]) => ({ id: state.id, name: state.id, permissions: anywhere, anywhere, isSuperadmin: false });
  const labels = async (anywhere: string[]) => Object.fromEntries((await homeItems.purchasingHomeItems(viewer(anywhere))).map((i) => [i.label, i.kind === "action" ? "action" : i.count]));
  as("mia", []);
  assert.deepEqual(await homeItems.purchasingHomeItems(viewer([])), [], "no Purchasing level, nothing on Home");
  const supplier = await fixture.prisma.supplier.findFirstOrThrow({ where: { name: "Sample Chemicals" }, include: { products: true } });
  const tablets = supplier.products.find((p) => p.name === "Chlorine tablets")!;
  const order = () => ({ siteId: bishopstown, supplierId: supplier.id, neededBy: "", note: "", lines: [{ productId: tablets.id, quantity: 1 }] });
  as("mia", [], [at(bishopstown, ["purchasing.request"])]);
  const sent = await actions.saveOrder(null, order(), true);
  const turnedDown = await actions.saveOrder(null, order(), true);
  assert.ok(sent.ok && turnedDown.ok);
  const mine = await labels(["purchasing.request"]);
  assert.equal(mine["Raise a purchase order"], "action");
  assert.equal(mine["Purchase orders to approve"], undefined, "never your own to approve");
  as("dan", [], [at(bishopstown, ["purchasing.read"])]);
  const dans = await labels(["purchasing.read"]);
  assert.equal(dans["Purchase orders to approve"], (await data.purchasingHome()).waiting.length);
  assert.ok((dans["Purchase orders to approve"] as number) >= 2, "both are within Dan's limit");
  assert.equal(dans["Raise a purchase order"], undefined, "View does not raise orders");
  as("gina", ["purchasing.read"]);
  assert.equal((await actions.decideOrder(turnedDown.id!, "reject", "Use the larger drum")).ok, true);
  as("mia", [], [at(bishopstown, ["purchasing.request"])]);
  assert.equal((await labels(["purchasing.request"]))["Your rejected orders to change"], 1);
});
