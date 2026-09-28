import "server-only";
import { requirePermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { CHANGEABLE_FIELDS, CHANGE_FIELD_LABELS, type ChangeableField } from "@/modules/activities/lib/parent/change-requests";

/** Reception's review list for parents' proposed corrections. Needs
 *  `students.manage` (a desk capability, so medical notes are allowed here per
 *  the Aquatics classification). Shows each proposed field beside the value on
 *  the swimmer's record now. */
export async function listParentChangeRequests(status: "PENDING" | "DONE" = "PENDING") {
  await requirePermission("students.manage");
  const rows = await prisma.parentChangeRequest.findMany({
    where: status === "PENDING" ? { status: "PENDING" } : { status: { in: ["APPLIED", "DECLINED"] } },
    orderBy: status === "PENDING" ? { createdAt: "asc" } : { reviewedAt: "desc" },
    take: 50,
    select: {
      id: true, status: true, proposed: true, message: true, reply: true, createdAt: true, reviewedAt: true, reviewedByName: true,
      parent: { select: { name: true, email: true } },
      student: {
        select: {
          id: true, firstName: true, lastName: true,
          contactName: true, contactEmail: true, contactPhone: true,
          emergencyName: true, emergencyPhone: true, emergencyRelationship: true, medicalNotes: true,
        },
      },
    },
  });
  return rows.map((row) => {
    const proposed = row.proposed as Partial<Record<ChangeableField, string>>;
    return {
      id: row.id, status: row.status, message: row.message, reply: row.reply, createdAt: row.createdAt, reviewedAt: row.reviewedAt, reviewedByName: row.reviewedByName,
      parent: row.parent,
      student: { id: row.student.id, name: `${row.student.firstName} ${row.student.lastName}` },
      changes: CHANGEABLE_FIELDS.filter((field) => proposed[field] !== undefined).map((field) => ({
        field, label: CHANGE_FIELD_LABELS[field], current: row.student[field] ?? "", proposed: proposed[field] ?? "",
      })),
    };
  });
}
export type ParentChangeRow = Awaited<ReturnType<typeof listParentChangeRequests>>[number];
