import type { Metadata } from "next";
import { StaffPortal } from "@/components/portal/staff-portal";
import { pageSession } from "@/lib/page-guards";
import { PORTAL_NAME } from "@/lib/modules";

export const metadata: Metadata = {
  title: { absolute: PORTAL_NAME },
  icons: {
    icon: { url: "/brand/turnfin.png", type: "image/png" },
    apple: { url: "/brand/turnfin.png", type: "image/png" },
  },
};

export default async function ModulesPage() {
  const session = await pageSession();
  return <StaffPortal userName={session.user.name ?? "Staff member"} />;
}
