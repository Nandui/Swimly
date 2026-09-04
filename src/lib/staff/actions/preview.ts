"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { PREVIEW_COOKIE, mayPreview, previewAllowed } from "@/lib/staff/preview";

/** Start or stop seeing the app as another role. Not audited: it changes
 *  what one person sees on one device, and no data. Lands on `/start`, so
 *  the previewed role's own first screen is what comes up. */
export async function previewRole(roleId: string | null): Promise<ActionResult> {
  if (!previewAllowed()) return fail("Previewing a role is only available on a dev build.");

  const session = await requireSession();
  // The session may already be wearing a preview; the check is against what
  // the real account holds.
  const actual = session.user.preview?.actualPermissions ?? session.user.permissions;
  if (!mayPreview(actual)) return fail("Only someone who manages roles can preview one.");

  const jar = await cookies();
  if (roleId === null) {
    jar.delete(PREVIEW_COOKIE);
  } else {
    const role = await prisma.staffRole.findUnique({ where: { id: roleId }, select: { id: true } });
    if (!role) return fail("That role no longer exists.");
    jar.set(PREVIEW_COOKIE, role.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
      secure: process.env.NODE_ENV === "production",
    });
  }

  revalidatePath("/", "layout");
  redirect("/start");
  return ok();
}
