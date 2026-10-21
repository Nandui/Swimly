import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { addDaysIso, today } from "@/lib/format";
import { readEmailParts } from "@/test/email";

/** Swimming courses in the parents app, end to end on an isolated database: Short courses
 *  registers its ticked Pool courses through the seam, adult accounts hold a place for themselves
 *  (making their swimmer record), family accounts for a linked child, and a full course is full.
 *  Invented people only. */
type Router = typeof import("@/modules/activities/features/parents/server/router");
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let router: Router;
const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
const origin = "https://parents.example.test";
const ORG = "org_leisureworld";
let sentCode = "", site = "", adultCourse = "", kidsCourse = "", smallCourse = "";

async function call(path: string, method = "GET", body?: unknown, token = "") {
  const request = new Request(`https://staff.example.test/api/parent/v1/${path}`, { method, headers: { Origin: origin,
    ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return router.handleParentRequest(request, path.split("?")[0].split("/"));
}
async function verify(email: string, kind?: "family" | "adult") {
  const challenge = await (await call("auth/request-code", "POST", { email })).json();
  return call("auth/verify-code", "POST", { challengeId: challenge.challengeId, code: sentCode, ...(kind ? { kind } : {}) });
}
async function signIn(email: string, kind: "family" | "adult", name: string) {
  const response = await verify(email, kind);
  assert.equal(response.status, 200);
  const token = (await response.json()).accessToken as string;
  assert.equal((await call("me", "PATCH", { name, phone: "000 000 0000" }, token)).status, 200);
  return token;
}

before(async () => {
  Object.assign(process.env, {
    PARENT_API_ENABLED: "true", PARENT_AUTH_SECRET: "synthetic-test-secret-at-least-thirty-two-characters", PARENT_API_ALLOWED_ORIGINS: origin,
    PARENT_GOOGLE_CLIENT_ID: "synthetic-client", PARENT_GOOGLE_CLIENT_SECRET: "synthetic-secret", PARENT_GOOGLE_REFRESH_TOKEN: "synthetic-refresh",
    PARENT_EMAIL_FROM: "LeisureWorld Aquatics <no-reply@example.test>",
  });
  globalThis.fetch = async (url, init) => {
    if (url === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "synthetic-access", token_type: "Bearer" });
    const mime = Buffer.from(JSON.parse(String(init?.body)).raw, "base64url").toString("utf8");
    sentCode = /code is (\d{6})/.exec(readEmailParts(mime).find((part) => part.type === "text/plain")!.content.toString("utf8"))![1];
    return Response.json({ id: "synthetic-mail" });
  };
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  site = (await db.club.findFirstOrThrow({ where: { orgId: ORG }, orderBy: { name: "asc" } })).id;
  await db.club.update({ where: { id: site }, data: { phone: "021 000 0000" } });
  await db.user.create({ data: { id: "ray", name: "Ray Example", email: "ray@example.invalid", passwordHash: "unused", orgId: ORG } });
  const type = (name: string, area: string, minAge: number | null) => db.shortCourseType.create({ data: { orgId: ORG, name, area, minAge } });
  const first = addDaysIso(today(), 14);
  const course = async (typeId: string, capacity: number, bookOnline = true) => (await db.shortCourse.create({ data: {
    orgId: ORG, siteId: site, typeId, capacity, priceCents: 6000, instructorId: "ray", createdByName: "Ray Example", bookOnline,
    sessions: { create: [0, 7, 14].map((days) => ({ date: new Date(`${addDaysIso(first, days)}T00:00:00Z`), startMinutes: 19 * 60 + 30, endMinutes: 20 * 60 + 15, place: "Main pool" })) },
  } })).id;
  adultCourse = await course((await type("Synthetic adult beginners", "pool", 18)).id, 5);
  kidsCourse = await course((await type("Synthetic stroke clinic", "pool", 7)).id, 5);
  smallCourse = await course((await type("Synthetic water confidence", "pool", 18)).id, 1);
  await course((await type("Synthetic not ticked", "pool", 18)).id, 5, false);
  await course((await type("Synthetic gym circuits", "gym", 18)).id, 5);

  const doubles = { "@/lib/prisma": { prisma: db }, "next/cache": { revalidatePath() {} }, "server-only": {},
    "@/lib/clubs/current": { currentClubId: async () => site }, "@/lib/authz": { AuthorizationError: class extends Error {}, requirePermission: async () => ({}), canSee: () => true } };
  const contributions = serverModule<typeof import("@/modules/contributions")>("src/modules/contributions.ts", { ...doubles, "@/modules/server": {} });
  serverModule("src/modules/short-courses/module.ts", { ...doubles, "@/modules/contributions": contributions });
  router = serverModule<Router>("src/modules/activities/features/parents/server/router.ts", { ...doubles, "@/modules/contributions": contributions });
});
after(async () => { globalThis.fetch = originalFetch; process.env = originalEnv; await fixture?.close(); });

test("the app lists only ticked Pool courses that have not started, with the site's phone", async () => {
  const response = await call("courses");
  assert.equal(response.status, 200);
  const { items } = await response.json() as { items: { id: string; name: string; forAdults: boolean; full: boolean; site: { phone: string }; sessions: unknown[] }[] };
  assert.deepEqual(items.map((c) => c.name).sort(), ["Synthetic adult beginners", "Synthetic stroke clinic", "Synthetic water confidence"]);
  assert.equal(items.find((c) => c.id === adultCourse)!.forAdults, true);
  assert.equal(items.find((c) => c.id === kidsCourse)!.forAdults, false);
  assert.equal(items[0].site.phone, "021 000 0000");
  assert.equal(items[0].sessions.length, 3);
  assert.equal((await call(`courses/${kidsCourse}`)).status, 200);
  const sites = await (await call("sites")).json() as { items: { id: string; phone: string }[] };
  assert.equal(sites.items.find((s) => s.id === site)!.phone, "021 000 0000");
});

test("an adult account books for themselves, and their first booking makes their swimmer record", async () => {
  const token = await signIn("adult@example.test", "adult", "Sam Example");
  assert.equal((await (await call("me", "GET", undefined, token)).json()).kind, "adult");
  assert.equal((await call("children", "GET", undefined, token)).status, 403, "no children part");
  assert.equal((await call("course-holds", "POST", { courseId: adultCourse }, token)).status, 409, "needs who they are first");
  assert.equal((await call("course-holds", "POST", { courseId: adultCourse, me: { firstName: "Sam", lastName: "Example", dateOfBirth: addDaysIso(today(), -365 * 17) } }, token)).status, 409, "too young");
  assert.equal(await fixture.prisma.student.count({ where: { firstName: "Sam" } }), 0, "a refused booking registers no one");
  const held = await call("course-holds", "POST", { courseId: adultCourse, me: { firstName: "Sam", lastName: "Example", dateOfBirth: "1990-03-12" }, callTimes: ["evening"] }, token);
  assert.equal(held.status, 201);
  const { hold } = await held.json();
  assert.match(hold.reference, /^SC-[A-Z2-9]{5}$/);
  const account = await fixture.prisma.parentAccount.findUniqueOrThrow({ where: { email: "adult@example.test" } });
  const place = await fixture.prisma.shortCourseParticipant.findFirstOrThrow({ where: { courseId: adultCourse } });
  assert.equal(place.swimmerId, account.swimmerId);
  assert.equal(place.source, "online");
  assert.equal(place.payment, "owed");
  assert.ok(place.callBy && place.callBy.getTime() > Date.now() + 71 * 3_600_000);
  assert.equal((await call("course-holds", "POST", { courseId: adultCourse }, token)).status, 409, "not twice");
  assert.equal((await call("course-holds", "POST", { courseId: kidsCourse }, token)).status, 409, "children's courses are for family accounts");
  const me = await (await call("me", "GET", undefined, token)).json();
  assert.deepEqual([me.swimmer.firstName, me.swimmer.dateOfBirth], ["Sam", "1990-03-12"]);
  const mine = await (await call("course-bookings", "GET", undefined, token)).json();
  assert.deepEqual(mine.items.map((b: { name: string; state: string; person: string }) => [b.name, b.state, b.person]), [["Synthetic adult beginners", "to-pay", "Sam"]]);
});

test("one email is one kind of account", async () => {
  const response = await verify("adult@example.test", "family");
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, "ACCOUNT_KIND");
});

test("a family books a linked child onto a course their age fits, never an adult course", async () => {
  const token = await signIn("family@example.test", "family", "Pat Example");
  const child = await fixture.prisma.student.create({ data: { clubId: site, firstName: "Aoife", lastName: "Example", dateOfBirth: new Date("2017-01-10T00:00:00Z") } });
  const young = await fixture.prisma.student.create({ data: { clubId: site, firstName: "Finn", lastName: "Example", dateOfBirth: new Date(`${addDaysIso(today(), -365 * 4)}T00:00:00Z`) } });
  await fixture.prisma.parentChildAccess.createMany({ data: [child, young].map((s) => ({ parentEmail: "family@example.test", studentId: s.id, source: "STAFF" })) });
  assert.equal((await call("course-holds", "POST", { courseId: kidsCourse }, token)).status, 400, "which child");
  assert.equal((await call("course-holds", "POST", { courseId: adultCourse, childId: child.id }, token)).status, 409);
  assert.equal((await call("course-holds", "POST", { courseId: kidsCourse, childId: young.id }, token)).status, 409, "too young");
  assert.equal((await call("course-holds", "POST", { courseId: kidsCourse, childId: child.id }, token)).status, 201);
  const place = await fixture.prisma.shortCourseParticipant.findFirstOrThrow({ where: { courseId: kidsCourse } });
  assert.deepEqual([place.swimmerId, place.name, place.email], [child.id, "Aoife Example", "family@example.test"]);
  const mine = await (await call("course-bookings", "GET", undefined, token)).json();
  assert.deepEqual(mine.items.map((b: { person: string }) => b.person), ["Aoife"]);
});

test("a full course is full, with the centre's phone, and no waiting list", async () => {
  const one = await signIn("first@example.test", "adult", "First Example");
  const two = await signIn("second@example.test", "adult", "Second Example");
  const me = { firstName: "Lee", lastName: "Example", dateOfBirth: "1985-06-01" };
  assert.equal((await call("course-holds", "POST", { courseId: smallCourse, me }, one)).status, 201);
  const full = await call("course-holds", "POST", { courseId: smallCourse, me: { ...me, firstName: "Kim" } }, two);
  assert.equal(full.status, 409);
  assert.match(JSON.stringify(await full.json()), /021 000 0000/);
  assert.equal(await fixture.prisma.shortCourseParticipant.count({ where: { courseId: smallCourse, status: "waiting" } }), 0);
  const listed = await (await call(`courses/${smallCourse}`)).json();
  assert.equal(listed.full, true);
});
