import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";

/** The Legend steps: processed marks billing notified and waits to restore; restored ends it;
 *  each needs billing.notify at this site. The price list needs swim school Manage. Invented rows. */
function fixture() {
  type Row = { id: string; clubId: string; courseId: string; className: string; date: Date; billingNotifiedAt: Date | null; legendProcessedAt: Date | null; restoredAt: Date | null };
  const rows: Row[] = [
    { id: "c1", clubId: "site", courseId: "k1", className: "Turtles", date: new Date("2026-10-01"), billingNotifiedAt: null, legendProcessedAt: null, restoredAt: null },
    { id: "c2", clubId: "other", courseId: "k2", className: "Seals", date: new Date("2026-10-01"), billingNotifiedAt: null, legendProcessedAt: null, restoredAt: null },
  ];
  const prices = [{ id: "p1", name: "Swimming Skills", monthlyCents: null as number | null }];
  const audits: string[] = [];
  let held: string[] = ["billing.notify"];
  const match = (r: Row, where: Record<string, unknown>) => Object.entries(where).every(([k, v]) => {
    const value = r[k as keyof Row];
    if (k === "id") return (v as { in: string[] }).in.includes(r.id);
    if (v === null) return value === null;
    if (typeof v === "object" && v && "not" in v) return value !== null;
    return value === v;
  });
  const db = {
    classCancellation: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => rows.filter((r) => match(r, where)),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Row> }) => { for (const r of rows.filter((x) => match(x, where))) Object.assign(r, data); },
    },
    legendAgreementPrice: {
      findUnique: async ({ where }: { where: { id: string } }) => prices.find((p) => p.id === where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: { monthlyCents: number | null } }) => Object.assign(prices.find((p) => p.id === where.id)!, data),
    },
  };
  const actions = serverModule<typeof import("./billing-actions")>("src/modules/activities/lib/cancellations/billing-actions.ts", {
    "@/lib/prisma": { prisma: { ...db, $transaction: async (run: (tx: typeof db) => Promise<unknown>) => run(db) } },
    "@/lib/authz": { requirePermission: async (key: string) => { if (!held.includes(key)) throw Error("denied"); return { user: { id: "u", name: "Billing Example" } }; }, canSee: () => true, AuthorizationError: Error },
    "@/lib/clubs/current": { currentClubId: async () => "site" },
    "@/lib/audit": { logAudit: async (row: { action: string }) => { audits.push(row.action); } },
    "next/cache": { revalidatePath: () => {} },
  });
  return { actions, rows, prices, audits, hold: (keys: string[]) => { held = keys; } };
}

test("processed, then restored, only for this site's classes in that stage", async () => {
  const f = fixture();
  assert.equal((await f.actions.markRestored({ ids: ["c1"] })).ok, false, "not processed yet");
  assert.equal((await f.actions.markLegendProcessed({ ids: ["c1", "c2"] })).ok, true);
  assert.ok(f.rows[0].legendProcessedAt && f.rows[0].billingNotifiedAt, "processed is billing notified");
  assert.equal(f.rows[1].legendProcessedAt, null, "another site's class is left alone");
  assert.equal((await f.actions.markLegendProcessed({ ids: ["c1"] })).ok, false, "already processed");
  assert.equal((await f.actions.markRestored({ ids: ["c1"] })).ok, true);
  assert.ok(f.rows[0].restoredAt);
  assert.deepEqual(f.audits, ["billing-notified", "billing-restored"]);
});

test("the price list needs swim school Manage and takes euros", async () => {
  const f = fixture();
  await assert.rejects(f.actions.saveLegendPrice({ id: "p1", price: "45" }), /denied/);
  f.hold(["curriculum.manage"]);
  assert.equal((await f.actions.saveLegendPrice({ id: "p1", price: "abc" })).ok, false);
  assert.equal((await f.actions.saveLegendPrice({ id: "p1", price: "€45.50" })).ok, true);
  assert.equal(f.prices[0].monthlyCents, 4550);
  assert.equal((await f.actions.saveLegendPrice({ id: "p1", price: "" })).ok, true);
  assert.equal(f.prices[0].monthlyCents, null, "empty clears it");
});
