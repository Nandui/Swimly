import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isDateOnly } from "@/lib/format";
export { toDateOnlyString as iso } from "@/lib/format";
import { liveSiteById } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import { currentActor, mayFor } from "@/lib/policy/session";
import type { PermissionKey } from "@/lib/staff/permissions";

/** What the writes share: access at a course's site, the course itself,
 *  form parsing and the pages to refresh after a change. */

export const optionalDate = z.string().trim().refine((v) => !v || isDateOnly(v), "Use a date like 2026-10-23.").default("");

export function refresh(courseId?: string) {
  revalidatePath("/short-courses");
  if (courseId) revalidatePath(`/short-courses/${courseId}`);
  revalidatePath("/rota");
  revalidatePath("/rota/today");
}

const REFUSALS: Partial<Record<PermissionKey, string>> = {
  "short-courses.manage": "Putting courses on at this site needs Short courses Manage there.",
  "short-courses.run": "Taking registers at this site needs Short courses Instructor there.",
};

/** The signed-in person, if they hold `cap` at the site. */
export async function atSite(siteId: string, cap: PermissionKey) {
  const site = await liveSiteById(siteId);
  if (!site?.orgId) return { ok: false as const, error: "That site is not open." };
  if (!(await mayFor(cap, { siteId, orgId: site.orgId }))) return { ok: false as const, error: REFUSALS[cap] ?? "This needs Short courses access at the course's site." };
  const actor = await currentActor();
  return { ok: true as const, actor: { id: actor.id, name: actor.name }, site: { id: site.id, name: site.name, orgId: site.orgId } };
}

export async function courseFor(id: string, cap: PermissionKey) {
  const course = await prisma.shortCourse.findFirst({ where: { id }, select: { id: true, siteId: true, capacity: true, status: true, cancelledAt: true, type: { select: { name: true, healthForm: true } } } });
  if (!course) return { ok: false as const, error: "That course no longer exists." };
  const at = await atSite(course.siteId, cap);
  if (!at.ok) return at;
  return { ...at, course };
}
