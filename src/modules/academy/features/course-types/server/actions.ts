"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { ACADEMY_CHECK_KEYS, ACADEMY_KINDS } from "@/modules/academy/shared/rules";
import { refresh } from "@/modules/academy/shared/server";

/** Academy writes for the course list (docs/academy.md): Manage keeps it. Every write is audited. */

/* ---------- The course list ---------- */

const typeSchema = z.object({
  name: z.string().trim().min(2, "Name the course.").max(80),
  kind: z.enum(ACADEMY_KINDS as [string, ...string[]]),
  awardingBody: z.string().trim().max(80).default(""),
  minAge: z.union([z.literal(""), z.coerce.number().int().min(8).max(99)]).default(""),
  minHours: z.coerce.number().int().min(0).max(500).default(0),
  checks: z.array(z.enum(ACADEMY_CHECK_KEYS as [string, ...string[]])).default([]),
  qualificationTypeId: z.string().default(""),
});
export type CourseTypeInput = z.input<typeof typeSchema>;

/** Add a course we deliver ("NPLQ"), or change one. */
export async function saveCourseType(id: string | null, input: CourseTypeInput): Promise<ActionResult> {
  const session = await requirePermission("academy.manage");
  const orgId = session.user.orgId;
  if (!orgId) return fail("Your account is not in an organisation.");
  const parsed = typeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  const clash = await prisma.academyCourseType.findFirst({ where: { orgId, name: { equals: d.name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (clash) return fail("There is already a course with that name.");
  if (d.qualificationTypeId && !(await prisma.qualificationType.findFirst({ where: { id: d.qualificationTypeId, orgId }, select: { id: true } }))) return fail("That qualification is no longer offered.");
  if (d.checks.includes("age") && d.minAge === "") return fail("Give the minimum age, or untick the age check.");
  if (id && !(await prisma.academyCourseType.findFirst({ where: { id, orgId }, select: { id: true } }))) return fail("That course no longer exists.");
  const data = { name: d.name, kind: d.kind, awardingBody: d.awardingBody, minAge: d.minAge === "" ? null : d.minAge, minHours: d.minHours, checks: [...new Set(d.checks)], qualificationTypeId: d.qualificationTypeId || null };
  await prisma.$transaction(async (tx) => {
    const row = id ? await tx.academyCourseType.update({ where: { id }, data }) : await tx.academyCourseType.create({ data: { ...data, orgId } });
    await logAudit({ actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: id ? "update" : "create", entity: "AcademyCourseType", entityId: row.id, clubId: null,
      summary: `${id ? "Changed" : "Added"} the Academy course ${d.name}` }, tx);
  });
  refresh();
  revalidatePath("/academy/courses");
  return ok();
}

export async function archiveCourseType(id: string, archived: boolean): Promise<ActionResult> {
  const session = await requirePermission("academy.manage");
  const type = await prisma.academyCourseType.findFirst({ where: { id, orgId: session.user.orgId ?? undefined }, select: { name: true } });
  if (!type) return fail("That course no longer exists.");
  await prisma.$transaction(async (tx) => {
    await tx.academyCourseType.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await logAudit({ actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: archived ? "archive" : "update", entity: "AcademyCourseType", entityId: id, clubId: null,
      summary: `${archived ? "Archived" : "Restored"} the Academy course ${type.name}` }, tx);
  });
  revalidatePath("/academy/courses");
  return ok();
}
