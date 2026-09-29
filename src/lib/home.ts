import "server-only";
import { cookies } from "next/headers";
import { pageSession } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";
import { getCurrentClub } from "@/lib/clubs/current";
import { modulesFor } from "@/modules/context";
import { homeCardItems } from "@/modules/server";
import type { Session } from "next-auth";
import type { HomeViewer } from "@/modules/contributions";

/** Everything a role's home page shows (docs/how-turnfin-works.md): its name,
 *  the modules the role has, and each module's card lines for this person. */
export async function loadHome() {
  const session = await pageSession();
  const user = session.user;
  const [role, jar, site] = await Promise.all([
    prisma.staffRole.findUnique({ where: { id: user.roleId }, select: { name: true, homeName: true } }),
    cookies(),
    // The working site names "Today"; an organisation without sites just has no name here.
    getCurrentClub().then((current) => current.club.name, () => null),
  ]);
  const roleName = role?.name ?? user.roleName ?? "Staff";
  const moduleIds = modulesFor(session).map((m) => m.id);
  const items = await homeCardItems(moduleIds, viewerOf(session.user));
  return {
    who: { id: user.id, name: user.name ?? "Staff member" },
    roleName,
    homeName: role?.homeName || roleName,
    siteName: site,
    moduleIds,
    items,
    collapsed: jar.get("turnfin.home.sidebar")?.value === "collapsed",
    today: new Intl.DateTimeFormat("en-IE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Dublin" }).format(new Date()),
  };
}

function viewerOf(user: Session["user"]): HomeViewer {
  return {
    id: user.id,
    name: user.name ?? "Staff member",
    permissions: user.permissions ?? [],
    anywhere: [...(user.permissions ?? []), ...(user.grants ?? []).flatMap((grant) => grant.permissions)],
    isSuperadmin: user.isSuperadmin === true,
  };
}

/** One module's overview page: the same items it gives the home page, for the
 *  person looking, and the working site's name for "Today". */
export async function loadModuleOverview(moduleId: string) {
  const session = await pageSession();
  const [items, siteName] = await Promise.all([
    homeCardItems([moduleId], viewerOf(session.user)).then((all) => all.get(moduleId) ?? []),
    getCurrentClub().then((current) => current.club.name, () => null),
  ]);
  return { items, siteName };
}
