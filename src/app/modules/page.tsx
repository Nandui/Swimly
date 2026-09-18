import type { Metadata } from "next";
import { StaffPortal } from "@/components/portal/staff-portal";
import { pageSession } from "@/lib/page-guards";
import { PORTAL_NAME } from "@/lib/modules";

import { canSee } from "@/lib/authz";
import { visibleScreens } from "@/lib/staff/screens";
import { expandPermissions } from "@/lib/staff/permissions";

export const metadata: Metadata = {
  title: { absolute: PORTAL_NAME },
  icons: {
    icon: { url: "/brand/turnfin.png", type: "image/png" },
    apple: { url: "/brand/turnfin.png", type: "image/png" },
  },
};

export default async function ModulesPage() {
  const session = await pageSession();
  const aquaticsAllowed = [...visibleScreens(session.user.screens, expandPermissions(session.user.permissions))].some(key => key !== "docs");
  return <StaffPortal docsAllowed={canSee(session, "docs")} aquaticsAllowed={aquaticsAllowed} userName={session.user.name ?? "Staff member"} />;
}
