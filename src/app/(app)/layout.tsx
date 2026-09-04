import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppFrame } from "@/components/ui-kit/app-shell";
import { AppMobileNav, AppSidebar } from "@/components/app-nav";
import { permissionsOf } from "@/lib/authz";
import { getCurrentClub } from "@/lib/clubs/current";
import { homePathFor, visibleScreens } from "@/lib/staff/screens";

/** The signed-in shell. Two greys and nothing else: a sidebar that stays put
 *  on desktop, a 48px bar that replaces it below `md`, and a centred content
 *  column. No top bar, no breadcrumb, no card around the page. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  // Memoised per request, so the pages inside asking again cost nothing.
  const { club, clubs } = await getCurrentClub();

  const nav = {
    userName: session.user.name ?? session.user.email ?? "Unknown",
    userSubtitle: session.user.roleName,
    // The wordmark goes where the role's day starts, same as the sign-in.
    homeHref: homePathFor(session.user.home, session.user.permissions, session.user.screens),
    screens: visibleScreens(session.user.screens, permissionsOf(session)),
    club,
    clubs,
  };

  return (
    <div className="flex min-h-svh">
      {/* Invisible until it has keyboard focus, then the first thing on the
          page: nine sidebar links stand between Tab and the content otherwise. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:ring-[3px] focus:ring-ring/50"
      >
        Skip to main content
      </a>
      <AppSidebar {...nav} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppMobileNav {...nav} />
        <AppFrame>{children}</AppFrame>
      </div>
    </div>
  );
}
