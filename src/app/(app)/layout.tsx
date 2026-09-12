import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { AppChrome } from "@/components/app-nav";
import { DevelopmentRolePreview } from "@/components/staff/development-role-preview";
import { permissionsOf } from "@/lib/authz";
import { getCurrentClub } from "@/lib/clubs/current";
import { homePathFor, visibleScreens, cleanScreens } from "@/lib/staff/screens";
import { NAV_COLLAPSED_COOKIE } from "@/lib/shell-preferences";

/** The signed-in grouped workspace. Authentication and screen access stay
 *  here; the client shell owns navigation, utilities and responsive layout. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  // Memoised per request, so the pages inside asking again cost nothing.
  const { club, clubs } = await getCurrentClub();

  const collapsed = (await cookies()).get(NAV_COLLAPSED_COOKIE)?.value === "1";

  return (
    <AppChrome
      userName={session.user.name ?? session.user.email ?? "Unknown"}
      userSubtitle={session.user.roleName}
      // The desk wordmark stays in this workspace, even for a dual-access
      // account whose sign-in landing page is Instructor.
      homeHref={homePathFor(session.user.home, session.user.permissions, cleanScreens(session.user.screens).filter(screen => screen !== "instructor"))}
      screens={visibleScreens(session.user.screens, permissionsOf(session))}
      club={club}
      clubs={clubs}
      initialCollapsed={collapsed}
      banner={<DevelopmentRolePreview session={session} />}
    >
      {children}
    </AppChrome>
  );
}
