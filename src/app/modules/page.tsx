import type { Metadata } from "next";
import { StaffPortal } from "@/components/portal/staff-portal";
import { pageSession } from "@/lib/page-guards";
import { PORTAL_NAME } from "@/lib/modules";

import { modulesFor } from "@/modules/context";
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
  return <StaffPortal modules={modulesFor(session)} receptionAllowed={receptionPortalAccess(session.user.permissions, session.user.screens).available} userName={session.user.name ?? "Staff member"} />;
}
