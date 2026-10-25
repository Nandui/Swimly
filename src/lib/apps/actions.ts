"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { APP_SWITCH_STATES, describeSwitch, type AppSwitchState } from "@/lib/apps/switches";
import { switchableApps } from "@/modules/registry";

/** Switch an app on everywhere, off, or on only at some sites, for the superadmin's organisation
 *  (docs/architecture.md, App switches). Superadmins only: the flag, never a permission, so no
 *  role can give it. The switch and its audit row are written together. */
const switchSchema = z.object({
  appId: z.string().min(1).max(64),
  state: z.enum(APP_SWITCH_STATES as [AppSwitchState, ...AppSwitchState[]], { error: "Choose on, off or some sites." }),
  siteIds: z.array(z.string().min(1).max(64)).max(50),
});
export type AppSwitchInput = z.infer<typeof switchSchema>;

export async function setAppSwitch(input: AppSwitchInput): Promise<ActionResult> {
  const session = await requireSession();
  if (!session.user.isSuperadmin) return fail("Only a superadmin can switch apps on or off.");
  const parsed = switchSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { appId, state } = parsed.data;
  const app = switchableApps().find((m) => m.id === appId);
  if (!app) return fail("That app no longer exists.");
  const orgId = session.user.orgId;
  if (!orgId) return fail("Your account belongs to no organisation.");
  const wanted = state === "sites" ? [...new Set(parsed.data.siteIds)].sort() : [];
  if (state === "sites" && wanted.length === 0) return fail("Tick at least one site, or switch the app off.");

  const result = await prisma.$transaction(async (tx) => {
    const sites = await tx.club.findMany({ where: { id: { in: wanted }, orgId, archivedAt: null }, select: { id: true, name: true } });
    if (sites.length !== wanted.length) return fail("Choose from your sites.");
    const existing = await tx.appSwitch.findUnique({ where: { orgId_appId: { orgId, appId } }, select: { state: true, siteIds: true } });
    const was = (existing?.state ?? "on") as AppSwitchState;
    if (was === state && [...(existing?.siteIds ?? [])].sort().join() === wanted.join()) return ok();
    const row = await tx.appSwitch.upsert({
      where: { orgId_appId: { orgId, appId } },
      create: { orgId, appId, state, siteIds: wanted, updatedById: session.user.id },
      update: { state, siteIds: wanted, updatedById: session.user.id },
      select: { id: true },
    });
    const wasSites = was === "sites"
      ? (await tx.club.findMany({ where: { id: { in: existing?.siteIds ?? [] } }, select: { name: true } })).map((s) => s.name).sort()
      : [];
    await logAudit({
      actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: "update",
      entity: "AppSwitch", entityId: row.id, clubId: null,
      summary: `${app.name}: ${describeSwitch(state, sites.map((s) => s.name).sort())} (was ${describeSwitch(was, wasSites)})`,
      details: { appId, state, siteIds: wanted, was: { state: was, siteIds: existing?.siteIds ?? [] } },
    }, tx);
    return ok();
  });
  // Menus, Home and every page follow the switch.
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
