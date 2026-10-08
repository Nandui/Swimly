import "server-only";
import { CircleCheck, Clock3, XCircle } from "lucide-react";
import { requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { subjectsFor } from "@/lib/policy/session";
import type { StatusMeta } from "@/lib/status";

/** Staff's own contact and emergency details as they asked to change them in
 *  Turnfin Me, beside what is on their record now. HR's: only the people the
 *  reader keeps details for (`hr.details.write`). */
export const DETAIL_LABELS = {
  phone: "Phone",
  homeAddress: "Home address",
  emergencyName: "Emergency contact",
  emergencyPhone: "Emergency phone",
  emergencyRelationship: "Emergency contact relationship",
} as const;
export type DetailField = keyof typeof DETAIL_LABELS;
export const DETAIL_FIELDS = Object.keys(DETAIL_LABELS) as DetailField[];

export const DETAIL_REQUEST_STATUS_META = {
  PENDING: { label: "Waiting for review", color: "orange", icon: Clock3 },
  APPLIED: { label: "Applied", color: "green", icon: CircleCheck },
  DECLINED: { label: "Declined", color: "gray", icon: XCircle },
} as const satisfies Record<string, StatusMeta>;

export async function listDetailRequests(view: "PENDING" | "DONE" = "PENDING") {
  const session = await requireSession();
  const scope = await subjectsFor("hr.details.write");
  const rows = await prisma.staffDetailChangeRequest.findMany({
    where: { orgId: session.user.orgId ?? undefined, ...(scope.kind === "all" ? {} : { userId: { in: [...scope.userIds] } }), ...(view === "PENDING" ? { status: "PENDING" } : { status: { in: ["APPLIED", "DECLINED"] } }) },
    orderBy: view === "PENDING" ? { createdAt: "asc" } : { reviewedAt: "desc" },
    take: 50,
  });
  const people = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.userId))] } },
    select: { id: true, name: true, jobTitle: true, phone: true, homeAddress: true, emergencyName: true, emergencyPhone: true, emergencyRelationship: true },
  });
  const byId = new Map(people.map((p) => [p.id, p]));
  return rows.flatMap((row) => {
    const person = byId.get(row.userId);
    if (!person) return [];
    const proposed = row.proposed as Partial<Record<DetailField, string>>;
    return [{
      id: row.id, status: row.status as keyof typeof DETAIL_REQUEST_STATUS_META, message: row.message, reply: row.reply,
      createdAt: row.createdAt, reviewedAt: row.reviewedAt, reviewedByName: row.reviewedByName,
      person: { id: person.id, name: person.name, jobTitle: person.jobTitle },
      changes: DETAIL_FIELDS.filter((f) => proposed[f] !== undefined).map((f) => ({ field: f, label: DETAIL_LABELS[f], current: person[f] ?? "", proposed: proposed[f] ?? "" })),
    }];
  });
}
