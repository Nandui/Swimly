"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { viewerOf } from "@/lib/home";
import { modulesFor } from "@/modules/context";
import { searchApps } from "@/modules/server";
import type { SearchHit } from "@/modules/contributions";

/** One search (D19; DESIGN.md, Search): the records behind a query, for the frame's search. People
 *  come from the platform, for those who manage staff (their names and job, linking to Admin ›
 *  Staff); everything else from the person's apps through `registerSearch`. Pages and apps are
 *  matched in the frame itself. Signed out, or under two letters, finds nothing. */
export async function searchEverything(query: string): Promise<SearchHit[]> {
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  const session = await auth();
  if (!session?.user) return [];
  const viewer = viewerOf(session.user);
  const people = viewer.permissions.includes("staff.manage") || viewer.isSuperadmin
    ? (await prisma.user.findMany({
        where: { isActive: true, orgId: session.user.orgId ?? undefined, name: { contains: q, mode: "insensitive" } },
        select: { id: true, name: true, staffRole: { select: { name: true } } },
        orderBy: { name: "asc" },
        take: 6,
      })).map((u) => ({ label: u.name, hint: u.staffRole?.name ? `Staff · ${u.staffRole.name}` : "Staff", href: `/staff/${encodeURIComponent(u.id)}` }))
    : [];
  const apps = await searchApps(q, modulesFor(session).map((m) => m.id), viewer);
  return [...people, ...apps];
}
