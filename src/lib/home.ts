import "server-only";
import { cookies } from "next/headers";
import { pageSession } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";
import { modulesFor } from "@/modules/context";
import { homeCardItems } from "@/modules/server";

/** Everything a role's home page shows (docs/how-turnfin-works.md): its name,
 *  the modules the role has, and each module's card lines for this person. */
export async function loadHome() {
  const session = await pageSession();
  const user = session.user;
  const [role, jar] = await Promise.all([
    prisma.staffRole.findUnique({ where: { id: user.roleId }, select: { name: true, homeName: true } }),
    cookies(),
  ]);
  const roleName = role?.name ?? user.roleName ?? "Staff";
  const moduleIds = modulesFor(session).map((m) => m.id);
  const items = await homeCardItems(moduleIds, {
    id: user.id,
    name: user.name ?? "Staff member",
    permissions: user.permissions ?? [],
    screens: user.screens ?? [],
    anywhere: [...(user.permissions ?? []), ...(user.grants ?? []).flatMap((grant) => grant.permissions)],
    isSuperadmin: user.isSuperadmin === true,
  });
  return {
    who: { id: user.id, name: user.name ?? "Staff member" },
    roleName,
    homeName: role?.homeName || roleName,
    moduleIds,
    items,
    collapsed: jar.get("turnfin.home.sidebar")?.value === "collapsed",
    today: new Intl.DateTimeFormat("en-IE", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Dublin" }).format(new Date()),
  };
}
