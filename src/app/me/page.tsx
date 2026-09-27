import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MyHub } from "@/components/my/my-hub";
import { pageSession } from "@/lib/page-guards";
import { receptionPortalAccess, staffPortalPath } from "@/lib/reception-portal";
import { modulesFor } from "@/modules/context";
import { loadMyHub } from "@/modules/my/hub";

export const metadata: Metadata = { title: { absolute: "My hub · Turnfin" } };

/** Everyone's front door: their own work from every module, and their apps.
 *  A role home such as the Reception Portal still opens first unless the
 *  person asks for the hub (`?view=me`). */
export default async function MyHubPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const session = await pageSession();
  const { view } = await searchParams;
  const landing = staffPortalPath(session.user.home, session.user.permissions, session.user.screens);
  if (view !== "me" && landing !== "/me") redirect(landing);
  const sections = await loadMyHub(session);
  return (
    <MyHub
      userName={session.user.name ?? "Staff member"}
      sections={sections}
      modules={modulesFor(session)}
      receptionAllowed={receptionPortalAccess(session.user.permissions, session.user.screens).available}
    />
  );
}
