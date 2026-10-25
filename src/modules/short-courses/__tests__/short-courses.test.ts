import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { addDaysIso, today } from "@/lib/format";

/** Short courses end to end on an isolated database: the course list, a course at a site with
 *  its weekly sessions made, the sessions on the Rota's seam, booking within the places, the
 *  waiting list, a register, and the audit trail. Invented people only. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let actions: typeof import("../features/courses/server/actions") & typeof import("../features/course-types/server/actions");
let data: typeof import("../features/courses/server/data");
let contributions: typeof import("@/modules/contributions");
let directory: import("@/modules/contributions").MemberDirectory;
const ORG = "org_leisureworld";
type GrantRow = { roleName: string; permissions: string[]; screens: string[]; scopeKind: string; scopeId: string };
const state = { id: "nora", permissions: [] as string[], grants: [] as GrantRow[] };
let bishopstown = "", churchfield = "";
class Denied extends Error {}
class NotFound extends Error {}

function session() {
  return { user: { id: state.id, name: state.id, orgId: ORG, isSuperadmin: false, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions,
    screens: ["short-courses"], primaryScreens: ["short-courses"], grants: state.grants, authMethod: "password", authAt: Date.now() } };
}
const as = (id: string, permissions: string[], grants: GrantRow[] = []) => Object.assign(state, { id, permissions, grants });
const at = (siteId: string, permissions: string[]): GrantRow => ({ roleName: "Site", permissions, screens: ["short-courses"], scopeKind: "site", scopeId: siteId });

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  const clubs = await db.club.findMany({ where: { orgId: ORG }, orderBy: { name: "asc" } });
  bishopstown = clubs.find((c) => c.name.includes("Bishopstown"))!.id;
  churchfield = clubs.find((c) => c.name.includes("Churchfield"))!.id;
  await db.siteArea.create({ data: { orgId: ORG, siteId: bishopstown, name: "Gym floor" } });
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  for (const id of ["nora", "ray", "desk"]) await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: "r-staff", orgId: ORG, siteIds: [bishopstown] } });
  const d = {
    "@/lib/prisma": { prisma: db },
    "@/lib/authz": {
      AuthorizationError: class AuthorizationError extends Error {},
      requireSession: async () => session(),
      requirePermission: async (p: PermissionKey) => { if (!expandPermissions(state.permissions).has(p)) throw new Denied(p); return session(); },
      can: (s: { user: { permissions: string[] } }, p: PermissionKey) => expandPermissions(s.user.permissions).has(p),
      canSee: () => true,
    },
    "@/lib/clubs/current": { currentClubId: async () => bishopstown, currentClubIdIfAny: async () => bishopstown },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { notFound: () => { throw new NotFound("not found"); } },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
  };
  contributions = serverModule<typeof import("@/modules/contributions")>("src/modules/contributions.ts", { ...d, "@/modules/server": {} });
  serverModule("src/modules/short-courses/module.ts", { ...d, "@/modules/contributions": contributions });
  const withSeam = { ...d, "@/modules/contributions": contributions };
  actions = { ...serverModule<object>("src/modules/short-courses/features/course-types/server/actions.ts", d), ...serverModule<object>("src/modules/short-courses/features/courses/server/actions.ts", withSeam) } as typeof actions;
  data = serverModule("src/modules/short-courses/features/courses/server/data.ts", withSeam);
  directory = serverModule<typeof import("@/modules/activities/features/students/server/members")>("src/modules/activities/features/students/server/members.ts", d).memberDirectory;
});
after(async () => { await fixture?.close(); });

let courseId = "";
const first = today();

test("the course list and putting a course on need Manage, at the course's site; its weekly sessions are made", async () => {
  as("nora", ["short-courses.run"]);
  await assert.rejects(actions.saveCourseType(null, { name: "Synthetic Couch to 5k", area: "gym", weeks: 8, sessionMinutes: 60 }), Denied, "Instructor does not keep the list");
  as("nora", ["short-courses.manage"]);
  assert.equal((await actions.saveCourseType(null, { name: "Synthetic Couch to 5k", area: "gym", weeks: 8, sessionMinutes: 60, minAge: "16", healthForm: true })).ok, true);
  const type = await fixture.prisma.shortCourseType.findFirstOrThrow({ where: { name: "Synthetic Couch to 5k" } });
  const input = { siteId: bishopstown, typeId: type.id, capacity: 2, price: "90", instructorId: "ray", firstDay: first, weeks: 6, start: "18:30", end: "19:30", place: "Gym floor" };
  as("nora", [], [at(churchfield, ["short-courses.manage"])]);
  assert.equal((await actions.saveCourse(null, input)).ok, false, "not their site");
  as("nora", [], [at(bishopstown, ["short-courses.manage"])]);
  assert.equal((await actions.saveCourse(null, { ...input, place: "Nowhere" })).ok, false, "one of the site's areas");
  assert.equal((await actions.saveCourse(null, { ...input, end: "18:00" })).ok, false, "ends after it starts");
  const made = await actions.saveCourse(null, input);
  assert.equal(made.ok, true);
  courseId = made.id!;
  const sessions = await fixture.prisma.shortCourseSession.findMany({ where: { courseId }, orderBy: { date: "asc" } });
  assert.deepEqual(sessions.map((s) => s.date.toISOString().slice(0, 10)), [0, 1, 2, 3, 4, 5].map((w) => addDaysIso(first, w * 7)));
  assert.ok(sessions.every((s) => s.startMinutes === 1110 && s.endMinutes === 1170 && s.place === "Gym floor"));
  assert.equal((await fixture.prisma.auditLog.findFirstOrThrow({ where: { entity: "ShortCourse" } })).module, "Short courses");
});

test("sessions reach the Rota through the commitments seam, for the instructor, named for the module", async () => {
  const seen = await contributions.commitmentsFor({ siteIds: [bishopstown], from: first, to: addDaysIso(first, 7) });
  assert.deepEqual(seen.map((c) => [c.source, c.userId, c.date, c.place, c.module]), [
    ["short-courses.sessions", "ray", first, "Gym floor", "Short courses"],
    ["short-courses.sessions", "ray", addDaysIso(first, 7), "Gym floor", "Short courses"],
  ]);
});

test("View books people within the places, then onto the waiting list; a withdrawal frees a place for the first waiting", async () => {
  as("desk", [], [at(churchfield, ["short-courses.read"])]);
  assert.equal((await actions.saveParticipant(courseId, null, { name: "Pat Example" })).ok, false, "not their site");
  as("desk", [], [at(bishopstown, ["short-courses.read"])]);
  assert.equal((await actions.saveParticipant(courseId, null, { name: "Young Example", dateOfBirth: addDaysIso(first, -365 * 12) })).ok, false, "the course is for 16 and over");
  assert.equal((await actions.saveParticipant(courseId, null, { name: "Pat Example", phone: "000 0000", payment: "paid" })).ok, true);
  assert.equal((await actions.saveParticipant(courseId, null, { name: "Sam Example", payment: "deposit", paid: "30" })).ok, true);
  assert.equal((await actions.saveParticipant(courseId, null, { name: "Lee Example" })).ok, false, "full: the desk is told to use the waiting list");
  assert.equal((await actions.saveParticipant(courseId, null, { name: "Lee Example", waiting: true })).ok, true);
  assert.equal((await actions.saveParticipant(courseId, null, { name: "Kai Example", waiting: true })).ok, true);
  const [pat, lee] = await Promise.all(["Pat Example", "Lee Example"].map((name) => fixture.prisma.shortCourseParticipant.findFirstOrThrow({ where: { courseId, name } })));
  assert.equal(pat.paidCents, 9000, "paid with no amount is the full price");
  assert.equal(lee.status, "waiting");
  assert.equal((await actions.setPlace(lee.id, "booked")).ok, false, "no place free yet");
  assert.equal((await actions.setPlace(pat.id, "withdrawn")).ok, true);
  assert.equal((await actions.setPlace(lee.id, "booked")).ok, true);
  const view = await data.shortCourse(courseId);
  assert.deepEqual(view.booked.map((p) => p.name).sort(), ["Lee Example", "Sam Example"]);
  assert.deepEqual(view.waiting.map((p) => p.name), ["Kai Example"]);
  assert.equal(view.booked.find((p) => p.name === "Sam Example")!.owed, 6000);
});

test("Instructor takes the register on the day; View cannot", async () => {
  const session = await fixture.prisma.shortCourseSession.findFirstOrThrow({ where: { courseId }, orderBy: { date: "asc" } });
  const later = await fixture.prisma.shortCourseSession.findFirstOrThrow({ where: { courseId }, orderBy: { date: "desc" } });
  const sam = await fixture.prisma.shortCourseParticipant.findFirstOrThrow({ where: { courseId, name: "Sam Example" } });
  as("desk", [], [at(bishopstown, ["short-courses.read"])]);
  assert.equal((await actions.takeRegister(session.id, [sam.id])).ok, false);
  as("ray", [], [at(bishopstown, ["short-courses.run"])]);
  assert.equal((await actions.takeRegister(later.id, [sam.id])).ok, false, "not before the day");
  assert.equal((await actions.takeRegister(session.id, [sam.id])).ok, true);
  const view = await data.shortCourse(courseId);
  assert.equal(view.booked.find((p) => p.name === "Sam Example")!.attended, 1);
  assert.equal(view.booked.find((p) => p.name === "Lee Example")!.attended, 0, "marked absent, not missing");
  assert.equal(await fixture.prisma.shortCourseAttendance.count({ where: { sessionId: session.id } }), 2);
});

test("with the swim school on, a booking is someone on the swimmer records, picked or added there", async () => {
  contributions.registerMemberDirectory(directory);
  as("nora", ["short-courses.manage"]);
  assert.equal((await actions.saveCourseType(null, { name: "Synthetic Adult swim", area: "pool", weeks: 6, sessionMinutes: 45 })).ok, true);
  const type = await fixture.prisma.shortCourseType.findFirstOrThrow({ where: { name: "Synthetic Adult swim" } });
  const made = await actions.saveCourse(null, { siteId: bishopstown, typeId: type.id, capacity: 3, price: "60", instructorId: "ray", firstDay: first, weeks: 6, start: "19:00", end: "19:45", place: "Gym floor" });
  const id = made.id!;
  const known = await fixture.prisma.student.create({ data: { clubId: bishopstown, memberNumber: "SYN-1001", firstName: "Robin", lastName: "Example", contactPhone: "000 1111", contactEmail: "robin@example.invalid", medicalNotes: "Synthetic: carries an inhaler" } });
  const ada = { firstName: "Ada", lastName: "Example", dateOfBirth: "1990-05-01", memberNumber: "", contactName: "", contactEmail: "", contactPhone: "000 2222", emergencyName: "", emergencyPhone: "", emergencyRelationship: "", medicalNotes: "" };
  as("desk", [], [at(bishopstown, ["short-courses.read"])]);
  assert.equal((await actions.saveParticipant(id, null, { name: "Typed Example" })).ok, false, "a typed name is not enough any more");
  assert.equal((await actions.saveParticipant(id, null, { swimmer: { swimmerId: known.id }, payment: "paid" })).ok, true);
  assert.equal((await actions.saveParticipant(id, null, { swimmer: { swimmerId: known.id } })).ok, false, "not twice on one course");
  assert.equal((await actions.saveParticipant(id, null, { swimmer: { newSwimmer: ada } })).ok, true);
  assert.equal((await actions.saveParticipant(id, null, { swimmer: { newSwimmer: ada } })).ok, false, "the same person is not added to the records twice");
  const added = await fixture.prisma.student.findFirstOrThrow({ where: { firstName: "Ada", lastName: "Example" } });
  assert.equal(added.clubId, bishopstown, "added at the course's site");
  assert.match((await fixture.prisma.auditLog.findFirstOrThrow({ where: { entity: "Student", entityId: added.id } })).summary, /from Short courses/);
  const robin = await fixture.prisma.shortCourseParticipant.findFirstOrThrow({ where: { courseId: id, swimmerId: known.id } });
  assert.deepEqual([robin.name, robin.phone, robin.email, robin.paidCents], ["Robin Example", "000 1111", "robin@example.invalid", 6000], "details come from the record");
  // A booking made before the records is linked afterwards.
  const old = await fixture.prisma.shortCourseParticipant.create({ data: { courseId: id, name: "Old Example", createdByName: "desk" } });
  const oldStudent = await fixture.prisma.student.create({ data: { clubId: churchfield, firstName: "Olive", lastName: "Example", memberNumber: "SYN-1002" } });
  assert.deepEqual((await directory.search("SYN-1002")).map((h) => h.id), [oldStudent.id], "found by member number");
  assert.deepEqual((await directory.search("olive")).map((h) => h.id), [oldStudent.id], "and by name");
  assert.equal((await actions.linkParticipant(old.id, { swimmerId: oldStudent.id })).ok, true);
  assert.equal((await fixture.prisma.shortCourseParticipant.findUniqueOrThrow({ where: { id: old.id } })).name, "Olive Example");
  const view = await data.shortCourse(id);
  const shown = view.booked.find((p) => p.swimmerId === known.id)!;
  assert.equal(view.swimmerRecords, true);
  assert.equal(shown.swimmer?.memberNumber, "SYN-1001");
  assert.equal(shown.swimmer?.medicalNotes, "Synthetic: carries an inhaler", "the desk working the course reads the medical notes");
  const history = await contributions.memberHistoryFor(known.id);
  assert.deepEqual(history.map((h) => [h.module, h.title]), [["Short courses", "Synthetic Adult swim at " + view.course.site.name]], "the swimmer profile lists the course");
  as("nora", [], [at(bishopstown, ["short-courses.manage"])]);
  assert.equal((await actions.setCourseStatus(id, "cancelled")).ok, true);
});

test("a cancelled course leaves the Rota and takes no bookings", async () => {
  as("nora", [], [at(bishopstown, ["short-courses.manage"])]);
  assert.equal((await actions.setCourseStatus(courseId, "cancelled")).ok, true);
  assert.equal((await contributions.commitmentsFor({ siteIds: [bishopstown], from: first, to: addDaysIso(first, 60) })).length, 0);
  assert.equal((await actions.saveParticipant(courseId, null, { name: "Late Example" })).ok, false);
});

test("renaming a site's area in Admin moves the sessions there, lanes included, and nothing at another site", async () => {
  const sessions = await fixture.prisma.shortCourseSession.findMany({ where: { courseId }, orderBy: { date: "asc" } });
  await fixture.prisma.shortCourseSession.update({ where: { id: sessions[0].id }, data: { place: "gym floor, lane 2" } });
  await fixture.prisma.shortCourseSession.update({ where: { id: sessions[1].id }, data: { place: "Gym floorboards" } });
  assert.equal(await contributions.renameAreaEverywhere({ siteId: churchfield, from: "Gym floor", to: "Studio" }), 0, "Churchfield has no sessions there");
  const changed = await contributions.renameAreaEverywhere({ siteId: bishopstown, from: "Gym floor", to: "Studio" });
  const after = await fixture.prisma.shortCourseSession.findMany({ where: { courseId }, orderBy: { date: "asc" } });
  assert.equal(after[0].place, "Studio, lane 2", "the lane it names follows");
  assert.equal(after[1].place, "Gym floorboards", "another area that only starts the same is left alone");
  assert.ok(after.slice(2).every((s) => s.place === "Studio"));
  assert.ok(changed >= after.length - 1, "every session moved is counted");
});
