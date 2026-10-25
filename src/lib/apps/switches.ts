import { cache } from "react";
import { operationContext } from "@/lib/operations/context";
import { appPermissions } from "@/modules/registry";

/** App switches (docs/architecture.md, App switches): for each organisation, every app is on
 *  everywhere, off, or on only at some sites. This file is the one place that answers "is this
 *  app on here?"; the session, menus, Home, plugs, events, front doors and API routes all ask it,
 *  so no app checks its own switch. It knows apps only by their manifest ids and names none.
 *
 *  No row means on everywhere. Only a superadmin changes a switch, from Admin › Apps
 *  (`src/lib/apps/actions.ts`), with an audit row. */

export type AppSwitchState = "on" | "off" | "sites";
export type AppSwitchSetting = { state: AppSwitchState; siteIds: readonly string[] };
/** Each app's setting, by app id. An app missing from it is on everywhere. */
export type AppSwitches = ReadonlyMap<string, AppSwitchSetting>;

export const APP_SWITCH_STATES: readonly AppSwitchState[] = ["on", "sites", "off"];

/** Where a question is about. With a site: is the app on at that site? Without one (a person's
 *  records, the whole organisation): is it on at any site? */
export type Where = { orgId?: string | null; siteId?: string | null };

/** The rule, pure. A stored state that is not one of the three reads as on, so a bad row can
 *  never switch an app off. */
export function switchedOn(setting: AppSwitchSetting | undefined, siteId: string | null | undefined): boolean {
  if (!setting) return true;
  if (setting.state === "off") return false;
  if (setting.state === "sites") return siteId ? setting.siteIds.includes(siteId) : setting.siteIds.length > 0;
  return true;
}

/** The switch in words, as Admin › Apps and the activity log say it. */
export function describeSwitch(state: AppSwitchState, siteNames: readonly string[]): string {
  if (state === "off") return "Off";
  if (state === "sites") return siteNames.length ? `On at ${siteNames.join(", ")} only` : "Off: no site chosen";
  return "On everywhere";
}

/** The apps that are off at this site (or, without one, off everywhere), by id. */
export function appsOffAt(switches: AppSwitches, siteId: string | null): string[] {
  return [...switches.keys()].filter((appId) => !switchedOn(switches.get(appId), siteId));
}

type Grant = { roleName: string; permissions: string[]; scopeKind: string; scopeId: string };
type SwitchableUser = { permissions: string[]; primaryPermissions?: string[]; grants?: Grant[] };

/** The session at the working site with the switches applied, pure: `appsOff` names the apps
 *  that are off here, and their permissions leave the flat permissions, what the role gives
 *  everywhere and the team grant. A grant at one site loses the apps that are off at *that*
 *  site. Each permission belongs to exactly one app, so nothing else is lost. `permissionsOf`
 *  and the policy engine remove the same apps from what an administrator or superadmin
 *  expands to, so pages, actions and menus all see the app as gone. */
export function withAppSwitches<U extends SwitchableUser>(user: U, switches: AppSwitches, siteId: string | null): U & { appsOff: string[] } {
  const appsOff = appsOffAt(switches, siteId);
  if (switches.size === 0) return { ...user, appsOff };
  const withheld = appPermissions(appsOff);
  const without = (keys: readonly string[], gone: ReadonlySet<string>) => keys.filter((key) => !gone.has(key));
  const grants = user.grants?.map((grant) => ({
    ...grant,
    permissions: without(grant.permissions, grant.scopeKind === "site" ? appPermissions(appsOffAt(switches, grant.scopeId)) : withheld),
  })).filter((grant) => grant.permissions.length > 0);
  return {
    ...user,
    appsOff,
    permissions: without(user.permissions, withheld),
    ...(user.primaryPermissions ? { primaryPermissions: without(user.primaryPermissions, withheld) } : {}),
    ...(grants ? { grants } : {}),
  };
}

const isState = (value: string): value is AppSwitchState => (APP_SWITCH_STATES as readonly string[]).includes(value);

/** The database, loaded when first asked: the session, menus and plugs import this file, and
 *  their tests load it with no database at all (no organisation then means every app on). */
const database = () => import("@/lib/prisma");

/** Read once per request. A failed read is logged and reads as "every app on": switches hide
 *  apps, they never secure them (permissions do), so an outage of this table must not take
 *  Turnfin down. */
const switchesOf = cache(async (orgId: string): Promise<AppSwitches> => {
  try {
    const { prisma } = await database();
    const rows = await prisma.appSwitch.findMany({ where: { orgId }, select: { appId: true, state: true, siteIds: true } });
    return new Map(rows.filter((row) => isState(row.state)).map((row) => [row.appId, { state: row.state as AppSwitchState, siteIds: row.siteIds }]));
  } catch (error) {
    console.error("App switches could not be read; every app stays on", error);
    return new Map();
  }
});

/** The first organisation: Turnfin runs one operator's sites today (as in Sign in with Google). */
const firstOrganisation = cache(async (): Promise<string | null> => {
  try {
    const { prisma } = await database();
    return (await prisma.organisation.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } }))?.id ?? null;
  } catch {
    return null;
  }
});

/** One organisation's switches; without one, the first organisation's. */
export async function appSwitchesOf(orgId: string | null | undefined): Promise<AppSwitches> {
  const id = orgId || await firstOrganisation();
  return id ? switchesOf(id) : new Map();
}

/** The organisation a question is about: the one named, else the signed-in person's (or a
 *  script's). Public APIs and nightly jobs have no person and use the first organisation. */
async function organisationOf(where: Where): Promise<string | null> {
  if (where.orgId) return where.orgId;
  const operation = operationContext.getStore()?.session.user.orgId;
  if (operation) return operation;
  const session = await import("@/auth").then((mod) => mod.auth()).catch(() => null);
  return session?.user.orgId ?? null;
}

/** Is this app on here? The one question everything asks. */
export async function appOn(appId: string, where: Where = {}): Promise<boolean> {
  const switches = await appSwitchesOf(await organisationOf(where));
  return switchedOn(switches.get(appId), where.siteId ?? null);
}

/** The ones among these sites (of one organisation) where an app is on. */
export async function sitesWhereOn(appId: string, siteIds: readonly string[], orgId?: string | null): Promise<string[]> {
  const switches = await appSwitchesOf(await organisationOf({ orgId }));
  return siteIds.filter((siteId) => switchedOn(switches.get(appId), siteId));
}

/** An app's API route (its route file in src/app/api): refused with "not available" while the
 *  app is off everywhere. A route a signed-in person calls is also refused site by site, because
 *  the session holds none of a switched-off app's permissions at the working site. */
export function appRoute<A extends unknown[]>(appId: string, handler: (...args: A) => Response | Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    if (!(await appOn(appId))) {
      return Response.json({ error: { code: "NOT_AVAILABLE", message: "That is not available." } }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    return handler(...args);
  };
}
