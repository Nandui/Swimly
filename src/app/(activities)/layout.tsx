import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppChrome } from "@/modules/activities/components/app-nav";
import { permissionsOf } from "@/lib/authz";
import { getCurrentClub } from "@/lib/clubs/current";
import { visibleScreens } from "@/lib/staff/screens";
import "../workspace/module-workspace.css";
import "./swim-school.css";

/** The swim school desk in the shared module frame. Authentication and screen
 *  access stay here; the frame owns navigation and responsive layout. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  // Memoised per request, so the pages inside asking again cost nothing.
  const { club, clubs } = await getCurrentClub();

  return (
    <AppChrome
      who={{ id: session.user.id, name: session.user.name ?? session.user.email ?? "Unknown" }}
      screens={visibleScreens(permissionsOf(session))}
      club={club}
      clubs={clubs}
    >
      {children}
    </AppChrome>
  );
}
