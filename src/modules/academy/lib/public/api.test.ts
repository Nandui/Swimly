import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { today } from "@/lib/format";

/** Academy online booking end to end on an isolated database (owner decision, 8 October 2026):
 *  the booking site reads only courses put online that have not started, never staff names; an
 *  email checked with a code holds a place within the places and the minimum age; and staff see
 *  who to phone, log calls, and take payment. Invented people only. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let router: typeof import("./router");
let actions: typeof import("../actions");
let data: typeof import("../data");
const ORG = "org_leisureworld";
const origin = "https://academy.example.test";
const originalEnv = { ...process.env };
const sent: { email: string; code: string }[] = [];
const held: { email: string; reference: string }[] = [];
let site = "", onlineCourse = "", staffOnlyCourse = "", startedCourse = "";
const state = { permissions: ["academy.read"] as string[] };
class Denied extends Error {}

const plusDays = (n: number) => { const d = new Date(`${today()}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d; };

function call(path: string, method = "GET", body?: unknown, token = "", headers: Record<string, string> = {}) {
  const request = new Request(`https://work.example.test/api/academy/v1/${path}`, { method, headers: {
    Origin: origin, ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers,
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return router.handleAcademyRequest(request, path.split("/"));
}
async function checkEmail(email: string) {
  const challenge = await (await call("auth/request-code", "POST", { email })).json();
  const res = await call("auth/verify-code", "POST", { challengeId: challenge.challengeId, code: sent.at(-1)!.code });
  assert.equal(res.status, 200);
  return (await res.json()).token as string;
}
const booking = (over: Record<string, unknown> = {}) => ({
  courseId: onlineCourse, name: "Candidate A", phone: "087 000 0000", dateOfBirth: "2000-03-14", callTimes: ["afternoon"], ...over,
});

before(async () => {
  Object.assign(process.env, {
    ACADEMY_API_ENABLED: "true", ACADEMY_AUTH_SECRET: "test-only-academy-secret-0000000000000000", ACADEMY_API_ALLOWED_ORIGINS: origin,
  });
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  site = (await db.club.findFirstOrThrow({ where: { orgId: ORG }, orderBy: { name: "asc" } })).id;
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  await db.user.create({ data: { id: "desk", name: "Desk B", email: "desk@example.invalid", staffRoleId: "r-staff", orgId: ORG, siteIds: [site] } });
  await db.user.create({ data: { id: "tutor", name: "Tutor Secret Name", email: "tutor@example.invalid", staffRoleId: "r-staff", orgId: ORG, siteIds: [site] } });
  const type = await db.academyCourseType.create({ data: { orgId: ORG, name: "Synthetic NPLQ", kind: "lifeguard", minAge: 16, checks: ["age", "swim"], awardingBody: "Synthetic body" } });
  const course = (bookOnline: boolean, first: number, capacity = 2) => db.academyCourse.create({ data: {
    orgId: ORG, siteId: site, typeId: type.id, capacity, priceCents: 39500, tutorId: "tutor", bookOnline, createdByName: "Test",
    sessions: { create: [{ date: plusDays(first), startMinutes: 540, endMinutes: 1020, place: "Main pool" }, { date: plusDays(first + 1), startMinutes: 540, endMinutes: 1020 }] },
  } });
  onlineCourse = (await course(true, 30)).id;
  staffOnlyCourse = (await course(false, 30)).id;
  startedCourse = (await course(true, 0)).id;
  const d = {
    "@/lib/prisma": { prisma: db },
    "@/lib/clubs/current": { currentClubId: async () => site, currentClubIdIfAny: async () => site },
    "@/modules/academy/lib/public/email": {
      sendCode: async (email: string, code: string) => { sent.push({ email, code }); },
      sendHeld: async (email: string, details: { reference: string }) => { held.push({ email, reference: details.reference }); },
    },
  };
  router = serverModule("src/modules/academy/lib/public/router.ts", d);
  const session = () => ({ user: { id: "desk", name: "Desk B", orgId: ORG, isSuperadmin: false, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions,
    screens: ["academy"], primaryScreens: ["academy"], grants: [], authMethod: "password", authAt: Date.now() } });
  const staff = {
    ...d,
    "@/lib/authz": {
      AuthorizationError: class AuthorizationError extends Error {},
      requireSession: async () => session(),
      requirePermission: async (p: PermissionKey) => { if (!expandPermissions(state.permissions).has(p)) throw new Denied(p); return session(); },
      can: (s: { user: { permissions: string[] } }, p: PermissionKey) => expandPermissions(s.user.permissions).has(p),
      canSee: () => true,
    },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { notFound: () => { throw new Error("not found"); } },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
  };
  actions = serverModule("src/modules/academy/lib/actions.ts", staff);
  data = serverModule("src/modules/academy/lib/data.ts", staff);
});
after(async () => { process.env = originalEnv; await fixture?.close(); });

test("the API is off without its settings, and only the booking site's origin may call it", async () => {
  const secret = process.env.ACADEMY_AUTH_SECRET;
  process.env.ACADEMY_AUTH_SECRET = "short";
  assert.equal((await call("courses")).status, 503);
  process.env.ACADEMY_AUTH_SECRET = secret;
  const denied = await call("courses", "GET", undefined, "", { Origin: "https://elsewhere.example.test" });
  assert.equal(denied.status, 403);
  const ok = await call("courses");
  assert.equal(ok.headers.get("Access-Control-Allow-Origin"), origin);
  assert.equal(ok.headers.get("Cache-Control"), "no-store");
});

test("the booking site sees only courses put online that have not started, and never staff", async () => {
  const res = await call("courses");
  const text = await res.clone().text();
  const { courses } = await res.json();
  assert.deepEqual(courses.map((c: { id: string }) => c.id), [onlineCourse], "not the staff-only course, not the one that started today");
  assert.equal(courses[0].placesLeft, 2);
  assert.equal(courses[0].price, "€395.00");
  assert.deepEqual(courses[0].checks, ["Swim test"], "age is said as the minimum age instead");
  assert.doesNotMatch(text, /Tutor Secret Name|tutor@example/, "no staff names or emails");
  assert.equal((await call(`courses/${staffOnlyCourse}`)).status, 404);
  assert.equal((await call(`courses/${startedCourse}`)).status, 404);
});

test("holding a place needs an email checked with a code", async () => {
  assert.equal((await call("bookings", "POST", booking())).status, 401);
  const challenge = await (await call("auth/request-code", "POST", { email: "Candidate.A@Example.test" })).json();
  assert.equal(sent.at(-1)!.email, "candidate.a@example.test");
  const wrong = sent.at(-1)!.code === "000000" ? "111111" : "000000";
  assert.equal((await call("auth/verify-code", "POST", { challengeId: challenge.challengeId, code: wrong })).status, 401);
  const right = await call("auth/verify-code", "POST", { challengeId: challenge.challengeId, code: sent.at(-1)!.code });
  assert.equal(right.status, 200);
  assert.equal((await call("auth/verify-code", "POST", { challengeId: challenge.challengeId, code: sent.at(-1)!.code })).status, 401, "a code works once");
});

test("a place is held within the places and the minimum age, owed, with 72 hours to phone", async () => {
  const token = await checkEmail("candidate.a@example.test");
  const young = await call("bookings", "POST", booking({ dateOfBirth: today() }), token);
  assert.equal(young.status, 422);
  assert.equal((await call("bookings", "POST", booking({ phone: "12" }), token)).status, 400, "a phone number we can call");
  const res = await call("bookings", "POST", booking({ phone2: "021 000 0000" }), token);
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.match(body.reference, /^AC-[A-Z2-9]{5}$/);
  const row = await fixture.prisma.academyCandidate.findFirstOrThrow({ where: { reference: body.reference } });
  assert.deepEqual([row.source, row.payment, row.status, row.email, row.phone2, row.callTimes], ["online", "owed", "booked", "candidate.a@example.test", "021 000 0000", ["afternoon"]]);
  assert.equal(row.callBy!.getTime() - row.createdAt.getTime(), 72 * 3_600_000);
  assert.deepEqual(held.at(-1), { email: "candidate.a@example.test", reference: body.reference }, "they are emailed the details");
  assert.equal((await call("bookings", "POST", booking(), token)).status, 409, "one place per email on a course");
  const audit = await fixture.prisma.auditLog.findFirstOrThrow({ where: { entity: "AcademyCandidate", entityId: row.id } });
  assert.equal(audit.module, "Academy");

  const other = await checkEmail("candidate.b@example.test");
  assert.equal((await call("bookings", "POST", booking({ name: "Candidate B" }), other)).status, 201);
  const third = await checkEmail("candidate.c@example.test");
  const full = await call("bookings", "POST", booking({ name: "Candidate C" }), third);
  assert.equal(full.status, 409);
  assert.equal((await full.json()).error.code, "FULL");
  const { courses } = await (await call("courses")).json();
  assert.equal(courses[0].placesLeft, 0, "still listed, as full");
});

test("staff see who to phone, soonest first, and every Academy level can log a call", async () => {
  state.permissions = ["academy.read"];
  const before = await data.toCall();
  assert.deepEqual(before.people.map((p) => p.name), ["Candidate A", "Candidate B"]);
  assert.equal(before.people[0].due, "later");
  const late = await data.toCall(new Date(Date.now() + 73 * 3_600_000));
  assert.equal(late.overdue, 2, "past 72 hours");

  const [a, b] = before.people;
  assert.equal((await actions.logCall(a.id, { outcome: "paid", amount: "" })).ok, false, "paid needs the amount");
  assert.equal((await actions.logCall(a.id, { outcome: "no-answer" })).ok, true);
  assert.equal((await actions.logCall(a.id, { outcome: "paid", amount: "100", receipt: "T-1" })).ok, true);
  const deposit = await fixture.prisma.academyCandidate.findUniqueOrThrow({ where: { id: a.id }, include: { calls: true } });
  assert.deepEqual([deposit.payment, deposit.paidCents, deposit.calls.length], ["deposit", 10000, 2], "less than the price is a deposit");
  assert.equal((await actions.logCall(b.id, { outcome: "not-going-ahead", note: "Changed plans" })).ok, true);
  assert.equal((await fixture.prisma.academyCandidate.findUniqueOrThrow({ where: { id: b.id } })).status, "withdrawn");
  assert.deepEqual((await data.toCall()).people, [], "a deposit and a withdrawal both leave the list");
  const { courses } = await (await call("courses")).json();
  assert.equal(courses[0].placesLeft, 1, "the place is free again online");
  const audit = await fixture.prisma.auditLog.findMany({ where: { entity: "AcademyCall" } });
  assert.equal(audit.length, 3);
  assert.ok(audit.every((r) => r.module === "Academy" && r.actorName === "Desk B"));
});
