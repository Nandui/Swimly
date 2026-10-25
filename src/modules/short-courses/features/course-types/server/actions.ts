"use server";

import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { MAX_SESSION_MINUTES, MAX_WEEKS, SHORT_COURSE_AREAS } from "@/modules/short-courses/shared/rules";
import { refresh } from "@/modules/short-courses/shared/server";

/** Writes for the course list: Manage keeps it. Every write is audited. */

const typeSchema = z.object({
  name: z.string().trim().min(2, "Name the course.").max(80),
  area: z.enum(SHORT_COURSE_AREAS as [string, ...string[]]),
  description: z.string().trim().max(300).default(""),
  weeks: z.coerce.number().int().min(1, "At least one week.").max(MAX_WEEKS, `At most ${MAX_WEEKS} weeks.`),
  sessionMinutes: z.coerce.number().int().min(15, "Sessions are at least 15 minutes.").max(MAX_SESSION_MINUTES, `Sessions are at most ${MAX_SESSION_MINUTES} minutes.`),
  minAge: z.union([z.literal(""), z.coerce.number().int().min(1).max(99)]).default(""),
  healthForm: z.boolean().default(false),
});
export type CourseTypeInput = z.input<typeof typeSchema>;

/** Add a course we offer ("Couch to 5k, 8 weeks"), or change one. Runs already on keep their
 *  own weeks and times. */
export async function saveCourseType(id: string | null, input: CourseTypeInput): Promise<ActionResult> {
  const session = await requirePermission("short-courses.manage");
  const orgId = session.user.orgId;
  if (!orgId) return fail("Your account is not in an organisation.");
  const parsed = typeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  const clash = await prisma.shortCourseType.findFirst({ where: { orgId, name: { equals: d.name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (clash) return fail("There is already a course with that name.");
  if (id && !(await prisma.shortCourseType.findFirst({ where: { id, orgId }, select: { id: true } }))) return fail("That course no longer exists.");
  const data = { name: d.name, area: d.area, description: d.description, weeks: d.weeks, sessionMinutes: d.sessionMinutes, minAge: d.minAge === "" ? null : d.minAge, healthForm: d.healthForm };
  await prisma.$transaction(async (tx) => {
    const row = id ? await tx.shortCourseType.update({ where: { id }, data }) : await tx.shortCourseType.create({ data: { ...data, orgId } });
    await logAudit({ actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: id ? "update" : "create", entity: "ShortCourseType", entityId: row.id, clubId: null,
      summary: `${id ? "Changed" : "Added"} the short course ${d.name}: ${d.weeks} weeks of ${d.sessionMinutes} minutes${d.healthForm ? ", health form" : ""}` }, tx);
  });
  refresh();
  return ok();
}

export async function archiveCourseType(id: string, archived: boolean): Promise<ActionResult> {
  const session = await requirePermission("short-courses.manage");
  const type = await prisma.shortCourseType.findFirst({ where: { id, orgId: session.user.orgId ?? undefined }, select: { name: true } });
  if (!type) return fail("That course no longer exists.");
  await prisma.$transaction(async (tx) => {
    await tx.shortCourseType.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await logAudit({ actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: archived ? "archive" : "update", entity: "ShortCourseType", entityId: id, clubId: null,
      summary: `${archived ? "Archived" : "Restored"} the short course ${type.name}` }, tx);
  });
  refresh();
  return ok();
}
