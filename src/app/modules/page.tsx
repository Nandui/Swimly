import type { Metadata } from "next";
import { StaffPortal } from "@/components/portal/staff-portal";
import { pageSession } from "@/lib/page-guards";
import { PORTAL_NAME } from "@/lib/modules";

import { canSee } from "@/lib/authz";
import { isAquaticsScreen, visibleScreens } from "@/lib/staff/screens";
import { expandPermissions } from "@/lib/staff/permissions";
import { redirect } from "next/navigation";
import { receptionPortalAccess, staffPortalPath } from "@/lib/reception-portal";

export const metadata: Metadata = {
  title: { absolute: PORTAL_NAME },
  icons: {
    icon: { url: "/brand/turnfin.png", type: "image/png" },
    apple: { url: "/brand/turnfin.png", type: "image/png" },
  },
};

export default async function ModulesPage({ searchParams }: PageProps<"/modules">) {
  const session = await pageSession();
  const query = await searchParams;
  const landing = staffPortalPath(session.user.home, session.user.permissions, session.user.screens);
  if (query.view !== "all" && landing !== "/modules") redirect(landing);
  const aquaticsAllowed = [...visibleScreens(session.user.screens, expandPermissions(session.user.permissions))].some(isAquaticsScreen);
  return <StaffPortal refundsAllowed={canSee(session, "refunds")} receptionAllowed={receptionPortalAccess(session.user.permissions, session.user.screens).available} docsAllowed={canSee(session, "docs")} aquaticsAllowed={aquaticsAllowed} userName={session.user.name ?? "Staff member"} />;
}
