import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { parentAdminFixture } from "../../test/parent-admin-fixture";
import { bookingDeadline, dublinDateTimeInput, saveParentAdmin } from "./admin-client";

let f: Awaited<ReturnType<typeof parentAdminFixture>>;
before(async () => { f = await parentAdminFixture(); });
after(async () => { await f?.close(); });
beforeEach(() => {
  f.state.permissions = new Set(["parents.manage", "courses.manage"]);
  f.state.screens = new Set(["students", "assessments"]);
  f.state.clubId = "club_bishopstown"; f.state.failAudit = false;
});
const reason = "Verified with the guardian at the desk";

test("requires the named permission and matching desk screen on every management route", async () => {
  const routes = [
    ["children/demo-swimmer-0/access", "PUT", { email: "denied@example.test", reason }, "parents.manage", "students"],
    ["accounts/demo-parent", "PATCH", { isActive: false, reason }, "parents.manage", "students"],
    ["assessment-sessions/demo-assessment/publication", "PUT", { enabled: true, reason }, "courses.manage", "assessments"],
  ] as const;
  const count = await f.prisma.auditLog.count();
  for (const [path, method, body, permission, screen] of routes) {
    f.state.permissions.delete(permission);
    assert.equal((await f.call(path, method, body)).status, 403);
    f.state.permissions.add(permission); f.state.screens.delete(screen);
    assert.equal((await f.call(path, method, body)).status, 403);
    f.state.screens.add(screen);
  }
  f.state.screens = new Set(["instructor"]);
  assert.equal((await f.call("accounts?email=parent%40example.test")).status, 403);
  assert.equal((await f.call("children/demo-swimmer-0/access")).status, 403);
  assert.equal(await f.prisma.auditLog.count(), count);
});

test("rejects cross-origin, missing-origin, bearer-token and empty-reason mutations", async () => {
  for (const headers of [{ Origin: "https://elsewhere.example.test" }, { Origin: "" }, { Authorization: "Bearer synthetic" }] as Record<string, string>[]) {
    assert.equal((await f.call("children/demo-swimmer-0/access", "PUT", { email: "denied@example.test", reason }, headers)).status, 403);
  }
  assert.equal((await f.call("children/demo-swimmer-0/access", "PUT", { email: "denied@example.test", reason: "  " })).status, 400);
  assert.equal(await f.prisma.parentChildAccess.count(), 0);
});

test("contact emails grant no access; explicit approval works across sites and is audited", async () => {
  assert.deepEqual(await (await f.call("children/demo-swimmer-0/access")).json(), { items: [] });
  for (const id of ["demo-swimmer-0", "demo-swimmer-1"]) {
    assert.equal((await f.call(`children/${id}/access`, "PUT", { email: "  PARENT@example.test  ", reason })).status, 200);
    const response = await f.call(`children/${id}/access`);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const { items } = await response.json();
    assert.equal(items[0].parentEmail, "parent@example.test");
    assert.equal(items[0].revokedAt, null);
  }
  const rows = await f.prisma.auditLog.findMany({ where: { entity: "ParentChildAccess" } });
  assert.equal(rows.length, 2);
  assert.ok(rows.every(row => row.clubId === null && row.actorId === "demo-staff" && row.summary.includes(reason)));
});

test("revoke affects only the selected swimmer and restoration reuses the approval", async () => {
  const path = "children/demo-swimmer-0/access";
  await f.call(path, "DELETE", { email: "parent@example.test", reason });
  const revoked = await f.prisma.parentChildAccess.findFirstOrThrow({ where: { studentId: "demo-swimmer-0" } });
  assert.ok(revoked.revokedAt);
  assert.equal((await f.prisma.parentChildAccess.findFirstOrThrow({ where: { studentId: "demo-swimmer-1" } })).revokedAt, null);
  await f.call(path, "PUT", { email: "parent@example.test", reason });
  const restored = await f.prisma.parentChildAccess.findUniqueOrThrow({ where: { id: revoked.id } });
  assert.equal(restored.revokedAt, null);
  assert.equal(await f.prisma.parentChildAccess.count(), 2);
});

test("account lookup is exact; suspension revokes sessions and reactivation does not restore them", async () => {
  assert.equal((await f.call("accounts?email=parent")).status, 400);
  assert.deepEqual(await (await f.call("accounts?email=unknown%40example.test")).json(), { account: null });
  const { account } = await (await f.call("accounts?email=PARENT%40example.test")).json();
  assert.equal(account.id, "demo-parent");
  await f.call("accounts/demo-parent", "PATCH", { isActive: false, reason });
  assert.equal((await f.prisma.parentAccount.findUniqueOrThrow({ where: { id: account.id } })).isActive, false);
  assert.ok((await f.prisma.parentSession.findFirstOrThrow()).revokedAt);
  await f.call("accounts/demo-parent", "PATCH", { isActive: true, reason });
  assert.equal((await f.prisma.parentAccount.findUniqueOrThrow({ where: { id: account.id } })).isActive, true);
  assert.ok((await f.prisma.parentSession.findFirstOrThrow()).revokedAt);
});

