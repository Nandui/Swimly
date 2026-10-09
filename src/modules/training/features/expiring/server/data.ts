import "server-only";
import { today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { qualificationState } from "@/lib/people/data";
import { requirementStates } from "@/lib/people/requirements";
import { subjectsFor } from "@/lib/policy/session";
import { requireTrainingActor } from "@/modules/training/shared/access";
import { OPEN_TRAINING_STATUSES } from "@/modules/training/shared/constants";
import { type ExpiringFilters, expiringQualificationRows, filteredPeople, scopedUserIds } from "@/modules/training/shared/data";

/** Expired and expiring qualifications for the people this person covers, filtered by site and
 *  position; and (owner decision, 8 October 2026) who lacks a qualification their position needs. */
export async function expiringQualifications(filters: ExpiringFilters = {}) {
  const who = await requireTrainingActor();
  const on = today();
  const scope = await scopedUserIds("training.records.read");
  const [rows, sites, positions, holders] = await Promise.all([
    expiringQualificationRows(who.orgId, scope, on, filters),
    prisma.club.findMany({ where: { orgId: who.orgId ?? undefined, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.position.findMany({ where: { orgId: who.orgId ?? undefined, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { orgId: who.orgId ?? undefined, id: scope, ...filteredPeople(filters), position: { requires: { some: {} } } },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, position: { select: { name: true, requires: { select: { type: { select: { id: true, name: true } } } } } },
        qualifications: { select: { typeId: true, issuedOn: true, expiresOn: true, revokedAt: true } },
      },
    }),
  ]);
  // Never held at all: expired and expiring ones are already in the list above.
  const missing = holders.flatMap((p) => {
    const lacking = requirementStates(p.position!.requires.map((r) => r.type), p.qualifications, on).filter((r) => r.state === "missing");
    return lacking.length ? [{ userId: p.id, name: p.name, position: p.position!.name, lacking: lacking.map((r) => r.name) }] : [];
  });
  const courses = await prisma.trainingCourse.findMany({
    where: { orgId: who.orgId ?? undefined, archivedAt: null, grantsTypeId: { in: [...new Set(rows.map((r) => r.typeId))] } },
    select: { id: true, title: true, grantsTypeId: true },
  });
  const open = await prisma.trainingAssignment.findMany({
    where: { userId: { in: [...new Set(rows.map((r) => r.userId))] }, courseId: { in: courses.map((c) => c.id) }, status: { in: [...OPEN_TRAINING_STATUSES] } },
    select: { userId: true, courseId: true },
  });
  const assigned = new Set(open.map((a) => `${a.userId}:${a.courseId}`));
  const assignScope = who.assign ? await subjectsFor("training.assign") : null;
  return {
    who, sites, positions, missing,
    rows: rows.map((r) => {
      const course = courses.find((c) => c.grantsTypeId === r.typeId) ?? null;
      return {
        id: r.id, userId: r.userId, name: r.user.name, jobTitle: r.user.jobTitle, qualification: r.type.name,
        expiresOn: r.expiresOn, state: qualificationState(r, on),
        renewal: course ? {
          courseId: course.id, title: course.title, assigned: assigned.has(`${r.userId}:${course.id}`),
          canAssign: !!assignScope && (assignScope.kind === "all" || assignScope.userIds.has(r.userId)),
        } : null,
      };
    }),
  };
}
