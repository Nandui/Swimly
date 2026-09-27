import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Session } from "next-auth";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import type { MyProvider } from "./types";

/** The My hub: providers only ever return the signed-in person's own items,
 *  and one failing or slow provider never takes the page down. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let hub: typeof import("./hub");
let providers: typeof import("./providers");
const ORG = "org_leisureworld";
const session = (id: string, screens: string[] = ["refunds"]) =>
  ({ user: { id, name: id, orgId: ORG, permissions: ["refunds.request"], screens, roleName: "", roleId: "", home: "calendar" }, expires: "2099-01-01" }) as unknown as Session;

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  const role = await db.staffRole.create({ data: { name: "Hub staff", permissions: ["refunds.request"], screens: ["refunds"] } });
  for (const id of ["ava", "noah"]) await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: role.id, orgId: ORG } });
  const nplq = await db.qualificationType.findFirstOrThrow({ where: { orgId: ORG, name: { startsWith: "National Pool" } } });
  await db.qualification.create({ data: { orgId: ORG, userId: "ava", typeId: nplq.id, issuedOn: new Date("2025-01-01T00:00:00Z"), expiresOn: new Date("2027-01-01T00:00:00Z") } });
  await db.qualification.create({ data: { orgId: ORG, userId: "noah", typeId: nplq.id, issuedOn: new Date("2025-01-01T00:00:00Z") } });
  for (const [id, creatorId, status] of [["r1", "ava", "DRAFT"], ["r2", "noah", "NEEDS_INFORMATION"], ["r3", "ava", "WITHDRAWN"]] as const) {
    await db.refundRequest.create({ data: { id, creatorId, creatorName: creatorId, clubId: "club_bishopstown", clubName: "Bishopstown", status, customerName: `Customer of ${creatorId}` } });
  }
  const doubles = {
    "@/lib/prisma": { prisma: db },
    "server-only": {},
    "@/lib/authz": { canSee: (s: Session, screen: string) => s.user.screens.includes(screen) },
    "@/lib/people/data": { qualificationState: () => "valid" },
  };
  providers = serverModule("src/modules/my/providers.ts", doubles);
  hub = serverModule("src/modules/my/hub.ts", { ...doubles, "@/modules/my/providers": providers });
});
after(async () => { await fixture?.close(); });

test("providers return only the signed-in person's own items", async () => {
  const mine = providers.myProviders().filter((p) => p.id !== "docs.reading");
  const sections = await hub.loadMyHub(session("ava"), mine);
  const text = JSON.stringify(sections);
  assert.ok(text.includes("Customer of ava"));
  assert.equal(text.includes("Customer of noah"), false, "another person's refund request");
  const refunds = sections.find((s) => s.id === "refunds.mine")!;
  assert.ok(refunds.ok && refunds.items.length === 1, "closed requests (withdrawn) are not waiting on anyone");
  const quals = sections.find((s) => s.id === "people.qualifications")!;
  assert.ok(quals.ok && quals.items.length === 1, "only Ava's qualification");
});

test("a section only appears for people it applies to", async () => {
  const mine = providers.myProviders().filter((p) => p.id !== "docs.reading");
  const sections = await hub.loadMyHub(session("ava", []), mine);
  assert.equal(sections.some((s) => s.id === "refunds.mine"), false, "no Refunds screen, no refunds section");
  assert.ok(sections.some((s) => s.id === "people.qualifications"), "own qualifications need no capability");
});

test("a failing or slow provider becomes a 'couldn't load' section; the rest still load", async () => {
  const good: MyProvider = { id: "good", moduleId: "x", title: "Good", empty: "", load: async () => [{ id: "1", title: "One" }] };
  const broken: MyProvider = { id: "broken", moduleId: "x", title: "Broken", empty: "", load: async () => { throw new Error("database down"); } };
  const slow: MyProvider = { id: "slow", moduleId: "x", title: "Slow", empty: "", load: () => new Promise(() => {}) };
  const started = Date.now();
  const sections = await hub.loadMyHub(session("ava"), [good, broken, slow]);
  assert.ok(Date.now() - started < 6000, "the slow provider is cut off");
  assert.deepEqual(sections.map((s) => [s.id, s.ok]), [["good", true], ["broken", false], ["slow", false]]);
});
