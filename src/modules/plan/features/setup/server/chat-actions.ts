"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { departmentsForSite } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import { requirePlanActor } from "@/modules/plan/shared/access";
import { chatConfig, chatSpaces } from "@/modules/plan/shared/chat";
import { mayManage, viewableSite } from "@/modules/plan/shared/scope";

/** Setup's Google Chat links, Manage only (D30): which Chat space a department's cover requests
 *  go to at a site. A space can be linked once Turnfin's Chat app has been added to it. */

const NOT_SET_UP = "Google Chat isn't set up for Turnfin yet.";
const NO_ANSWER = "Google Chat didn't answer. Try again in a moment.";

async function managedSite(siteId: string) {
  const who = await requirePlanActor();
  const site = await viewableSite(siteId);
  if (!site || !(await mayManage(site.id, site.orgId))) return null;
  return { who, site };
}

/** The spaces Turnfin's Chat app is in, for the link dialog. A read a client component calls, so
 *  it is a server action that still checks Manage at the site: the list comes from Google when
 *  the dialog opens, never with the page. */
export async function chatSpacesToLink(siteId: string): Promise<{ ok: true; spaces: { space: string; name: string }[] } | { ok: false; error: string }> {
  if (!(await managedSite(siteId))) return fail("Only someone who manages the plan here can link a space.");
  const config = chatConfig();
  if (!config) return fail(NOT_SET_UP);
  try {
    return { ok: true, spaces: await chatSpaces(config) };
  } catch (error) {
    console.error("Google Chat's spaces could not be listed", error);
    return fail(NO_ANSWER);
  }
}

/** Link a department at a site to a Chat space, or move it to another one. */
export async function linkChatSpace(input: { siteId: string; departmentId: string; space: string }): Promise<ActionResult> {
  const at = await managedSite(input.siteId);
  if (!at) return fail("Only someone who manages the plan here can link a space.");
  const { who, site } = at;
  const department = (await departmentsForSite(site.orgId, site.id)).find((d) => d.id === input.departmentId);
  if (!department) return fail("That department isn't at this site.");
  const config = chatConfig();
  if (!config) return fail(NOT_SET_UP);
  // Only a space the app is really in: its name comes from Google, never from the form.
  let space: { space: string; name: string } | undefined;
  try { space = (await chatSpaces(config)).find((s) => s.space === input.space); } catch { return fail(NO_ANSWER); }
  if (!space) return fail("Turnfin's Chat app isn't in that space. Add it to the space in Google Chat first.");
  await prisma.$transaction(async (tx) => {
    const key = { siteId_departmentId: { siteId: site.id, departmentId: department.id } };
    const before = await tx.planChatSpace.findUnique({ where: key });
    const row = await tx.planChatSpace.upsert({ where: key,
      create: { orgId: site.orgId, siteId: site.id, departmentId: department.id, space: space.space, name: space.name, linkedById: who.id, linkedByName: who.name },
      update: { space: space.space, name: space.name, linkedById: who.id, linkedByName: who.name } });
    await logAudit({ actorId: who.id, actorName: who.name, action: before ? "update" : "create", entity: "PlanChatSpace", entityId: row.id, clubId: site.id,
      summary: `Linked ${department.name} at ${site.name} to the Google Chat space ${space.name}` }, tx);
  });
  revalidatePath("/plan", "layout");
  return ok();
}

/** Unlink a department's space: nobody can be asked for it in Chat until one is linked again. */
export async function unlinkChatSpace(input: { siteId: string; departmentId: string }): Promise<ActionResult> {
  const at = await managedSite(input.siteId);
  if (!at) return fail("Only someone who manages the plan here can unlink a space.");
  const { who, site } = at;
  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.planChatSpace.findUnique({ where: { siteId_departmentId: { siteId: site.id, departmentId: input.departmentId } } });
    if (!row) return fail("That department has no space linked.");
    // Cards already posted would be left with buttons nobody is watching.
    const open = await tx.planCoverRequest.count({ where: { orgId: site.orgId, siteId: site.id, departmentId: input.departmentId, closedAt: null } });
    if (open) return fail(`Staff are still being asked to cover ${open === 1 ? "one gap" : `${open} gaps`} for this department. Choose someone or stop asking first.`);
    await tx.planChatSpace.delete({ where: { id: row.id } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "delete", entity: "PlanChatSpace", entityId: row.id, clubId: site.id,
      summary: `Unlinked the Google Chat space ${row.name || row.space} at ${site.name}` }, tx);
    return ok();
  });
  if (!result.ok) return result;
  revalidatePath("/plan", "layout");
  return ok();
}
