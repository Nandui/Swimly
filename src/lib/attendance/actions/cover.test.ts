import assert from "node:assert/strict";
import { test } from "node:test";
import type { Session } from "next-auth";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";

function fixture() {
  let actor = "scheduled",
    permissions = ["attendance.mark", "attendance.cover"],
    screen = true,
    failAudit = false,
    archived = false,
    locked = false;
  let stored: {
    coverById: string | null;
    coverByName: string;
    instructorId: string | null;
  } | null = null;
  const audits: { action: string; summary: string }[] = [];
  let queue = Promise.resolve();
  const tx = {
    course: {
      findUnique: async () => {
        assert.ok(locked);
        return {
          id: "class",
          name: "Synthetic lesson",
          instructorId: "scheduled",
          instructor: { name: "Scheduled Teacher" },
          dayOfWeek: "FRIDAY",
          startMinutes: 900,
          archivedAt: archived ? new Date() : null,
          level: { name: "Turtles", programmeId: "programme" },
        };
      },
    },
    classCover: {
      findUnique: async () => {
        assert.ok(locked);
        return stored;
      },
      create: async ({ data }: { data: NonNullable<typeof stored> }) => {
        assert.ok(locked);
        assert.equal(stored, null);
        stored = data;
      },
    },
  };
  const actions = serverModule<typeof import("./cover")>(
    "src/lib/attendance/actions/cover.ts",
    {
      "@/lib/authz": {
        requirePermission: async () => ({
          user: { id: actor, name: actor, permissions: [...permissions] },
        }),
        can: (s: Session, p: PermissionKey) =>
          expandPermissions(s.user.permissions).has(p),
        canSee: () => screen,
        AuthorizationError: Error,
      },
      "@/lib/clubs/current": { currentClubId: async () => "site" },
      "@/lib/format": {
        isDateOnly: (s: string) => /^2026-09-\d{2}$/.test(s),
        parseDateOnly: (s: string) => new Date(s),
        today: () => "2026-09-11",
        weekdayOf: (d: Date) => (d.getUTCDay() === 5 ? "FRIDAY" : "MONDAY"),
        formatDate: (d: Date) => d.toISOString().slice(0, 10),
      },
      "@/lib/enrolment/seat": {
        withCourseSeat: async (
          _: string,
          run: (db: typeof tx) => Promise<unknown>,
        ) => {
          const before = queue;
          let release!: () => void;
          queue = new Promise<void>((r) => (release = r));
          await before;
          locked = true;
          const old = structuredClone(stored);
          try {
            return await run(tx);
          } catch (e) {
            stored = old;
            throw e;
          } finally {
            locked = false;
            release();
          }
        },
      },
      "@/lib/audit": {
        logAudit: async (row: (typeof audits)[number]) => {
          if (failAudit) throw Error("audit failed");
          audits.push(row);
        },
      },
      "next/cache": { revalidatePath: () => {} },
    },
  );
  return {
    actions,
    audits,
    claim: () => stored,
    actor: (id: string) => {
      actor = id;
    },
    seed: (id: string | null) => {
      stored = {
        coverById: id,
        coverByName: "Already teaching",
        instructorId: "scheduled",
      };
    },
    denyScreen: () => {
      screen = false;
    },
    noCover: () => {
      permissions = ["attendance.mark"];
    },
    archive: () => {
      archived = true;
    },
    failAudit: () => {
      failAudit = true;
    },
  };
}
const input = { courseId: "class", date: "2026-09-11" };

test("a scheduled instructor confirms a class once and a retry adds no audit", async () => {
  const f = fixture();
  assert.equal((await f.actions.startClass(input)).ok, true);
  assert.equal(f.claim()?.coverById, "scheduled");
  assert.equal(f.audits[0].action, "start-class");
  assert.equal((await f.actions.startClass(input)).ok, true);
  assert.equal(f.audits.length, 1);
});
test("simultaneous starts have one winner and the losing teacher cannot take it over", async () => {
  const f = fixture();
  const one = f.actions.startClass(input);
  f.actor("cover");
  const two = f.actions.startClass(input);
  const result = await Promise.all([one, two]);
  assert.equal(result.filter((r) => r.ok).length, 1);
  assert.equal(f.claim()?.coverById, "scheduled");
  assert.equal(f.audits.length, 1);
  assert.equal((await f.actions.takeOverClass(input)).ok, false);
});
test("a claim blocks the scheduled teacher too, including when its owner was deleted", async () => {
  for (const owner of ["cover", null]) {
    const f = fixture();
    f.seed(owner);
    assert.equal((await f.actions.startClass(input)).ok, false);
    assert.equal(f.claim()?.coverById, owner);
    assert.equal(f.audits.length, 0);
  }
});
test("permission, date and archive checks happen before claiming, and audit failure rolls back", async () => {
  const f = fixture();
  f.actor("cover");
  f.noCover();
  assert.equal((await f.actions.startClass(input)).ok, false);
  f.actor("scheduled");
  assert.equal(
    (await f.actions.startClass({ ...input, date: "2026-09-04" })).ok,
    false,
  );
  assert.equal(
    (await f.actions.startClass({ ...input, date: "2026-09-12" })).ok,
    false,
  );
  f.archive();
  assert.equal((await f.actions.startClass(input)).ok, false);
  assert.equal(f.claim(), null);
  const denied = fixture();
  denied.denyScreen();
  await assert.rejects(denied.actions.startClass(input), /Instructor access/);
  const failed = fixture();
  failed.failAudit();
  await assert.rejects(failed.actions.startClass(input), /audit failed/);
  assert.equal(failed.claim(), null);
});
