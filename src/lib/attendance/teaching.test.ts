import assert from "node:assert/strict";
import { test } from "node:test";
import type { Prisma } from "@/generated/prisma/client";
import type { Session } from "next-auth";
import { serverModule } from "@/test/server-module";

test("teaching saves reject another teacher, unclaimed dates and swimmers outside the class", async () => {
  let owner: string | null = "other",
    exists = true,
    members = ["swimmer"];
  const { teachingError } = serverModule<typeof import("./teaching")>(
    "src/lib/attendance/teaching.ts",
    { "@/lib/authz": { can: () => true, canSee: () => true } },
  );
  const tx = {
    course: {
      findUnique: async () => ({ dayOfWeek: "FRIDAY", archivedAt: null }),
    },
    classCover: {
      findUnique: async () => (exists ? { coverById: owner } : null),
    },
    enrolment: {
      findMany: async () => members.map((studentId) => ({ studentId })),
    },
  } as unknown as Prisma.TransactionClient;
  const session = { user: { id: "teacher" } } as Session,
    context = { courseId: "class", date: "2026-09-11" };
  assert.match((await teachingError(tx, session, context, "site"))!, /locked/);
  owner = null;
  assert.ok(await teachingError(tx, session, context, "site"));
  exists = false;
  assert.ok(await teachingError(tx, session, context, "site"));
  exists = true;
  owner = "teacher";
  assert.equal(
    await teachingError(tx, session, context, "site", ["swimmer"]),
    null,
  );
  members = [];
  assert.match(
    (await teachingError(tx, session, context, "site", ["swimmer"]))!,
    /no longer/,
  );
});
