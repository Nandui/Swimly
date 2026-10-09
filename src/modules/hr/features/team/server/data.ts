import "server-only";
import { prisma } from "@/lib/prisma";
import { hrDatabase } from "@/modules/hr/shared/database";
import { requireHrActor } from "@/modules/hr/shared/access";
import type { ReviewStatus } from "@/modules/hr/shared/constants";
import { subjectsFor } from "@/lib/policy/session";
import { logHrAccess } from "@/modules/hr/shared/records";

/** Everyone whose HR record the reader covers, with their latest review. */
export async function hrPeople(query = "") {
  const who = await requireHrActor();
  const scope = await subjectsFor("hr.records.read");
  const q = query.trim().slice(0, 80);
  const people = await prisma.user.findMany({
    where: {
      orgId: who.orgId || undefined, isActive: true,
      ...(scope.kind === "all" ? {} : { id: { in: [...scope.userIds] } }),
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { name: "asc" }, take: 200,
    select: { id: true, name: true, jobTitle: true },
  });
  const ids = people.map((p) => p.id);
  const db = hrDatabase();
  const latest = ids.length === 0 ? [] : await db.query<{ subjectUserId: string; status: ReviewStatus; period: string }>(
    `SELECT DISTINCT ON (subject_user_id) subject_user_id AS "subjectUserId", status, period FROM reviews
      WHERE org_id=$1 AND subject_user_id = ANY($2) AND (status <> 'draft' OR reviewer_id=$3 OR $4)
      ORDER BY subject_user_id, created_at DESC`,
    [who.orgId, ids, who.id, who.superadmin],
  );
  await logHrAccess(db, who, ids, "HrPeople", null, "HR people list");
  const byId = new Map(latest.map((r) => [r.subjectUserId, r]));
  return { who, people: people.map((p) => ({ ...p, latestReview: byId.get(p.id) ?? null })) };
}
