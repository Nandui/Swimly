/** Loopback-only, in-memory preview. No application database or real email. */
import { createServer } from "node:http";
import { isolatedPrisma } from "../src/test/pglite-prisma";
import { serverModule } from "../src/test/server-module";
import { mostRecentOccurrence, shiftWeeks } from "../src/modules/activities/shared/attendance/dates";
import { readEmailParts } from "../src/test/email";

async function main() {
  if (process.env.PARENT_API_PREVIEW !== "1" || process.env.NODE_ENV === "production") throw new Error("Set PARENT_API_PREVIEW=1 for the isolated preview.");
  process.env.PARENT_API_ENABLED = "true";
  process.env.PARENT_AUTH_SECRET = "synthetic-preview-secret-never-use-in-production";
  process.env.PARENT_API_ALLOWED_ORIGINS = "http://127.0.0.1:3020";
  process.env.PARENT_EMAIL_FROM = "LeisureWorld Aquatics preview <parent@example.test>";
  process.env.PARENT_GOOGLE_CLIENT_ID = "synthetic-client";
  process.env.PARENT_GOOGLE_CLIENT_SECRET = "synthetic-secret";
  process.env.PARENT_GOOGLE_REFRESH_TOKEN = "synthetic-refresh";
  const codes = new Map<string, string>();
  globalThis.fetch = async (url, init) => {
    if (url === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "synthetic-access", token_type: "Bearer" });
    if (url !== "https://gmail.googleapis.com/gmail/v1/users/me/messages/send") throw new Error("External requests are disabled in this preview.");
    const message = JSON.parse(String(init?.body));
    const mime = Buffer.from(message.raw, "base64url").toString("utf8");
    const email = /^To: (.+)$/m.exec(mime)![1].trim();
    const text = readEmailParts(mime).find(part => part.type === "text/plain")!.content.toString("utf8");
    codes.set(email, /code is (\d{6})/.exec(text)![1]);
    return Response.json({ id: "synthetic-email" });
  };
  const fixture = await isolatedPrisma(), db = fixture.prisma;
  await db.club.update({ where: { id: "club_bishopstown" }, data: { name: "Demo LeisureWorld Pool", phone: "021 000 0000" } });
  const programme = await db.programme.create({ data: { id: "demo-programme", name: "Learn to swim", clubId: "club_bishopstown" } });
  const level = await db.level.create({ data: { id: "demo-level", programmeId: programme.id, name: "Level 2 · Water confidence", description: "Building confidence, balance and independent movement in the water." } });
  const skills = ["Enter and exit the pool safely", "Blow bubbles underwater", "Float on your back", "Push and glide", "Kick for five metres", "Turn and return to the wall"];
  for (const [index, name] of skills.entries()) await db.competency.create({ data: { id: `demo-skill-${index}`, levelId: level.id, name, sortOrder: index } });
  await db.parentAccount.create({ data: { email: "parent@example.test", name: "Alex Morgan" } });
  const teacher = await db.user.create({ data: { name: "Robin Example", email: "teacher@example.test", passwordHash: "unused" } });
  const course = await db.course.create({ data: { clubId: "club_bishopstown", levelId: level.id, dayOfWeek: "MONDAY", startMinutes: 960, durationMinutes: 30, instructorId: teacher.id, location: "Learner pool" } });
  for (const [index, name] of ["Ava", "Liam"].entries()) {
    const child = await db.student.create({ data: { id: `demo-child-${index}`, clubId: "club_bishopstown", firstName: name, lastName: "Morgan", dateOfBirth: new Date(`201${7 + index}-04-12`), medicalNotes: "Private synthetic note: must never leave staff API" } });
    await db.parentChildAccess.create({ data: { parentEmail: "parent@example.test", studentId: child.id, source: "STAFF_APPROVAL" } });
    await db.enrolment.create({ data: { studentId: child.id, courseId: course.id, levelId: level.id, programmeId: programme.id, startedOn: new Date("2026-01-01") } });
    for (let week = 1; week <= 10; week++) await db.attendanceRecord.create({ data: {
      studentId: child.id, courseId: course.id, date: new Date(shiftWeeks(mostRecentOccurrence("MONDAY"), -week)),
      status: week === 4 + index ? "ABSENT" : week === 2 ? "LATE" : "PRESENT",
      markedByName: "Robin Example", note: "Private synthetic attendance note",
    } });
    for (let n = 0; n < 5; n++) await db.competencyResult.create({ data: { studentId: child.id, competencyId: `demo-skill-${n}`, status: n < 3 - index ? "ACHIEVED" : "WORKING_ON", assessedByName: "Demo teacher", assessedOn: new Date("2026-09-10") } });
  }
  // Only this isolated database advances the initial synthetic marks into the past.
  await db.parentProgressEvent.updateMany({ data: { releaseAt: new Date(Date.now() - 86400_000) } });
  await db.competencyResult.update({ where: { studentId_competencyId: { studentId: "demo-child-0", competencyId: "demo-skill-3" } }, data: { status: "ACHIEVED" } });
  for (let n = 1; n <= 5; n++) {
    const date = new Date(Date.now() + n * 86400_000); date.setUTCHours(0, 0, 0, 0);
    await db.assessmentSession.create({ data: { id: `demo-session-${n}`, clubId: "club_bishopstown", programmeId: programme.id, date, startMinutes: 900 + n * 30, durationMinutes: 20, capacity: n === 2 ? 0 : 6, location: "Teaching pool", parentPublication: { create: { enabled: true } } } });
  }
  // Assessment-only family: upcoming, published/unreleased placement and cancellation.
  await db.parentAccount.create({ data: { email: "assessment-parent@example.test", name: "Sam Example" } });
  const assessmentDate = new Date(Date.now() - 86400_000); assessmentDate.setUTCHours(0, 0, 0, 0);
  await db.assessmentSession.create({ data: { id: "demo-past-assessment", clubId: "club_bishopstown", programmeId: programme.id,
    date: assessmentDate, startMinutes: 930, durationMinutes: 20, location: "Teaching pool" } });
  for (const [state, name] of [["upcoming", "Casey"], ["placed", "Riley"], ["pending", "Taylor"], ["cancelled", "Jordan"]]) {
    const studentId = `demo-assessment-${state}`;
    await db.student.create({ data: { id: studentId, clubId: "club_bishopstown", firstName: name, lastName: "Example" } });
    await db.parentChildAccess.create({ data: { parentEmail: "assessment-parent@example.test", studentId, source: "PARENT_BOOKING" } });
    await db.assessmentBooking.create({ data: { id: `demo-booking-${state}`, studentId, sessionId: state === "upcoming" || state === "cancelled" ? "demo-session-1" : "demo-past-assessment",
      status: state === "upcoming" ? "BOOKED" : state === "cancelled" ? "CANCELLED" : "ATTENDED", bookedByName: "Sam Example",
      ...(state === "placed" || state === "pending" ? { outcomeLevelId: level.id, assessedOn: assessmentDate } : {}) } });
    if (state === "placed") await db.parentProgressEvent.updateMany({ where: { studentId }, data: { releaseAt: new Date(Date.now() - 86400_000) } });
  }
  // Synthetic Pool short courses ticked for the app: adult ones, a full one and one for children.
  const orgId = (await db.club.findUniqueOrThrow({ where: { id: "club_bishopstown" } })).orgId!;
  const first = new Date(Date.now() + 10 * 86400_000); first.setUTCHours(0, 0, 0, 0);
  const shortCourse = async (name: string, minAge: number | null, capacity: number, weekday: number, start: number, booked = 0) => {
    const type = await db.shortCourseType.create({ data: { orgId, name, area: "pool", minAge, description: minAge && minAge >= 18 ? "Small groups in the shallow end with a patient teacher." : "" } });
    const day = new Date(first.getTime() + ((weekday - first.getUTCDay() + 7) % 7) * 86400_000);
    const course = await db.shortCourse.create({ data: { orgId, siteId: "club_bishopstown", typeId: type.id, capacity, priceCents: 6500, instructorId: teacher.id, createdByName: "Robin Example", bookOnline: true,
      sessions: { create: [0, 7, 14, 21, 28, 35].map((days) => ({ date: new Date(day.getTime() + days * 86400_000), startMinutes: start, endMinutes: start + 45, place: "Main pool" })) } } });
    for (let n = 0; n < booked; n++) await db.shortCourseParticipant.create({ data: { courseId: course.id, name: `Synthetic swimmer ${n + 1}`, createdByName: "Robin Example" } });
  };
  await shortCourse("Adult beginners", 18, 8, 2, 19 * 60 + 30, 3);
  await shortCourse("Adult improvers", 18, 8, 4, 20 * 60, 6);
  await shortCourse("Adult stroke technique", 18, 6, 6, 9 * 60 + 30, 6);
  await shortCourse("Mid-term stroke clinic", 7, 10, 3, 11 * 60, 2);
  const doubles = { "@/lib/prisma": { prisma: db }, "next/cache": { revalidatePath() {} }, "server-only": {},
    "@/lib/clubs/current": { currentClubId: async () => "club_bishopstown" } };
  const contributions = serverModule<typeof import("../src/modules/contributions")>("src/modules/contributions.ts", { ...doubles, "@/modules/server": {} });
  serverModule("src/modules/short-courses/module.ts", { ...doubles, "@/modules/contributions": contributions,
    "@/lib/authz": { AuthorizationError: class extends Error {}, requirePermission: async () => ({}), canSee: () => true } });
  const router = serverModule<typeof import("../src/modules/activities/features/parents/server/router")>("src/modules/activities/features/parents/server/router.ts", {
    ...doubles, "@/modules/contributions": contributions,
  });
  const server = createServer(async (incoming, outgoing) => {
    try {
      if (incoming.headers.host !== "127.0.0.1:3019") { outgoing.writeHead(403).end(); return; }
      const url = new URL(incoming.url ?? "/", "http://127.0.0.1:3019");
      if (url.pathname === "/__test/code" && incoming.method === "GET") {
        outgoing.setHeader("Content-Type", "application/json"); outgoing.setHeader("Cache-Control", "no-store");
        outgoing.end(JSON.stringify({ code: codes.get(url.searchParams.get("email") ?? "") ?? null })); return;
      }
      if (!url.pathname.startsWith("/api/parent/v1/")) { outgoing.writeHead(404).end(); return; }
      let size = 0; const chunks: Buffer[] = [];
      for await (const chunk of incoming) { size += chunk.length; if (size > 16_384) { outgoing.writeHead(413).end(); return; } chunks.push(chunk); }
      const headers = new Headers(); for (const [key, value] of Object.entries(incoming.headers)) if (typeof value === "string") headers.set(key, value);
      const response = await router.handleParentRequest(new Request(url, { method: incoming.method, headers, ...(chunks.length ? { body: Buffer.concat(chunks) } : {}) }), url.pathname.slice("/api/parent/v1/".length).split("/"));
      outgoing.writeHead(response.status, Object.fromEntries(response.headers)); outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) { console.error("Synthetic preview request failed", error instanceof Error ? error.message : "Unknown"); outgoing.writeHead(500).end(); }
  });
  server.listen(3019, "127.0.0.1", () => console.log("Synthetic parent API ready at http://127.0.0.1:3019. Emails are captured locally; no real data is connected."));
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => server.close(() => { void fixture.close().then(() => process.exit()); }));
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
