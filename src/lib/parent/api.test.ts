import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "../../test/pglite-prisma";
import { serverModule } from "../../test/server-module";
import { nextDublinMidnight } from "./time";

type Router = typeof import("./router");
type Admin = typeof import("./admin");
type Auth = typeof import("./auth");
type Progress = typeof import("./progress");
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let router: Router, admin: Admin, auth: Auth, progress: Progress;
const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
let sentCode = "", emailCalls = 0, actorPermissions = true, actorScreen = true;
let parentToken = "", otherToken = "", childId = "", sessionId = "";
const origin = "https://parents.example.test";

function request(path: string, method = "GET", body?: unknown, token = parentToken, extra: Record<string, string> = {}) {
  return new Request(`https://staff.example.test/api/parent/v1/${path}`, { method, headers: { Origin: origin,
    ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function call(path: string, method = "GET", body?: unknown, token = parentToken, extra: Record<string, string> = {}) {
  return router.handleParentRequest(request(path, method, body, token, extra), path.split("?")[0].split("/"));
}
async function staff(path: string, method = "GET", body?: unknown) {
  return admin.handleParentAdminRequest(new Request(`https://staff.example.test/api/parent-admin/v1/${path}`, { method,
    headers: { Origin: "https://staff.example.test", "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), path.split("?")[0].split("/"));
}
async function signIn(email: string) {
  const response = await call("auth/request-code", "POST", { email }, "");
  assert.equal(response.status, 202);
  const challenge = await response.json();
  const verification = await call("auth/verify-code", "POST", { challengeId: challenge.challengeId, code: sentCode }, "");
  assert.equal(verification.status, 200);
  return { ...(await verification.json()), challengeId: challenge.challengeId, code: sentCode };
}

before(async () => {
  process.env.PARENT_API_ENABLED = "true";
  process.env.PARENT_AUTH_SECRET = "synthetic-test-secret-at-least-thirty-two-characters";
  process.env.PARENT_API_ALLOWED_ORIGINS = origin;
  process.env.PARENT_GOOGLE_CLIENT_ID = "synthetic-client";
  process.env.PARENT_GOOGLE_CLIENT_SECRET = "synthetic-secret";
  process.env.PARENT_GOOGLE_REFRESH_TOKEN = "synthetic-refresh";
  process.env.PARENT_EMAIL_FROM = "Bookly <no-reply@example.test>";
  globalThis.fetch = async (url, init) => {
    if (url === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "synthetic-access", token_type: "Bearer" });
    assert.equal(url, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    emailCalls++;
    const message = JSON.parse(String(init?.body));
    const mime = Buffer.from(message.raw, "base64url").toString("utf8");
    const text = Buffer.from(mime.split("\r\n\r\n")[1], "base64").toString("utf8");
    sentCode = /code is (\d{6})/.exec(text)![1];
    return Response.json({ id: "synthetic-mail" });
  };
  fixture = await isolatedPrisma();
  await fixture.prisma.user.create({ data: { id: "staff", name: "Synthetic Staff", email: "staff@example.test", passwordHash: "unused" } });
  class AuthorizationError extends Error {}
  const doubles = { "@/lib/prisma": { prisma: fixture.prisma }, "@/lib/clubs/current": { currentClubId: async () => "club_bishopstown" },
    "next/cache": { revalidatePath() {} }, "@/lib/authz": { AuthorizationError,
      requirePermission: async () => { if (!actorPermissions) throw new AuthorizationError(); return { user: { id: "staff", name: "Synthetic Staff" } }; }, canSee: () => actorScreen } };
  router = serverModule<Router>("src/lib/parent/router.ts", doubles);
  admin = serverModule<Admin>("src/lib/parent/admin.ts", doubles);
  auth = serverModule<Auth>("src/lib/parent/auth.ts", doubles);
  progress = serverModule<Progress>("src/lib/parent/progress.ts", doubles);
});
after(async () => { globalThis.fetch = originalFetch; process.env = originalEnv; await fixture?.close(); });

test("parent sign-in verifies email, hashes secrets, consumes the code once and creates no staff account", async () => {
  const result = await signIn("  PARENT@example.test ");
  parentToken = result.accessToken;
  assert.equal(result.parent.email, "parent@example.test");
  assert.equal(await fixture.prisma.user.count(), 1);
  const session = await fixture.prisma.parentSession.findFirstOrThrow();
  assert.notEqual(session.tokenHash, parentToken);
  const challenge = await fixture.prisma.parentSignInChallenge.findUniqueOrThrow({ where: { id: result.challengeId } });
  assert.notEqual(challenge.codeHash, result.code);
  assert.equal((await call("auth/verify-code", "POST", { challengeId: result.challengeId, code: result.code }, "")).status, 401);
  assert.equal((await call("me", "PATCH", { name: "Synthetic Parent", phone: "000000000" })).status, 200);
  otherToken = (await signIn("other@example.test")).accessToken;
  await call("me", "PATCH", { name: "Other Synthetic Parent" }, otherToken);
  assert.ok(emailCalls >= 2);
});

test("code guessing is bounded and attempts persist after rejected requests", async () => {
  const challenge = await (await call("auth/request-code", "POST", { email: "attempts@example.test" }, "")).json();
  const right = sentCode, wrong = right === "000000" ? "111111" : "000000";
  for (let n = 0; n < 5; n++) assert.equal((await call("auth/verify-code", "POST", { challengeId: challenge.challengeId, code: wrong }, "")).status, 401);
  assert.equal((await call("auth/verify-code", "POST", { challengeId: challenge.challengeId, code: right }, "")).status, 401);
  assert.equal((await fixture.prisma.parentSignInChallenge.findUniqueOrThrow({ where: { id: challenge.challengeId } })).attempts, 5);
});

test("expired codes and rate-limited emails cannot create sessions or send more mail", async () => {
  const response = await call("auth/request-code", "POST", { email: "expired@example.test" }, "");
  const { challengeId } = await response.json(), code = sentCode;
  await fixture.prisma.parentSignInChallenge.update({ where: { id: challengeId }, data: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await call("auth/verify-code", "POST", { challengeId, code }, "")).status, 401);
  for (let n = 0; n < 5; n++) assert.equal((await call("auth/request-code", "POST", { email: "limited@example.test" }, "")).status, 202);
  const calls = emailCalls;
  const limited = await call("auth/request-code", "POST", { email: "limited@example.test" }, "");
  assert.equal(limited.status, 429); assert.ok(limited.headers.has("retry-after"));
  assert.equal(emailCalls, calls);
});

test("missing configuration and failed email delivery fail closed without publishing codes", async () => {
  process.env.PARENT_API_ENABLED = "false";
  assert.equal((await call("sites", "GET", undefined, "")).status, 503);
  process.env.PARENT_API_ENABLED = "true";
  const refreshToken = process.env.PARENT_GOOGLE_REFRESH_TOKEN;
  const beforeChallenges = await fixture.prisma.parentSignInChallenge.count();
  delete process.env.PARENT_GOOGLE_REFRESH_TOKEN;
  try {
    assert.equal((await call("auth/request-code", "POST", { email: "no-config@example.test" }, "")).status, 503);
    assert.equal(await fixture.prisma.parentSignInChallenge.count(), beforeChallenges);
  } finally { process.env.PARENT_GOOGLE_REFRESH_TOKEN = refreshToken; }
  const workingFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => url === "https://oauth2.googleapis.com/token"
    ? workingFetch(url, init) : new Response(null, { status: 503 });
  try {
    const failed = await call("auth/request-code", "POST", { email: "delivery-failed@example.test" }, "");
    assert.equal(failed.status, 503);
    const body = await failed.text();
    assert.equal(body.includes("challengeId"), false);
    assert.ok((await fixture.prisma.parentSignInChallenge.findFirstOrThrow({ where: { email: "delivery-failed@example.test" } })).usedAt);
  } finally { globalThis.fetch = workingFetch; }
});

test("revoked Google authorization invalidates a challenge without sending mail", async () => {
  const workingFetch = globalThis.fetch;
  const calls = emailCalls;
  globalThis.fetch = async () => Response.json({ error: "invalid_grant" }, { status: 400 });
  try {
    const failed = await call("auth/request-code", "POST", { email: "revoked-google@example.test" }, "");
    assert.equal(failed.status, 503);
    assert.equal((await failed.text()).includes("invalid_grant"), false);
    assert.equal(emailCalls, calls);
    assert.ok((await fixture.prisma.parentSignInChallenge.findFirstOrThrow({ where: { email: "revoked-google@example.test" } })).usedAt);
  } finally { globalThis.fetch = workingFetch; }
});

test("unknown origins, staff cookies and oversized requests cannot bypass the API boundary", async () => {
  const blocked = await call("me", "GET", undefined, parentToken, { Origin: "https://untrusted.example.test" });
  assert.equal(blocked.status, 403); assert.equal(blocked.headers.get("access-control-allow-origin"), null);
  assert.equal((await call("me", "GET", undefined, "", { Cookie: "authjs.session-token=staff-cookie" })).status, 401);
  const preflight = await call("assessment-bookings", "OPTIONS", undefined, "");
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get("access-control-allow-origin"), origin);
  assert.equal(preflight.headers.get("access-control-allow-credentials"), null);
  assert.equal((await call("me", "PATCH", { name: "x".repeat(17000) })).status, 413);
  assert.equal((await call("children/not-yours/progress")).status, 404);
  assert.equal((await call("class-transfers", "POST", {})).status, 404);
});

test("only published future assessments are listed, and a new family can book without an existing swimmer", async () => {
  const programme = await fixture.prisma.programme.create({ data: { name: "Synthetic Swim", clubId: "club_bishopstown" } });
  const level = await fixture.prisma.level.create({ data: { id: "test-level", programmeId: programme.id, name: "Synthetic Level" } });
  await fixture.prisma.competency.create({ data: { id: "test-skill", levelId: level.id, name: "Synthetic Skill" } });
  const tomorrow = new Date(Date.now() + 2 * 86400_000); tomorrow.setUTCHours(0, 0, 0, 0);
  const session = await fixture.prisma.assessmentSession.create({ data: { programmeId: programme.id, clubId: "club_bishopstown", date: tomorrow, startMinutes: 600, capacity: 1 } });
  sessionId = session.id;
  assert.equal((await (await call("assessment-sessions", "GET", undefined, "")).json()).items.length, 0);
  assert.equal((await call(`assessment-sessions/${sessionId}`, "GET", undefined, "")).status, 404);
  assert.equal((await staff(`assessment-sessions/${sessionId}/publication`, "PUT", { enabled: true, reason: "Open synthetic assessment" })).status, 200);
  const listed = await (await call("assessment-sessions", "GET", undefined, "")).json();
  assert.equal(listed.items.length, 1); assert.equal(listed.items[0].spacesAvailable, 1);
  assert.equal((await (await call(`assessment-sessions/${sessionId}`, "GET", undefined, "")).json()).bookable, true);
  const input = { sessionId, newChild: { firstName: "Synthetic", lastName: "Swimmer", dateOfBirth: "2020-01-01" } };
  const booked = await call("assessment-bookings", "POST", input, parentToken, { "Idempotency-Key": "new-child-request-001" });
  assert.equal(booked.status, 201, await booked.clone().text());
  childId = (await booked.json()).booking.childId;
  assert.equal((await (await call(`assessment-sessions/${sessionId}`, "GET", undefined, "")).json()).bookable, false);
  assert.equal(await fixture.prisma.student.count(), 1); assert.equal(await fixture.prisma.enrolment.count(), 0);
  assert.equal(await fixture.prisma.parentChildAccess.count(), 1);
  assert.ok(fixture.queries.some(q => q.includes('"AssessmentSession"') && q.includes("FOR UPDATE")));
  const replay = await call("assessment-bookings", "POST", input, parentToken, { "Idempotency-Key": "new-child-request-001" });
  assert.equal(replay.status, 200); assert.equal((await replay.json()).replayed, true);
  assert.equal(await fixture.prisma.student.count(), 1);
  assert.equal((await call("assessment-bookings", "POST", { ...input, newChild: { ...input.newChild, firstName: "Different" } }, parentToken, { "Idempotency-Key": "new-child-request-001" })).status, 409);
  assert.equal((await call("assessment-bookings", "POST", input, otherToken, { "Idempotency-Key": "other-child-request-001" })).status, 409);
  assert.equal(await fixture.prisma.student.count(), 1, "Full sessions must not leave orphan swimmers");
  assert.ok(await fixture.prisma.auditLog.count({ where: { entity: "AssessmentBooking", action: "book" } }));
});

test("families only read linked children; staff revocation immediately removes profiles, progress and bookings", async () => {
  assert.equal((await (await call("children")).json()).items.length, 1);
  assert.equal((await (await call("children", "GET", undefined, otherToken)).json()).items.length, 0);
  for (const path of [`children/${childId}`, `children/${childId}/progress`, `assessment-bookings?childId=${childId}`]) {
    assert.equal((await call(path, "GET", undefined, otherToken)).status, 404);
  }
  const children = await (await call(`children/${childId}`)).json();
  assert.equal(Object.hasOwn(children, "medicalNotes"), false); assert.equal(Object.hasOwn(children, "contactEmail"), false);
  assert.equal((await staff(`children/${childId}/access`, "DELETE", { email: "parent@example.test", reason: "Synthetic access review" })).status, 200);
  assert.equal((await call(`children/${childId}`)).status, 404);
  assert.equal((await (await call("assessment-bookings")).json()).items.length, 0);
  assert.equal((await call("assessment-bookings", "POST", { sessionId, newChild: { firstName: "Synthetic", lastName: "Swimmer", dateOfBirth: "2020-01-01" } }, parentToken, { "Idempotency-Key": "new-child-request-001" })).status, 404);
  assert.equal((await staff(`children/${childId}/access`, "PUT", { email: "parent@example.test", reason: "Verified guardian again" })).status, 200);
  assert.equal((await call(`children/${childId}`)).status, 200);
});

test("closed, cancelled and archived-site sessions reject bookings and do not create children", async () => {
  const source = await fixture.prisma.assessmentSession.findUniqueOrThrow({ where: { id: sessionId } });
  const initialChildren = await fixture.prisma.student.count();
  for (const condition of ["unpublished", "cutoff", "past", "cancelled", "archived-site"] as const) {
    const site = condition === "archived-site" ? await fixture.prisma.club.create({ data: { name: "Synthetic Archived Site", archivedAt: new Date() } }) : null;
    const session = await fixture.prisma.assessmentSession.create({ data: { programmeId: source.programmeId, clubId: site?.id ?? source.clubId,
      date: condition === "past" ? new Date("2020-01-01T00:00:00Z") : source.date, startMinutes: 600, capacity: 5,
      cancelledAt: condition === "cancelled" ? new Date() : null } });
    if (condition !== "unpublished") await fixture.prisma.parentAssessmentPublication.create({ data: { sessionId: session.id, enabled: true,
      bookingClosesAt: condition === "cutoff" ? new Date(Date.now() - 1000) : null } });
    const response = await call("assessment-bookings", "POST", { sessionId: session.id, newChild: { firstName: "Should", lastName: "Not Exist", dateOfBirth: "2020-01-01" } }, parentToken, { "Idempotency-Key": `closed-condition-${condition}` });
    assert.equal(response.status, 409, condition);
  }
  assert.equal(await fixture.prisma.student.count(), initialChildren);
  assert.equal((await call("assessment-sessions?from=2026-99-99", "GET", undefined, "")).status, 400);
});

test("competing final-seat requests yield one booking and transaction failure rolls back new child and access", async () => {
  const source = await fixture.prisma.assessmentSession.findUniqueOrThrow({ where: { id: sessionId } });
  const session = await fixture.prisma.assessmentSession.create({ data: { programmeId: source.programmeId, clubId: source.clubId, date: source.date, startMinutes: 600, capacity: 1,
    parentPublication: { create: { enabled: true } } } });
  const initialChildren = await fixture.prisma.student.count();
  const makeInput = (name: string) => ({ sessionId: session.id, newChild: { firstName: name, lastName: "Synthetic Race", dateOfBirth: "2020-01-01" } });
  const responses = await Promise.all([
    call("assessment-bookings", "POST", makeInput("First"), parentToken, { "Idempotency-Key": "race-parent-request-001" }),
    call("assessment-bookings", "POST", makeInput("Second"), otherToken, { "Idempotency-Key": "race-parent-request-002" }),
  ]);
  assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]);
  assert.equal(await fixture.prisma.assessmentBooking.count({ where: { sessionId: session.id } }), 1);
  assert.equal(await fixture.prisma.student.count(), initialChildren + 1);
  // PGlite serialises transactions; the query trace additionally verifies the
  // shared PostgreSQL row-lock contract used by staff and parent booking paths.
  const failing = await fixture.prisma.assessmentSession.create({ data: { programmeId: source.programmeId, clubId: source.clubId, date: source.date, startMinutes: 600, capacity: 3,
    parentPublication: { create: { enabled: true } } } });
  const identities = await auth.authenticateParent(request("me"));
  const reservations = serverModule<typeof import("./assessments")>("src/lib/parent/assessments.ts", {
    "@/lib/prisma": { prisma: fixture.prisma }, "next/cache": { revalidatePath() {} }, "@/lib/audit": { logAudit: async () => { throw new Error("Synthetic audit failure"); } },
  });
  const before = [await fixture.prisma.student.count(), await fixture.prisma.parentChildAccess.count(), await fixture.prisma.assessmentBooking.count()];
  await assert.rejects(auth.withParent(identities, (tx, parent) => reservations.reserveAssessment(tx, parent,
    { sessionId: failing.id, newChild: { firstName: "Rollback", lastName: "Synthetic", dateOfBirth: "2020-01-01" } }, "rollback-test-key-001")), /Synthetic audit failure/);
  assert.deepEqual([await fixture.prisma.student.count(), await fixture.prisma.parentChildAccess.count(), await fixture.prisma.assessmentBooking.count()], before);
});

test("progress triggers keep the released state during pending edits and removals, including completion and placement", async () => {
  const now = new Date(), yesterday = new Date(now.getTime() - 2 * 86400_000);
  await fixture.prisma.competencyResult.create({ data: { studentId: childId, competencyId: "test-skill", status: "WORKING_ON", assessedOn: yesterday, assessedByName: "Synthetic Instructor", note: "private note" } });
  const captured = await fixture.prisma.parentProgressEvent.findFirstOrThrow({ where: { studentId: childId, kind: "competency" } });
  assert.equal(captured.releaseAt.toISOString(), nextDublinMidnight(captured.recordedAt).toISOString());
  assert.equal(JSON.stringify(captured.value).includes("private"), false);
  await fixture.prisma.parentProgressEvent.update({ where: { id: captured.id }, data: { recordedAt: yesterday, releaseAt: yesterday } });
  await fixture.prisma.competencyResult.update({ where: { studentId_competencyId: { studentId: childId, competencyId: "test-skill" } }, data: { status: "ACHIEVED" } });
  let released = await progress.releasedEvents(fixture.prisma, childId, now);
  assert.equal((released[0].value as { status: string }).status, "WORKING_ON");
  const response = await call(`children/${childId}/progress`);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(body.programmes[0].levels[0].achieved, 0);
  const tomorrow = new Date(nextDublinMidnight(new Date()).getTime() + 1);
  released = await progress.releasedEvents(fixture.prisma, childId, tomorrow);
  assert.equal((released[0].value as { status: string }).status, "ACHIEVED");
  await fixture.prisma.competencyResult.delete({ where: { studentId_competencyId: { studentId: childId, competencyId: "test-skill" } } });
  released = await progress.releasedEvents(fixture.prisma, childId, tomorrow);
  assert.equal(released[0].value, null);
  assert.equal((await progress.releasedEvents(fixture.prisma, childId, now))[0].value !== null, true);
  const level = await fixture.prisma.level.findUniqueOrThrow({ where: { id: "test-level" } });
  await fixture.prisma.levelCompletion.create({ data: { studentId: childId, levelId: level.id, programmeId: level.programmeId, completedOn: yesterday, competenciesAchieved: 1, competencyCount: 1, confirmedByName: "Synthetic Instructor", overrideReason: "private" } });
  const booking = await fixture.prisma.assessmentBooking.findFirstOrThrow();
  await fixture.prisma.assessmentBooking.update({ where: { id: booking.id }, data: { outcomeLevelId: level.id, assessedOn: yesterday, outcomeNote: "private assessment note" } });
  const futureEvents = await progress.releasedEvents(fixture.prisma, childId, tomorrow);
  assert.equal(futureEvents.filter(e => e.kind === "completion").length, 1);
  assert.equal(futureEvents.filter(e => e.kind === "assessment").length, 1);
  assert.equal(JSON.stringify(futureEvents.map(e => e.value)).includes("private"), false);
  assert.equal((await progress.releasedEvents(fixture.prisma, childId, now)).filter(e => e.kind !== "competency").length, 0);
});

test("staff permissions, workspace boundaries, same-origin checks and parent account suspension are enforced", async () => {
  actorPermissions = false;
  assert.equal((await staff(`children/${childId}/access`)).status, 403);
  actorPermissions = true; actorScreen = false;
  assert.equal((await staff(`children/${childId}/access`)).status, 403);
  actorScreen = true;
  assert.equal((await admin.handleParentAdminRequest(request(`children/${childId}/access`), ["children", childId, "access"])).status, 403);
  const parent = await fixture.prisma.parentAccount.findUniqueOrThrow({ where: { email: "parent@example.test" } });
  assert.equal((await staff(`accounts/${parent.id}`, "PATCH", { isActive: false, reason: "Synthetic suspension test" })).status, 200);
  assert.equal((await call("children")).status, 401);
  assert.equal((await staff(`accounts/${parent.id}`, "PATCH", { isActive: true, reason: "Synthetic reactivation test" })).status, 200);
  assert.equal((await call("children")).status, 401, "Reactivation cannot revive revoked tokens");
  const identity = await auth.authenticateParent(request("me", "GET", undefined, otherToken));
  await auth.logout(identity);
  assert.equal((await call("me", "GET", undefined, otherToken)).status, 401);
});

test("Dublin midnight publication handles both daylight-saving changes", async () => {
  for (const [saved, expected] of [
    ["2026-09-14T10:00:00Z", "2026-09-14T23:00:00.000Z"],
    ["2026-03-29T00:30:00Z", "2026-03-29T23:00:00.000Z"],
    ["2026-10-25T00:30:00Z", "2026-10-26T00:00:00.000Z"],
    ["2026-09-14T23:00:00Z", "2026-09-15T23:00:00.000Z"],
  ]) {
    assert.equal(nextDublinMidnight(new Date(saved)).toISOString(), expected);
    const result = await fixture.db.query<{ release: string }>("SELECT parent_progress_release_at($1::timestamp)::text AS release", [saved.replace("Z", "")]);
    assert.equal(new Date(result.rows[0].release.replace(" ", "T") + "Z").toISOString(), expected);
  }
});
