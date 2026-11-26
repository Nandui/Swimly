import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, beforeEach, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";

/** The classes API end to end, against the real tables: another app's key, the timetable it
 *  may read and the one write, which lands on the rota's plan. Invented classes and people. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let handle: (request: Request, path: string[]) => Promise<Response>;
const KEY = "tfc_synthetic-key-for-the-scheduler-0001", OTHER = "tfc_synthetic-key-for-another-app-0002";
const hash = (key: string) => createHash("sha256").update(key).digest("hex");
const date = (iso: string) => new Date(`${iso}T00:00:00Z`);
// 7 December 2026 is a Monday.
const MON = "2026-12-07", TUE = "2026-12-08", NEXT = "2026-12-14";
const audits: Array<{ actorId?: string | null; actorName: string; summary: string; clubId?: string | null }> = [];
let teachers = ["tess", "cole", "tess-two"];

function call(method: string, path: string, { key = KEY, body, headers = {} }: { key?: string | null; body?: unknown; headers?: Record<string, string> } = {}) {
  const [route, search = ""] = path.split("?");
  return handle(new Request(`https://turnfin.example/api/classes/v1/${route}${search ? `?${search}` : ""}`, {
    method, headers: { ...(key ? { authorization: `Bearer ${key}` } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), route.split("/"));
}

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  await db.staffRole.create({ data: { id: "r-teach", name: "Teacher", permissions: ["attendance.mark"], screens: [] } });
  await db.staffRole.create({ data: { id: "r-desk", name: "Desk", permissions: [], screens: [] } });
  const people = [["tess", "Tess Example", "r-teach"], ["cole", "Cole Example", "r-teach"], ["tess-two", "Tess Example", "r-teach"], ["dana", "Dana Example", "r-desk"]];
  for (const [id, name, staffRoleId] of people) await db.user.create({ data: { id, name, email: `${id}@example.invalid`, staffRoleId, orgId: "org_leisureworld" } });
  await db.programme.create({ data: { id: "api-programme", clubId: "club_churchfield", name: "Synthetic swimming" } });
  await db.level.create({ data: { id: "api-level", programmeId: "api-programme", name: "Turtles" } });
  await db.course.create({ data: { id: "api-mon", clubId: "club_churchfield", levelId: "api-level", dayOfWeek: "MONDAY", startMinutes: 910, durationMinutes: 30, instructorId: "tess", location: "Learner pool" } });
  await db.course.create({ data: { id: "api-mon-late", clubId: "club_churchfield", levelId: "api-level", name: "Turtles plus", dayOfWeek: "MONDAY", startMinutes: 945, durationMinutes: 30 } });
  await db.course.create({ data: { id: "api-tue", clubId: "club_churchfield", levelId: "api-level", dayOfWeek: "TUESDAY", startMinutes: 1020, durationMinutes: 30 } });
  await db.course.create({ data: { id: "api-gone", clubId: "club_churchfield", levelId: "api-level", dayOfWeek: "MONDAY", startMinutes: 600, durationMinutes: 30, archivedAt: new Date() } });
  await db.classCover.create({ data: { courseId: "api-mon", date: date(NEXT), coverById: "cole", coverByName: "Cole Example" } });
  await db.classCancellation.create({ data: { courseId: "api-tue", clubId: "club_churchfield", date: date(TUE), className: "Turtles", levelName: "Turtles", programmeName: "Synthetic swimming", startMinutes: 1020, durationMinutes: 30,
    reason: "Synthetic pool closure", cancelledById: "tess", cancelledByName: "Tess Example" } });
  const name = (id: string) => people.find((p) => p[0] === id)![1];
  ({ handleClassesRequest: handle } = serverModule<{ handleClassesRequest: typeof handle }>("src/modules/activities/features/classes-api/server/router.ts", {
    "@/lib/prisma": { prisma: db },
    "server-only": {},
    "@/lib/audit": { logAudit: async (row: (typeof audits)[number]) => { audits.push(row); } },
    "@/lib/apps/switches": { sitesWhereOn: async (_app: string, ids: string[]) => ids },
    "@/lib/directory": {
      liveSites: async () => [{ id: "club_churchfield", name: "Churchfield" }, { id: "club_bishopstown", name: "Bishopstown" }],
      staffByIds: async (ids: (string | null)[]) => new Map(ids.filter((id): id is string => !!id && people.some((p) => p[0] === id)).map((id) => [id, { id, name: name(id) }])),
      activeStaffHolding: async () => teachers.map((id) => ({ id, name: name(id), jobTitle: "never sent" })),
      activeStaffAccess: async (ids: string[]) => ids.map((id) => ({ id, name: name(id), email: `${id}@Example.invalid`, isActive: true, rolePermissions: [] })),
    },
  }));
});
after(async () => { await fixture?.close(); });
beforeEach(async () => {
  process.env.CLASSES_API_ENABLED = "true";
  process.env.CLASSES_API_KEYS = `Staff scheduler:${hash(KEY)}, Other app:${hash(OTHER)}`;
  audits.length = 0;
  teachers = ["tess", "cole", "tess-two"];
  await fixture.prisma.$executeRawUnsafe(`DELETE FROM "ParentRateLimit"`);
});

test("off unless enabled with well-formed keys; a bad entry switches it all off", async () => {
  process.env.CLASSES_API_ENABLED = "false";
  assert.equal((await call("GET", "classes")).status, 503);
  process.env.CLASSES_API_ENABLED = "true";
  process.env.CLASSES_API_KEYS = `Staff scheduler:${hash(KEY)},Broken:not-a-hash`;
  assert.equal((await call("GET", "classes")).status, 503);
  process.env.CLASSES_API_KEYS = `Staff scheduler:${hash(KEY)},staff scheduler:${hash(OTHER)}`;
  assert.equal((await call("GET", "classes")).status, 503, "one name, two keys");
  process.env.CLASSES_API_KEYS = "";
  assert.equal((await call("GET", "classes")).status, 503);
});

test("needs an app's key; a browser origin is refused; a key taken off the list stops working", async () => {
  assert.equal((await call("GET", "classes", { key: null })).status, 401);
  const wrong = await call("GET", "classes", { key: "tfc_not-a-key-anyone-was-given-0000000" });
  assert.equal(wrong.status, 401);
  assert.deepEqual(await wrong.json(), { error: { code: "UNAUTHORIZED", message: "Send this app's key as a Bearer token." } });
  assert.equal((await call("GET", "classes", { headers: { origin: "https://elsewhere.example" } })).status, 403);
  assert.equal((await call("GET", "classes", { key: OTHER })).status, 200);
  process.env.CLASSES_API_KEYS = `Staff scheduler:${hash(KEY)}`;
  assert.equal((await call("GET", "classes", { key: OTHER })).status, 401, "revoked");
  const ok = await call("GET", "classes");
  assert.equal(ok.headers.get("cache-control"), "no-store");
  assert.equal(ok.headers.get("access-control-allow-origin"), null);
});

test("classes: each lesson with its time, name, programme and that day's instructor, and nothing else", async () => {
  const response = await call("GET", `classes?from=${MON}&days=2`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { from: MON, days: 2, classes: [
    { id: "api-mon", date: MON, day: "MONDAY", start: "15:10", end: "15:40", durationMinutes: 30, name: "Turtles", programme: "Synthetic swimming", level: "Turtles", location: "Learner pool",
      site: { id: "club_churchfield", name: "Churchfield" }, started: false, instructor: null },
    { id: "api-mon-late", date: MON, day: "MONDAY", start: "15:45", end: "16:15", durationMinutes: 30, name: "Turtles plus", programme: "Synthetic swimming", level: "Turtles", location: null,
      site: { id: "club_churchfield", name: "Churchfield" }, started: false, instructor: null },
  ] }, "the stored instructor no longer counts, the archived class and Tuesday's cancelled lesson are left out");
  const started = (await (await call("GET", `classes?from=${NEXT}&days=1`)).json()).classes[0];
  assert.deepEqual([started.id, started.started, started.instructor], ["api-mon", true, { id: "cole", name: "Cole Example" }]);
  assert.deepEqual((await (await call("GET", `classes?from=${MON}&days=1&site=club_bishopstown`)).json()).classes, []);
  assert.equal((await call("GET", "classes?days=40")).status, 400);
  assert.equal((await call("GET", "classes?from=2026-02-31")).status, 400);
  assert.equal((await (await call("GET", "classes")).json()).days, 7);
});

test("sites and instructors: ids and names only", async () => {
  assert.deepEqual(await (await call("GET", "sites")).json(), { sites: [{ id: "club_churchfield", name: "Churchfield" }, { id: "club_bishopstown", name: "Bishopstown" }] });
  teachers = ["tess", "cole"];
  assert.deepEqual(await (await call("GET", "instructors")).json(), { instructors: [{ id: "tess", name: "Tess Example" }, { id: "cole", name: "Cole Example" }] });
});

test("assigning writes the rota's plan, in the app's name, by id, email or name", async () => {
  const byId = await call("PUT", "classes/api-mon/instructor", { body: { date: MON, instructorId: "cole" } });
  assert.equal(byId.status, 200);
  assert.deepEqual((await byId.json()).class.instructor, { id: "cole", name: "Cole Example" });
  const row = await fixture.prisma.classPlannedTeacher.findUniqueOrThrow({ where: { courseId_date: { courseId: "api-mon", date: date(MON) } } });
  assert.deepEqual([row.teacherId, row.teacherName, row.setById, row.setByName], ["cole", "Cole Example", null, "Staff scheduler (API)"]);
  assert.deepEqual(audits.map((a) => [a.actorId, a.actorName, a.clubId, a.summary]), [[null, "Staff scheduler (API)", "club_churchfield", `Planned Turtles on ${MON} with Cole Example`]]);

  const byEmail = await call("PUT", "classes/api-mon/instructor", { body: { date: MON, instructorEmail: "TESS@example.invalid" } });
  assert.deepEqual((await byEmail.json()).class.instructor, { id: "tess", name: "Tess Example" });
  const byName = await call("PUT", "classes/api-mon-late/instructor", { key: OTHER, body: { date: MON, instructorName: "  cole   example " } });
  assert.deepEqual((await byName.json()).class.instructor, { id: "cole", name: "Cole Example" });
  assert.equal(audits.at(-1)!.actorName, "Other app (API)");

  const nobody = await call("PUT", "classes/api-mon/instructor", { body: { date: MON, instructorId: null } });
  assert.equal((await nobody.json()).class.instructor, null);
  assert.equal(await fixture.prisma.classPlannedTeacher.count({ where: { courseId: "api-mon" } }), 1, "one plan per lesson, replaced each time");
});

test("refused: someone who cannot teach, a shared name, and lessons that cannot be planned", async () => {
  const put = async (path: string, body: unknown) => { const r = await call("PUT", path, { body }); return [r.status, (await r.json()).error?.code]; };
  assert.deepEqual(await put("classes/api-mon/instructor", { date: MON, instructorId: "dana" }), [422, "INSTRUCTOR_NOT_FOUND"], "the desk cannot take a register");
  assert.deepEqual(await put("classes/api-mon/instructor", { date: MON, instructorName: "Nobody Example" }), [422, "INSTRUCTOR_NOT_FOUND"]);
  assert.deepEqual(await put("classes/api-mon/instructor", { date: MON, instructorName: "Tess Example" }), [409, "INSTRUCTOR_AMBIGUOUS"]);
  assert.deepEqual(await put("classes/api-mon/instructor", { date: TUE, instructorId: "cole" }), [409, "CANNOT_ASSIGN"], "a Monday class on a Tuesday");
  assert.deepEqual(await put("classes/api-tue/instructor", { date: TUE, instructorId: "cole" }), [409, "CANNOT_ASSIGN"], "cancelled");
  assert.deepEqual(await put("classes/api-mon/instructor", { date: NEXT, instructorId: "tess" }), [409, "CANNOT_ASSIGN"], "started");
  assert.deepEqual(await put("classes/api-gone/instructor", { date: MON, instructorId: "cole" }), [404, "NOT_FOUND"], "archived");
  assert.deepEqual(await put("classes/api-nothing/instructor", { date: MON, instructorId: "cole" }), [404, "NOT_FOUND"]);
  assert.deepEqual(await put("classes/api-mon/instructor", { date: MON }), [400, "INVALID_REQUEST"]);
  assert.deepEqual(await put("classes/api-mon/instructor", { date: MON, instructorId: "cole", instructorName: "Cole Example" }), [400, "INVALID_REQUEST"]);
  assert.deepEqual(await put("classes/api-mon/instructor", { date: MON, instructorId: "cole", extra: true }), [400, "INVALID_REQUEST"]);
  assert.equal((await call("POST", "classes/api-mon/instructor", { body: {} })).status, 405);
  assert.equal((await call("GET", "swimmers")).status, 404);
  assert.equal(audits.length, 0, "nothing was written");
});

test("each app is limited to 120 requests a minute", async () => {
  for (let at = 0; at < 120; at++) assert.equal((await call("GET", "sites")).status, 200);
  const limited = await call("GET", "sites");
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");
  assert.equal((await call("GET", "sites", { key: OTHER })).status, 200, "the other app has its own count");
});

test("the contract handed to the outside developer names exactly the routes that answer", async () => {
  const { readFileSync } = await import("node:fs");
  const spec = JSON.parse(readFileSync("docs/classes-api.openapi.json", "utf8")) as { paths: Record<string, Record<string, unknown>> };
  assert.deepEqual(Object.entries(spec.paths).map(([path, methods]) => `${Object.keys(methods).join(",")} ${path}`).sort(),
    ["get /classes", "get /instructors", "get /sites", "put /classes/{id}/instructor"]);
  for (const path of Object.keys(spec.paths)) {
    const route = path.slice(1).replace("{id}", "api-mon");
    const response = path.includes("{id}") ? await call("PUT", route, { body: { date: MON, instructorId: null } }) : await call("GET", route);
    assert.equal(response.status, 200, path);
  }
});
