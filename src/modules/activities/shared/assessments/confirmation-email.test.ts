import assert from "node:assert/strict";
import { test } from "node:test";
import { directoryDouble } from "@/test/directory-double";
import { serverModule } from "@/test/server-module";

type Email = typeof import("@/modules/activities/shared/assessments/confirmation-email");
const production = { VERCEL_ENV: "production" };

function fixture() {
  const sent: { to: string; subject: string; text: string; html: string }[] = [];
  const booking = {
    status: "BOOKED",
    student: { firstName: "Ava", lastName: "Testsurname", contactEmail: "family@example.test" as string | null, parentAccess: [{ parentEmail: "linked@example.test" }] },
    session: { date: new Date("2030-03-02T00:00:00Z"), startMinutes: 600, durationMinutes: 30, location: "Small pool" as string | null, clubId: "site",
      programmeId: "programme", typeId: "type" as string | null, cancelledAt: null as Date | null },
  };
  const people = { system: false };
  const prisma = {
    assessmentBooking: { findUnique: async () => booking },
    user: { findUnique: async () => ({ actsAsSystem: people.system }) },
  };
  const email = serverModule<Email>("src/modules/activities/shared/assessments/confirmation-email.ts", {
    "@/lib/prisma": { prisma },
    "@/lib/clubs/current": { currentClubId: async () => "site", currentClubIdIfAny: async () => "site" },
    "@/lib/directory": { ...directoryDouble({ sites: [{ id: "site", name: "Example Pool" }] }), sitePhones: async () => new Map([["site", "021 000 0000"]]) },
    "@/modules/activities/shared/curriculum/data/shared": { readSharedCurriculum: async () => ({
      types: [{ id: "type", name: "Learn to swim assessment" }], typeIds: { resolve: (id: string) => id }, programme: () => ({ name: "Swim school" }),
    }) },
    "@/modules/activities/shared/parents/email": { parentEmailConfig: () => ({ fromHeader: "test" }) },
    "@/lib/email/google": { sendGoogleEmail: async (to: string, subject: string, content: { text: string; html: string }) => { sent.push({ to, subject, ...content }); } },
  });
  return { email, booking, people, sent };
}

test("a parent's app booking emails them the day, time, place and reception phone", async () => {
  const f = fixture();
  await f.email.sendAssessmentConfirmation("booking", { parentEmail: "Parent@Example.test" }, production);
  assert.deepEqual(f.sent.map((s) => s.to), ["parent@example.test"]);
  const [mail] = f.sent;
  assert.match(mail.subject, /^Assessment booked: Ava, /);
  for (const part of ["Ava", "Learn to swim assessment", "10:00 to 10:30", "Example Pool (Small pool)", "021 000 0000", "parents app"]) assert.ok(mail.text.includes(part), part);
  assert.ok(mail.html.includes("021 000 0000"));
  assert.ok(!mail.text.includes("Testsurname"), "the swimmer's surname stays out of the email");
});

test("a reception booking emails the swimmer's contact email, or the linked parents when there is none", async () => {
  const f = fixture();
  await f.email.sendAssessmentConfirmation("booking", { actorId: "staff" }, production);
  assert.deepEqual(f.sent.map((s) => s.to), ["family@example.test"]);
  assert.ok(!f.sent[0].text.includes("parents app"));
  f.sent.length = 0; f.booking.student.contactEmail = null;
  await f.email.sendAssessmentConfirmation("booking", { actorId: "staff" }, production);
  assert.deepEqual(f.sent.map((s) => s.to), ["linked@example.test"]);
});

test("nothing is sent from previews, by a system account, or for a cancelled session", async () => {
  const f = fixture();
  await f.email.sendAssessmentConfirmation("booking", { actorId: "staff" }, { VERCEL_ENV: "preview" });
  await f.email.sendAssessmentConfirmation("booking", { actorId: "staff" }, {});
  f.people.system = true;
  await f.email.sendAssessmentConfirmation("booking", { actorId: "dev" }, production);
  f.people.system = false; f.booking.session.cancelledAt = new Date();
  await f.email.sendAssessmentConfirmation("booking", { actorId: "staff" }, production);
  assert.equal(f.sent.length, 0);
});

test("a failed send never breaks the booking", async () => {
  const f = fixture();
  const quiet = console.error; console.error = () => {};
  try {
    f.booking.student = undefined as never;
    await f.email.sendAssessmentConfirmation("booking", { actorId: "staff" }, production);
  } finally { console.error = quiet; }
  assert.equal(f.sent.length, 0);
});

test("the email escapes names and leaves out a missing phone", () => {
  const f = fixture();
  const mail = f.email.assessmentConfirmationEmail({ child: "<b>Ava</b>", day: "Saturday 2 March", time: "10:00 to 10:30", site: "Example Pool",
    location: null, assessment: "Assessment", phone: "", bookedInApp: false });
  assert.ok(!mail.html.includes("<b>Ava</b>"));
  assert.match(mail.text, /contact reception at Example Pool/);
});
