import assert from "node:assert/strict";
import { test } from "node:test";
import { serverModule } from "@/test/server-module";
import { directoryDouble } from "@/test/directory-double";

test("the group read keeps every active level and finds selected swimmers across sites", async () => {
  let where: unknown;
  const data = serverModule<typeof import("@/modules/activities/features/together/server/data/together")>("src/modules/activities/features/together/server/data/together.ts", {
    "@/lib/authz": { requireSession: async () => ({}) },
    "@/lib/clubs/current": { currentClubId: async () => "club" },
    "@/lib/directory": directoryDouble({ sites: [{ id: "club", name: "Site A", archivedAt: null }] }),
    "@/lib/prisma": { prisma: { programme: { findMany: async () => [] }, student: { findMany: async (args: { where: unknown }) => {
      where = args.where;
      return [{ id: "A", firstName: "Sample", lastName: "Swimmer", dateOfBirth: null, contactEmail: null, contactPhone: null,
        enrolments: ["two", "one", "one"].map((id, i) => ({ id: `e${i}`, courseId: String(i), levelId: id, programmeId: "p", level: { id, name: id, sortOrder: i },
          course: { name: null, dayOfWeek: "MONDAY", startMinutes: 960, durationMinutes: 30, clubId: "club" } })) }];
    } } } },
  });
  const group = await data.getGroup(["A"]);
  assert.deepEqual(where, { id: { in: ["A"] } });
  assert.deepEqual(new Set(data.toMembers(group.chosen)[0].levelIds), new Set(["one", "two"]));
  assert.equal(group.chosen[0].levelName, "two, one");
  assert.deepEqual(group.chosen[0].places[0], { enrolmentId: "e0", courseId: "0", programmeId: "p", levelName: "two", label: "two · Monday 16:00",
    place: { title: "two", when: "Monday 16:00 to 16:30", level: "two", centre: "Site A" } });
});
