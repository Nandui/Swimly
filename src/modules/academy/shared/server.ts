import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { currentActor, mayFor } from "@/lib/policy/session";
import type { PermissionKey } from "@/lib/staff/permissions";

/** What the Academy's writes share (docs/academy.md): access at a course's site, the course
 *  itself, form parsing and the pages to refresh after a change. */

export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const optionalDate = z.string().trim().refine((v) => !v || isDateOnly(v), "Use a date like 2026-10-23.").default("");
export const clockOf = (value: string) => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export function refresh(courseId?: string) {
  revalidatePath("/academy");
  revalidatePath("/academy/calls");
  if (courseId) revalidatePath(`/academy/${courseId}`);
  revalidatePath("/rota");
  revalidatePath("/rota/today");
}

/** The signed-in person, if they hold `cap` at the course's site. */
export async function atSite(siteId: string, cap: PermissionKey) {
  const site = await prisma.club.findFirst({ where: { id: siteId, archivedAt: null }, select: { id: true, name: true, orgId: true } });
  if (!site?.orgId) return { ok: false as const, error: "That site is not open." };
  if (!(await mayFor(cap, { siteId, orgId: site.orgId }))) {
    return { ok: false as const, error: cap === "academy.manage" ? "Putting courses on at this site needs Academy Manage there."
      : cap === "academy.run" ? "Running courses at this site needs Academy Tutor there." : "This needs Academy access at the course's site." };
  }
  const actor = await currentActor();
  return { ok: true as const, actor: { id: actor.id, name: actor.name }, site: { id: site.id, name: site.name, orgId: site.orgId } };
}

export async function courseFor(id: string, cap: PermissionKey) {
  const course = await prisma.academyCourse.findFirst({ where: { id }, select: { id: true, siteId: true, capacity: true, status: true, cancelledAt: true, type: { select: { name: true } } } });
  if (!course) return { ok: false as const, error: "That course no longer exists." };
  const at = await atSite(course.siteId, cap);
  if (!at.ok) return at;
  return { ...at, course };
}
