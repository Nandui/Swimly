import { isolatedPrisma } from "./pglite-prisma";
import { serverModule } from "./server-module";

/** No environment reads, outbound requests, shared database or real identities. */
export async function parentAdminFixture() {
  const fixture = await isolatedPrisma();
  const db = fixture.prisma;
  const state = { permissions: new Set(["parents.manage", "courses.manage"]), screens: new Set(["students", "assessments"]), clubId: "club_bishopstown", failAudit: false };
  await db.user.create({ data: { id: "demo-staff", name: "Alex Example", email: "staff@example.test", passwordHash: "unused" } });
  for (const [i, firstName] of ["Avery", "Jamie"].entries()) await db.student.create({ data: {
    id: `demo-swimmer-${i}`, firstName, lastName: "Example", clubId: i ? "club_churchfield" : "club_bishopstown",
    contactEmail: "contact@example.test", joinedOn: new Date("2026-01-05"), dateOfBirth: new Date("2018-04-06"),
  } });
  const programme = await db.programme.create({ data: { id: "demo-programme", name: "Water Safety & Fun", clubId: "club_bishopstown" } });
  const date = new Date(Date.now() + 2 * 86_400_000); date.setUTCHours(0, 0, 0, 0);
  const session = await db.assessmentSession.create({ data: { id: "demo-assessment", programmeId: programme.id, clubId: "club_bishopstown", date, startMinutes: 960, durationMinutes: 30, capacity: 4 } });
  const account = await db.parentAccount.create({ data: { id: "demo-parent", email: "parent@example.test", name: "Pat Example", phone: "000 000 0000" } });
  await db.parentSession.create({ data: { parentId: account.id, tokenHash: "synthetic-session", expiresAt: new Date(Date.now() + 86_400_000) } });
  class AuthorizationError extends Error {}
  const doubles = {
    "@/lib/prisma": { prisma: db },
    "@/lib/clubs/current": { currentClubId: async () => state.clubId },
    "next/cache": { revalidatePath() {} },
    "@/lib/authz": { AuthorizationError,
      requirePermission: async (permission: string) => {
        if (!state.permissions.has(permission)) throw new AuthorizationError();
        return { user: { id: "demo-staff", name: "Alex Example" } };
      }, canSee: (_actor: unknown, screen: string) => state.screens.has(screen),
    },
  };
  const audit = serverModule<typeof import("../lib/audit")>("src/lib/audit.ts", doubles);
  const admin = serverModule<typeof import("../lib/parent/admin")>("src/lib/parent/admin.ts", {
    ...doubles, "@/lib/audit": { logAudit: async (...args: Parameters<typeof audit.logAudit>) => {
      if (state.failAudit) throw new Error("Synthetic audit failure");
      return audit.logAudit(...args);
    } },
  });
  async function call(path: string, method = "GET", body?: unknown, headers: Record<string, string> = {}) {
    return admin.handleParentAdminRequest(new Request(`http://staff.example.test/api/parent-admin/v1/${path}`, {
      method, headers: { Origin: "http://staff.example.test", "Content-Type": "application/json", ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }), path.split("?")[0].split("/"));
  }
  return { ...fixture, state, admin, call, session, account };
}
