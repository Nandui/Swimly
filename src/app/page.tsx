import { redirect } from "next/navigation";
import { pageSession } from "@/lib/page-guards";
import { staffPortalPath } from "@/lib/reception-portal";

/** Work's front door: straight into the role's own home. */
export default async function HomePage() {
  const session = await pageSession();
  redirect(staffPortalPath(session.user.home, session.user.permissions, session.user.screens));
}