test("audit failure rolls back approval, suspension and publication", async () => {
  f.state.failAudit = true;
  const before = await f.prisma.auditLog.count();
  for (const [path, method, body] of [
    ["children/demo-swimmer-0/access", "PUT", { email: "rollback@example.test", reason }],
    ["accounts/demo-parent", "PATCH", { isActive: false, reason }],
    ["assessment-sessions/demo-assessment/publication", "PUT", { enabled: true, reason }],
  ] as const) assert.equal((await f.call(path, method, body)).status, 500);
  assert.equal(await f.prisma.parentChildAccess.count({ where: { parentEmail: "rollback@example.test" } }), 0);
  assert.equal((await f.prisma.parentAccount.findUniqueOrThrow({ where: { id: "demo-parent" } })).isActive, true);
  assert.equal(await f.prisma.parentAssessmentPublication.count(), 0);
  assert.equal(await f.prisma.auditLog.count(), before);
});

test("publishing respects the working site, validates deadlines and preserves existing bookings when unpublished", async () => {
  const path = "assessment-sessions/demo-assessment/publication";
  f.state.clubId = "club_churchfield";
  assert.equal((await f.call(path)).status, 404);
  assert.equal((await f.call(path, "PUT", { enabled: true, reason })).status, 404);
  f.state.clubId = "club_bishopstown";
  assert.equal((await (await f.call(path)).json()).canPublish, true);
  for (const bookingClosesAt of ["2000-01-01T00:00:00Z", "2200-01-01T00:00:00Z"]) {
    assert.equal((await f.call(path, "PUT", { enabled: true, bookingClosesAt, reason })).status, 400);
  }
  const deadline = bookingDeadline(`${f.session.date.toISOString().slice(0, 10)}T15:00`);
  const published = await (await f.call(path, "PUT", { enabled: true, bookingClosesAt: deadline, reason })).json();
  assert.equal(published.visibleToParents, true);
  assert.equal(published.bookingClosesAt, deadline);
  await f.prisma.assessmentBooking.create({ data: { sessionId: f.session.id, studentId: "demo-swimmer-0", bookedByName: "Alex Example" } });
  const unpublished = await (await f.call(path, "PUT", { enabled: false, reason })).json();
  assert.equal(unpublished.visibleToParents, false);
  assert.equal(unpublished.bookingClosesAt, deadline);
  assert.equal(await f.prisma.assessmentBooking.count(), 1);
});

test("publishing cannot promise visibility for archived curriculum or cancelled sessions", async () => {
  const path = "assessment-sessions/demo-assessment/publication";
  await f.prisma.programme.update({ where: { id: "demo-programme" }, data: { archivedAt: new Date() } });
  assert.equal((await (await f.call(path)).json()).canPublish, false);
  assert.equal((await f.call(path, "PUT", { enabled: true, reason })).status, 400);
  await f.prisma.programme.update({ where: { id: "demo-programme" }, data: { archivedAt: null } });
  await f.prisma.assessmentSession.update({ where: { id: f.session.id }, data: { cancelledAt: new Date() } });
  assert.equal((await (await f.call(path)).json()).canPublish, false);
  assert.equal((await f.call(path, "PUT", { enabled: true, reason })).status, 400);
  assert.equal((await f.call(path, "PUT", { enabled: false, reason })).status, 200);
});

test("Ireland deadlines ignore the device timezone and reject invalid or missing spring-clock times", () => {
  assert.equal(bookingDeadline("2027-07-20T15:30"), "2027-07-20T14:30:00.000Z");
  assert.equal(bookingDeadline("2027-01-20T15:30"), "2027-01-20T15:30:00.000Z");
  assert.equal(dublinDateTimeInput("2027-07-20T14:30:00.000Z"), "2027-07-20T15:30");
  assert.equal(bookingDeadline(""), null);
  for (const value of ["2027-02-30T10:00", "2027-03-28T01:30", "2027-07-20T24:00", "2027-07-20T12:60"]) assert.throws(() => bookingDeadline(value));
});

test("a whitespace audit reason never sends a mutation", async () => {
  const result = await saveParentAdmin("accounts/demo-parent", "PATCH", { isActive: false, reason: "   " });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.fieldErrors?.reason);
});
