import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createHrTestDatabase } from "@/test/hr-database";
import { serverModule } from "@/test/server-module";
import { digestEmail, kindTally, recipientList, recipientsProblem } from "@/modules/hr/features/digest/rules";

/** The daily email of yesterday's reports: only yesterday's (Dublin) reports,
 *  never withdrawn ones or file notes, by person, once a day, nothing on an
 *  empty day, and only holders of the HR tick set who gets it. Synthetic people only. */
const ORG = "org_test";
let hr: Awaited<ReturnType<typeof createHrTestDatabase>>;
let send: typeof import("../features/digest/server/send");
let settings: typeof import("../features/digest/server/settings");
const outbox: { to: string; subject: string; text: string }[] = [];

before(async () => {
  hr = await createHrTestDatabase();
  const d = {
    "@/modules/hr/shared/database": hr.module,
    "server-only": {},
    "next/cache": { revalidatePath() {} },
    "@/lib/prisma": { prisma: {} },
    "@/lib/authz": { AuthorizationError: class extends Error {}, requireSession: async () => { throw new Error("no session"); } },
    "@/lib/clubs/current": { currentClubId: async () => "site_a" },
    "@/lib/directory": {
      staffByIds: async (ids: string[]) => new Map(ids.map((id) => [id, { id, name: id === "u_ava" ? "Ava Test" : "Ben Test" }])),
      sitesByIds: async (ids: string[]) => new Map(ids.map((id) => [id, { id, name: "Test Pool" }])),
    },
    "@/lib/email/sender": { emailSender: () => ({ sender: "x@example.invalid" }) },
    "@/lib/email/google": { sendGoogleTextEmail: async (to: string, subject: string, text: string) => { outbox.push({ to, subject, text }); } },
  };
  send = serverModule("src/modules/hr/features/digest/server/send.ts", d);
  settings = serverModule("src/modules/hr/features/digest/server/settings.ts", d);
});
after(async () => { await hr?.close(); });

const note = (id: string, subject: string, kind: string, createdAt: string, extra: { via?: string; withdrawn?: boolean } = {}) =>
  hr.db.query(`INSERT INTO notes (id, org_id, subject_user_id, author_id, author_name, visibility, body, kind, via, occurred_at, site_id, created_at, withdrawn_at)
    VALUES ($1,$2,$3,'u_mgr','Manager Test','record',$4,$5,$6,$7,'site_a',$7,$8)`,
    [id, ORG, subject, `Synthetic text ${id}`, kind, extra.via ?? "report", createdAt, extra.withdrawn ? createdAt : null]);

test("addresses are cleaned and checked", () => {
  assert.deepEqual(recipientList("A@x.ie, a@x.ie\nb@y.ie"), ["a@x.ie", "b@y.ie"]);
  assert.match(recipientsProblem(["nope"]) ?? "", /not an email/);
  assert.equal(recipientsProblem([]), null);
  assert.equal(kindTally([{ kind: "conduct" }, { kind: "good_work" }, { kind: "conduct" }]), "1 good work, 2 conduct");
});

test("only holders of the daily reports email tick change the list", async () => {
  await assert.rejects(settings.saveDigestRecipients({ id: "u_mgr", name: "M", orgId: ORG, digest: false }, "me@example.ie"), /Keeps the daily reports email/);
  await assert.rejects(settings.saveDigestRecipients({ id: "u_boss", name: "Boss", orgId: ORG, digest: true }, "bad"), /not an email/);
  await settings.saveDigestRecipients({ id: "u_boss", name: "Boss", orgId: ORG, digest: true }, "me@example.ie\nhr@example.ie");
  assert.deepEqual((await settings.digestSetting(ORG)).to, ["me@example.ie", "hr@example.ie"]);
});

test("sends yesterday's reports by person, once", async () => {
  // Now: 10 Nov 2026 07:00 Dublin (UTC in winter). Yesterday is 9 Nov.
  const now = new Date("2026-11-10T07:00:00Z");
  await note("n1", "u_ben", "conduct", "2026-11-09T09:00:00Z");
  await note("n2", "u_ava", "good_work", "2026-11-09T23:30:00Z");
  await note("n3", "u_ava", "safety", "2026-11-09T00:10:00Z");
  await note("n4", "u_ava", "conduct", "2026-11-08T23:59:00Z"); // the day before
  await note("n5", "u_ava", "conduct", "2026-11-10T00:01:00Z"); // today
  await note("n6", "u_ben", "conduct", "2026-11-09T10:00:00Z", { withdrawn: true });
  await note("n7", "u_ben", "general", "2026-11-09T10:00:00Z", { via: "file" });
  const first = await send.runDailyDigest("https://turnfin.test", now);
  assert.deepEqual(first, { day: "2026-11-09", sent: 1, failed: 0 });
  assert.deepEqual(outbox.map((m) => m.to), ["me@example.ie", "hr@example.ie"]);
  const { subject, text } = outbox[0];
  assert.match(subject, /2 people, 1 good work, 2 issues/);
  for (const id of ["n1", "n2", "n3"]) assert.ok(text.includes(`Synthetic text ${id}`), id);
  for (const id of ["n4", "n5", "n6", "n7"]) assert.ok(!text.includes(`Synthetic text ${id} `) && !text.includes(`Synthetic text ${id}\r`), id);
  assert.ok(text.indexOf("Ava Test") < text.indexOf("Ben Test"));
  assert.ok(text.includes("https://turnfin.test/hr/people/u_ava"));
  const again = await send.runDailyDigest("https://turnfin.test", now);
  assert.equal(again.sent, 0);
  assert.equal(outbox.length, 2);
  assert.equal((await settings.digestSetting(ORG)).last?.reports, 3);
});

test("a day with no reports sends nothing", async () => {
  outbox.length = 0;
  const result = await send.runDailyDigest("https://turnfin.test", new Date("2026-11-13T07:00:00Z"));
  assert.deepEqual(result, { day: "2026-11-12", sent: 0, failed: 0 });
  assert.equal(outbox.length, 0);
});

test("the email reads per person", () => {
  const { text } = digestEmail("2026-11-09", [{ id: "x", subjectUserId: "u1", subject: "Cara Test", kind: "good_work", body: "Line one\nLine two", occurredAt: new Date("2026-11-09T14:20:00Z"), site: "Test Pool", authorName: "Manager Test" }], "https://t.test");
  assert.match(text, /Cara Test: 1 good work/);
  assert.match(text, /Good work · .* · Test Pool · reported by Manager Test/);
  assert.match(text, /    Line two/);
});
