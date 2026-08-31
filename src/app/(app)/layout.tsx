import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppFrame } from "@/components/ui-kit/app-shell";
import { AppMobileNav, AppSidebar } from "@/components/app-nav";
import { permissionsOf } from "@/lib/authz";

/** The signed-in shell. Two greys and nothing else: a sidebar that stays put
 *  on desktop, a 48px bar that replaces it below `md`, and a centred content
 *  column. No top bar, no breadcrumb, no card around the page. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const nav = {
    userName: session.user.name ?? session.user.email ?? "Unknown",
    userSubtitle: session.user.roleName,
    permissions: permissionsOf(session),
  };

  return (
    <div className="flex min-h-svh">
      <AppSidebar {...nav} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppMobileNav {...nav} />
        <AppFrame>{children}</AppFrame>
      </div>
    </div>
  );
}
