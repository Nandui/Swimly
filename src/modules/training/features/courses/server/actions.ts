"use server";

import { z } from "zod";
import { fail, ok, onUniqueViolation, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireTrainingActor } from "@/modules/training/shared/access";
import { refresh } from "@/modules/training/shared/writes";

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

const courseSchema = z.object({
  title: z.string().trim().min(3, "Give the course a name.").max(120, "Keep the name under 120 characters."),
  summary: z.string().trim().max(300, "Keep the summary under 300 characters."),
  content: z.string().trim().max(10000, "Keep the material under 10,000 characters."),
  requiresSignoff: z.boolean(),
  grantsTypeId: z.string().trim().max(64).transform((v) => v || null),
});
export type CourseInput = z.input<typeof courseSchema>;

export async function saveCourse(id: string | null, input: CourseInput): Promise<ActionResult> {
  const who = await requireTrainingActor();
  if (!who.manage || !who.orgId) return fail("Building the catalogue needs the Training catalogue permission.");
  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = parsed.data;
  const result = await onUniqueViolation(() => prisma.$transaction(async (tx) => {
    if (data.grantsTypeId && !(await tx.qualificationType.findFirst({ where: { id: data.grantsTypeId, orgId: who.orgId!, archivedAt: null }, select: { id: true } }))) {
      return fail("That qualification is no longer offered.");
    }
    if (id) {
      const existing = await tx.trainingCourse.findFirst({ where: { id, orgId: who.orgId! }, select: { title: true } });
      if (!existing) return fail("That course no longer exists.");
      await tx.trainingCourse.update({ where: { id }, data });
      await logAudit({ actorId: who.id, actorName: who.name, action: "update", entity: "TrainingCourse", entityId: id, summary: `Updated the course ${data.title}` }, tx);
    } else {
      const created = await tx.trainingCourse.create({ data: { ...data, orgId: who.orgId!, createdById: who.id } });
      await logAudit({ actorId: who.id, actorName: who.name, action: "create", entity: "TrainingCourse", entityId: created.id, summary: `Added the course ${data.title}` }, tx);
    }
    return ok();
  }), "There is already a course with that name.", "title");
  if (result.ok) refresh("/training/courses");
  return result;
}

export async function setCourseArchived(id: string, archived: boolean): Promise<ActionResult> {
  const who = await requireTrainingActor();
  if (!who.manage) return fail("Building the catalogue needs the Training catalogue permission.");
  const result = await prisma.$transaction(async (tx) => {
    const course = await tx.trainingCourse.findFirst({ where: { id, orgId: who.orgId ?? undefined }, select: { title: true, archivedAt: true } });
    if (!course) return fail("That course no longer exists.");
    if (!!course.archivedAt === archived) return ok();
    await tx.trainingCourse.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await logAudit({ actorId: who.id, actorName: who.name, action: archived ? "archive" : "restore", entity: "TrainingCourse", entityId: id, summary: `${archived ? "Retired" : "Restored"} the course ${course.title}` }, tx);
    return ok();
  });
  if (result.ok) refresh("/training/courses");
  return result;
}
