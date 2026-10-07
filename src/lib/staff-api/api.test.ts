import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { createHrTestDatabase } from "@/test/hr-database";
import { createDocsTestDatabase } from "@/test/docs-database";
import { serverModule } from "@/test/server-module";
import { paragraph } from "@/lib/docs/content";
import type { DocumentContent } from "@/lib/docs/types";

/** The staff API behind Turnfin Me, against real (in-memory) Postgres for the
 *  main, HR and Docs databases. It signs staff in by email code only, returns
 *  only the caller's own records through allowlisted responses, keeps HR
 *  behind a fresh code, and changes nothing until reviewers act on Work. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let hr: Awaited<ReturnType<typeof createHrTestDatabase>>;
let docs: Awaited<ReturnType<typeof createDocsTestDatabase>>;
let router: typeof import("./router");
const ORG = "org_leisureworld";
const origin = "https://me.example.test";
const originalEnv = { ...process.env };
const sent: { email: string; code: string; purpose: string }[] = [];
let rileyToken = "", avaAssignment = "", rileyAssignment = "", sharedReview = "", assignedDoc = "", otherDoc = "";

function call(path: string, method = "GET", body?: unknown, token = rileyToken, extra: Record<string, string> = {}) {
  const request = new Request(`https://work.example.test/api/staff/v1/${path}`, { method, headers: {
    Origin: origin, ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra,
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return router.handleStaffRequest(request, path.split("?")[0].split("/"));
}
async function signIn(email: string) {
  const before = sent.length;
  const res = await call("auth/request-code", "POST", { email }, ""); const challenge = await res.json();
  assert.equal(sent.length, before + 1, `a code was sent to ${email} (${res.status} ${JSON.stringify(challenge)})`);
  const response = await call("auth/verify-code", "POST", { challengeId: challenge.challengeId, code: sent.at(-1)!.code }, "");
  assert.equal(response.status, 200);
  return (await response.json()).accessToken as string;
}
const docContent = (title: string): DocumentContent => ({
  schemaVersion: 1, title, reference: `SOP-${randomUUID().slice(0, 6)}`, type: "SOP", summary: "Synthetic procedure.", ownerId: "jamie",
  facilityIds: ["harbour"], teamIds: ["aquatics"], reviewDate: "2027-09-16", body: { type: "doc", content: [paragraph("Check the pool before opening.")] },
  riskRows: [], riskMatrix: null, attachments: [], relatedIds: [],
});

before(async () => {
  Object.assign(process.env, { STAFF_API_ENABLED: "true", STAFF_AUTH_SECRET: "synthetic-staff-secret-at-least-thirty-two-chars", STAFF_API_ALLOWED_ORIGINS: origin, DOCS_DATABASE_URL: "postgres://unused/docs" });
  fixture = await isolatedPrisma();
  hr = await createHrTestDatabase();
  docs = await createDocsTestDatabase();
  const db = fixture.prisma;
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: ["docs.read"], screens: ["docs"] } });
  for (const [id, active] of [["riley", true], ["ava", true], ["noah", false]] as const) {
    await db.user.create({ data: { id, name: `${id} example`, email: `${id}@example.test`, staffRoleId: "r-staff", orgId: ORG, isActive: active, phone: "000 000" } });
  }
  await db.qualificationType.create({ data: { id: "qt-life", orgId: ORG, name: "Synthetic lifeguard", validityMonths: 24 } });
  const course = await db.trainingCourse.create({ data: { orgId: ORG, title: "Synthetic safeguarding", content: "Read the policy.", requiresSignoff: false, grantsTypeId: "qt-life" } });
  rileyAssignment = (await db.trainingAssignment.create({ data: { orgId: ORG, courseId: course.id, userId: "riley", assignedByName: "Maya" } })).id;
  avaAssignment = (await db.trainingAssignment.create({ data: { orgId: ORG, courseId: course.id, userId: "ava", assignedByName: "Maya" } })).id;
  const club = await db.club.findFirstOrThrow({ where: { orgId: ORG } });
  const tomorrow = new Date(); tomorrow.setUTCHours(0, 0, 0, 0); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  // The rota: both on tomorrow's lifeguarding, in a week shared with the pool's staff.
  await db.department.create({ data: { id: "d-pool", orgId: ORG, name: "Pool", clubId: club.id } });
  await db.activityType.create({ data: { id: "t-guard", orgId: ORG, departmentId: "d-pool", name: "Lifeguarding", icon: "lifeguard" } });
  const lifeguarding = await db.rotaNeed.create({ data: { orgId: ORG, siteId: club.id, date: tomorrow, typeId: "t-guard", place: "Main pool", startMinutes: 420, endMinutes: 900, places: 2, createdByName: "Maya" } });
  for (const [place, userId] of [[1, "riley"], [2, "ava"]] as const) await db.rotaAssignment.create({ data: { needId: lifeguarding.id, place, userId, startMinutes: 420, endMinutes: 900, createdByName: "Maya" } });
  const monday = new Date(tomorrow); monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  await db.rotaWeekShare.create({ data: { siteId: club.id, departmentId: "d-pool", monday, sharedByName: "Maya" } });
  // HR: one note shared with Riley, one private; one shared review.
  for (const [visibility, body] of [["subject", "Synthetic thanks for covering"], ["private", "Synthetic private observation"]]) {
    await hr.db.query("INSERT INTO notes (id, org_id, subject_user_id, author_id, author_name, visibility, body) VALUES ($1,$2,'riley','maya','Maya',$3,$4)", [randomUUID(), ORG, visibility, body]);
  }
  sharedReview = randomUUID();
  await hr.db.query("INSERT INTO reviews (id, org_id, subject_user_id, reviewer_id, reviewer_name, period, status, summary, shared_at) VALUES ($1,$2,'riley','maya','Maya','2026 review','shared','Synthetic summary',now())", [sharedReview, ORG]);
  // Docs: two published documents; only one is assigned to Riley.
  const { DocumentService } = await import("@/lib/docs/domain");
  const service = new DocumentService(docs);
  const publish = async (title: string) => {
    const id = await service.create("jamie", docContent(title));
    const lock = randomUUID(), draft = await service.lock("jamie", id, lock);
    const submission = await service.submit("jamie", id, lock, draft!.revision, "sam", "Release");
    await service.review("sam", id, submission, "approved", "");
    return id;
  };
  assignedDoc = await publish("Opening checks");
  otherDoc = await publish("Plant room");
  await service.assign("jamie", assignedDoc, ["riley"], [], "2020-01-01");

  const doubles = {
    "@/lib/prisma": { prisma: db },
    "@/lib/staff-api/email": { sendStaffCode: async (email: string, code: string, purpose: string) => { sent.push({ email, code, purpose }); } },
    "@/lib/hr/database": hr.module,
    "@/lib/docs/runtime-database": { directoryDatabase: () => docs },
    "@/lib/authz": { requireSession: async () => { throw new Error("no Work session in the staff API"); } },
    "@/lib/clubs/current": { currentClubIdIfAny: async () => null, currentClubId: async () => club.id },
    // No swim classes: the swim school is not part of the staff API.
    "@/modules/server": { commitmentsFor: async () => [] },
    "server-only": {},
  };
  router = serverModule("src/lib/staff-api/router.ts", doubles);
  rileyToken = await signIn("riley@example.test");
});
after(async () => { process.env = originalEnv; await docs?.close(); await hr?.close(); await fixture?.close(); });

test("codes go only to active staff, are single-use, and tokens are stored hashed", async () => {
  const before = sent.length;
  for (const email of ["nobody@example.test", "noah@example.test"]) {
    const response = await call("auth/request-code", "POST", { email }, "");
    assert.equal(response.status, 202, "the same answer for unknown and inactive addresses");
  }
  assert.equal(sent.length, before, "no code for unknown or deactivated accounts");
  const challenge = await (await call("auth/request-code", "POST", { email: "ava@example.test" }, "")).json();
  const code = sent.at(-1)!.code;
  const wrong = code === "000000" ? "111111" : "000000";
  assert.equal((await call("auth/verify-code", "POST", { challengeId: challenge.challengeId, code: wrong }, "")).status, 401);
  assert.equal((await call("auth/verify-code", "POST", { challengeId: challenge.challengeId, code }, "")).status, 200);
  assert.equal((await call("auth/verify-code", "POST", { challengeId: challenge.challengeId, code }, "")).status, 401, "single use");
  const sessions = await fixture.prisma.staffSession.findMany();
  assert.ok(sessions.every((s) => s.tokenHash !== rileyToken));
  assert.equal((await call("home", "GET", undefined, "")).status, 401);
  assert.equal((await call("home", "GET", undefined, rileyToken, { Origin: "https://evil.example.test" })).status, 403);
});

test("every endpoint returns only the caller's own records, with no work data", async () => {
  const training = await (await call("training")).json();
  assert.deepEqual(training.items.map((t: { id: string }) => t.id), [rileyAssignment]);
  assert.equal((await call(`training/${avaAssignment}`)).status, 404, "another person's training");
  assert.equal((await call(`training/${avaAssignment}/complete`, "POST", {})).status, 404);
  const shifts = await (await call("shifts")).json();
  assert.equal(shifts.items.length, 1);
  assert.deepEqual(shifts.items[0].blocks.map((b: { kind: string; label: string; place: string }) => [b.kind, b.label, b.place]), [["activity", "Lifeguarding", "Main pool"]]);
  assert.equal(shifts.items[0].breaksToArrange, 60, "eight hours straight: no free time for the breaks they are owed");
  const home = await (await call("home")).json();
  const encoded = JSON.stringify([home, training, shifts, await (await call("me")).json()]);
  for (const leak of ["ava", "permissions", "screens", "passwordHash", "Synthetic summary", "Synthetic thanks"]) assert.equal(encoded.includes(leak), false, `no ${leak}`);
  assert.equal(home.reviewsToAcknowledge, 1, "a count only; HR content needs a fresh code");
});

test("completing own training records the qualification it grants", async () => {
  const done = await (await call(`training/${rileyAssignment}/complete`, "POST", { note: "Read it" })).json();
  assert.equal(done.state, "completed");
  assert.equal((await call(`training/${rileyAssignment}/complete`, "POST", {})).status, 409);
  const quals = await (await call("qualifications")).json();
  assert.deepEqual(quals.items.map((q: { name: string }) => q.name), ["Synthetic lifeguard"]);
});

test("HR needs a fresh code; only what is shared appears; the person acknowledges their review", async () => {
  const locked = await call("hr");
  assert.equal(locked.status, 403);
  assert.equal((await locked.json()).error.code, "CONFIRM_REQUIRED");
  const challenge = await (await call("auth/confirm", "POST", {})).json();
  assert.equal(sent.at(-1)!.purpose, "confirm");
  assert.equal((await call("auth/confirm/verify", "POST", { challengeId: challenge.challengeId, code: sent.at(-1)!.code })).status, 200);
  const record = await (await call("hr")).json();
  assert.deepEqual(record.notes.map((n: { body: string }) => n.body), ["Synthetic thanks for covering"], "never the private note");
  assert.equal(record.reviews[0].status, "shared");
  const acknowledged = await (await call(`hr/reviews/${sharedReview}/acknowledge`, "POST", { comment: "Thanks" })).json();
  assert.equal(acknowledged.reviews[0].status, "acknowledged");
  assert.ok((await hr.db.query("SELECT 1 FROM access_events WHERE actor_id='riley'")).length >= 1, "reading your own HR record is logged");
});

test("details changes and certificates change nothing until reviewed on Work", async () => {
  assert.equal((await call("me", "PATCH", { phone: "111 222" })).status, 201);
  assert.equal((await fixture.prisma.user.findUniqueOrThrow({ where: { id: "riley" } })).phone, "000 000", "unchanged until applied");
  assert.equal((await call("me", "PATCH", { phone: "333" })).status, 409, "one request at a time");
  assert.equal((await call("me", "PATCH", { email: "new@example.test" })).status, 400, "only listed fields");
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]).toString("base64");
  assert.equal((await call("qualifications/evidence", "POST", { typeId: "qt-life", fileName: "cert.png", mime: "image/png", data: Buffer.from("not an image").toString("base64") })).status, 400);
  assert.equal((await call("qualifications/evidence", "POST", { typeId: "qt-life", fileName: "cert.png", mime: "image/png", data: png })).status, 201);
  assert.equal(await fixture.prisma.qualification.count({ where: { userId: "riley", note: { not: { contains: "Training" } } } }), 0, "no qualification until verified");
  const quals = await (await call("qualifications")).json();
  assert.equal(quals.uploads[0].status, "PENDING");
});

test("required reading: only assigned documents open, and acknowledging completes it", async () => {
  const list = await (await call("reading")).json();
  assert.deepEqual(list.items.map((r: { documentId: string }) => r.documentId), [assignedDoc]);
  assert.equal(list.items[0].overdue, true);
  assert.equal((await call(`reading/${otherDoc}`)).status, 404, "not assigned");
  const doc = await (await call(`reading/${assignedDoc}`)).json();
  assert.equal(doc.title, "Opening checks");
  assert.equal(doc.body.type, "doc");
  const done = await (await call(`reading/${assignedDoc}/acknowledge`, "POST", { versionId: doc.versionId })).json();
  assert.ok(done.acknowledgedAt);
  assert.equal(done.status, "completed");
});

test("deactivating an account ends its sessions at once", async () => {
  const token = await signIn("ava@example.test");
  assert.equal((await call("home", "GET", undefined, token)).status, 200);
  await fixture.prisma.user.update({ where: { id: "ava" }, data: { isActive: false } });
  assert.equal((await call("home", "GET", undefined, token)).status, 401);
  assert.ok((await fixture.prisma.staffSession.findMany({ where: { userId: "ava" } })).every((s) => s.revokedAt));
});

test("the API is off unless enabled", async () => {
  process.env.STAFF_API_ENABLED = "false";
  try { assert.equal((await call("home")).status, 503); } finally { process.env.STAFF_API_ENABLED = "true"; }
});
